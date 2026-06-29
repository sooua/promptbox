import { createHash } from 'crypto'
import type {
  Asset,
  Category,
  Prompt,
  S3ConfigInput,
  SyncEnvelope,
  SyncResult,
  SyncState,
  SyncStatus,
  SyncVersion,
  Tombstone,
  WebDavConfigInput
} from '@shared/types'
import type { Repository } from '../store/repository'
import { loadSyncConfig, saveSyncConfig, type SyncConfig } from './config'
import { GistProvider, testGistToken } from './gist'
import { WebDavProvider, testWebDav } from './webdav'
import { S3Provider, testS3 } from './s3'
import { decryptPayload, encryptPayload, isEncrypted } from './crypto'
import type { SyncProvider } from './provider'

const SCHEMA = 1
const AUTO_DEBOUNCE_MS = 4000
/** Cap for exponential backoff after repeated auto-sync failures. */
const AUTO_BACKOFF_MAX_MS = 5 * 60 * 1000
const TOMBSTONE_TTL_MS = 90 * 24 * 60 * 60 * 1000

interface Bundle {
  prompts: Prompt[]
  categories: Category[]
  assets: Asset[]
  tombstones: Tombstone[]
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

type WithMeta = { id: string; updatedAt: number }

/** Merge two collections by id, keeping the newer item; deleted ids drop out. */
export function mergeCollection<T extends WithMeta>(a: T[], b: T[], tombs: Map<string, number>): T[] {
  const map = new Map<string, T>()
  for (const item of [...a, ...b]) {
    const existing = map.get(item.id)
    if (!existing || item.updatedAt > existing.updatedAt) map.set(item.id, item)
  }
  const out: T[] = []
  for (const item of map.values()) {
    const deletedAt = tombs.get(item.id)
    if (deletedAt != null && deletedAt >= item.updatedAt) continue // deletion wins
    out.push(item)
  }
  return out
}

/** Count items the merge adds to / removes from the local bundle (for UX visibility). */
function bundleDelta(local: Bundle, merged: Bundle): { added: number; removed: number } {
  const ids = (b: Bundle) =>
    new Set([...b.prompts, ...b.categories, ...b.assets].map((x) => x.id))
  const before = ids(local)
  const after = ids(merged)
  let added = 0
  let removed = 0
  for (const id of after) if (!before.has(id)) added++
  for (const id of before) if (!after.has(id)) removed++
  return { added, removed }
}

export function mergeTombstones(a: Tombstone[], b: Tombstone[]): Tombstone[] {
  const map = new Map<string, Tombstone>()
  for (const t of [...a, ...b]) {
    const e = map.get(t.id)
    if (!e || t.deletedAt > e.deletedAt) map.set(t.id, t)
  }
  const cutoff = Date.now() - TOMBSTONE_TTL_MS
  return [...map.values()].filter((t) => t.deletedAt >= cutoff)
}

/** Item-level three-way-ish merge: newer wins per item, deletions propagate. */
export function mergeBundles(local: Bundle, remote: Bundle): Bundle {
  const tombstones = mergeTombstones(local.tombstones, remote.tombstones)
  const tombMap = new Map(tombstones.map((t) => [t.id, t.deletedAt]))
  return {
    prompts: mergeCollection(local.prompts, remote.prompts, tombMap),
    categories: mergeCollection(local.categories, remote.categories, tombMap),
    assets: mergeCollection(local.assets, remote.assets, tombMap),
    tombstones
  }
}

/**
 * Provider-agnostic sync engine. Holds the local repository + sync metadata and
 * implements the conflict-aware push/pull decision:
 *   - only local changed  → push
 *   - only remote changed → pull
 *   - both changed        → conflict (user resolves)
 */
export class SyncEngine {
  private config: SyncConfig
  private pendingRemote: SyncEnvelope | null = null
  private autoTimer: ReturnType<typeof setTimeout> | null = null
  private running = false
  /** consecutive auto-sync failures, drives exponential backoff */
  private autoFailures = 0
  /** suppress auto-sync while we ourselves write to the repo (pull/restore) */
  private suppressAuto = false
  private notifier?: (result: SyncResult) => void

