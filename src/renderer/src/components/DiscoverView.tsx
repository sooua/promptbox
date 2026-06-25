import { useEffect, useRef, useState } from 'react'
import {
  Bot,
  Check,
  Compass,
  Download,
  FileText,
  Loader2,
  Plug,
  Search,
  Sparkles,
  WifiOff
} from 'lucide-react'
import type { GithubDiscoverItem, McpDiscoverItem, PromptDiscoverItem, PromptSource } from '@shared/types'
import { useStore } from '../store'
import { useT } from '../i18n'
import { toast } from './Toast'

type Tab = 'prompt' | 'mcp' | 'skill' | 'agent'

export function DiscoverView(): React.JSX.Element {
  const t = useT()
  const marketEnabled = useStore((s) => s.settings?.marketEnabled ?? true)
  const setMarket = useStore((s) => s.setMarket)
  const [tab, setTab] = useState<Tab>('prompt')

  return (
    <div className="flex flex-1 flex-col bg-canvas">
      <div className="border-b border-line px-8 pt-7">
        <div className="mb-4 flex items-center gap-2">
          <Compass size={22} className="text-brand" />
          <h1 className="font-serif text-[26px] leading-none text-ink">{t('发现')}</h1>
        </div>
        <div className="flex items-center gap-1">
          <TabBtn active={tab === 'prompt'} onClick={() => setTab('prompt')}>
            Prompt
          </TabBtn>
          <TabBtn active={tab === 'mcp'} onClick={() => setTab('mcp')}>
            MCP
          </TabBtn>
          <TabBtn active={tab === 'skill'} onClick={() => setTab('skill')}>
            Skill
          </TabBtn>
          <TabBtn active={tab === 'agent'} onClick={() => setTab('agent')}>
            Agent
          </TabBtn>
        </div>
      </div>

      {!marketEnabled ? (
        <Disabled onEnable={() => void setMarket(true)} />
      ) : tab === 'prompt' ? (
        <PromptDiscover />
      ) : tab === 'mcp' ? (
        <McpDiscover />
      ) : (
        <GithubDiscover kind={tab} />
      )}
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

function McpDiscover(): React.JSX.Element {
  const t = useT()
  const searchMcp = useStore((s) => s.searchMcp)
  const importMcp = useStore((s) => s.importMcp)
  const customRegistries = useStore((s) => s.settings?.mcpRegistries ?? [])

  const [registry, setRegistry] = useState('official')
  const [query, setQuery] = useState('')
  const [items, setItems] = useState<McpDiscoverItem[]>([])
  const [cursor, setCursor] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)
  const reqId = useRef(0)

  async function run(q: string, cur?: string, reg = registry) {
    const id = ++reqId.current
    setLoading(true)
    setError(null)
    const r = await searchMcp(q, cur, reg)
    if (id !== reqId.current) return // a newer search superseded this one
    setLoading(false)
    if (r.error) {
      setError(r.error)
      if (!cur) setItems([])
      return
    }
    setItems((prev) => (cur ? [...prev, ...r.items] : r.items))
    setCursor(r.nextCursor)
  }

  useEffect(() => {
    void run(query, undefined, registry)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registry])

  async function doImport(item: McpDiscoverItem) {
    setImporting(item.name)
    const r = await importMcp(item)
    setImporting(null)
    setItems((prev) => prev.map((x) => (x.name === item.name ? { ...x, imported: true } : x)))
    toast.success(r.duplicate ? t('已在库中') : t('已导入「{name}」', { name: item.title }))
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex w-full max-w-[820px] items-center gap-2 px-8 py-4">
        <select
          value={registry}
          onChange={(e) => setRegistry(e.target.value)}
          className="rounded-xl border border-line-strong bg-surface px-2.5 py-2 text-sm text-ink outline-none focus:border-focus"
          title={t('来源')}
        >
          <option value="official">{t('官方注册表')}</option>
          <option value="smithery">Smithery</option>
          {customRegistries.map((r) => (
            <option key={r.url} value={r.url}>
              {r.name || r.url}
            </option>
          ))}
        </select>
        <div className="relative flex-1 max-w-lg">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void run(query)}
            placeholder={t('搜索 MCP 服务器…')}
            className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-focus"
          />
        </div>
        <button
          onClick={() => void run(query)}
          className="rounded-xl bg-brand px-3.5 py-2 text-sm text-on-brand transition hover:bg-brand-strong"
        >
          {t('搜索')}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {error ? (
          <div className="mt-16 text-center text-sm text-faint">
            <p>{t('加载失败：{msg}', { msg: error })}</p>
            <button
              onClick={() => void run(query)}
              className="mt-3 rounded-lg border border-line-strong px-3 py-1.5 text-muted transition hover:border-ring hover:text-ink"
            >
              {t('重试')}
            </button>
          </div>
        ) : items.length === 0 && !loading ? (
          <div className="mt-16 text-center text-sm text-faint">{t('没有找到匹配的服务器')}</div>
        ) : (
          <div className="max-w-[820px] space-y-2">
            {items.map((item) => (
              <div
                key={item.name}
                className="flex items-start gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  <Plug size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium text-ink">{item.title}</span>
                    {item.transports.map((tp) => (
                      <span
                        key={tp}
                        className="shrink-0 rounded bg-surface-2 px-1.5 text-[10px] uppercase tracking-wide text-faint"
                      >
                        {tp}
                      </span>
                    ))}
                  </div>
                  <div className="truncate font-mono text-[11px] text-faint">{item.name}</div>
                  <div className="mt-1 line-clamp-2 text-xs text-muted">{item.description}</div>
                </div>
                {item.imported ? (
                  <span className="flex shrink-0 items-center gap-1 px-2 py-1 text-xs text-faint">
                    <Check size={14} />
                    {t('已导入')}
                  </span>
                ) : (
                  <button
                    onClick={() => void doImport(item)}
                    disabled={importing === item.name}
                    className="flex shrink-0 items-center gap-1.5 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
                  >
                    {importing === item.name ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      <Download size={13} />
                    )}
                    {t('导入')}
                  </button>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex justify-center py-6 text-faint">
                <Loader2 size={18} className="animate-spin" />
              </div>
            )}
            {cursor && !loading && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => void run(query, cursor)}
                  className="rounded-lg border border-line-strong px-4 py-1.5 text-sm text-muted transition hover:border-ring hover:text-ink"
                >
                  {t('加载更多')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function GithubDiscover({ kind }: { kind: 'skill' | 'agent' }): React.JSX.Element {
  const t = useT()
  const listGithub = useStore((s) => s.listGithub)
  const importGithub = useStore((s) => s.importGithub)

  const [query, setQuery] = useState('')
  const [items, setItems] = useState<GithubDiscoverItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importing, setImporting] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    setError(null)
    const r = await listGithub(kind)
    setLoading(false)
    setItems(r.items)
    if (r.error) setError(r.error)
  }
  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind])

  async function doImport(item: GithubDiscoverItem) {
    setImporting(item.id)
    try {
      const r = await importGithub(item)
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
    ? items.filter((i) => i.title.toLowerCase().includes(q) || i.category.toLowerCase().includes(q))
    : items
  const shown = filtered.slice(0, 120)
  const Icon = kind === 'skill' ? Sparkles : Bot

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex w-full max-w-[820px] items-center gap-2 px-8 py-4">
        <div className="relative flex-1 max-w-xl">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === 'skill' ? t('搜索 Skill…') : t('搜索 Agent…')}
            className="w-full rounded-xl border border-line-strong bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-focus"
          />
        </div>
        <span className="ml-auto text-[11px] text-faint">
          {filtered.length > 0 ? t('共 {n} 项 · 来自社区仓库', { n: filtered.length }) : t('来自社区仓库')}
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
              onClick={() => void load()}
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
                className="flex items-center gap-3 rounded-xl border border-line-strong bg-surface px-4 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-muted">
                  <Icon size={16} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-mono text-sm font-medium text-ink">{item.title}</span>
                    <span className="shrink-0 rounded bg-surface-2 px-1.5 text-[10px] text-faint">
                      {item.category}
                    </span>
                  </div>
                  <div className="truncate text-[11px] text-faint">{item.repo}</div>
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
        <p className="mt-1 text-xs">{t('开启后可浏览并导入 MCP 服务器')}</p>
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

function TabBtn({
  children,
  active,
  onClick,
  soon
}: {
  children: React.ReactNode
  active: boolean
  onClick(): void
  soon?: boolean
}): React.JSX.Element {
  const t = useT()
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 border-b-2 px-3 py-2.5 text-sm transition ${
        active ? 'border-brand font-medium text-brand' : 'border-transparent text-muted hover:text-ink'
      }`}
    >
      {children}
      {soon && (
        <span className="rounded bg-surface-2 px-1.5 text-[9px] text-faint">{t('即将支持')}</span>
      )}
    </button>
  )
}
