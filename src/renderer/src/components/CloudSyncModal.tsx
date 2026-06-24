import { useEffect, useState } from 'react'
import {
  Cloud,
  CloudOff,
  Database,
  Github,
  HardDrive,
  History,
  RefreshCw,
  RotateCcw,
  Server,
  X
} from 'lucide-react'
import type { SyncProviderId, SyncStatus, SyncVersion } from '@shared/types'
import { SYNC_PROVIDERS } from '@shared/types'
import { useStore } from '../store'
import { useT, t } from '../i18n'
import { formatDate, relativeTime } from '../selectors'
import { toast } from './Toast'

const ICONS: Record<SyncProviderId, React.ReactNode> = {
  gist: <Github size={22} />,
  gdrive: <HardDrive size={22} />,
  onedrive: <Cloud size={22} />,
  webdav: <Server size={22} />,
  s3: <Database size={22} />
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  idle: t('待同步'),
  uptodate: t('已是最新'),
  pushed: t('已上传'),
  pulled: t('已拉取'),
  conflict: t('存在冲突'),
  error: t('同步失败')
}

type Tab = 'services' | 'status'

export function CloudSyncModal(): React.JSX.Element {
  const close = useStore((s) => s.closeCloud)
  const syncState = useStore((s) => s.syncState)
  const syncBusy = useStore((s) => s.syncBusy)
  const connectGist = useStore((s) => s.connectGist)
  const connectWebdav = useStore((s) => s.connectWebdav)
  const connectS3 = useStore((s) => s.connectS3)
  const disconnectSync = useStore((s) => s.disconnectSync)
  const setAutoSync = useStore((s) => s.setAutoSync)
  const setEncryption = useStore((s) => s.setEncryption)
  const runSync = useStore((s) => s.runSync)
  const listSyncVersions = useStore((s) => s.listSyncVersions)
  const restoreSyncVersion = useStore((s) => s.restoreSyncVersion)
  const t = useT()

  const [tab, setTab] = useState<Tab>('services')
  const [connectingId, setConnectingId] = useState<SyncProviderId | null>(null)
  const [history, setHistory] = useState<SyncVersion[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [encOpen, setEncOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')

  async function applyEncryption() {
    if (!passphrase.trim()) return
    await setEncryption(true, passphrase.trim())
    setEncOpen(false)
    setPassphrase('')
    toast.success(t('已开启端到端加密，请在其它设备设置相同口令'))
  }
  async function disableEncryption() {
    await setEncryption(false, '')
    toast.info(t('已关闭端到端加密'))
  }

  // connect form state
  const [token, setToken] = useState('')
  const [dav, setDav] = useState({ url: '', username: '', password: '' })
  const [s3, setS3] = useState({
    endpoint: '',
    region: 'us-east-1',
    bucket: '',
    accessKeyId: '',
    secretAccessKey: '',
    prefix: ''
  })

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])

  function afterConnect(ok: boolean, name: string) {
    if (ok) {
      toast.success(t('已连接 {name}', { name }))
      setConnectingId(null)
    } else {
      toast.error(t('连接失败，请检查配置与凭证'))
    }
  }

  async function handleSync() {
    const r = await runSync()
    if (r.status === 'error') toast.error(r.message || t('同步失败'))
    else toast.success(r.message || t('同步完成'))
  }

  async function openHistory() {
    setLoadingHistory(true)
    setHistory(await listSyncVersions())
    setLoadingHistory(false)
  }

  async function handleRestore(v: SyncVersion) {
    if (!confirm(t('恢复到 {date} 的版本？当前数据会被替换。', { date: formatDate(v.createdAt) }))) return
    const r = await restoreSyncVersion(v.id)
    if (r.status === 'error') toast.error(r.message || t('恢复失败'))
    else {
      toast.success(t('已恢复该版本'))
      setHistory(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[8vh]" onClick={close}>
      <div
        className="flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl border border-line-strong bg-canvas shadow-[rgba(0,0,0,0.14)_0px_16px_56px]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <div className="flex flex-1 gap-1 rounded-xl bg-surface-2 p-1">
            <TabBtn active={tab === 'services'} onClick={() => setTab('services')}>
              {t('云服务')}
            </TabBtn>
            <TabBtn active={tab === 'status'} onClick={() => setTab('status')}>
              {t('同步状态')}
            </TabBtn>
          </div>
          <button onClick={close} className="rounded-lg p-1.5 text-faint transition hover:bg-surface-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {history ? (
            <HistoryPanel
              versions={history}
              loading={loadingHistory}
              busy={syncBusy}
              onBack={() => setHistory(null)}
              onRestore={handleRestore}
            />
          ) : tab === 'services' ? (
            <div className="space-y-3">
              {SYNC_PROVIDERS.map((prov) => {
                const connected = syncState?.provider === prov.id && syncState.connected
                const isConnecting = connectingId === prov.id
                return (
                  <div key={prov.id} className="rounded-2xl border border-line-strong bg-surface p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface-2 text-ink">
                        {ICONS[prov.id]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-ink">{prov.name}</span>
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              connected ? 'bg-emerald-500' : 'bg-faint/50'
                            }`}
                          />
                        </div>
                        <div className="text-xs text-faint">
                          {connected
                            ? `${syncState?.account ?? t('已连接')}${
                                syncState?.lastSyncedAt ? ' · ' + relativeTime(syncState.lastSyncedAt) : ''
                              }`
                            : prov.available
                              ? t('未连接')
                              : t('即将支持')}
                        </div>
                      </div>

                      {connected ? (
                        <div className="flex items-center gap-1 text-sm">
                          <CardAction
                            icon={<RefreshCw size={15} className={syncBusy ? 'animate-spin' : ''} />}
                            label={t('同步')}
                            onClick={handleSync}
                            disabled={syncBusy}
                          />
                          <CardAction icon={<History size={15} />} label={t('历史版本')} onClick={openHistory} />
                          <button
                            onClick={async () => {
                              await disconnectSync()
                              toast.info(t('已断开连接'))
                            }}
                            title={t('断开连接')}
                            className="rounded-lg p-1.5 text-faint transition hover:text-error"
                          >
                            <CloudOff size={16} />
                          </button>
                        </div>
                      ) : prov.available ? (
                        <button
                          onClick={() => setConnectingId(isConnecting ? null : prov.id)}
                          className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-sm text-[#faf9f5] transition hover:bg-brand-strong"
                        >
                          <Cloud size={15} />
                          {t('连接')}
                        </button>
                      ) : (
                        <span className="rounded-xl border border-line-strong px-3 py-2 text-xs text-faint">
                          {t('后续支持')}
                        </span>
                      )}
                    </div>

                    {connected && (
                      <div className="mt-3 flex items-center justify-between border-t border-line pt-3">
                        <div>
                          <div className="text-sm text-ink">{t('自动同步')}</div>
                          <div className="text-xs text-faint">{t('本地改动后自动上传')}</div>
                        </div>
                        <Switch
                          checked={syncState?.autoSync ?? false}
                          onChange={async (v) => {
                            await setAutoSync(v)
                            toast.success(v ? t('已开启自动同步') : t('已关闭自动同步'))
                          }}
                        />
                      </div>
                    )}

                    {connected && (
                      <div className="mt-3 border-t border-line pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-ink">{t('端到端加密')}</div>
                            <div className="text-xs text-faint">
                              {t('用口令加密上传的数据，云端只存密文（其它设备需相同口令）')}
                            </div>
                          </div>
                          <Switch
                            checked={syncState?.encrypted ?? false}
                            onChange={(v) => {
                              if (v) setEncOpen(true)
                              else void disableEncryption()
                            }}
                          />
                        </div>
                        {encOpen && !syncState?.encrypted && (
                          <div className="mt-2 flex gap-2">
                            <input
                              type="password"
                              value={passphrase}
                              onChange={(e) => setPassphrase(e.target.value)}
                              onKeyDown={(e) => e.key === 'Enter' && applyEncryption()}
                              placeholder={t('设置同步口令…')}
                              className="flex-1 rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-focus"
                            />
                            <button
                              onClick={applyEncryption}
                              className="rounded-xl bg-brand px-3 py-2 text-sm text-[#faf9f5] transition hover:bg-brand-strong"
                            >
                              {t('启用')}
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {!connected && isConnecting && prov.id === 'gist' && (
                      <ConnectForm>
                        <Label>
                          {t('GitHub Personal Access Token（需勾选')} <code className="var-chip">gist</code>{' '}
                          {t('权限）')}
                        </Label>
                        <div className="flex gap-2">
                          <input
                            type="password"
                            value={token}
                            onChange={(e) => setToken(e.target.value)}
                            placeholder="ghp_…"
                            className={inputCls}
                          />
                          <ConnectBtn
                            onClick={async () => afterConnect(await connectGist(token.trim()), 'GitHub Gist')}
                          />
                        </div>
                        <LinkBtn
                          onClick={() =>
                            window.open('https://github.com/settings/tokens/new?scopes=gist&description=PromptBox')
                          }
                        >
                          {t('前往 GitHub 创建 Token →')}
                        </LinkBtn>
                      </ConnectForm>
                    )}

                    {!connected && isConnecting && prov.id === 'webdav' && (
                      <ConnectForm>
                        <Label>{t('WebDAV 地址（指向一个目录，如坚果云 https://dav.jianguoyun.com/dav/PromptBox/）')}</Label>
                        <input
                          value={dav.url}
                          onChange={(e) => setDav({ ...dav, url: e.target.value })}
                          placeholder="https://example.com/dav/PromptBox/"
                          className={inputCls + ' mb-2'}
                        />
                        <div className="mb-2 flex gap-2">
                          <input
                            value={dav.username}
                            onChange={(e) => setDav({ ...dav, username: e.target.value })}
                            placeholder={t('用户名')}
                            className={inputCls}
                          />
                          <input
                            type="password"
                            value={dav.password}
                            onChange={(e) => setDav({ ...dav, password: e.target.value })}
                            placeholder={t('密码 / 应用密码')}
                            className={inputCls}
                          />
                        </div>
                        <ConnectBtn
                          full
                          onClick={async () => afterConnect(await connectWebdav(dav), 'WebDAV')}
                        />
                      </ConnectForm>
                    )}

                    {!connected && isConnecting && prov.id === 's3' && (
                      <ConnectForm>
                        <Label>{t('S3 兼容存储（AWS S3 / MinIO / Cloudflare R2 / Backblaze B2 等）')}</Label>
                        <input
                          value={s3.endpoint}
                          onChange={(e) => setS3({ ...s3, endpoint: e.target.value })}
                          placeholder={t('Endpoint，如 https://s3.amazonaws.com 或 https://xxx.r2.cloudflarestorage.com')}
                          className={inputCls + ' mb-2'}
                        />
                        <div className="mb-2 flex gap-2">
                          <input
                            value={s3.bucket}
                            onChange={(e) => setS3({ ...s3, bucket: e.target.value })}
                            placeholder="Bucket"
                            className={inputCls}
                          />
                          <input
                            value={s3.region}
                            onChange={(e) => setS3({ ...s3, region: e.target.value })}
                            placeholder={t('Region（如 us-east-1）')}
                            className={inputCls}
                          />
                        </div>
                        <div className="mb-2 flex gap-2">
                          <input
                            value={s3.accessKeyId}
                            onChange={(e) => setS3({ ...s3, accessKeyId: e.target.value })}
                            placeholder="Access Key ID"
                            className={inputCls}
                          />
                          <input
                            type="password"
                            value={s3.secretAccessKey}
                            onChange={(e) => setS3({ ...s3, secretAccessKey: e.target.value })}
                            placeholder="Secret Access Key"
                            className={inputCls}
                          />
                        </div>
                        <input
                          value={s3.prefix}
                          onChange={(e) => setS3({ ...s3, prefix: e.target.value })}
                          placeholder={t('路径前缀（可选，如 promptbox/）')}
                          className={inputCls + ' mb-2'}
                        />
                        <ConnectBtn
                          full
                          onClick={async () =>
                            afterConnect(
                              await connectS3({ ...s3, prefix: s3.prefix || undefined }),
                              t('S3 存储')
                            )
                          }
                        />
                      </ConnectForm>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <StatusPanel />
          )}
        </div>
      </div>
    </div>
  )
}

const inputCls =
  'flex-1 w-full rounded-xl border border-line-strong bg-canvas px-3 py-2 text-sm text-ink outline-none focus:border-focus'

function ConnectForm({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="mt-3 border-t border-line pt-3">{children}</div>
}
function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <label className="mb-1.5 block text-xs text-muted">{children}</label>
}
function ConnectBtn({ onClick, full }: { onClick(): void; full?: boolean }): React.JSX.Element {
  const t = useT()
  return (
    <button
      onClick={onClick}
      className={`rounded-xl bg-brand px-3 py-2 text-sm text-[#faf9f5] transition hover:bg-brand-strong ${
        full ? 'w-full' : ''
      }`}
    >
      {t('连接')}
    </button>
  )
}
function LinkBtn({ onClick, children }: { onClick(): void; children: React.ReactNode }): React.JSX.Element {
  return (
    <button onClick={onClick} className="mt-2 text-xs text-brand underline">
      {children}
    </button>
  )
}

function StatusPanel(): React.JSX.Element {
  const syncState = useStore((s) => s.syncState)
  const prompts = useStore((s) => s.prompts)
  const t = useT()
  if (!syncState?.connected) {
    return <div className="px-2 py-10 text-center text-sm text-faint">{t('尚未连接任何云服务。')}</div>
  }
  const status = syncState.lastStatus ?? 'idle'
  const providerName = SYNC_PROVIDERS.find((p) => p.id === syncState.provider)?.name ?? '—'
  return (
    <div className="space-y-3 text-sm">
      <Field label={t('云服务')}>{providerName}</Field>
      <Field label={t('账号')}>{syncState.account ?? '—'}</Field>
      <Field label={t('状态')}>
        <span
          className={`rounded-md px-2 py-0.5 text-xs ${
            status === 'error'
              ? 'bg-error/12 text-error'
              : status === 'conflict'
                ? 'bg-brand/15 text-brand'
                : 'bg-surface-2 text-muted'
          }`}
        >
          {STATUS_TEXT[status]}
        </span>
      </Field>
      {syncState.lastMessage && <Field label={t('详情')}>{syncState.lastMessage}</Field>}
      <Field label={t('上次同步')}>
        {syncState.lastSyncedAt ? formatDate(syncState.lastSyncedAt) : t('尚未同步')}
      </Field>
      <Field label={t('本地条目')}>{t('{count} 个 Prompt', { count: prompts.length })}</Field>
      <Field label={t('设备 ID')}>
        <code className="font-mono text-xs text-faint">{syncState.deviceId.slice(0, 12)}</code>
      </Field>
    </div>
  )
}

function HistoryPanel({
  versions,
  loading,
  busy,
  onBack,
  onRestore
}: {
  versions: SyncVersion[]
  loading: boolean
  busy: boolean
  onBack(): void
  onRestore(v: SyncVersion): void
}): React.JSX.Element {
  const t = useT()
  return (
    <div>
      <button onClick={onBack} className="mb-3 text-xs text-muted underline hover:text-ink">
        {t('← 返回')}
      </button>
      {loading ? (
        <div className="py-8 text-center text-sm text-faint">{t('加载中…')}</div>
      ) : versions.length === 0 ? (
        <div className="py-8 text-center text-sm text-faint">{t('暂无历史版本。')}</div>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-line-strong bg-surface px-3 py-2.5"
            >
              <div>
                <div className="text-sm text-ink">{formatDate(v.createdAt)}</div>
                <div className="font-mono text-[10px] text-faint">
                  {v.id.slice(0, 18)}
                  {v.label ? ` · ${v.label}` : ''}
                </div>
              </div>
              <button
                onClick={() => onRestore(v)}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg border border-line-strong px-2.5 py-1 text-xs text-muted transition hover:border-brand hover:text-brand disabled:opacity-50"
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

function TabBtn({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick(): void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-lg py-1.5 text-sm transition ${
        active ? 'bg-canvas font-medium text-ink shadow-sm' : 'text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function CardAction({
  icon,
  label,
  onClick,
  disabled
}: {
  icon: React.ReactNode
  label: string
  onClick(): void
  disabled?: boolean
}): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted transition hover:bg-surface-2 hover:text-ink disabled:opacity-50"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-2">
      <span className="text-xs text-faint">{label}</span>
      <span className="text-ink">{children}</span>
    </div>
  )
}

function Switch({
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
      className={`relative h-6 w-11 shrink-0 rounded-full transition ${
        checked ? 'bg-brand' : 'bg-surface-2'
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${
          checked ? 'left-[22px]' : 'left-0.5'
        }`}
      />
    </button>
  )
}
