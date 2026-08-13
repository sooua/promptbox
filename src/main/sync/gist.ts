import type { SyncVersion } from '@shared/types'
import type { ConnectionResult, SyncProvider } from './provider'
import { httpFetch as fetch } from '../net'

const API = 'https://api.github.com'
const FILE = 'promptbox-data.json'

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'PromptBox',
    'X-GitHub-Api-Version': '2022-11-28'
  }
}

/** Verify a token and return the associated GitHub account login. */
export async function testGistToken(token: string): Promise<ConnectionResult> {
  try {
    const res = await fetch(`${API}/user`, { headers: headers(token) })
    if (!res.ok) return { ok: false, error: `GitHub 返回 ${res.status}` }
    const json = (await res.json()) as { login?: string }
    return { ok: true, account: json.login }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) }
  }
}

interface GistOptions {
  token: string
  gistId?: string
  /** called when a brand-new gist is created so its id can be persisted */
  onGistId(id: string): void
}

interface GistFile {
  content?: string
  truncated?: boolean
  raw_url?: string
}

export class GistProvider implements SyncProvider {
  constructor(private opts: GistOptions) {}

  /**
   * A second device has the token but not the gist id (only the creating device
   * persisted it). Before creating a new gist — which would fork sync into two
   * never-converging gists — list this account's gists and adopt the existing
   * PromptBox one, matched by its data filename.
   * ponytail: scans first 100 gists (one page); paginate if a user has more.
   */
  private async resolveGistId(): Promise<string | null> {
    if (this.opts.gistId) return this.opts.gistId
    const res = await fetch(`${API}/gists?per_page=100`, { headers: headers(this.opts.token) })
    if (!res.ok) return null
    const list = (await res.json()) as Array<{
      id: string
      created_at?: string
      files?: Record<string, unknown>
    }>
    // If a duplicate was already forked, adopt the earliest-created one (the
    // original) so every device converges on the same gist deterministically.
    const found = list
      .filter((g) => g.files && FILE in g.files)
      .sort((a, b) => Date.parse(a.created_at ?? '') - Date.parse(b.created_at ?? ''))[0]
    if (found) {
      this.opts.gistId = found.id
      this.opts.onGistId(found.id)
      return found.id
    }
    return null
  }

  private async readFile(file: GistFile | undefined): Promise<string | null> {
    if (!file) return null
    const content =
      file.truncated && file.raw_url
        ? await (await fetch(file.raw_url, { headers: headers(this.opts.token) })).text()
        : (file.content ?? '')
    return content || null
  }

  async pull(): Promise<string | null> {
    const gistId = await this.resolveGistId()
    if (!gistId) return null
    const res = await fetch(`${API}/gists/${gistId}`, {
      headers: headers(this.opts.token)
    })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`拉取失败（${res.status}）`)
    const json = (await res.json()) as { files?: Record<string, GistFile> }
    return this.readFile(json.files?.[FILE])
  }

  async push(payload: string): Promise<void> {
    const body = JSON.stringify({
      description: 'PromptBox 同步数据',
      public: false,
      files: { [FILE]: { content: payload } }
    })
    const gistId = await this.resolveGistId()
    if (gistId) {
      const res = await fetch(`${API}/gists/${gistId}`, {
        method: 'PATCH',
        headers: headers(this.opts.token),
        body
      })
      if (!res.ok) throw new Error(`推送失败（${res.status}）`)
    } else {
      const res = await fetch(`${API}/gists`, {
        method: 'POST',
        headers: headers(this.opts.token),
        body
      })
      if (!res.ok) throw new Error(`创建失败（${res.status}）`)
      const json = (await res.json()) as { id: string }
      this.opts.gistId = json.id
      this.opts.onGistId(json.id)
    }
  }

  async listVersions(): Promise<SyncVersion[]> {
    if (!this.opts.gistId) return []
    const res = await fetch(`${API}/gists/${this.opts.gistId}/commits`, {
      headers: headers(this.opts.token)
    })
    if (!res.ok) return []
    const json = (await res.json()) as Array<{
      version: string
      committed_at: string
      user?: { login?: string }
    }>
    return json.map((c) => ({
      id: c.version,
      createdAt: Date.parse(c.committed_at),
      label: c.user?.login
    }))
  }

  async getVersion(id: string): Promise<string | null> {
    if (!this.opts.gistId) return null
    const res = await fetch(`${API}/gists/${this.opts.gistId}/${id}`, {
      headers: headers(this.opts.token)
    })
    if (!res.ok) return null
    const json = (await res.json()) as { files?: Record<string, GistFile> }
    return this.readFile(json.files?.[FILE])
  }
}
