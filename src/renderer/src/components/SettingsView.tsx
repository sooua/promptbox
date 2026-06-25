import { useEffect, useState } from 'react'
import {
  Archive,
  Camera,
  Download,
  FolderOpen,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  RotateCcw,
  Sun,
  Upload,
  Database,
  Info,
  X
} from 'lucide-react'
import type {
  BackupInfo,
  GithubSourceConfig,
  Language,
  McpRegistryConfig,
  PromptSourceConfig,
  ThemeMode
} from '@shared/types'
import { HOTKEY_PRESETS } from '@shared/types'
import { useStore } from '../store'
import { formatDate } from '../selectors'
import { useT } from '../i18n'
import { toast } from './Toast'

export function SettingsView(): React.JSX.Element {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const prompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const setTheme = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const setMarket = useStore((s) => s.setMarket)
  const setProxy = useStore((s) => s.setProxy)
  const setGithubSources = useStore((s) => s.setGithubSources)
  const setMcpRegistries = useStore((s) => s.setMcpRegistries)
  const setPromptSources = useStore((s) => s.setPromptSources)
  const setHotkey = useStore((s) => s.setHotkey)
  const chooseDataDir = useStore((s) => s.chooseDataDir)
  const openDataDir = useStore((s) => s.openDataDir)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)

  async function handleExport() {
    const res = await exportData()
    if (res.ok) toast.success(t('数据已导出'))
  }

  async function handleHotkey(accelerator: string) {
    const ok = await setHotkey(accelerator)
    if (ok) toast.success(t('全局热键已更新'))
    else toast.error(t('该热键被系统或其他应用占用，请换一个'))
  }

  async function handleImport(mode: 'merge' | 'replace') {
    if (mode === 'replace' && !confirm(t('替换导入会覆盖当前全部数据，确定继续？'))) return
    const res = await importData(mode)
    if (res.ok) toast.success(t('导入完成'))
    else toast.error(t('导入失败或已取消'))
  }

  const themes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: '浅色', icon: <Sun size={15} /> },
    { value: 'dark', label: '深色', icon: <Moon size={15} /> },
    { value: 'system', label: '跟随系统', icon: <Monitor size={15} /> }
  ]
  const languages: { value: Language; label: string }[] = [
    { value: 'zh', label: '中文' },
    { value: 'en', label: 'English' }
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-2xl px-8 py-10">
        <h1 className="mb-7 font-serif text-[32px] leading-tight text-ink">{t('设置')}</h1>

        {/* Appearance */}
        <Section title={t('外观')}>
          <Row label={t('主题')}>
            <div className="flex gap-2">
              {themes.map((th) => (
                <button
                  key={th.value}
                  onClick={() => setTheme(th.value)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${
                    settings?.theme === th.value
                      ? 'border-brand/40 bg-brand/10 text-brand'
                      : 'border-line-strong text-muted hover:border-ring hover:text-ink'
                  }`}
                >
                  {th.icon}
                  {t(th.label)}
                </button>
              ))}
            </div>
          </Row>
          <Row label={t('语言')}>
            <div className="flex gap-2">
              {languages.map((lng) => (
                <button
                  key={lng.value}
                  onClick={() => setLanguage(lng.value)}
                  className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                    (settings?.language ?? 'zh') === lng.value
                      ? 'border-brand/40 bg-brand/10 text-brand'
                      : 'border-line-strong text-muted hover:border-ring hover:text-ink'
                  }`}
                >
                  {lng.label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Quick launch */}
        <Section title={t('快速调用')}>
          <Row label={t('全局热键')} description={t('在任意应用中唤起命令面板，托盘后台运行时也生效')}>
            <select
              value={settings?.globalHotkey ?? ''}
              onChange={(e) => handleHotkey(e.target.value)}
              className="rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-focus"
            >
              {HOTKEY_PRESETS.map((h) => (
                <option key={h.value} value={h.value}>
                  {h.label}
                </option>
              ))}
            </select>
          </Row>
        </Section>

        {/* Network */}
        <Section title={t('网络')}>
          <Row
            label={t('代理')}
            description={t('留空跟随系统；direct 为直连；或填 http:// 、socks5:// 地址')}
          >
            <ProxyInput value={settings?.proxy ?? ''} onSave={(v) => void setProxy(v)} />
          </Row>
          <Row
            label={t('允许联网获取市场内容')}
            description={t('仅在打开发现页时请求，不会后台联网')}
          >
            <Toggle
              checked={settings?.marketEnabled ?? true}
              onChange={(v) => void setMarket(v)}
            />
          </Row>
        </Section>

        {/* Discover sources */}
        <Section title={t('发现来源')}>
          <div className="mb-2 text-xs font-medium text-muted">{t('自定义 Prompt 源')}</div>
          <p className="mb-3 text-xs text-faint">
            {t('内置中英各一个推荐合集；可添加指向 CSV / JSON 文件的原始链接（act,prompt 列或 {act,prompt} 数组）。')}
          </p>
          <PromptSources
            sources={settings?.promptSources ?? []}
            onChange={(v) => void setPromptSources(v)}
          />
          <div className="mb-2 mt-5 text-xs font-medium text-muted">
            {t('自定义 Skill / Agent 仓库')}
          </div>
          <p className="mb-3 text-xs text-faint">
            {t('内置仓库为推荐来源；可添加你自己的 GitHub 仓库到 Skill / Agent 标签。')}
          </p>
          <GithubSources
            sources={settings?.githubSources ?? []}
            onChange={(v) => void setGithubSources(v)}
          />
          <div className="mb-2 mt-5 text-xs font-medium text-muted">
            {t('自定义 MCP 注册表')}
          </div>
          <p className="mb-3 text-xs text-faint">
            {t('官方注册表与 Smithery 已内置；可添加实现官方 /v0/servers 规范的注册表。')}
          </p>
          <McpRegistries
            registries={settings?.mcpRegistries ?? []}
            onChange={(v) => void setMcpRegistries(v)}
          />
        </Section>

        {/* Data */}
        <Section title={t('数据存储')}>
          <Row label={t('数据目录')} description={t('数据保存在本机此目录')}>
            <code className="max-w-xs truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-muted">
              {settings?.dataDir ?? '—'}
            </code>
          </Row>
          <div className="flex gap-2 pt-1">
            <ActionButton icon={<Database size={15} />} onClick={chooseDataDir}>
              {t('更改目录')}
            </ActionButton>
            <ActionButton icon={<FolderOpen size={15} />} onClick={openDataDir}>
              {t('打开目录')}
            </ActionButton>
          </div>
        </Section>

        {/* Import / Export */}
        <Section title={t('导入 / 导出')}>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={<Download size={15} />} onClick={handleExport}>
              {t('导出全部')}
            </ActionButton>
            <ActionButton icon={<Upload size={15} />} onClick={() => handleImport('merge')}>
              {t('导入（合并）')}
            </ActionButton>
            <ActionButton icon={<Upload size={15} />} danger onClick={() => handleImport('replace')}>
              {t('导入（替换）')}
            </ActionButton>
          </div>
        </Section>

        {/* Shortcuts */}
        <Section title={t('快捷键')}>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <ShortcutRow keys="⌘/Ctrl + K" label={t('命令面板(搜索全部资产)')} />
            <ShortcutRow keys="⌘/Ctrl + N" label={t('在当前工作区新建')} />
            <ShortcutRow keys="⌘/Ctrl + D" label={t('复制当前条目')} />
            <ShortcutRow keys="⌘/Ctrl + S" label={t('立即保存')} />
            <ShortcutRow keys="⌘/Ctrl + F" label={t('聚焦列表搜索')} />
            <ShortcutRow keys="⌘/Ctrl + 1~4" label={t('切换 Prompts / Skill / Agent / MCP')} />
            <ShortcutRow keys="⌘/Ctrl + ," label={t('打开设置')} />
            <ShortcutRow keys="⌘/Ctrl + Z" label={t('编辑器撤销 / 重做')} />
            <ShortcutRow keys="↑ ↓ / Enter" label={t('列表选择 / 复制')} />
            <ShortcutRow keys="Esc" label={t('关闭弹窗 / 返回')} />
          </div>
        </Section>

        {/* Backups */}
        <Section title={t('数据快照')}>
          <BackupSection />
        </Section>

        {/* About & Update */}
        <Section title={t('关于与更新')}>
          <UpdateRow />
          <div className="mt-4 flex items-center gap-2 text-xs text-faint">
            <Info size={14} className="shrink-0" />
            <p>
              {t('PromptBox · 本地 AI Prompt 资产库')} ·{' '}
              {t('{prompts} 个 Prompt、{categories} 个分类', {
                prompts: prompts.length,
                categories: categories.length
              })}
            </p>
          </div>
        </Section>
      </div>
    </div>
  )
}

function UpdateRow(): React.JSX.Element {
  const t = useT()
  const appVersion = useStore((s) => s.appVersion)
  const updateStatus = useStore((s) => s.updateStatus)
  const checkUpdate = useStore((s) => s.checkUpdate)
  const installUpdate = useStore((s) => s.installUpdate)
  const [checking, setChecking] = useState(false)

  async function handleCheck() {
    setChecking(true)
    const s = await checkUpdate()
    setChecking(false)
    if (s.state === 'dev') toast.info(t('开发模式下不检查更新，打包后生效'))
    else if (s.state === 'none') toast.success(t('已是最新版本'))
    else if (s.state === 'error') toast.error(t('检查失败：{message}', { message: s.message ?? '' }))
  }

  const st = updateStatus?.state
  const busy = checking || st === 'checking' || st === 'downloading'
  const statusText = ((): string => {
    switch (st) {
      case 'checking':
        return t('正在检查更新…')
      case 'available':
        return t('发现新版本 {version}，正在后台下载…', { version: updateStatus?.version ?? '' })
      case 'downloading':
        return t('下载中 {percent}%', { percent: updateStatus?.percent ?? 0 })
      case 'downloaded':
        return t('新版本 {version} 已就绪，重启即可安装', { version: updateStatus?.version ?? '' })
      case 'none':
        return t('已是最新版本')
      case 'error':
        return t('检查失败：{message}', { message: updateStatus?.message ?? '' })
      case 'dev':
        return t('开发模式，打包后可更新')
      default:
        return ''
    }
  })()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm text-ink">{t('版本 v{version}', { version: appVersion || '—' })}</div>
        {statusText && <div className="mt-0.5 text-xs text-faint">{statusText}</div>}
      </div>
      {st === 'downloaded' ? (
        <button
          onClick={() => void installUpdate()}
          className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-sm text-on-brand transition hover:bg-brand-strong"
        >
          <Download size={15} />
          {t('重启安装')}
        </button>
      ) : (
        <button
          onClick={handleCheck}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-sm text-muted transition hover:border-ring hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
          {t('检查更新')}
        </button>
      )}
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function BackupSection(): React.JSX.Element {
  const t = useT()
  const listBackups = useStore((s) => s.listBackups)
  const createBackup = useStore((s) => s.createBackup)
  const restoreBackup = useStore((s) => s.restoreBackup)
  const openBackupDir = useStore((s) => s.openBackupDir)

  const [backups, setBackups] = useState<BackupInfo[]>([])

  async function refresh() {
    setBackups(await listBackups())
  }
  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleCreate() {
    await createBackup()
    await refresh()
    toast.success(t('已创建快照'))
  }

  async function handleRestore(b: BackupInfo) {
    if (!confirm(t('从 {date} 的快照恢复？当前数据会被替换。', { date: formatDate(b.createdAt) }))) return
    const ok = await restoreBackup(b.file)
    if (ok) toast.success(t('已从快照恢复'))
    else toast.error(t('恢复失败'))
  }

  return (
    <div>
      <p className="mb-3 text-xs text-faint">{t('自动保存快照，最多保留 20 份。')}</p>
      <div className="mb-3 flex flex-wrap gap-2">
        <ActionButton icon={<Camera size={15} />} onClick={handleCreate}>
          {t('立即备份')}
        </ActionButton>
        <ActionButton icon={<FolderOpen size={15} />} onClick={openBackupDir}>
          {t('打开备份文件夹')}
        </ActionButton>
      </div>
      {backups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong py-6 text-center text-xs text-faint">
          {t('暂无快照')}
        </div>
      ) : (
        <div className="space-y-1.5">
          {backups.map((b) => (
            <div
              key={b.file}
              className="flex items-center justify-between rounded-xl border border-line-strong bg-surface px-3 py-2"
            >
              <div className="flex items-center gap-2">
                <Archive size={14} className="text-faint" />
                <div>
                  <div className="text-sm text-ink">{formatDate(b.createdAt)}</div>
                  <div className="text-[10px] text-faint">{formatSize(b.size)}</div>
                </div>
              </div>
              <button
                onClick={() => handleRestore(b)}
                className="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand"
              >
                <RotateCcw size={12} />
                {t('恢复')}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function PromptSources({
  sources,
  onChange
}: {
  sources: PromptSourceConfig[]
  onChange(v: PromptSourceConfig[]): void
}): React.JSX.Element {
  const t = useT()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [format, setFormat] = useState<'csv' | 'json'>('csv')

  function add() {
    const u = url.trim()
    if (!/^https?:\/\/.+/.test(u)) {
      toast.error(t('请输入有效的 URL'))
      return
    }
    if (sources.some((s) => s.url === u)) {
      toast.info(t('该来源已存在'))
      return
    }
    onChange([...sources, { name: name.trim() || u, url: u, format }])
    setName('')
    setUrl('')
    toast.success(t('已添加来源'))
  }

  return (
    <div className="space-y-2">
      {sources.length > 0 && (
        <div className="space-y-1.5">
          {sources.map((s, i) => (
            <div
              key={s.url}
              className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5"
            >
              <span className="rounded bg-surface-2 px-1.5 text-[10px] uppercase tracking-wide text-faint">
                {s.format}
              </span>
              <span className="shrink-0 text-xs text-ink">{s.name}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-faint">{s.url}</span>
              <button
                onClick={() => onChange(sources.filter((_, idx) => idx !== i))}
                className="text-faint transition hover:text-error"
                title={t('删除')}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('名称')}
          className="w-28 rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-focus"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="https://…/prompts.csv"
          spellCheck={false}
          className="flex-1 rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-focus"
        />
        <select
          value={format}
          onChange={(e) => setFormat(e.target.value as 'csv' | 'json')}
          className="rounded-xl border border-line-strong bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-focus"
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
        <ActionButton icon={<Plus size={14} />} onClick={add}>
          {t('添加')}
        </ActionButton>
      </div>
    </div>
  )
}

function GithubSources({
  sources,
  onChange
}: {
  sources: GithubSourceConfig[]
  onChange(v: GithubSourceConfig[]): void
}): React.JSX.Element {
  const t = useT()
  const [repo, setRepo] = useState('')
  const [kind, setKind] = useState<'skill' | 'agent'>('skill')

  function add() {
    const r = repo
      .trim()
      .replace(/^https?:\/\/github\.com\//i, '')
      .replace(/\.git$/i, '')
      .replace(/\/$/, '')
    if (!/^[^/]+\/[^/]+$/.test(r)) {
      toast.error(t('请输入 owner/repo 格式'))
      return
    }
    if (sources.some((s) => s.repo === r && s.kind === kind)) {
      toast.info(t('该来源已存在'))
      return
    }
    onChange([...sources, { repo: r, kind }])
    setRepo('')
    toast.success(t('已添加来源'))
  }

  return (
    <div className="space-y-2">
      {sources.length > 0 && (
        <div className="space-y-1.5">
          {sources.map((s, i) => (
            <div
              key={s.repo + s.kind}
              className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5"
            >
              <span className="rounded bg-surface-2 px-1.5 text-[10px] uppercase tracking-wide text-faint">
                {s.kind}
              </span>
              <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{s.repo}</span>
              <button
                onClick={() => onChange(sources.filter((_, idx) => idx !== i))}
                className="text-faint transition hover:text-error"
                title={t('删除')}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder={t('owner/repo')}
          spellCheck={false}
          className="flex-1 rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-focus"
        />
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as 'skill' | 'agent')}
          className="rounded-xl border border-line-strong bg-surface px-2 py-1.5 text-xs text-ink outline-none focus:border-focus"
        >
          <option value="skill">Skill</option>
          <option value="agent">Agent</option>
        </select>
        <ActionButton icon={<Plus size={14} />} onClick={add}>
          {t('添加')}
        </ActionButton>
      </div>
    </div>
  )
}

function McpRegistries({
  registries,
  onChange
}: {
  registries: McpRegistryConfig[]
  onChange(v: McpRegistryConfig[]): void
}): React.JSX.Element {
  const t = useT()
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')

  function add() {
    const u = url.trim().replace(/\/$/, '')
    if (!/^https?:\/\/.+/.test(u)) {
      toast.error(t('请输入有效的 URL'))
      return
    }
    if (registries.some((r) => r.url === u)) {
      toast.info(t('该来源已存在'))
      return
    }
    onChange([...registries, { name: name.trim() || u, url: u }])
    setName('')
    setUrl('')
    toast.success(t('已添加来源'))
  }

  return (
    <div className="space-y-2">
      {registries.length > 0 && (
        <div className="space-y-1.5">
          {registries.map((r, i) => (
            <div
              key={r.url}
              className="flex items-center gap-2 rounded-lg border border-line-strong bg-surface px-3 py-1.5"
            >
              <span className="shrink-0 text-xs text-ink">{r.name}</span>
              <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-faint">{r.url}</span>
              <button
                onClick={() => onChange(registries.filter((_, idx) => idx !== i))}
                className="text-faint transition hover:text-error"
                title={t('删除')}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('名称')}
          className="w-28 rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 text-xs text-ink outline-none focus:border-focus"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="https://…"
          spellCheck={false}
          className="flex-1 rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-focus"
        />
        <ActionButton icon={<Plus size={14} />} onClick={add}>
          {t('添加')}
        </ActionButton>
      </div>
    </div>
  )
}

function ProxyInput({
  value,
  onSave
}: {
  value: string
  onSave(v: string): void
}): React.JSX.Element {
  const t = useT()
  const [draft, setDraft] = useState(value)
  useEffect(() => setDraft(value), [value])
  const commit = () => {
    const v = draft.trim()
    if (v !== value) onSave(v)
  }
  return (
    <input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder={t('http://127.0.0.1:7890')}
      spellCheck={false}
      className="w-64 rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-focus"
    />
  )
}

function Toggle({
  checked,
  onChange
}: {
  checked: boolean
  onChange(v: boolean): void
}): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        checked ? 'bg-brand' : 'bg-surface-2'
      }`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${
          checked ? 'left-[18px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}

function ShortcutRow({ keys, label }: { keys: string; label: string }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted">{label}</span>
      <kbd className="shrink-0 rounded-md border border-line-strong px-1.5 py-0.5 font-mono text-[11px] text-faint">
        {keys}
      </kbd>
    </div>
  )
}

function Section({
  title,
  children
}: {
  title: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="mb-7 rounded-2xl border border-line-strong bg-surface p-6">
      <h2 className="mb-3 font-serif text-[20px] text-ink">{title}</h2>
      {children}
    </section>
  )
}

function Row({
  label,
  description,
  children
}: {
  label: string
  description?: string
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div>
        <div className="text-sm text-ink">{label}</div>
        {description && <div className="text-xs text-faint">{description}</div>}
      </div>
      {children}
    </div>
  )
}

function ActionButton({
  children,
  icon,
  onClick,
  danger
}: {
  children: React.ReactNode
  icon: React.ReactNode
  onClick(): void
  danger?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${
        danger
          ? 'border-error/30 text-error hover:bg-error/10'
          : 'border-line-strong text-muted hover:border-ring hover:bg-surface-2 hover:text-ink'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}
