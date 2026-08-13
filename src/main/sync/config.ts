import { app, safeStorage } from 'electron'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import type { SyncProviderId, SyncStatus } from '@shared/types'

/** In-memory sync config. Secrets are held decrypted here. */
export interface SyncConfig {
  provider: SyncProviderId | null
  deviceId: string
  /**
   * Set when a provider is configured on disk but its secret could not be
   * decrypted on this machine (OS keychain reset, profile copied to a new
   * machine, safeStorage unavailable). Without this the app silently presents
   * itself as "not connected" while the user believes syncing is running.
   */
  credentialError?: boolean
  /**
   * The untouched on-disk record, kept only while `credentialError` is set.
   * Saving the config is a load-modify-write of the whole file, so without
   * this the first `saveSyncConfig` after a failed decrypt writes the provider
   * block back as `undefined` and destroys ciphertext that is still perfectly
   * valid — the keychain may simply have been locked at launch.
   */
  preserved?: PersistedSecrets
  gist?: { token: string; gistId?: string; account?: string }
  webdav?: { url: string; username: string; password: string; account?: string }
  s3?: {
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: string
    prefix?: string
    account?: string
  }
  autoSync?: boolean
  encryption?: { enabled: boolean; passphrase: string }
  lastSyncedAt?: number
  lastStatus?: SyncStatus
  lastMessage?: string
  lastSyncedHash?: string
  lastRemoteUpdatedAt?: number
}

/** A secret persisted either OS-encrypted (enc) or, as a fallback, plaintext. */
interface Secret {
  enc?: string
  plain?: string
}

/** The secret-bearing blocks of the on-disk record, kept verbatim for re-save. */
type PersistedSecrets = Pick<Persisted, 'gist' | 'webdav' | 's3' | 'encryption'>

interface Persisted {
  provider: SyncProviderId | null
  deviceId: string
  gist?: { token: Secret; gistId?: string; account?: string }
  webdav?: { url: string; username: string; password: Secret; account?: string }
  s3?: {
    endpoint: string
    region: string
    bucket: string
    accessKeyId: string
    secretAccessKey: Secret
    prefix?: string
    account?: string
  }
  autoSync?: boolean
  encryption?: { enabled: boolean; passphrase: Secret }
  lastSyncedAt?: number
  lastStatus?: SyncStatus
  lastMessage?: string
  lastSyncedHash?: string
  lastRemoteUpdatedAt?: number
}

function configPath(): string {
  return join(app.getPath('userData'), 'promptbox.sync.json')
}

function encryptSecret(value: string): Secret {
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return { enc: safeStorage.encryptString(value).toString('base64') }
    }
  } catch {
    /* fall through to plaintext */
  }
  return { plain: value }
}

function decryptSecret(s: Secret | undefined): string | undefined {
  if (s?.enc) {
    try {
      return safeStorage.decryptString(Buffer.from(s.enc, 'base64'))
    } catch {
      return undefined
    }
  }
  return s?.plain
}

export function loadSyncConfig(): SyncConfig {
  try {
    const p = JSON.parse(readFileSync(configPath(), 'utf-8')) as Persisted

    const gistToken = p.gist ? decryptSecret(p.gist.token) : undefined
    const webdavPass = p.webdav ? decryptSecret(p.webdav.password) : undefined
    const s3Secret = p.s3 ? decryptSecret(p.s3.secretAccessKey) : undefined
    // An undecryptable passphrase must NOT fall back to '': that would keep
    // encryption "enabled" while encrypting with an empty key.
    const encPass = p.encryption?.enabled ? decryptSecret(p.encryption.passphrase) : undefined

    // A stored secret that fails to decrypt is a real failure, not "unconfigured".
    const credentialError =
      (!!p.gist && !gistToken) ||
      (!!p.webdav && !webdavPass) ||
      (!!p.s3 && !s3Secret) ||
      (!!p.encryption?.enabled && !encPass)

    return {
      provider: p.provider ?? null,
      deviceId: p.deviceId || nanoid(),
      credentialError: credentialError || undefined,
      preserved: credentialError
        ? { gist: p.gist, webdav: p.webdav, s3: p.s3, encryption: p.encryption }
        : undefined,
      gist:
        p.gist && gistToken
          ? { token: gistToken, gistId: p.gist.gistId, account: p.gist.account }
          : undefined,
      webdav:
        p.webdav && webdavPass
          ? {
              url: p.webdav.url,
              username: p.webdav.username,
              password: webdavPass,
              account: p.webdav.account
            }
          : undefined,
      s3:
        p.s3 && s3Secret
          ? {
              endpoint: p.s3.endpoint,
              region: p.s3.region,
              bucket: p.s3.bucket,
              accessKeyId: p.s3.accessKeyId,
              secretAccessKey: s3Secret,
              prefix: p.s3.prefix,
              account: p.s3.account
            }
          : undefined,
      autoSync: p.autoSync ?? false,
      encryption: encPass ? { enabled: true, passphrase: encPass } : undefined,
      lastSyncedAt: p.lastSyncedAt,
      lastStatus: p.lastStatus,
      lastMessage: p.lastMessage,
      lastSyncedHash: p.lastSyncedHash,
      lastRemoteUpdatedAt: p.lastRemoteUpdatedAt
    }
  } catch {
    const fresh: SyncConfig = { provider: null, deviceId: nanoid() }
    // Never overwrite a file we merely failed to read — a transient lock or a
    // truncated record would take every stored credential with it. Quarantine
    // it first (same rule the prompt store uses) so the ciphertext survives and
    // the save below has nothing left to clobber.
    if (existsSync(configPath())) {
      try {
        renameSync(configPath(), `${configPath()}.corrupt-${Date.now()}`)
      } catch {
        return fresh
      }
    }
    saveSyncConfig(fresh)
    return fresh
  }
}

export function saveSyncConfig(c: SyncConfig): void {
  // Blocks that could not be decrypted this session are written back byte for
  // byte instead of as `undefined`. `preserved` is only set while
  // `credentialError` holds, and `resetTracking()` clears it, so an explicit
  // reconnect or disconnect still erases the old secret.
  const keep: PersistedSecrets = (c.credentialError && c.preserved) || {}
  const persisted: Persisted = {
    provider: c.provider,
    deviceId: c.deviceId,
    gist: c.gist
      ? { token: encryptSecret(c.gist.token), gistId: c.gist.gistId, account: c.gist.account }
      : keep.gist,
    webdav: c.webdav
      ? {
          url: c.webdav.url,
          username: c.webdav.username,
          password: encryptSecret(c.webdav.password),
          account: c.webdav.account
        }
      : keep.webdav,
    s3: c.s3
      ? {
          endpoint: c.s3.endpoint,
          region: c.s3.region,
          bucket: c.s3.bucket,
          accessKeyId: c.s3.accessKeyId,
          secretAccessKey: encryptSecret(c.s3.secretAccessKey),
          prefix: c.s3.prefix,
          account: c.s3.account
        }
      : keep.s3,
    autoSync: c.autoSync,
    encryption: c.encryption
      ? { enabled: c.encryption.enabled, passphrase: encryptSecret(c.encryption.passphrase) }
      : keep.encryption,
    lastSyncedAt: c.lastSyncedAt,
    lastStatus: c.lastStatus,
    lastMessage: c.lastMessage,
    lastSyncedHash: c.lastSyncedHash,
    lastRemoteUpdatedAt: c.lastRemoteUpdatedAt
  }
  writeFileSync(configPath(), JSON.stringify(persisted, null, 2), 'utf-8')
}
