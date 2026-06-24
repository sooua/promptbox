import type { Asset, Prompt } from '@shared/types'
import { pinyinForms } from './pinyin'

/**
 * Incremental search index.
 *
 * The hot path is "user typing in a search box": for every keystroke the list
 * is re-filtered over every item. Doing `title+desc+tags+content` concatenation,
 * `toLowerCase()` on the full body, and pinyin conversion *per keystroke per
 * item* is the real cost at scale — not the absence of a database.
 *
 * So we precompute a single lowercased search blob per item (literal text +
 * pinyin full + initials) and memoize it keyed by object identity. The store
 * rebuilds item objects from IPC whenever data changes, so an edited item gets
 * a fresh object and naturally a fresh key, while a stable typing session reuses
 * the cached blob — turning each keystroke into a plain substring scan.
 *
 * This is the indexed-search win a SQLite backend would nominally provide, but
 * without a native dependency, data migration, or per-keystroke IPC latency.
 */

const promptKeys = new WeakMap<object, string>()
const assetKeys = new WeakMap<object, string>()

/** title/desc/tags get pinyin (short, Chinese-likely); the body stays literal. */
function buildKey(short: string, body: string): string {
  const { full, initials } = pinyinForms(short)
  return `${short}\n${body}\n${full}\n${initials}`.toLowerCase()
}

export function promptSearchKey(p: Prompt): string {
  const hit = promptKeys.get(p)
  if (hit !== undefined) return hit
  const key = buildKey(`${p.title} ${p.description ?? ''} ${p.tags.join(' ')}`, p.content)
  promptKeys.set(p, key)
  return key
}

export function assetSearchKey(a: Asset): string {
  const hit = assetKeys.get(a)
  if (hit !== undefined) return hit
  const body = a.kind === 'mcp' ? Object.values(a.meta).join(' ') : a.content
  const key = buildKey(`${a.name} ${a.description ?? ''} ${a.tags.join(' ')}`, body)
  assetKeys.set(a, key)
  return key
}

/** True when the (already lowercased) query hits the item's precomputed blob. */
export function promptMatches(p: Prompt, qLower: string): boolean {
  return !qLower || promptSearchKey(p).includes(qLower)
}

export function assetMatches(a: Asset, qLower: string): boolean {
  return !qLower || assetSearchKey(a).includes(qLower)
}
