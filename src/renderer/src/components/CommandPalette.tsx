import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import { Blocks, Bot, CornerDownLeft, Pencil, Plug, Search, Sparkles, Wand2 } from 'lucide-react'
import type { AssetKind } from '@shared/types'
import { assetToText } from '@shared/assetFormat'
import { useStore } from '../store'
import { categoryById, rankCommand, type CommandEntry } from '../selectors'
import { requestCopy } from '../copy'
import { toast } from './Toast'
import { useT } from '../i18n'

const MAX_RESULTS = 50

const KIND_ICON: Record<'prompt' | AssetKind, React.ReactNode> = {
  prompt: <Blocks size={13} />,
  skill: <Sparkles size={13} />,
  agent: <Bot size={13} />,
  mcp: <Plug size={13} />
}
const KIND_LABEL: Record<'prompt' | AssetKind, string> = {
  prompt: 'Prompt',
  skill: 'Skill',
  agent: 'Agent',
  mcp: 'MCP'
}

/**
 * Ctrl/⌘+K quick launcher over prompts AND assets. Enter copies (prompts may
 * open quick-fill; assets copy their formatted text); ⌘/Ctrl+Enter opens the
 * item in its workspace. Ranked by text match + usage so common items lead.
 */
export function CommandPalette(): React.JSX.Element {
  const prompts = useStore((s) => s.prompts)
  const assets = useStore((s) => s.assets)
  const categories = useStore((s) => s.categories)
  const closePalette = useStore((s) => s.closePalette)
  const select = useStore((s) => s.select)
  const setWorkspace = useStore((s) => s.setWorkspace)
  const selectAsset = useStore((s) => s.selectAsset)
  const t = useT()

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const itemsRef = useRef<(HTMLButtonElement | null)[]>([])

  // Defer ranking so each keystroke paints immediately even over a large library.
  const deferredQuery = useDeferredValue(query)
  const results = useMemo(
    () => rankCommand(prompts, assets, deferredQuery).slice(0, MAX_RESULTS),
    [prompts, assets, deferredQuery]
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

  async function copy(entry: CommandEntry) {
    closePalette()
    if (entry.type === 'prompt') {
      await requestCopy(entry.id)
    } else {
      await navigator.clipboard.writeText(assetToText(entry.asset))
      toast.success(t('已复制 {kind} 格式文本', { kind: KIND_LABEL[entry.asset.kind] }))
    }
  }

  function open(entry: CommandEntry) {
    if (entry.type === 'prompt') {
      setWorkspace('prompts')
      select(entry.id)
    } else {
      setWorkspace(entry.asset.kind)
      selectAsset(entry.id)
    }
    closePalette()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      closePalette()
    } else if (e.key === 'ArrowDown') {
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
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[12vh]"
      onClick={closePalette}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-3xl border border-line-strong bg-surface shadow-[rgba(0,0,0,0.12)_0px_12px_48px]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-5">
          <Search size={17} className="text-faint" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('搜索 Prompt 与 Skill / Agent / MCP…')}
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
              const kind = entry.type === 'prompt' ? 'prompt' : entry.asset.kind
              const title = entry.type === 'prompt' ? entry.prompt.title : entry.asset.name
              const cat =
                entry.type === 'prompt'
                  ? categoryById(categories, entry.prompt.categoryId)
                  : undefined
              const subtitle =
                entry.type === 'prompt'
                  ? `${cat ? cat.name + ' · ' : ''}${entry.prompt.description || entry.prompt.content.slice(0, 60) || t('空内容')}`
                  : entry.asset.description || entry.asset.content.slice(0, 60) || '—'
              const varCount = entry.type === 'prompt' ? entry.prompt.variables.length : 0
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
                    {KIND_ICON[kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`truncate text-sm font-medium text-ink ${entry.type === 'asset' ? 'font-mono' : ''}`}>
                        {title}
                      </span>
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 text-[9px] uppercase tracking-wide text-faint">
                        {KIND_LABEL[kind]}
                      </span>
                      {varCount > 0 && (
                        <span className="flex shrink-0 items-center gap-0.5 rounded-md bg-brand/15 px-1.5 text-[10px] text-brand">
                          <Wand2 size={9} />
                          {varCount}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-xs text-faint">{subtitle}</div>
                  </div>
                  {i === active && <CornerDownLeft size={14} className="shrink-0 text-brand" />}
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
    </div>
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
