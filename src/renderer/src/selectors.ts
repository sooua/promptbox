import type { Asset, AssetKind, Category, Prompt } from '@shared/types'
import type { CategoryFilter } from './store'
import { pinyinMatch } from './pinyin'
import { assetMatches, assetSearchKey, promptMatches, promptSearchKey } from './searchIndex'

export function filterAssets(
  assets: Asset[],
  kind: AssetKind,
  opts: { search: string; favOnly: boolean; categoryId?: string | null }
): Asset[] {
  const q = opts.search.trim().toLowerCase()
  return assets
    .filter((a) => {
      if (a.kind !== kind) return false
      if (opts.favOnly && !a.favorite) return false
      if (opts.categoryId && a.categoryId !== opts.categoryId) return false
      // indexed match: precomputed literal + pinyin blob, scanned once per item
      if (q && !assetMatches(a, q)) return false
      return true
    })
    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt)
}

const SPECIAL = ['all', 'favorites', 'uncategorized', 'recent', 'frequent']

export function filterPrompts(
  prompts: Prompt[],
  opts: { categoryFilter: CategoryFilter; tagFilters: string[]; search: string }
): Prompt[] {
  const q = opts.search.trim().toLowerCase()
  const f = opts.categoryFilter

  const matched = prompts.filter((p) => {
    if (f === 'favorites' && !p.favorite) return false
    if (f === 'uncategorized' && p.categoryId) return false
    if (f === 'recent' && !p.lastUsedAt) return false
    if (f === 'frequent' && (p.useCount ?? 0) === 0) return false
    if (!SPECIAL.includes(f) && p.categoryId !== f) return false
    // every active tag must be present (AND combination)
    if (opts.tagFilters.length && !opts.tagFilters.every((t) => p.tags.includes(t))) {
      return false
    }
    // indexed match: precomputed literal + pinyin blob, scanned once per item
    if (q && !promptMatches(p, q)) return false
    return true
  })

  return sortPrompts(matched, f)
}

/**
 * Pinned prompts always float to the top. Within each group, "最近使用"/"最常用"
 * get their own ordering; everything else sorts by last edit.
 */
function sortPrompts(prompts: Prompt[], f: CategoryFilter): Prompt[] {
  const within = (a: Prompt, b: Prompt): number => {
    if (f === 'recent') return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
    if (f === 'frequent') {
      return (b.useCount ?? 0) - (a.useCount ?? 0) || (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
    }
    return b.updatedAt - a.updatedAt
  }
  return [...prompts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return within(a, b)
  })
}

export type CommandEntry =
  | { type: 'prompt'; id: string; prompt: Prompt }
  | { type: 'asset'; id: string; asset: Asset }

/**
 * Unified command-palette ranking over prompts AND assets. Text match (literal
 * + pinyin) drives relevance; usage/recency/favorite break ties so the things
 * you reach for most surface first (and with an empty query too).
 */
export function rankCommand(prompts: Prompt[], assets: Asset[], query: string): CommandEntry[] {
  const q = query.trim().toLowerCase()
  const scored: { entry: CommandEntry; score: number }[] = []

  for (const p of prompts) {
    const text = entryScore(
      q,
      p.title,
      `${p.description ?? ''} ${p.tags.join(' ')}`,
      promptSearchKey(p)
    )
    if (text > -Infinity) {
      scored.push({
        entry: { type: 'prompt', id: p.id, prompt: p },
        score: text + usageBoost(p.useCount, p.lastUsedAt) + (p.favorite ? 5 : 0)
      })
    }
  }
  for (const a of assets) {
    const text = entryScore(
      q,
      a.name,
      `${a.description ?? ''} ${a.tags.join(' ')}`,
      assetSearchKey(a)
    )
    if (text > -Infinity) {
      scored.push({
        entry: { type: 'asset', id: a.id, asset: a },
        score: text + (a.favorite ? 5 : 0) + recencyBoost(a.updatedAt)
      })
    }
  }
  scored.sort((x, y) => y.score - x.score)
  return scored.map((x) => x.entry)
}

/**
 * Relevance score. Title/meta drive ranking weight; the final fallback scans the
 * precomputed search key (literal + pinyin blob) so a body-only match is cheap.
 */
function entryScore(q: string, title: string, meta: string, key: string): number {
  if (!q) return 1
  const t = title.toLowerCase()
  if (t.startsWith(q)) return 100
  if (t.includes(q)) return 60
  if (pinyinMatch(q, title)) return 50
  if (pinyinMatch(q, meta)) return 30
  if (key.includes(q)) return 20
  return -Infinity
}

function usageBoost(useCount = 0, lastUsedAt?: number | null): number {
  return Math.min(useCount, 20) + recencyBoost(lastUsedAt)
}

function recencyBoost(ts?: number | null): number {
  return ts ? Math.max(0, 10 - (Date.now() - ts) / 86_400_000) : 0
}

export function collectTags(prompts: Prompt[]): { tag: string; count: number }[] {
  const counts = new Map<string, number>()
  for (const p of prompts) {
    for (const t of p.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag))
}

export function categoryById(categories: Category[], id?: string | null): Category | undefined {
  if (!id) return undefined
  return categories.find((c) => c.id === id)
}

export function formatDate(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} 小时前`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day} 天前`
  return formatDate(ts).slice(0, 10)
}