  constructor(private repo: Repository) {
    this.config = loadSyncConfig()
    this.repo.onChange(() => this.onLocalChange())
  }

  /** Wire a callback so the renderer can be told when an auto-sync completes. */
  setNotifier(fn: (result: SyncResult) => void): void {
    this.notifier = fn
  }

  getState(): SyncState {
    const p = this.config.provider
    const account =
      p === 'gist'
        ? this.config.gist?.account
        : p === 'webdav'
          ? this.config.webdav?.account
          : p === 's3'
            ? this.config.s3?.account
            : undefined
    return {
      provider: p,
      connected: this.hasCreds(),
      account,
      autoSync: this.config.autoSync ?? false,
      encrypted: !!this.config.encryption?.enabled,
      lastSyncedAt: this.config.lastSyncedAt,
      lastStatus: this.config.lastStatus,
      lastMessage: this.config.lastMessage,
      deviceId: this.config.deviceId
    }
  }

  setAutoSync(enabled: boolean): SyncState {
    this.config.autoSync = enabled
    saveSyncConfig(this.config)
    // enabling pushes the current state shortly after
    if (enabled) this.onLocalChange()
    return this.getState()
  }

  /** Enable/disable end-to-end encryption of the synced blob. */
  setEncryption(enabled: boolean, passphrase: string): SyncState {
    if (enabled && passphrase.trim()) {
      this.config.encryption = { enabled: true, passphrase: passphrase.trim() }
    } else {
      this.config.encryption = undefined
    }
    // remote format changes → re-establish on next sync
    this.config.lastSyncedHash = undefined
    this.config.lastRemoteUpdatedAt = undefined
    saveSyncConfig(this.config)
    return this.getState()
  }

  private encode(env: SyncEnvelope): string {
    const json = JSON.stringify(env, null, 2)
    const enc = this.config.encryption
    return enc?.enabled ? encryptPayload(json, enc.passphrase) : json
  }

  private decode(raw: string): SyncEnvelope {
    if (isEncrypted(raw)) {
      const enc = this.config.encryption
      if (!enc?.enabled || !enc.passphrase) {
        throw new Error('云端数据已加密，请先在本机设置相同的同步口令')
      }
      try {
        return JSON.parse(decryptPayload(raw, enc.passphrase)) as SyncEnvelope
      } catch {
        throw new Error('解密失败：同步口令不正确或数据已损坏')
      }
    }
    return JSON.parse(raw) as SyncEnvelope
  }

  /** Debounce a background sync after local edits when auto-sync is on. */
  private onLocalChange(): void {
    if (this.suppressAuto || !this.config.autoSync || !this.hasCreds()) return
    if (this.autoTimer) clearTimeout(this.autoTimer)
    this.autoTimer = setTimeout(() => void this.autoRun(), AUTO_DEBOUNCE_MS)
  }

  private async autoRun(): Promise<void> {
    if (this.running) {
      // a sync is in flight; try again shortly
      this.autoTimer = setTimeout(() => void this.autoRun(), AUTO_DEBOUNCE_MS)
      return
    }
    const result = await this.run()
    // Back off exponentially on repeated failures (offline / bad creds) so we
    // don't hammer the provider; reset as soon as one succeeds.
    if (result.status === 'error') {
      this.autoFailures++
      const delay = Math.min(AUTO_DEBOUNCE_MS * 2 ** this.autoFailures, AUTO_BACKOFF_MAX_MS)
      if (this.autoTimer) clearTimeout(this.autoTimer)
      this.autoTimer = setTimeout(() => void this.autoRun(), delay)
    } else {
      this.autoFailures = 0
    }
    this.notifier?.(result)
  }

  private hasCreds(): boolean {
    const p = this.config.provider
    return (
      (p === 'gist' && !!this.config.gist?.token) ||
      (p === 'webdav' && !!this.config.webdav?.password) ||
      (p === 's3' && !!this.config.s3?.secretAccessKey)
    )
  }

