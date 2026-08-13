import { describe, expect, it } from 'vitest'
import { parseMarkdownPrompt } from './markdown'

describe('parseMarkdownPrompt', () => {
  it('falls back to the file name when there is no front-matter', () => {
    const r = parseMarkdownPrompt('# Hello\n\nbody text', 'code-review')
    expect(r.title).toBe('code-review')
    expect(r.content).toBe('# Hello\n\nbody text')
    expect(r.tags).toEqual([])
    expect(r.description).toBeUndefined()
  })

  it('reads title / description / tags and strips the front-matter from the body', () => {
    const text = [
      '---',
      'title: 代码审计助手',
      'description: "对代码做安全审计"',
      'tags: [security, code-review]',
      '---',
      '',
      '正文 {{language}}'
    ].join('\n')
    const r = parseMarkdownPrompt(text, 'fallback')
    expect(r.title).toBe('代码审计助手')
    expect(r.description).toBe('对代码做安全审计')
    expect(r.tags).toEqual(['security', 'code-review'])
    expect(r.content).toBe('正文 {{language}}')
  })

  it('accepts a bare comma list for tags and drops leading #', () => {
    const r = parseMarkdownPrompt('---\ntags: #a, b\n---\nbody', 'f')
    expect(r.tags).toEqual(['a', 'b'])
  })

  it('survives malformed front-matter instead of throwing', () => {
    // Unclosed fence — the whole thing is body, nothing is lost.
    const text = '---\ntitle: broken\nno closing fence\n\nbody'
    const r = parseMarkdownPrompt(text, 'fallback')
    expect(r.title).toBe('fallback')
    expect(r.content).toContain('body')
  })

  it('ignores list items and comments inside front-matter', () => {
    const text = '---\n# a comment\n- listitem\ntitle: kept\n---\nbody'
    const r = parseMarkdownPrompt(text, 'f')
    expect(r.title).toBe('kept')
    expect(r.content).toBe('body')
  })

  it('handles CRLF line endings', () => {
    const r = parseMarkdownPrompt('---\r\ntitle: win\r\n---\r\nbody', 'f')
    expect(r.title).toBe('win')
    expect(r.content).toBe('body')
  })

  it('treats an empty front-matter title as absent', () => {
    const r = parseMarkdownPrompt('---\ntitle:\n---\nbody', 'fallback')
    expect(r.title).toBe('fallback')
  })
})
