import type {
  PromptDiscoverItem,
  PromptDiscoverResult,
  PromptSource
} from '@shared/types'
import type { Repository } from '../store/repository'
import { httpFetch as fetch } from '../net'
import { loadSettings } from '../store/config'
import { defaultBranch, treePaths } from './github'

/**
 * Prompt Discover. Two kinds of source:
 *  - file: a single CSV (act,prompt columns) or JSON array of {act,prompt}, e.g.
 *    awesome-chatgpt-prompts. Built-in EN + ZH; users add their own raw URLs.
 *  - repo: a GitHub repo whose markdown/txt files each become one prompt (lists
 *    via one Git-Trees request; raw content fetched lazily on import). Built-in
 *    coding sources: AI-tool system prompts, Cursor rules, Copilot instructions.
 */
interface FileSource {
  kind: 'file'
  id: string
  label: string
  url: string
  format: 'csv' | 'json'
}

interface RepoSource {
  kind: 'repo'
  id: string
  label: string
  repo: string
  match: RegExp
  exclude?: RegExp
  title: (path: string) => string
  category: (path: string) => string
}

type ResolvedSource = FileSource | RepoSource

const base = (p: string): string => p.split('/').pop()!.replace(/\.[^.]+$/, '')
const GENERIC = /^(prompt|prompts|system prompt|default prompt|agent prompt)$/i

/** System-prompts repo: tool folder + file; fall back to folder when file is generic. */
function sysTitle(p: string): string {
  const parts = p.replace(/\.[^.]+$/, '').split('/')
  const file = parts[parts.length - 1]
  if (parts.length > 1 && GENERIC.test(file)) return parts.slice(0, -1).join(' / ')
  return parts.length > 1 ? `${parts[0]} · ${file}` : file
}

const prettify = (s: string): string => s.replace(/[-_]+/g, ' ').trim()

const BUILTIN: ResolvedSource[] = [
  {
    kind: 'file',
    id: 'awesome-en',
    label: 'Awesome ChatGPT Prompts (EN)',
    url: 'https://raw.githubusercontent.com/f/awesome-chatgpt-prompts/master/prompts.csv',
    format: 'csv'
  },
  {
    kind: 'file',
    id: 'awesome-zh',
    label: 'ChatGPT 中文调教指南 (ZH)',
    url: 'https://raw.githubusercontent.com/PlexPt/awesome-chatgpt-prompts-zh/main/prompts-zh.json',
    format: 'json'
  },
  {
    kind: 'repo',
    id: 'ai-tool-system-prompts',
    label: 'AI 工具系统提示词 (EN)',
    repo: 'x1xhlol/system-prompts-and-models-of-ai-tools',
    match: /\.(txt|md)$/i,
    exclude: /(^|\/)(README|LICENSE|CONTRIBUTING|SECURITY|CODE_OF_CONDUCT)|(^|\/)\.github\//i,
    title: sysTitle,
    category: (p) => p.split('/')[0]
  },
  {
    kind: 'repo',
    id: 'cursor-rules',
    label: 'Cursor Rules',
    repo: 'PatrickJS/awesome-cursorrules',
    match: /^rules\/.+\.mdc$/i,
    title: (p) => prettify(base(p).replace(/-?cursorrules-prompt-file$/i, '').replace(/-?prompt-file$/i, '')),
    category: () => 'Cursor Rules'
  },
  {
    kind: 'repo',
    id: 'copilot-instructions',
    label: 'GitHub Copilot 指令 (EN)',
    repo: 'github/awesome-copilot',
    match: /^instructions\/.+\.instructions\.md$/i,
    title: (p) => prettify(base(p).replace(/\.instructions$/i, '')),
    category: () => 'Copilot'
  }
]

const customId = (url: string): string => `custom:${url}`

function resolve(sourceId: string): ResolvedSource | null {
  const builtin = BUILTIN.find((s) => s.id === sourceId)
  if (builtin) return builtin
  const custom = (loadSettings().promptSources ?? []).find((c) => customId(c.url) === sourceId)
  if (custom) {
    return {
      kind: 'file',
      id: customId(custom.url),
      label: custom.name || custom.url,
      url: custom.url,
      format: custom.format
    }
  }
  return null
}

/** The merged source list shown in the Discover dropdown. */
export function promptSources(): PromptSource[] {
  const custom = (loadSettings().promptSources ?? []).map((c) => ({
    id: customId(c.url),
    label: c.name || c.url,
    builtin: false
  }))
  return [...BUILTIN.map((s) => ({ id: s.id, label: s.label, builtin: true })), ...custom]
}

