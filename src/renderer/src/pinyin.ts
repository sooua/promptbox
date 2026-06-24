import { pinyin } from 'pinyin-pro'

interface Forms {
  full: string
  initials: string
}

// Pinyin conversion isn't free, so memoize per source string.
const cache = new Map<string, Forms>()

export function pinyinForms(text: string): Forms {
  if (!text) return { full: '', initials: '' }
  const hit = cache.get(text)
  if (hit) return hit
  const full = pinyin(text, { toneType: 'none', type: 'array', nonZh: 'consecutive' })
    .join('')
    .toLowerCase()
  const initials = pinyin(text, {
    pattern: 'first',
    toneType: 'none',
    type: 'array',
    nonZh: 'consecutive'
  })
    .join('')
    .toLowerCase()
  const forms = { full, initials }
  cache.set(text, forms)
  return forms
}

/**
 * Match a (lowercased) query against text directly, or via its pinyin —
 * both full ("kehubaogao") and initials ("khbg"). Lets Chinese prompts be
 * found by typing pinyin or just the initials.
 */
export function pinyinMatch(query: string, text: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  if (text.toLowerCase().includes(q)) return true
  const { full, initials } = pinyinForms(text)
  return full.includes(q) || initials.includes(q)
}
