import { useState } from 'react'
import { CloseIcon, CloudIcon, DataIcon, GithubIcon, HistoryIcon, RefreshIcon, ServerIcon } from '../icons'
import type { SyncProviderId, SyncStatus, SyncVersion } from '@shared/types'
import { SYNC_PROVIDERS } from '@shared/types'
import { useStore } from '../store'
import { useT, t } from '../i18n'
import { formatDate, relativeTime } from '../selectors'
import { Modal } from './Modal'
import { Switch } from './Switch'
import { toast } from './Toast'

const ICONS: Record<SyncProviderId, React.ReactNode> = {
  gist: <GithubIcon className="size-5" />,
  webdav: <ServerIcon className="size-5" />,
  s3: <DataIcon className="size-5" />
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

  const credentialBroken = syncState?.credentialError ?? false

  const [tab, setTab] = useState<Tab>('services')
  const [connectingId, setConnectingId] = useState<SyncProviderId | null>(null)
  const [history, setHistory] = useState<SyncVersion[] | null>(null)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [encOpen, setEncOpen] = useState(false)
  const [passphrase, setPassphrase] = useState('')
  const [passphrase2, setPassphrase2] = useState('')

  // A typo here is unrecoverable: this machine keeps working with the wrong
  // passphrase while every other device can never decrypt the remote blob.
  const passMismatch = passphrase2.length > 0 && passphrase.trim() !== passphrase2.trim()

  async function applyEncryption() {
    if (!passphrase.trim()) return
    if (passphrase.trim() !== passphrase2.trim()) {
      toast.error(t('两次输入的口令不一致'))
      return
    }
    await setEncryption(true, passphrase.trim())
    setEncOpen(false)
    setPassphrase('')
    setPassphrase2('')
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
    // Restoring also pushes the old snapshot back up as the new remote head, so
    // every other device gets overwritten too. Say that out loud.
    if (
      !confirm(
        t('恢复到 {date} 的版本？\n\n本机当前数据会被替换，并作为新版本上传到云端——其它已连接的设备也会同步到这个旧版本。', {
          date: formatDate(v.createdAt)
        })
      )
    )
      return
    const r = await restoreSyncVersion(v.id)
    if (r.status === 'error') toast.error(r.message || t('恢复失败'))
    else {
      toast.success(t('已恢复该版本'))
      setHistory(null)
    }
  }

  return (
    <Modal
      onClose={close}
      ariaLabel={t('云同步')}
      overlayClassName="fixed inset-0 z-50 flex items-start justify-center bg-black/30 pt-[8vh]"
      className="flex max-h-[82vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-[rgba(0,0,0,0.14)_0px_16px_56px]"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <div className="flex flex-1 gap-1 rounded-xl bg-muted p-1">
            <TabBtn active={tab === 'services'} onClick={() => setTab('services')}>
              {t('云服务')}
            </TabBtn>
            <TabBtn active={tab === 'status'} onClick={() => setTab('status')}>
              {t('同步状态')}
            </TabBtn>
          </div>
          <button onClick={close} className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground">
            <CloseIcon className="size-4.5" />
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
                  <div key={prov.id} className="rounded-xl border border-border bg-card p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted text-foreground">
                        {ICONS[prov.id]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{prov.name}</span>
                          <span
                            className={`inline-block h-2 w-2 rounded-full ${
                              connected ? 'bg-success' : 'bg-faint/50'
                            }`}
                          />
                        </div>
                        <div
                          className={`text-xs ${
                            credentialBroken && syncState?.provider === prov.id
                              ? 'text-destructive'
                              : 'text-muted-foreground'
                          }`}
                        >
                          {connected
                            ? `${syncState?.account ?? t('已连接')}${
                                syncState?.lastSyncedAt ? '，' + relativeTime(syncState.lastSyncedAt) : ''
                              }`
                            : credentialBroken && syncState?.provider === prov.id
                              ? t('凭证无法在本机解密，请重新连接')
                              : t('未连接')}
                        </div>
                      </div>

                      {connected ? (
                        <div className="flex items-center gap-1 text-sm">
                          <CardAction
                            icon={<RefreshIcon className={syncBusy ? 'size-4 animate-spin' : 'size-4'} />}
                            label={t('同步')}
                            onClick={handleSync}
                            disabled={syncBusy}
                          />
                          <CardAction icon={<HistoryIcon className="size-4" />} label={t('历史版本')} onClick={openHistory} />
                          <button
                            onClick={async () => {
                              await disconnectSync()
                              toast.info(t('已断开连接'))
                            }}
                            title={t('断开连接')}
                            className="rounded-lg p-1.5 text-muted-foreground transition hover:text-destructive"
                          >
                            <CloudIcon className="size-4" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConnectingId(isConnecting ? null : prov.id)}
                          className="flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm text-primary-foreground transition hover:bg-primary/80"
                        >
                          <CloudIcon className="size-4" />
                          {t('连接')}
                        </button>
                      )}
                    </div>

                    {connected && (
                      <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
                        <div>
                          <div className="text-sm text-foreground">{t('自动同步')}</div>
                          <div className="text-xs text-muted-foreground">{t('本地改动后自动上传')}</div>
                        </div>
                        <Switch
                          label={t('自动同步')}
                          checked={syncState?.autoSync ?? false}
                          onChange={async (v) => {
                            await setAutoSync(v)
                            toast.success(v ? t('已开启自动同步') : t('已关闭自动同步'))
                          }}
                        />
                      </div>
                    )}

                    {connected && (
                      <div className="mt-3 border-t border-border pt-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm text-foreground">{t('端到端加密')}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('用口令加密上传的数据，云端只存密文（其它设备需相同口令）')}
                            </div>
                          </div>
                          <Switch
                            label={t('端到端加密')}
                            checked={syncState?.encrypted ?? false}
                            onChange={(v) => {
                              if (v) setEncOpen(true)
                              else void disableEncryption()
                            }}
                          />
                        </div>
                        {encOpen && !syncState?.encrypted && (
                          <div className="mt-2 space-y-2">
                            <p className="text-xs text-destructive">
                              {t('口令只保存在本机，无法找回。忘记后云端数据将永久无法解密。')}
                            </p>
                            <input
                              type="password"
                              value={passphrase}
                              onChange={(e) => setPassphrase(e.target.value)}
                              placeholder={t('设置同步口令…')}
                              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring"
                            />
                            <div className="flex gap-2">
                              <input
                                type="password"
                                value={passphrase2}
                                onChange={(e) => setPassphrase2(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && applyEncryption()}
                                placeholder={t('再次输入口令')}
                                className={`flex-1 rounded-xl border bg-background px-3 py-2 text-sm text-foreground outline-none ${
                                  passMismatch ? 'border-destructive' : 'border-border focus:border-ring'
                                }`}
                              />
                              <button
                                onClick={applyEncryption}
                                disabled={!passphrase.trim() || passMismatch || !passphrase2}
                                className="rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground transition hover:bg-primary/80 disabled:opacity-40"
                              >
                                {t('启用')}
                              </button>
                            </div>
                            {passMismatch && (
                              <p className="text-xs text-destructive">{t('两次输入的口令不一致')}</p>
                            )}
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
                          {t('前往 GitHub 创建 Token')}
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
    </Modal>
  )
}

const inputCls =
  'flex-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-ring'

function ConnectForm({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <div className="mt-3 border-t border-border pt-3">{children}</div>
}
function Label({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <label className="mb-1.5 block text-xs text-muted-foreground">{children}</label>
}
function ConnectBtn({ onClick, full }: { onClick(): void; full?: boolean }): React.JSX.Element {
  const t = useT()
  return (
    <button
      onClick={onClick}
      className={`rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground transition hover:bg-primary/80 ${
        full ? 'w-full' : ''
      }`}
    >
      {t('连接')}
    </button>
  )
}
function LinkBtn({ onClick, children }: { onClick(): void; children: React.ReactNode }): React.JSX.Element {
  return (
    <button onClick={onClick} className="mt-2 text-xs text-foreground underline">
      {children}
    </button>
  )
}

function StatusPanel(): React.JSX.Element {
  const syncState = useStore((s) => s.syncState)
  const prompts = useStore((s) => s.prompts)
  const t = useT()
  if (!syncState?.connected) {
    return (
      <div className="px-2 py-10 text-center text-sm text-muted-foreground">
        {syncState?.credentialError
          ? t('已配置云服务，但凭证无法在本机解密。请在「云服务」页重新连接。')
          : t('尚未连接任何云服务。')}
      </div>
    )
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
              ? 'bg-destructive/12 text-destructive'
              : status === 'conflict'
                ? 'bg-primary/15 text-foreground'
                : 'bg-muted text-muted-foreground'
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
        <code className="font-mono text-xs text-muted-foreground">{syncState.deviceId.slice(0, 12)}</code>
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
      <button onClick={onBack} className="mb-3 text-xs text-muted-foreground underline hover:text-foreground">
        {t('← 返回')}
      </button>
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('加载中…')}</div>
      ) : versions.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">{t('暂无历史版本。')}</div>
      ) : (
        <div className="space-y-2">
          {versions.map((v) => (
            <div
              key={v.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5"
            >
              <div>
                <div className="text-sm text-foreground">{formatDate(v.createdAt)}</div>
                <div className="font-mono text-[10px] text-muted-foreground">
                  {v.id.slice(0, 18)}
                  {v.label ? `，${v.label}` : ''}
                </div>
              </div>
              <button
                onClick={() => onRestore(v)}
                disabled={busy}
                className="flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs text-muted-foreground transition hover:border-primary hover:text-foreground disabled:opacity-50"
              >
                <HistoryIcon className="size-3" />
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
        active ? 'bg-background font-medium text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
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
      className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50"
    >
      {icon}
      <span className="text-xs">{label}</span>
    </button>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-foreground">{children}</span>
    </div>
  )
}

