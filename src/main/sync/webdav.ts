import type { SyncVersion, WebDavConfigInput } from '@shared/types'
import type { ConnectionResult, SyncProvider } from './provider'

const FILE = 'promptbox-data.json'
const HISTORY_DIR = 'history'
const MAX_HISTORY = 30

function authHeader(username: string, password: string): string {
  return 'Basic ' + Buffer.from(`${username}:${password}`).toString('base64')
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

/** Verify credentials by issuing a depth-0 PROPFIND on the base collection. */
export async function testWebDav(cfg: WebDavConfigInput): Promise<ConnectionResult> {
  try {
    const res = await fetch(base(cfg.url), {
      method: 'PROPFIND',
      headers: { Authorization: authHeader(cfg.username, cfg.password), Depth: '0' }
    })
    if (res.status === 401 || res.status === 403) return { ok: false, error: '认证失败' }
    if (res.status >= 500) return { ok: false, error: `服务器错误（${res.status}）` }
    return { ok: true, account: `${cfg.username}@${new URL(cfg.url).host}` }
  } catch (e) {
    return { ok: false, error: errMsg(e) }
  }
}

function base(url: string): string {
  return url.replace(/\/+$/, '')
}

export class WebDavProvider implements SyncProvider {
  constructor(private cfg: WebDavConfigInput) {}

  private headers(extra?: Record<string, string>): Record<string, string> {
    return { Authorization: authHeader(this.cfg.username, this.cfg.password), ...extra }
  }
  private fileUrl(): string {
    return `${base(this.cfg.url)}/${FILE}`
  }
  private historyDirUrl(): string {
    return `${base(this.cfg.url)}/${HISTORY_DIR}/`
  }
  private historyUrl(name: string): string {
    return `${base(this.cfg.url)}/${HISTORY_DIR}/${name}`
  }

  async pull(): Promise<string | null> {
    const res = await fetch(this.fileUrl(), { headers: this.headers() })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`拉取失败（${res.status}）`)
    const text = await res.text()
    return text || null
  }

  async push(payload: string): Promise<void> {
    const res = await fetch(this.fileUrl(), {
      method: 'PUT',
      headers: this.headers({ 'Content-Type': 'application/json' }),
      body: payload
    })
    if (!res.ok && res.status !== 201 && res.status !== 204) {
      throw new Error(`推送失败（${res.status}）`)
    }
    // best-effort history snapshot
    try {
      await fetch(this.historyDirUrl(), { method: 'MKCOL', headers: this.headers() }).catch(() => {})
      await fetch(this.historyUrl(`${Date.now()}.json`), {
        method: 'PUT',
        headers: this.headers({ 'Content-Type': 'application/json' }),
        body: payload
      })
      await this.prune()
    } catch {
      /* history is non-critical */
    }
  }

  async listVersions(): Promise<SyncVersion[]> {
    const res = await fetch(this.historyDirUrl(), {
      method: 'PROPFIND',
      headers: this.headers({ Depth: '1' })
    })
    if (!res.ok && res.status !== 207) return []
    const xml = await res.text()
    const hrefs = [...xml.matchAll(/<[^>]*href>([^<]+)<\/[^>]*href>/gi)].map((m) =>
      decodeURIComponent(m[1])
    )
    return hrefs
      .map((h) => h.split('/').pop() ?? '')
      .filter((n) => /^\d+\.json$/.test(n))
      .map((n) => ({ id: n, createdAt: parseInt(n, 10) }))
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  async getVersion(id: string): Promise<string | null> {
    const res = await fetch(this.historyUrl(id), { headers: this.headers() })
    if (!res.ok) return null
    const text = await res.text()
    return text || null
  }

  private async prune(): Promise<void> {
    const versions = await this.listVersions()
    for (const v of versions.slice(MAX_HISTORY)) {
      await fetch(this.historyUrl(v.id), { method: 'DELETE', headers: this.headers() }).catch(
        () => {}
      )
    }
  }
}
