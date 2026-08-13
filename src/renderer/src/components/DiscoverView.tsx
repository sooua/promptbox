import { useEffect, useRef, useState } from 'react'
import { Check, Compass, Download, FileText, Loader2, Search, WifiOff } from 'lucide-react'
import type { PromptDiscoverItem, PromptSource } from '@shared/types'
import { useStore } from '../store'
import { useT } from '../i18n'
import { toast } from './Toast'

export function DiscoverView(): React.JSX.Element {
  const t = useT()
  const marketEnabled = useStore((s) => s.settings?.marketEnabled ?? true)
  const setMarket = useStore((s) => s.setMarket)

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <div className="border-b border-line px-8 py-7">
        <div className="flex items-center gap-2">
          <Compass size={22} className="text-brand" />
          <h1 className="font-serif text-[26px] leading-none text-ink">{t('发现')}</h1>
        </div>
      </div>

      {marketEnabled ? <PromptDiscover /> : <Disabled onEnable={() => void setMarket(true)} />}
    </div>
  )
}

function PromptDiscover(): React.JSX.Element {
  const t = useT()
  const listPromptSources = useStore((s) => s.listPromptSources)
  const listPrompts = useStore((s) => s.listPrompts)
  const importPrompt = useStore((s) => s.importPrompt)

  const [sources, setSources] = useState<PromptSource[]>([])
  const [source, setSource] = useState('')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<PromptDiscoverItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const reqId = useRef(0)

  // Load the source list once; default to the first source.
  useEffect(() => {
    void listPromptSources().then((list) => {
      setSources(list)
      setSource((cur) => cur || list[0]?.id || '')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function load(srcId: string) {
    if (!srcId) return
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    const r = await listPrompts(srcId)
    if (id !== reqId.current) return // superseded
    setLoading(false)
    setItems(r.items)
    setError(r.error ?? null)
  }

  useEffect(() => {
    void load(source)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source])

  async function doImport(item: PromptDiscoverItem) {
    setImporting(item.id)
    try {
      const r = await importPrompt(item)
      setItems((prev) => prev.map((x) => (x.id === item.id ? { ...x, imported: true } : x)))
      toast.success(r.duplicate ? t('已在库中') : t('已导入「{name}」', { name: item.title }))
    } catch {
      toast.error(t('导入失败'))
    } finally {
      setImporting(null)
    }
  }

  const q = query.trim().toLowerCase()
  const filtered = q
    ? items.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.content.toLowerCase().includes(q) ||
          (i.subtitle ?? '').toLowerCase().includes(q)
      )
    : items
  const shown = filtered.slice(0, 150)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex w-full max-w-[820px] items-center gap-2 px-8 py-4">
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="max-w-[15rem] rounded-xl border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-focus"
          title={t('来源')}
        >
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <div className="relative flex-1 max-w-lg">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('搜索提示词…')}
            className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-focus"
          />
        </div>
        <span className="ml-auto shrink-0 text-[11px] text-faint">
          {filtered.length > 0 ? t('共 {n} 项', { n: filtered.length }) : ''}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="flex justify-center py-16 text-faint">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : error ? (
          <div className="mt-16 text-center text-sm text-faint">
            <p>{t('加载失败：{msg}', { msg: error })}</p>
            <button
              onClick={() => void load(source)}
              className="mt-3 rounded-lg border border-line-strong px-3 py-1.5 text-muted transition hover:border-ring hover:text-ink"
            >
              {t('重试')}
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mt-16 text-center text-sm text-faint">{t('没有找到匹配的结果')}</div>
        ) : (
          <div className="max-w-[820px] space-y-2">
            {shown.map((item) => (
              <div
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  <FileText size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{item.title}</span>
                    {!item.content && item.subtitle && (
                      <span className="shrink-0 rounded bg-surface-2 px-1.5 text-[10px] text-faint">
                        {item.subtitle}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted">
                    {item.content || item.source}
                  </div>
                </div>
                {item.imported ? (
                  <span className="flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-faint">
                    <Check size={14} />
                    {t('已导入')}
                  </span>
                ) : (
                  <button
                    onClick={() => void doImport(item)}
                    disabled={importing === item.id}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {importing === item.id ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    {t('导入')}
                  </button>
                )}
              </div>
            ))}
            {filtered.length > shown.length && (
              <div className="py-3 text-center text-[11px] text-faint">
                {t('仅显示前 {n} 项，搜索以缩小范围', { n: shown.length })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Disabled({ onEnable }: { onEnable(): void }): React.JSX.Element {
  const t = useT()
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center text-faint">
      <WifiOff size={36} className="opacity-40" />
      <div>
        <p className="text-sm text-muted">{t('联网获取市场内容已关闭')}</p>
        <p className="mt-1 text-xs">{t('开启后可浏览并导入社区提示词')}</p>
      </div>
      <button
        onClick={onEnable}
        className="rounded-xl bg-brand px-4 py-2 text-sm text-on-brand transition hover:bg-brand-strong"
      >
        {t('开启联网')}
      </button>
    </div>
  )
}
