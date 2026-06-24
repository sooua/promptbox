import { useEffect, useState } from 'react'
import {
  Archive,
  Camera,
  Download,
  FolderOpen,
  Monitor,
  Moon,
  RefreshCw,
  RotateCcw,
  Sun,
  Upload,
  Database,
  Info
} from 'lucide-react'
import type { BackupInfo, ThemeMode } from '@shared/types'
import { HOTKEY_PRESETS } from '@shared/types'
import { useStore } from '../store'
import { formatDate } from '../selectors'
import { toast } from './Toast'

export function SettingsView(): React.JSX.Element {
  const settings = useStore((s) => s.settings)
  const prompts = useStore((s) => s.prompts)
  const categories = useStore((s) => s.categories)
  const setTheme = useStore((s) => s.setTheme)
  const setHotkey = useStore((s) => s.setHotkey)
  const chooseDataDir = useStore((s) => s.chooseDataDir)
  const openDataDir = useStore((s) => s.openDataDir)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)

  async function handleExport() {
    const res = await exportData()
    if (res.ok) toast.success('数据已导出')
  }

  async function handleHotkey(accelerator: string) {
    const ok = await setHotkey(accelerator)
    if (ok) toast.success('全局热键已更新')
    else toast.error('该热键被系统或其他应用占用，请换一个')
  }

  async function handleImport(mode: 'merge' | 'replace') {
    if (mode === 'replace' && !confirm('替换导入会覆盖当前全部数据，确定继续？')) return
    const res = await importData(mode)
    if (res.ok) toast.success('导入完成')
    else toast.error('导入失败或已取消')
  }

  const themes: { value: ThemeMode; label: string; icon: React.ReactNode }[] = [
    { value: 'light', label: '浅色', icon: <Sun size={15} /> },
    { value: 'dark', label: '深色', icon: <Moon size={15} /> },
    { value: 'system', label: '跟随系统', icon: <Monitor size={15} /> }
  ]

  return (
    <div className="flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-2xl px-8 py-10">
        <h1 className="mb-7 font-serif text-[32px] leading-tight text-ink">设置</h1>

        {/* Appearance */}
        <Section title="外观">
          <Row label="主题">
            <div className="flex gap-2">
              {themes.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setTheme(t.value)}
                  className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm transition ${
                    settings?.theme === t.value
                      ? 'border-brand/40 bg-brand/10 text-brand'
                      : 'border-line-strong text-muted hover:border-ring hover:text-ink'
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          </Row>
        </Section>

        {/* Quick launch */}
        <Section title="快速调用">
          <Row
            label="全局热键"
            description="在任何应用中按下即可唤起命令面板（应用最小化到托盘后仍生效）"
          >
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
          <p className="mt-1 text-xs text-faint">
            关闭主窗口会最小化到系统托盘，应用继续在后台运行；可从托盘图标右键菜单退出。
            应用内任意位置按 <Kbd>Ctrl/⌘ + K</Kbd> 也可打开面板。
          </p>
        </Section>

        {/* Data */}
        <Section title="数据存储">
          <Row label="数据目录" description="所有 Prompt 默认以 JSON 保存在本机此目录">
            <code className="max-w-xs truncate rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-xs text-muted">
              {settings?.dataDir ?? '—'}
            </code>
          </Row>
          <div className="flex gap-2 pt-1">
            <ActionButton icon={<Database size={15} />} onClick={chooseDataDir}>
              更改目录
            </ActionButton>
            <ActionButton icon={<FolderOpen size={15} />} onClick={openDataDir}>
              在文件管理器打开
            </ActionButton>
          </div>
        </Section>

        {/* Import / Export */}
        <Section title="导入 / 导出">
          <p className="mb-3 text-xs text-faint">
            导出为单个 JSON 文件用于备份或迁移；导入时可选择合并或替换。
          </p>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={<Download size={15} />} onClick={handleExport}>
              导出全部
            </ActionButton>
            <ActionButton icon={<Upload size={15} />} onClick={() => handleImport('merge')}>
              导入（合并）
            </ActionButton>
            <ActionButton icon={<Upload size={15} />} danger onClick={() => handleImport('replace')}>
              导入（替换）
            </ActionButton>
          </div>
        </Section>

        {/* Shortcuts */}
        <Section title="快捷键">
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <ShortcutRow keys="⌘/Ctrl + K" label="命令面板(搜索全部资产)" />
            <ShortcutRow keys="⌘/Ctrl + N" label="在当前工作区新建" />
            <ShortcutRow keys="⌘/Ctrl + D" label="复制当前条目" />
            <ShortcutRow keys="⌘/Ctrl + S" label="立即保存" />
            <ShortcutRow keys="⌘/Ctrl + F" label="聚焦列表搜索" />
            <ShortcutRow keys="⌘/Ctrl + 1~4" label="切换 Prompts / Skill / Agent / MCP" />
            <ShortcutRow keys="⌘/Ctrl + ," label="打开设置" />
            <ShortcutRow keys="⌘/Ctrl + Z" label="编辑器撤销 / 重做" />
            <ShortcutRow keys="↑ ↓ / Enter" label="列表选择 / 复制" />
            <ShortcutRow keys="Esc" label="关闭弹窗 / 返回" />
          </div>
        </Section>

        {/* Backups */}
        <Section title="数据快照">
          <BackupSection />
        </Section>

        {/* About & Update */}
        <Section title="关于与更新">
          <UpdateRow />
          <div className="mt-4 flex items-start gap-2 text-xs text-faint">
            <Info size={14} className="mt-0.5 shrink-0" />
            <div className="leading-[1.6]">
              <p>
                PromptBox · 本地优先的 AI Prompt 资产管理工具。当前共{' '}
                <span className="text-muted">{prompts.length}</span> 个 Prompt、
                <span className="text-muted">{categories.length}</span> 个分类。
              </p>
              <p className="mt-1">
                所有数据保存在本机，不上传任何服务器。后续可扩展云同步、团队协作、多模型测试、Agent
                / Skill / MCP 配置管理等能力。
              </p>
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}

function UpdateRow(): React.JSX.Element {
  const appVersion = useStore((s) => s.appVersion)
  const updateStatus = useStore((s) => s.updateStatus)
  const checkUpdate = useStore((s) => s.checkUpdate)
  const installUpdate = useStore((s) => s.installUpdate)
  const [checking, setChecking] = useState(false)

  async function handleCheck() {
    setChecking(true)
    const s = await checkUpdate()
    setChecking(false)
    if (s.state === 'dev') toast.info('开发模式下不检查更新，打包后生效')
    else if (s.state === 'none') toast.success('已是最新版本')
    else if (s.state === 'error') toast.error(`检查失败：${s.message ?? ''}`)
  }

  const st = updateStatus?.state
  const busy = checking || st === 'checking' || st === 'downloading'
  const statusText = ((): string => {
    switch (st) {
      case 'checking':
        return '正在检查更新…'
      case 'available':
        return `发现新版本 ${updateStatus?.version ?? ''}，正在后台下载…`
      case 'downloading':
        return `下载中 ${updateStatus?.percent ?? 0}%`
      case 'downloaded':
        return `新版本 ${updateStatus?.version ?? ''} 已就绪，重启即可安装`
      case 'none':
        return '已是最新版本'
      case 'error':
        return `检查失败：${updateStatus?.message ?? ''}`
      case 'dev':
        return '开发模式（在线更新打包后生效）'
      default:
        return '可手动检查，或在发布新版本后自动提示'
    }
  })()

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line-strong bg-surface px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm text-ink">当前版本 v{appVersion || '—'}</div>
        <div className="mt-0.5 text-xs text-faint">{statusText}</div>
      </div>
      {st === 'downloaded' ? (
        <button
          onClick={() => void installUpdate()}
          className="flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-sm text-[#faf9f5] transition hover:bg-brand-strong"
        >
          <Download size={15} />
          重启安装
        </button>
      ) : (
        <button
          onClick={handleCheck}
          disabled={busy}
          className="flex items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 py-1.5 text-sm text-muted transition hover:border-ring hover:text-ink disabled:opacity-50"
        >
          <RefreshCw size={15} className={busy ? 'animate-spin' : ''} />
          检查更新
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
    toast.success('已创建快照')
  }

  async function handleRestore(b: BackupInfo) {
    if (!confirm(`从 ${formatDate(b.createdAt)} 的快照恢复？当前数据会被替换。`)) return
    const ok = await restoreBackup(b.file)
    if (ok) toast.success('已从快照恢复')
    else toast.error('恢复失败')
  }

  return (
    <div>
      <p className="mb-3 text-xs text-faint">
        每次启动会自动保存一份快照（与上一份相同则跳过），最多保留 20 份，存放在数据目录的{' '}
        <code className="font-mono">backups/</code> 文件夹。
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        <ActionButton icon={<Camera size={15} />} onClick={handleCreate}>
          立即备份
        </ActionButton>
        <ActionButton icon={<FolderOpen size={15} />} onClick={openBackupDir}>
          打开备份文件夹
        </ActionButton>
      </div>
      {backups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line-strong py-6 text-center text-xs text-faint">
          暂无快照
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
                恢复
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
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

function Kbd({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <kbd className="rounded-md border border-line-strong px-1 text-[10px] text-muted">
      {children}
    </kbd>
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
