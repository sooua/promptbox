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
  FileText,
  Info,
  Power,
  X
} from 'lucide-react'
import type { BackupInfo, CloseAction, Language, PromptSourceConfig, ThemeMode } from '@shared/types'
import { HOTKEY_PRESETS } from '@shared/types'
import { useStore } from '../store'
import { formatDate } from '../selectors'
import { useT } from '../i18n'
import { toast } from './Toast'

const CLOSE_ACTIONS: { value: CloseAction; label: string }[] = [
  { value: 'ask', label: '每次询问' },
  { value: 'tray', label: '最小化到托盘' },
  { value: 'quit', label: '直接退出' }
]

export function SettingsView(): React.JSX.Element {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const prompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const setTheme = useStore((s) => s.setTheme)
  const setLanguage = useStore((s) => s.setLanguage)
  const setMarket = useStore((s) => s.setMarket)
  const setProxy = useStore((s) => s.setProxy)
  const setPromptSources = useStore((s) => s.setPromptSources)
  const setHotkey = useStore((s) => s.setHotkey)
  const chooseDataDir = useStore((s) => s.chooseDataDir)
  const openDataDir = useStore((s) => s.openDataDir)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)
  const quitApp = useStore((s) => s.quitApp)
  const setCloseAction = useStore((s) => s.setCloseAction)
  const importPromptFiles = useStore((s) => s.importPromptFiles)

  async function handleImportFiles() {
    const res = await importPromptFiles(null)
    if (res.count > 0) toast.success(t('已导入 {n} 条 Prompt', { n: res.count }))
    if (res.failed.length > 0)
      toast.error(t('{n} 个文件无法读取：{names}', { n: res.failed.length, names: res.failed.join('、') }))
    else if (res.count === 0) toast.info(t('未导入任何文件'))
  }

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
    if (
      mode === 'replace' &&
      !confirm(
        t('替换导入会删除当前全部 {n} 条 Prompt 并用文件内容取代。\n\n继续前会自动创建一次备份，可在下方「本地备份」中恢复。确定继续？', {
          n: prompts.length
        })
      )
    )
      return
    const res = await importData(mode)
    if (!res.ok) {
      // `error` is set when the file was rejected (wrong format, corrupt);
      // absent when the user simply cancelled the picker.
      if (res.error) toast.error(res.error)
      return
    }
    if (mode === 'replace' && res.backedUp) toast.success(t('导入完成，旧数据已备份'))
    else toast.success(t('导入完成'))
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
      <div className="mx-auto max-w-2xl px-8 pb-16 pt-12">
        <h1 className="mb-10 font-serif text-[32px] leading-tight text-ink">{t('设置')}</h1>

        {/* Appearance.
            Control vocabulary rule for this page: up to three short options
            (especially with an icon) get a segmented button group; anything
            longer gets a <select>. Theme and language qualify; the hotkey list
            and the close-behaviour labels do not. */}
        <Section title={t('外观')}>
          <Row label={t('主题')}>
            <div className="flex gap-2" role="group" aria-label={t('主题')}>
              {themes.map((th) => (
                <button
                  key={th.value}
                  onClick={() => setTheme(th.value)}
                  aria-pressed={settings?.theme === th.value}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${
                    settings?.theme === th.value
                      ? 'border-brand/40 bg-brand/10 text-brand-text'
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
            <div className="flex gap-2" role="group" aria-label={t('语言')}>
              {languages.map((lng) => (
                <button
                  key={lng.value}
                  onClick={() => setLanguage(lng.value)}
                  aria-pressed={(settings?.language ?? 'zh') === lng.value}
                  className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                    (settings?.language ?? 'zh') === lng.value
                      ? 'border-brand/40 bg-brand/10 text-brand-text'
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
          <Row
            label={t('全局热键')}
            description={t('在任意应用中唤起命令面板，托盘后台运行时也生效')}
            controlId="set-hotkey"
          >
            <select
              id="set-hotkey"
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
            controlId="set-proxy"
          >
            <ProxyInput id="set-proxy" value={settings?.proxy ?? ''} onSave={(v) => void setProxy(v)} />
          </Row>
          <Row
            label={t('允许联网获取发现内容')}
            description={t('仅在打开发现页时请求，不会后台联网')}
          >
            <Toggle
              checked={settings?.marketEnabled ?? true}
              onChange={(v) => void setMarket(v)}
              label={t('允许联网获取发现内容')}
            />
          </Row>
        </Section>

        {/* Discover sources */}
        <Section title={t('发现来源')}>
          <div className="mb-2 text-xs font-medium text-muted">{t('自定义 Prompt 源')}</div>
          <p className="mb-3 text-xs text-faint">
            {t('已内置 10 个公开合集；可再添加指向 CSV / JSON 文件的原始链接（act,prompt 列或 {act,prompt} 数组）。')}
          </p>
          <PromptSources
            sources={settings?.promptSources ?? []}
            onChange={(v) => void setPromptSources(v)}
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
          <div className="mt-3 border-t border-line pt-3">
            <p className="mb-2 text-xs text-faint">
              {/* The parser reads `key: value` lines, not YAML — calling it YAML
                  promised nested structures and anchors that silently fail. */}
              {t('已有的 .md / .txt 提示词可直接导入，支持 front-matter 的 title / description / tags。')}
            </p>
            <ActionButton icon={<FileText size={15} />} onClick={handleImportFiles}>
              {t('从 Markdown 文件导入…')}
            </ActionButton>
          </div>
        </Section>

        {/* Shortcuts */}
        <Section title={t('快捷键')}>
          {/* Two columns only once there is room: at the narrow end the label
              and the key cap were colliding inside a 50% column. */}
          <div className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
            <ShortcutRow keys="⌘/Ctrl + K" label={t('命令面板（搜索全部 Prompt）')} />
            <ShortcutRow keys="⌘/Ctrl + N" label={t('新建 Prompt')} />
            <ShortcutRow keys="⌘/Ctrl + D" label={t('为当前条目创建副本')} />
            <ShortcutRow keys="⌘/Ctrl + S" label={t('立即保存')} />
            <ShortcutRow keys="⌘/Ctrl + F" label={t('聚焦列表搜索')} />
            <ShortcutRow keys="⌘/Ctrl + ," label={t('打开设置')} />
            <ShortcutRow keys="⌘/Ctrl + Z" label={t('编辑器撤销 / 重做')} />
            <ShortcutRow keys="↑ ↓ / Enter" label={t('列表选择 / 复制')} />
            <ShortcutRow keys="Esc" label={t('关闭弹窗 / 返回资产库')} />
          </div>
        </Section>

        {/* Backups */}
        <Section title={t('数据快照')}>
          <BackupSection />
        </Section>

        {/* About & Update */}
        <Section title={t('关于与更新')}>
          <UpdateRow />
          {/* A dropdown rather than a button group: the three labels are long
              enough that side-by-side buttons crowded the row. Matches the
              global-hotkey control above. */}
          <Row
            label={t('关闭窗口时')}
            description={t('最小化到托盘可让全局热键继续生效')}
            controlId="set-close-action"
          >
            <select
              id="set-close-action"
              value={settings?.closeAction ?? 'ask'}
              onChange={(e) => void setCloseAction(e.target.value as CloseAction)}
              className="rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 text-sm text-ink outline-none focus:border-focus"
            >
              {CLOSE_ACTIONS.map((c) => (
                <option key={c.value} value={c.value}>
                  {t(c.label)}
                </option>
              ))}
            </select>
          </Row>
          {/* Not a fourth close-behaviour option — an escape hatch. With the
              setting on "tray", Alt+F4 also just hides, leaving the tray menu as
              the only way out, and Windows tucks the tray icon into the overflow
              flyout where people don't find it. */}
          <Row label={t('退出 PromptBox')} description={t('完全关闭应用，同时移除托盘图标')}>
            <ActionButton icon={<Power size={15} />} danger onClick={() => void quitApp()}>
              {t('退出')}
            </ActionButton>
          </Row>
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
          className="flex items-center gap-1.5 rounded-xl bg-brand-solid px-3 py-1.5 text-sm text-on-brand transition hover:bg-brand-solid-hover"
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

/** How many snapshots to show before collapsing the rest behind a toggle. */
const COLLAPSED = 5

function BackupSection(): React.JSX.Element {
  const t = useT()
  const listBackups = useStore((s) => s.listBackups)
  const createBackup = useStore((s) => s.createBackup)
  const restoreBackup = useStore((s) => s.restoreBackup)
  const openBackupDir = useStore((s) => s.openBackupDir)

  const [backups, setBackups] = useState<BackupInfo[]>([])
  const [expanded, setExpanded] = useState(false)

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
          {(expanded ? backups : backups.slice(0, COLLAPSED)).map((b) => (
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
                className="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand-text"
              >
                <RotateCcw size={12} />
                {t('恢复')}
              </button>
            </div>
          ))}
          {/* Twenty snapshots pushed everything below this section off-screen,
              and only the newest few are realistically ever restored. */}
          {backups.length > COLLAPSED && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="w-full rounded-xl border border-dashed border-line-strong py-1.5 text-xs text-muted transition hover:border-ring hover:text-ink"
            >
              {expanded
                ? t('收起')
                : t('显示全部 {n} 份快照', { n: backups.length })}
            </button>
          )}
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


function ProxyInput({
  id,
  value,
  onSave
}: {
  id: string
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
      id={id}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder={t('http://127.0.0.1:7890')}
      spellCheck={false}
      // Fixed 16rem overflowed the row in a narrow window; cap instead.
      className="w-full max-w-64 rounded-xl border border-line-strong bg-surface px-2.5 py-1.5 font-mono text-xs text-ink outline-none focus:border-focus"
    />
  )
}

function Toggle({
  checked,
  onChange,
  label
}: {
  checked: boolean
  onChange(v: boolean): void
  /** The switch has no text of its own; without this it is announced unnamed. */
  label: string
}): React.JSX.Element {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition ${
        checked ? 'bg-brand' : 'bg-surface-2'
      }`}
    >
      {/* `bg-on-brand` rather than a hard-coded white: it is the token that
          means "sits on the terracotta fill" and it holds in both themes. */}
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-on-brand shadow-sm transition-all ${
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
    // Eight identically-boxed cards in a column made the chrome the loudest
    // thing on the page while telling the reader nothing — every section got
    // the same border whether it held one toggle or a whole list. A hairline
    // rule and real whitespace separate them just as clearly, and the boxes
    // that remain (the update banner, a snapshot row, an input) now mean
    // "this is an object you can act on" instead of "this is a section".
    <section className="mb-10 border-t border-line-strong pt-8 first:mt-0 first:border-0 first:pt-0 last:mb-0">
      <h2 className="mb-4 font-serif text-[20px] text-ink">{title}</h2>
      {children}
    </section>
  )
}

/**
 * `controlId` ties the visible label to the control with a real `<label>`, so
 * screen readers announce it and clicking the text focuses the input. Without
 * it every select on this page was announced as a bare "combobox".
 */
function Row({
  label,
  description,
  controlId,
  children
}: {
  label: string
  description?: string
  controlId?: string
  children: React.ReactNode
}): React.JSX.Element {
  const Label = controlId ? 'label' : 'div'
  return (
    // Wraps rather than overflowing: the label plus a 256px input does not fit
    // a narrow window side by side.
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-1.5">
      <div className="min-w-0">
        <Label htmlFor={controlId} className="block text-sm text-ink">
          {label}
        </Label>
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
