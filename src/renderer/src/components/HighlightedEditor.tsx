import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { extractVariableNames } from '@shared/variables'

interface Props {
  value: string
  onChange(value: string): void
  onBlur?(): void
  placeholder?: string
  /** known variable names offered in {{ }} autocomplete */
  suggestions: string[]
}

const TOKEN_RE = /(\{\{\s*[\w.-]+\s*\}\})|(`[^`\n]+`)|(\*\*[^*\n]+\*\*)|(^#{1,6} .*$)/gm

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Build highlighted HTML for the overlay; escapes everything else. */
function highlight(text: string): string {
  let out = ''
  let last = 0
  text.replace(TOKEN_RE, (m: string, varTok, code, bold, heading, offset: number) => {
    out += escapeHtml(text.slice(last, offset))
    const cls = varTok ? 'hl-var' : code ? 'hl-code' : bold ? 'hl-bold' : 'hl-heading'
    out += `<span class="${cls}">${escapeHtml(m)}</span>`
    last = offset + m.length
    return m
  })
  out += escapeHtml(text.slice(last))
  // trailing newline so the overlay's height matches the textarea
  return out + '\n'
}

// Styles copied onto the mirror div used to measure caret pixel position.
const MIRROR_PROPS = [
  'boxSizing',
  'width',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'letterSpacing',
  'tabSize',
  'whiteSpace',
  'wordWrap',
  'overflowWrap'
]

function caretCoordinates(el: HTMLTextAreaElement, position: number): { top: number; left: number } {
  const div = document.createElement('div')
  const computed = window.getComputedStyle(el)
  const style = div.style as unknown as Record<string, string>
  style.position = 'absolute'
  style.visibility = 'hidden'
  style.whiteSpace = 'pre-wrap'
  style.wordWrap = 'break-word'
  for (const prop of MIRROR_PROPS) {
    style[prop] = (computed as unknown as Record<string, string>)[prop]
  }
  div.textContent = el.value.slice(0, position)
  const span = document.createElement('span')
  span.textContent = el.value.slice(position) || '.'
  div.appendChild(span)
  document.body.appendChild(div)
  const top = span.offsetTop + parseInt(computed.borderTopWidth || '0', 10)
  const left = span.offsetLeft + parseInt(computed.borderLeftWidth || '0', 10)
  document.body.removeChild(div)
  return { top, left }
}

const SHARED =
  'p-5 font-mono text-sm leading-[1.7] whitespace-pre-wrap break-words tracking-normal'

export function HighlightedEditor({
  value,
  onChange,
  onBlur,
  placeholder,
  suggestions
}: Props): React.JSX.Element {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  // A controlled <textarea> loses the browser's native undo stack, so we keep
  // our own word-level history (checkpoints coalesce rapid keystrokes).
  const hist = useRef<{ past: string[]; future: string[]; lastAt: number }>({
    past: [],
    future: [],
    lastAt: 0
  })

  function record(prev: string) {
    const h = hist.current
    if (h.past[h.past.length - 1] === prev) return
    h.past.push(prev)
    if (h.past.length > 200) h.past.shift()
    h.future = []
  }

  /** Apply a restored value and move the caret to its end. */
  function restore(next: string) {
    onChange(next)
    const ta = taRef.current
    requestAnimationFrame(() => {
      ta?.focus()
      ta?.setSelectionRange(next.length, next.length)
    })
  }

  function undo() {
    const h = hist.current
    if (!h.past.length) return
    h.future.push(value)
    restore(h.past.pop() as string)
    setSuggest(null)
  }

  function redo() {
    const h = hist.current
    if (!h.future.length) return
    h.past.push(value)
    restore(h.future.pop() as string)
    setSuggest(null)
  }

  const [suggest, setSuggest] = useState<{
    items: string[]
    active: number
    top: number
    left: number
    start: number
  } | null>(null)

  const html = useMemo(() => highlight(value), [value])

  const counts = useMemo(() => {
    return {
      chars: value.length,
      lines: value ? value.split('\n').length : 0,
      vars: extractVariableNames(value).length
    }
  }, [value])

  function syncScroll() {
    if (preRef.current && taRef.current) {
      preRef.current.scrollTop = taRef.current.scrollTop
      preRef.current.scrollLeft = taRef.current.scrollLeft
    }
  }

  /** Recompute the {{ }} autocomplete popup based on the caret context. */
  function updateSuggest() {
    const ta = taRef.current
    if (!ta) return
    const caret = ta.selectionStart
    const before = value.slice(0, caret)
    const m = before.match(/\{\{\s*([\w.-]*)$/)
    if (!m) {
      setSuggest(null)
      return
    }
    const partial = m[1]
    const names = Array.from(new Set(suggestions))
    let items = partial
      ? names.filter((n) => n.toLowerCase().includes(partial.toLowerCase()))
      : names
    if (partial && !names.includes(partial)) items = [partial, ...items.filter((n) => n !== partial)]
    items = items.slice(0, 8)
    if (items.length === 0) {
      setSuggest(null)
      return
    }
    const coords = caretCoordinates(ta, caret)
    setSuggest({
      items,
      active: 0,
      top: coords.top - ta.scrollTop + 22,
      left: coords.left - ta.scrollLeft,
      start: m.index ?? caret
    })
  }

  useLayoutEffect(syncScroll, [value])

  function applySuggestion(name: string) {
    const ta = taRef.current
    if (!ta || !suggest) return
    const caret = ta.selectionStart
    const after = value.slice(caret)
    const closing = after.startsWith('}}') ? 2 : 0
    const insert = `{{${name}}}`
    const next = value.slice(0, suggest.start) + insert + value.slice(caret + closing)
    const newCaret = suggest.start + insert.length
    record(value)
    onChange(next)
    setSuggest(null)
    requestAnimationFrame(() => {
      ta.focus()
      ta.setSelectionRange(newCaret, newCaret)
    })
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Undo / redo intercept (controlled textarea has no native history).
    if (e.metaKey || e.ctrlKey) {
      const k = e.key.toLowerCase()
      if (k === 'z' && !e.shiftKey) {
        e.preventDefault()
        undo()
        return
      }
      if ((k === 'z' && e.shiftKey) || k === 'y') {
        e.preventDefault()
        redo()
        return
      }
    }
    if (!suggest) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSuggest({ ...suggest, active: (suggest.active + 1) % suggest.items.length })
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSuggest({
        ...suggest,
        active: (suggest.active - 1 + suggest.items.length) % suggest.items.length
      })
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault()
      applySuggestion(suggest.items[suggest.active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setSuggest(null)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex-1 overflow-hidden rounded-2xl border border-line-strong bg-surface focus-within:border-focus">
        <pre
          ref={preRef}
          aria-hidden
          className={`hl-overlay pointer-events-none absolute inset-0 m-0 overflow-hidden ${SHARED}`}
          dangerouslySetInnerHTML={{ __html: html }}
        />
        <textarea
          ref={taRef}
          value={value}
          onChange={(e) => {
            // Checkpoint into history when the typing pauses or crosses a word
            // boundary, so undo steps back by words rather than per-keystroke.
            const ts = Date.now()
            const boundary = /\s/.test(e.target.value.slice(-1))
            if (ts - hist.current.lastAt > 350 || boundary) {
              record(value)
              hist.current.lastAt = ts
            }
            onChange(e.target.value)
            // defer so selectionStart reflects the new value
            requestAnimationFrame(updateSuggest)
          }}
          onScroll={syncScroll}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => {
            if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) updateSuggest()
          }}
          onClick={updateSuggest}
          onBlur={() => {
            // small delay so a mousedown on a suggestion can apply first
            setTimeout(() => setSuggest(null), 120)
            onBlur?.()
          }}
          placeholder={placeholder}
          spellCheck={false}
          className={`absolute inset-0 h-full w-full resize-none bg-transparent outline-none placeholder:text-faint ${SHARED}`}
          style={{ color: 'transparent', caretColor: 'var(--color-ink)' }}
        />

        {suggest && (
          <ul
            className="absolute z-10 max-h-52 w-52 overflow-y-auto rounded-xl border border-line-strong bg-surface py-1 shadow-[rgba(0,0,0,0.12)_0px_8px_28px]"
            style={{ top: suggest.top, left: suggest.left }}
          >
            {suggest.items.map((name, i) => (
              <li key={name}>
                <button
                  onMouseDown={(e) => {
                    e.preventDefault()
                    applySuggestion(name)
                  }}
                  onMouseEnter={() => setSuggest({ ...suggest, active: i })}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs ${
                    i === suggest.active ? 'bg-brand/12 text-brand' : 'text-ink hover:bg-surface-2'
                  }`}
                >
                  <code className="var-chip">{`{{${name}}}`}</code>
                  {!suggestions.includes(name) && <span className="text-faint">新建</span>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-2 flex items-center gap-4 px-1 text-[11px] text-faint">
        <span>{counts.chars} 字符</span>
        <span>{counts.lines} 行</span>
        <span>{counts.vars} 个变量</span>
        <span className="ml-auto">
          输入 <code className="var-chip">{'{{'}</code> 触发变量补全
        </span>
      </div>
    </div>
  )
}