/** Minimal RFC-4180 CSV tokenizer: handles quotes, escaped "", CRLF, embedded newlines. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      field += c
      i++
      continue
    }
    if (c === '"') {
      inQuotes = true
      i++
    } else if (c === ',') {
      row.push(field)
      field = ''
      i++
    } else if (c === '\r') {
      i++
    } else if (c === '\n') {
      row.push(field)
      rows.push(row)
      row = []
      field = ''
      i++
    } else {
      field += c
      i++
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** Parse a CSV with act,prompt columns (falls back to first two columns). */
function parseCsv(text: string): Array<{ act: string; prompt: string }> {
  const rows = parseCsvRows(text)
  if (rows.length === 0) return []
  const header = rows[0].map((h) => h.trim().toLowerCase())
  const ai = header.indexOf('act')
  const pi = header.indexOf('prompt')
  const actIdx = ai === -1 ? 0 : ai
  const promptIdx = pi === -1 ? 1 : pi
  const out: Array<{ act: string; prompt: string }> = []
  for (let r = 1; r < rows.length; r++) {
    const act = (rows[r][actIdx] ?? '').trim()
    const prompt = (rows[r][promptIdx] ?? '').trim()
    if (act && prompt) out.push({ act, prompt })
  }
  return out
}

/** Parse a JSON array of {act,prompt} (also accepts title/content, name/text). */
function parseJson(text: string): Array<{ act: string; prompt: string }> {
  const data = JSON.parse(text) as unknown
  if (!Array.isArray(data)) return []
  const out: Array<{ act: string; prompt: string }> = []
  for (const it of data) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const act = String(o.act ?? o.title ?? o.name ?? '').trim()
    const prompt = String(o.prompt ?? o.content ?? o.text ?? '').trim()
    if (act && prompt) out.push({ act, prompt })
  }
  return out
}

const norm = (s: string): string => s.trim().toLowerCase()

function existingTitles(lib: Repository): Set<string> {
  return new Set(lib.listPrompts().map((p) => norm(p.title)))
}

async function listFile(src: FileSource, have: Set<string>): Promise<PromptDiscoverItem[]> {
  const res = await fetch(src.url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const text = await res.text()
  const rows = src.format === 'csv' ? parseCsv(text) : parseJson(text)
  const seen = new Set<string>()
  const items: PromptDiscoverItem[] = []
  rows.forEach((r, idx) => {
    const key = norm(r.act)
    if (seen.has(key)) return
    seen.add(key)
    items.push({
      id: `promptsrc:${src.id}@${idx}`,
      title: r.act,
      content: r.prompt,
      source: src.label,
      imported: have.has(key)
    })
  })
  return items
}

async function listRepo(src: RepoSource, have: Set<string>): Promise<PromptDiscoverItem[]> {
  const branch = await defaultBranch(src.repo)
  const paths = await treePaths(src.repo, branch)
  const seen = new Set<string>()
  const items: PromptDiscoverItem[] = []
  for (const p of paths) {
    if (!src.match.test(p) || (src.exclude && src.exclude.test(p))) continue
    const title = src.title(p)
    const key = norm(title)
    if (!title || seen.has(key)) continue
    seen.add(key)
    items.push({
      id: `promptsrc:${src.id}@${p}`,
      title,
      content: '',
      source: src.label,
      subtitle: src.category(p),
      imported: have.has(key),
      repo: src.repo,
      branch,
      path: p
    })
  }
  items.sort((a, b) => a.title.localeCompare(b.title))
  return items
}

export async function listPrompts(lib: Repository, sourceId: string): Promise<PromptDiscoverResult> {
  const src = resolve(sourceId)
  if (!src) return { items: [], error: '未知来源' }
  try {
    const have = existingTitles(lib)
    const items = src.kind === 'file' ? await listFile(src, have) : await listRepo(src, have)
    return { items }
  } catch (e) {
    return { items: [], error: e instanceof Error ? e.message : String(e) }
  }
}

function rawUrl(repo: string, branch: string, path: string): string {
  return `https://raw.githubusercontent.com/${repo}/${branch}/${encodeURI(path)}`
}

export async function importPrompt(
  lib: Repository,
  item: PromptDiscoverItem
): Promise<{ id: string; duplicate: boolean }> {
  const key = norm(item.title)
  const existing = lib.listPrompts().find((p) => norm(p.title) === key)
  if (existing) return { id: existing.id, duplicate: true }

  let content = item.content
  if (!content && item.repo && item.branch && item.path) {
    const res = await fetch(rawUrl(item.repo, item.branch, item.path))
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    content = await res.text()
  }

  const created = lib.createPrompt({
    title: item.title,
    content,
    tags: ['prompt-registry']
  })
  return { id: created.id, duplicate: false }
}