  /** Switching providers invalidates remote-change tracking. */
  private resetTracking(): void {
    this.config.lastSyncedHash = undefined
    this.config.lastRemoteUpdatedAt = undefined
    this.config.lastStatus = 'idle'
    this.config.lastMessage = undefined
  }

  async connectGist(token: string): Promise<SyncState> {
    const test = await testGistToken(token.trim())
    if (!test.ok) return this.connectError(test.error)
    this.resetTracking()
    this.config.provider = 'gist'
    this.config.gist = { token: token.trim(), account: test.account, gistId: this.config.gist?.gistId }
    saveSyncConfig(this.config)
    return this.getState()
  }

  async connectWebDav(cfg: WebDavConfigInput): Promise<SyncState> {
    const test = await testWebDav(cfg)
    if (!test.ok) return this.connectError(test.error)
    this.resetTracking()
    this.config.provider = 'webdav'
    this.config.webdav = { ...cfg, account: test.account }
    saveSyncConfig(this.config)
    return this.getState()
  }

  async connectS3(cfg: S3ConfigInput): Promise<SyncState> {
    const test = await testS3(cfg)
    if (!test.ok) return this.connectError(test.error)
    this.resetTracking()
    this.config.provider = 's3'
    this.config.s3 = { ...cfg, account: test.account }
    saveSyncConfig(this.config)
    return this.getState()
  }

  private connectError(message?: string): SyncState {
    this.config.lastStatus = 'error'
    this.config.lastMessage = message || '连接失败'
    saveSyncConfig(this.config)
    return this.getState()
  }

  disconnect(): SyncState {
    this.config.provider = null
    this.config.gist = undefined
    this.config.webdav = undefined
    this.config.s3 = undefined
    this.resetTracking()
    saveSyncConfig(this.config)
    return this.getState()
  }

  private provider(): SyncProvider | null {
    if (this.config.provider === 'gist' && this.config.gist?.token) {
      return new GistProvider({
        token: this.config.gist.token,
        gistId: this.config.gist.gistId,
        onGistId: (id) => {
          if (this.config.gist) this.config.gist.gistId = id
          saveSyncConfig(this.config)
        }
      })
    }
    if (this.config.provider === 'webdav' && this.config.webdav) {
      return new WebDavProvider(this.config.webdav)
    }
    if (this.config.provider === 's3' && this.config.s3) {
      return new S3Provider(this.config.s3)
    }
    return null
  }

  private localBundle(): Bundle {
    const b = this.repo.export()
    return {
      prompts: b.prompts,
      categories: b.categories,
      assets: b.assets,
      tombstones: b.tombstones ?? []
    }
  }

  private bundleOf(env: SyncEnvelope): Bundle {
    return {
      prompts: env.prompts ?? [],
      categories: env.categories ?? [],
      assets: env.assets ?? [],
      tombstones: env.tombstones ?? []
    }
  }

  private hashOf(b: Bundle): string {
    const byId = <T extends { id: string }>(arr: T[]): T[] =>
      [...arr].sort((a, c) => a.id.localeCompare(c.id))
    const norm = {
      prompts: byId(b.prompts),
      categories: byId(b.categories),
      assets: byId(b.assets),
      tombstones: byId(b.tombstones)
    }
    return createHash('sha1').update(JSON.stringify(norm)).digest('hex')
  }

  private envelope(b: Bundle): SyncEnvelope {
    return {
      app: 'promptbox',
      schemaVersion: SCHEMA,
      updatedAt: Date.now(),
      deviceId: this.config.deviceId,
      prompts: b.prompts,
      categories: b.categories,
      assets: b.assets,
      tombstones: b.tombstones
    }
  }

  /** Write to the repo without re-triggering our own auto-sync. */
  private replaceLocal(b: Bundle): void {
    this.suppressAuto = true
    try {
      this.repo.replaceAll(b.prompts, b.categories, b.assets, b.tombstones)
    } finally {
      this.suppressAuto = false
    }
  }

