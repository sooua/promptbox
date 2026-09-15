import { useEffect, useState } from 'react'
import { CloseIcon, DataIcon, DocumentIcon, DownloadIcon, FolderIcon, InfoIcon, RefreshIcon, SnapshotIcon, UploadIcon } from '../icons'
import type { CloseAction } from '@shared/types'
import { HOTKEY_PRESETS } from '@shared/types'
import { useStore } from '../store'
import { useT } from '../i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
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
  const setProxy = useStore((s) => s.setProxy)
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

  return (
    <div className="flex-1 overflow-y-auto bg-background">
      <div className="mx-auto max-w-2xl px-8 pb-16 pt-12">
        <h1 className="mb-10 font-semibold tracking-tight text-[32px] leading-tight text-foreground">{t('设置')}</h1>


        {/* Quick launch */}
        <Section title={t('快速调用')}>
          <Row
            label={t('全局热键')}
            description={t('在任意应用中唤起命令面板，托盘后台运行时也生效')}
            controlId="set-hotkey"
          >
            <Select value={settings?.globalHotkey ?? ''} onValueChange={(v) => handleHotkey(v as string)} items={HOTKEY_PRESETS}>
              <SelectTrigger id="set-hotkey" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {HOTKEY_PRESETS.map((h) => (
                  <SelectItem key={h.value} value={h.value}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
        </Section>

        {/* Network: the proxy serves sync and updates. */}
        <Section title={t('网络')}>
          <Row
            label={t('代理')}
            description={t('留空跟随系统；direct 为直连；或填 http:// 、socks5:// 地址')}
            controlId="set-proxy"
          >
            <ProxyInput id="set-proxy" value={settings?.proxy ?? ''} onSave={(v) => void setProxy(v)} />
          </Row>
        </Section>

        {/* Data */}
        <Section title={t('数据存储')}>
          <Row label={t('数据目录')} description={t('数据保存在本机此目录')}>
            <code className="max-w-xs truncate rounded-lg bg-muted px-2.5 py-1.5 font-mono text-xs text-muted-foreground">
              {settings?.dataDir ?? '—'}
            </code>
          </Row>
          <div className="flex gap-2 pt-1">
            <ActionButton icon={<DataIcon className="size-4" />} onClick={chooseDataDir}>
              {t('更改目录')}
            </ActionButton>
            <ActionButton icon={<FolderIcon className="size-4" />} onClick={openDataDir}>
              {t('打开目录')}
            </ActionButton>
          </div>
        </Section>

        {/* Import / Export */}
        <Section title={t('导入 / 导出')}>
          <div className="flex flex-wrap gap-2">
            <ActionButton icon={<DownloadIcon className="size-4" />} onClick={handleExport}>
              {t('导出全部')}
            </ActionButton>
            <ActionButton icon={<UploadIcon className="size-4" />} onClick={() => handleImport('merge')}>
              {t('导入（合并）')}
            </ActionButton>
            <ActionButton icon={<UploadIcon className="size-4" />} danger onClick={() => handleImport('replace')}>
              {t('导入（替换）')}
            </ActionButton>
          </div>
          <div className="mt-3 border-t border-border pt-3">
            <p className="mb-2 text-xs text-muted-foreground">
              {/* The parser reads `key: value` lines, not YAML — calling it YAML
                  promised nested structures and anchors that silently fail. */}
              {t('已有的 .md / .txt 提示词可直接导入，支持 front-matter 的 title / description / tags。')}
            </p>
            <ActionButton icon={<DocumentIcon className="size-4" />} onClick={handleImportFiles}>
              {t('从 Markdown 文件导入…')}
            </ActionButton>
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
            <Select
              value={settings?.closeAction ?? 'ask'}
              onValueChange={(v) => void setCloseAction(v as CloseAction)}
              items={CLOSE_ACTIONS.map((c) => ({ value: c.value, label: t(c.label) }))}
            >
              <SelectTrigger id="set-close-action" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLOSE_ACTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {t(c.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Row>
          {/* Not a fourth close-behaviour option — an escape hatch. With the
              setting on "tray", Alt+F4 also just hides, leaving the tray menu as
              the only way out, and Windows tucks the tray icon into the overflow
              flyout where people don't find it. */}
          <Row label={t('退出 PromptBox')} description={t('完全关闭应用，同时移除托盘图标')}>
            <ActionButton icon={<CloseIcon className="size-4" />} danger onClick={() => void quitApp()}>
              {t('退出')}
            </ActionButton>
          </Row>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <InfoIcon className="size-3.5 shrink-0" />
            <p>
              {t('PromptBox')}{' '}
              {t('{prompts} 个 Prompt、{categories} 个步骤', {
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
      <div className="min-w-0">
        <div className="text-sm text-foreground">{t('版本 v{version}', { version: appVersion || '—' })}</div>
        {statusText && <div className="mt-0.5 text-xs text-muted-foreground">{statusText}</div>}
      </div>
      {st === 'downloaded' ? (
        <Button onClick={() => void installUpdate()}>
          <DownloadIcon />
          {t('重启安装')}
        </Button>
      ) : (
        <Button variant="outline" onClick={handleCheck} disabled={busy}>
          <RefreshIcon className={busy ? 'animate-spin' : undefined} />
          {t('检查更新')}
        </Button>
      )}
    </div>
  )
}

function BackupSection(): React.JSX.Element {
  const t = useT()
  const createBackup = useStore((s) => s.createBackup)
  const openBackupDir = useStore((s) => s.openBackupDir)

  async function handleCreate() {
    await createBackup()
    toast.success(t('已创建快照'))
  }

  // ponytail: no in-app restore list. Snapshots are plain JSON in a folder the
  // user can open; corrupt-file recovery already restores the newest one
  // automatically. Bring the list back if people ask how to roll back.
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">{t('自动保存快照，最多保留 20 份。要回滚时，把快照文件用「导入（替换）」导入即可。')}</p>
      <div className="flex flex-wrap gap-2">
        <ActionButton icon={<SnapshotIcon className="size-4" />} onClick={handleCreate}>
          {t('立即备份')}
        </ActionButton>
        <ActionButton icon={<FolderIcon className="size-4" />} onClick={openBackupDir}>
          {t('打开备份文件夹')}
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
    <Input
      id={id}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      placeholder={t('http://127.0.0.1:7890')}
      spellCheck={false}
      // Fixed 16rem overflowed the row in a narrow window; cap instead.
      className="w-full max-w-64 font-mono text-xs"
    />
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
    <section className="mb-10 border-t border-border pt-8 first:mt-0 first:border-0 first:pt-0 last:mb-0">
      <h2 className="mb-4 font-semibold tracking-tight text-[20px] text-foreground">{title}</h2>
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
        <Label htmlFor={controlId} className="block text-sm text-foreground">
          {label}
        </Label>
        {description && <div className="text-xs text-muted-foreground">{description}</div>}
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
    <Button variant={danger ? 'destructive' : 'outline'} onClick={onClick}>
      {icon}
      {children}
    </Button>
  )
}
