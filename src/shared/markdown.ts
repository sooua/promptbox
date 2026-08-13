/**
 * Minimal front-matter reader for importing existing .md / .txt prompts.
 *
 * Deliberately not a YAML parser: the files this targets (hand-written prompts,
 * Claude-ecosystem SKILL.md / agent.md) use flat `key: value` lines, and a real
 * YAML dependency would cost more than the cases it buys. Anything it doesn't
 * understand is skipped rather than treated as an error — a prompt body is worth
 * importing even when its metadata is malformed.
 */

const FRONTMATTER_RE = /^﻿?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/

export interface ParsedMarkdownPrompt {
  title: string
  content: string
  description?: string
  tags: string[]
}

/** Strip matching surrounding quotes from a front-matter value. */
function unquote(value: string): string {
  const v = value.trim()
  if (v.length >= 2 && (v[0] === '"' || v[0] === "'") && v[v.length - 1] === v[0]) {
    return v.slice(1, -1)
  }
  return v
}

/** Accepts both `tags: [a, b]` and `tags: a, b`. */
function parseTags(value: string): string[] {
  return unquote(value)
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((t) => unquote(t).replace(/^#/, ''))
    .filter(Boolean)
}

export function parseMarkdownPrompt(text: string, fallbackTitle: string): ParsedMarkdownPrompt {
  const match = FRONTMATTER_RE.exec(text)
  const meta: Record<string, string> = {}

  if (match) {
    for (const line of match[1].split(/\r?\n/)) {
      const sep = line.indexOf(':')
      // Skip list items, comments and anything without a `key: value` shape.
      if (sep <= 0 || /^\s*[#-]/.test(line)) continue
      const key = line.slice(0, sep).trim().toLowerCase()
      if (!/^[a-z_][a-z0-9_-]*$/.test(key)) continue
      meta[key] = line.slice(sep + 1)
    }
  }

  const body = (match ? text.slice(match[0].length) : text).replace(/^﻿/, '').trim()
  const title = meta.title ? unquote(meta.title) : ''
  const description = meta.description ?? meta.desc

  return {
    title: title || fallbackTitle,
    content: body,
    description: description ? unquote(description) : undefined,
    tags: meta.tags ? parseTags(meta.tags) : []
  }
}
