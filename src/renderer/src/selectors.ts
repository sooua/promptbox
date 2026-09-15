import type { Category, Flow, Prompt, StageId, StageInfo, TrackId } from '@shared/types'
import { STAGES } from '@shared/types'
import { isCategoryId, stageOf, type CategoryFilter } from './store'
import { t } from './i18n'
import { pinyinMatch } from './pinyin'
import { promptMatches, promptSearchKey } from './searchIndex'

export function filterPrompts(
  prompts: Prompt[],
  categories: Category[],
  opts: { categoryFilter: CategoryFilter; search: string }
): Prompt[] {
  const q = opts.search.trim().toLowerCase()
  const f = opts.categoryFilter
  const stage = stageOf(f)
  const stageSteps = stage ? new Set(categories.filter((c) => c.stage === stage).map((c) => c.id)) : null

  const matched = prompts.filter((p) => {
    if (f === 'favorites' && !p.favorite) return false
    if (stageSteps && !stageSteps.has(p.categoryId ?? '')) return false
    if (isCategoryId(f) && p.categoryId !== f) return false
    // indexed match: precomputed literal + pinyin blob, scanned once per item
    if (q && !promptMatches(p, q)) return false
    return true
  })

  return sortPrompts(matched, categories, f)
}

/**
 * Stage and step views are a walkthrough, so they keep the step order first and
 * creation order inside a step (the built-ins were seeded in the order you use
 * them). "全部" and "收藏" are a working set and sort by last edit.
 */
function sortPrompts(prompts: Prompt[], categories: Category[], f: CategoryFilter): Prompt[] {
  if (f === 'all' || f === 'favorites') return [...prompts].sort((a, b) => b.updatedAt - a.updatedAt)
  const rank = new Map(categories.map((c, i) => [c.id, i]))
  const stepOf = (p: Prompt) => rank.get(p.categoryId ?? '') ?? Infinity
  return [...prompts].sort((a, b) => stepOf(a) - stepOf(b) || a.createdAt - b.createdAt)
}

/**
 * The steps that make up the route for one starting point, in stage order then
 * rail order. "从零开始" skips the steps only an existing codebase needs, and
 * vice versa; steps without a `flow` are on both routes.
 */
export function routeSteps(categories: Category[], flow: Flow): Category[] {
  const rank = new Map(STAGES.map((s, i) => [s.id, i]))
  return categories
    .filter((c) => c.stage && (!c.flow || c.flow === flow))
    .sort((a, b) => rank.get(a.stage!)! - rank.get(b.stage!)! || a.order - b.order)
}

/**
 * The prompt to show for a step on the route: the variant written for this
 * project type if there is one, else the one that applies to every type.
 * Earliest wins when a step holds several — the built-ins come first.
 */
export function routePrompt(prompts: Prompt[], stepId: string, track: TrackId | null): Prompt | undefined {
  const mine = prompts.filter((p) => p.categoryId === stepId).sort((a, b) => a.createdAt - b.createdAt)
  return mine.find((p) => p.track === track) ?? mine.find((p) => !p.track)
}

/** Steps of one stage in rail order; `null` stage = steps the user made without one. */
export function stepsOf(categories: Category[], stage: StageId | null): Category[] {
  return categories.filter((c) => (c.stage ?? null) === stage)
}

/**
 * Where to go after this prompt: the next step in its stage, or the first step
 * of the next stage. Null at the very end (or for prompts outside any stage).
 */
export function nextStep(
  categories: Category[],
  categoryId: string | null | undefined
): { stage: StageInfo; step: Category } | null {
  const cur = categories.find((c) => c.id === categoryId)
  if (!cur?.stage) return null
  const stageIdx = STAGES.findIndex((s) => s.id === cur.stage)
  const siblings = stepsOf(categories, cur.stage)
  const next = siblings[siblings.indexOf(cur) + 1]
  if (next) return { stage: STAGES[stageIdx], step: next }
  for (let i = stageIdx + 1; i < STAGES.length; i++) {
    const first = stepsOf(categories, STAGES[i].id)[0]
    if (first) return { stage: STAGES[i], step: first }
  }
  return null
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
