import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Blocks, CornerDownLeft, Pencil, Search, Wand2 } from 'lucide-react'
import type { Prompt } from '@shared/types'
import { useStore } from '../store'
import { categoryById, rankCommand } from '../selectors'
import { requestCopy } from '../copy'
import { Modal } from './Modal'
import { useT } from '../i18n'

const MAX_RESULTS = 50

/**
 * Ctrl/⌘+K quick launcher over prompts. Enter copies (may open quick-fill);
 * ⌘/Ctrl+Enter opens the prompt in the editor. Ranked by text match + usage so
 * common items lead.
 */
export function CommandPalette(): React.JSX.Element {
  const prompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const closePalette = useStore((s) => s.closePalette)
  const select = useStore((s) => s.select)
  const t = useT()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([])

  // Defer ranking so each keystroke paints immediately even over a large library.
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => rankCommand(prompts, deferredQuery).slice(0, MAX_RESULTS),
    [prompts, deferredQuery]
  )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])
  useEffect(() => {
    setActive(0)
  }, [query])
  useEffect(() => {
    itemsRef.current[active]?.scrollIntoView({ block: 'nearest' })
  }, [active])

  async function copy(entry: Prompt) {
    closePalette()
    await requestCopy(entry.id)
  }

  function open(entry: Prompt) {
    select(entry.id)
    closePalette()
  }

  // Esc is handled by <Modal> at window level.
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = results[active]
      if (!target) return
      if (e.metaKey || e.ctrlKey) open(target)
      else void copy(target)
    }
  }

  return (
    <Modal
      onClose={closePalette}
      ariaLabel={t('命令面板')}
      className="w-full max-w-xl overflow-hidden rounded-3xl border border-line-strong bg-surface shadow-[rgba(0,0,0,0.12)_0px_12px_48px]"
    >
      <div onKeyDown={onKeyDown}>
        <div className="flex items-center gap-2 border-b border-line px-5">
          <Search size={17} className="text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('搜索 Prompt…')}
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls="command-results"
            aria-activedescendant={results[active] ? `cmd-${results[active].id}` : undefined}
            aria-autocomplete="list"
            className="w-full bg-transparent py-4 text-sm text-ink outline-none placeholder:text-faint"
          />
        </div>

        <div id="command-results" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-faint">{t('没有匹配的结果')}</div>
          ) : (
            results.map((entry, i) => {
              const cat = categoryById(categories, entry.categoryId)
              const subtitle = `${cat ? cat.name + ' · ' : ''}${entry.description || entry.content.slice(0, 60) || t('空内容')}`
              const varCount = entry.variables.length
              return (
                <button
                  key={entry.id}
                  id={`cmd-${entry.id}`}
                  role="option"
                  aria-selected={i === active}
                  ref={(el) => {
                    itemsRef.current[i] = el
                  }}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => copy(entry)}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    i === active ? 'bg-brand/12' : 'hover:bg-surface-2'
                  }`}
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-surface-2 text-muted">
                    <Blocks size={13} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-ink">{entry.title}</span>
                      {varCount > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-brand/15 px-1.5 text-[10px] text-brand-text">
                          <Wand2 size={9} />
                          {varCount}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-faint">{subtitle}</div>
                  </div>
                  {i === active && <CornerDownLeft size={14} className="shrink-0 text-brand-text" />}
                </button>
              )
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-5 py-2.5 text-[11px] text-faint">
          <Hint icon={<CornerDownLeft size={11} />}>{t('复制')}</Hint>
          <Hint icon={<Pencil size={11} />}>{t('⌘/Ctrl + Enter 打开')}</Hint>
          <Hint icon={<Search size={11} />}>{t('↑↓ 选择')}</Hint>
          <span className="ml-auto">{t('Esc 关闭')}</span>
        </div>
      </div>
    </Modal>
  )
}

function Hint({
  icon,
  children
}: {
  icon: React.ReactNode
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <span className="flex items-center gap-1">
      {icon}
      {children}
    </span>
  )
}
