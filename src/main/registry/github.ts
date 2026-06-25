import type {
  AssetFile,
  GithubDiscoverItem,
  GithubDiscoverResult,
  GithubSourceConfig
} from '@shared/types'
import { parseAssetFile } from '@shared/assetFormat'
import type { Repository } from '../store/repository'
import { httpFetch as fetch } from '../net'
import { loadSettings } from '../store/config'

/**
 * Phase 2 Discover: list Skills / Agents from trusted GitHub repos (built-in
 * recommendations + user-added custom repos) and import them as editable assets.
 * One Git-Trees request lists an entire repo (cached); raw.githubusercontent.com
 * downloads don't count against the API rate limit.
 */
interface Source {
  repo: string
  kind: 'skill' | 'agent'
  match: RegExp
  exclude?: RegExp
  title: (path: string) => string
  category: (path: string) => string
}

const base = (p: string): string => p.split('/').pop()!.replace(/\.md$/i, '')
const seg = (p: string, i: number): string => p.split('/')[i] ?? ''
const skillName = (p: string): string => p.split('/').slice(-2, -1)[0] ?? base(p)

const BUILTIN: Source[] = [
  {
    repo: 'wshobson/agents',
    kind: 'skill',
    match: /^plugins\/[^/]+\/skills\/[^/]+\/SKILL\.md$/i,
    title: skillName,
    category: (p) => seg(p, 1)
  },
  {
    repo: 'VoltAgent/awesome-claude-code-subagents',
    kind: 'agent',
    match: /^categories\/[^/]+\/[^/]+\.md$/i,
    exclude: /README/i,
    title: base,
    category: (p) => seg(p, 1).replace(/^\d+-/, '')
  },
  {
    repo: 'wshobson/agents',
    kind: 'agent',
    match: /^plugins\/[^/]+\/agents\/[^/]+\.md$/i,
    title: base,
    category: (p) => seg(p, 1)
  }
]

/** Convert a simple glob into an anchored regex (char-by-char; `**`+slash = any dirs). */
function globToRegex(glob: string): RegExp {
  let re = ''
  let i = 0
  while (i < glob.length) {
    if (glob.startsWith('**/', i)) {
      re += '(?:.*/)?'
      i += 3
    } else if (glob.startsWith('**', i)) {
      re += '.*'
      i += 2
    } else if (glob[i] === '*') {
      re += '[^/]*'
      i += 1
    } else {
      re += glob[i].replace(/[.+^${}()|[\]\\]/, '\\$&')
      i += 1
    }
  }
  return new RegExp(`^${re}$`, 'i')
}

/** Build a Source for a user-added repo, with sensible per-kind defaults. */
function customSource(c: GithubSourceConfig): Source {
  const glob = c.glob?.trim() || (c.kind === 'skill' ? '**/SKILL.md' : '**/agents/**/*.md')
  return {
    repo: c.repo,
    kind: c.kind,
    match: globToRegex(glob),
    exclude: /(^|\/)(README|LICENSE|CONTRIBUTING|CHANGELOG|CODE_OF_CONDUCT)/i,
    title: (p) => (/SKILL\.md$/i.test(p) ? skillName(p) : base(p)),
    category: (p) => {
      const parts = p.split('/')
      return parts.length > 1 ? parts[parts.length - 2].replace(/^\d+-/, '') : c.repo.split('/')[1]
    }
  }
}

function sourcesFor(kind: 'skill' | 'agent'): Source[] {
  const custom = (loadSettings().githubSources ?? [])
    .filter((c) => c.kind === kind && c.repo.includes('/'))
    .map(customSource)
  return [...BUILTIN.filter((s) => s.kind === kind), ...custom]
}

const TTL_MS = 60 * 60 * 1000
const branchCache = new Map<string, { at: number; branch: string }>()
const treeCache = new Map<string, { at: number; paths: string[] }>()

export async function defaultBranch(repo: string): Promise<string> {
  const hit = branchCache.get(repo)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.branch
  const res = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const data = (await res.json()) as { default_branch?: string }
  const branch = data.default_branch || 'main'
  branchCache.set(repo, { at: Date.now(), branch })
  return branch
}

export async function treePaths(repo: string, branch: string): Promise<string[]> {
  const key = `${repo}@${branch}`
  const hit = treeCache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.paths
  const res = await fetch(`https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`, {
    headers: { Accept: 'application/vnd.github+json' }
  })
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const data = (await res.json()) as { tree?: Array<{ path: string; type: string }> }
  const paths = (data.tree ?? []).filter((x) => x.type === 'blob').map((x) => x.path)
  treeCache.set(key, { at: Date.now(), paths })
  return paths
}

function importedSources(lib: Repository, kind: 'skill' | 'agent'): Set<string> {
  return new Set(
    lib
      .listAssets(kind)
      .map((a) => a.meta?.source)
      .filter((v): v is string => !!v)
  )
}

export async function listGithub(
  lib: Repository,
  kind: 'skill' | 'agent'
): Promise<GithubDiscoverResult> {
  const imported = importedSources(lib, kind)
  const seen = new Set<string>()
  const items: GithubDiscoverItem[] = []
  let error: string | undefined
  for (const s of sourcesFor(kind)) {
    try {
      const branch = await defaultBranch(s.repo)
      const paths = await treePaths(s.repo, branch)
      for (const p of paths) {
        if (!s.match.test(p) || (s.exclude && s.exclude.test(p))) continue
        const id = `github:${s.repo}@${p}`
        if (seen.has(id)) continue
        seen.add(id)
        items.push({
          id,
          title: s.title(p),
          category: s.category(p),
          repo: s.repo,
          branch,
          path: p,
          kind,
          imported: imported.has(id)
        })
      }
    } catch (e) {
      // one bad source (e.g. a wrong custom repo) shouldn't break the rest
      error = e instanceof Error ? `${s.repo}: ${e.message}` : String(e)
    }
  }
  items.sort((a, b) => a.title.localeCompare(b.title))
  return { items, error: items.length === 0 ? error : undefined }
}

function rawUrl(repo: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${path}`
}

export async function importGithub(
  lib: Repository,
  item: GithubDiscoverItem
): Promise<{ id: string; duplicate: boolean }> {
  const existing = lib.listAssets(item.kind).find((a) => a.meta?.source === item.id)
  if (existing) return { id: existing.id, duplicate: true }

  const res = await fetch(rawUrl(item.repo, item.branch, item.path))
  if (!res.ok) throw new Error(`GitHub ${res.status}`)
  const text = await res.text()
  const input = parseAssetFile(item.kind, text, item.title)[0]
  if (!input) throw new Error('解析失败')
  input.meta = { ...(input.meta ?? {}), source: item.id, sourceRepo: item.repo }
  input.tags = [...(input.tags ?? []), `${item.kind}-registry`]

  // Bundle sibling files alongside a skill's SKILL.md (scripts, references).
  if (item.kind === 'skill') {
    const folder = item.path.replace(/SKILL\.md$/i, '')
    const siblings = (treeCache.get(`${item.repo}@${item.branch}`)?.paths ?? []).filter(
      (p) => p.startsWith(folder) && p !== item.path
    )
    const files: AssetFile[] = []
    for (const sp of siblings.slice(0, 20)) {
      const r = await fetch(rawUrl(item.repo, item.branch, sp))
      if (r.ok) files.push({ path: sp.slice(folder.length), content: await r.text() })
    }
    if (files.length) input.files = files
  }

  const asset = lib.createAsset(input)
  return { id: asset.id, duplicate: false }
}