  private async pushBundle(prov: SyncProvider, b: Bundle): Promise<number> {
    const env = this.envelope(b)
    await prov.push(this.encode(env))
    this.config.lastRemoteUpdatedAt = env.updatedAt
    this.config.lastSyncedHash = this.hashOf(b)
    this.config.lastSyncedAt = Date.now()
    return env.updatedAt
  }

  private finish(status: SyncStatus, message?: string): SyncResult {
    this.config.lastStatus = status
    this.config.lastMessage = message
    saveSyncConfig(this.config)
    return { status, message }
  }

  async run(): Promise<SyncResult> {
    const prov = this.provider()
    if (!prov) return this.finish('error', '未连接云服务')
    if (this.running) return { status: this.config.lastStatus ?? 'idle', message: '同步进行中' }

    this.running = true
    try {
      return await this.runInner(prov)
    } finally {
      this.running = false
    }
  }

  /**
   * Item-level merge sync: pull remote, merge per-item (newer wins, deletions
   * propagate via tombstones), apply the merge locally and push it back so both
   * sides converge. No whole-document conflict — concurrent edits of *different*
   * items both survive.
   */
  private async runInner(prov: SyncProvider): Promise<SyncResult> {
    const local = this.localBundle()
    const localHash = this.hashOf(local)

    let raw: string | null
    try {
      raw = await prov.pull()
    } catch (e) {
      return this.finish('error', errMsg(e))
    }

    try {
      if (!raw) {
        await this.pushBundle(prov, local)
        return this.finish('pushed', '已创建云端数据')
      }
      const remote = this.bundleOf(this.decode(raw))
      const remoteHash = this.hashOf(remote)

      if (localHash === remoteHash) {
        this.config.lastSyncedHash = localHash
        this.config.lastSyncedAt = Date.now()
        saveSyncConfig(this.config)
        return this.finish('uptodate', '已是最新')
      }

      const merged = mergeBundles(local, remote)
      const mergedHash = this.hashOf(merged)
      const localChanged = mergedHash !== localHash
      const remoteChanged = mergedHash !== remoteHash

      // Summarize how local data shifts so deletions/additions from the other
      // device aren't applied silently — surfaced to the user via the result.
      const delta = localChanged ? bundleDelta(local, merged) : null
      const deltaText = delta && (delta.added || delta.removed)
        ? `（+${delta.added} 项${delta.removed ? ` · 移除 ${delta.removed} 项` : ''}）`
        : ''

      if (localChanged) this.replaceLocal(merged)
      if (remoteChanged) await this.pushBundle(prov, merged)
      else {
        this.config.lastSyncedHash = mergedHash
        this.config.lastSyncedAt = Date.now()
      }

      if (localChanged && remoteChanged) return this.finish('pulled', `已合并双方改动${deltaText}`)
      if (localChanged) return this.finish('pulled', `已合并云端更新${deltaText}`)
      return this.finish('pushed', '已上传本地改动')
    } catch (e) {
      return this.finish('error', errMsg(e))
    }
  }

  /** Retained for IPC compatibility; item-level merge no longer raises conflicts. */
  async resolveConflict(): Promise<SyncResult> {
    return this.run()
  }

  listVersions(): Promise<SyncVersion[]> {
    const prov = this.provider()
    if (!prov) return Promise.resolve([])
    return prov.listVersions().catch(() => [])
  }

  async restoreVersion(id: string): Promise<SyncResult> {
    const prov = this.provider()
    if (!prov) return this.finish('error', '未连接云服务')
    try {
      const raw = await prov.getVersion(id)
      if (!raw) return this.finish('error', '无法读取该版本')
      this.replaceLocal(this.bundleOf(this.decode(raw)))
      // push the restored state as the new remote head
      await this.pushBundle(prov, this.localBundle())
      return this.finish('pulled', '已恢复该版本并同步')
    } catch (e) {
      return this.finish('error', errMsg(e))
    }
  }
}
