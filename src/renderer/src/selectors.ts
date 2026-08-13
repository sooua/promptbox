import type { Category, Prompt } from '@shared/types'
import type { CategoryFilter } from './store'
import { t } from './i18n'
import { pinyinMatch } from './pinyin'
import { promptMatches, promptSearchKey } from './searchIndex'

const SPECIAL = ['all', 'favorites', 'uncategorized', 'recent']

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
 * Pinned prompts always float to the top. Within each group, "最近使用" orders by
 * when it was last copied; everything else sorts by last edit.
 *
 * There used to be a second "最常用" rail sorting the same set by useCount.
 * `recordUse` is the only writer of both fields and always writes them
 * together, so its membership was identical to "最近使用" by construction —
 * two rails, always the same count, differing only in sort order.
 */
function sortPrompts(prompts: Prompt[], f: CategoryFilter): Prompt[] {
  const within = (a: Prompt, b: Prompt): number => {
    if (f === 'recent') return (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
    return b.updatedAt - a.updatedAt
  }
  return [...prompts].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return within(a, b)
  })
}

/**
 * Command-palette ranking over prompts. Text match (literal + pinyin) drives
 * relevance; usage/recency/favorite break ties so the things you reach for most
 * surface first (and with an empty query too).
 */
export function rankCommand(prompts: Prompt[], query: string): Prompt[] {
  const q = query.trim().toLowerCase()
  const scored: { prompt: Prompt; score: number }[] = []

  for (const p of prompts) {
    const text = entryScore(
      q,
      p.title,
      `${p.description ?? ''} ${p.tags.join(' ')}`,
      promptSearchKey(p)
    )
    if (text > -Infinity) {
      scored.push({
        prompt: p,
        score: text + usageBoost(p.useCount, p.lastUsedAt) + (p.favorite ? 5 : 0)
      })
    }
  }
  scored.sort((x, y) => y.score - x.score)
  return scored.map((x) => x.prompt)
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
  if (min < 1) return t('刚刚')
  if (min < 60) return t('{n} 分钟前', { n: min })
  const hr = Math.floor(min / 60)
  if (hr < 24) return t('{n} 小时前', { n: hr })
  const day = Math.floor(hr / 24)
  if (day < 30) return t('{n} 天前', { n: day })
  return formatDate(ts).slice(0, 10)
}
