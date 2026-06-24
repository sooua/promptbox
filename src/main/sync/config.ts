import { app, safeStorage } from 'electron'
import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import type { SyncProviderId, SyncStatus } from '@shared/types'

/** In-memory sync config. Secrets are held decrypted here. */
export interface SyncConfig {
  provider: SyncProviderId | null
  deviceId: string
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

    return {
      provider: p.provider ?? null,
      deviceId: p.deviceId || nanoid(),
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
      encryption:
        p.encryption && p.encryption.enabled
          ? { enabled: true, passphrase: decryptSecret(p.encryption.passphrase) ?? '' }
          : undefined,
      lastSyncedAt: p.lastSyncedAt,
      lastStatus: p.lastStatus,
      lastMessage: p.lastMessage,
      lastSyncedHash: p.lastSyncedHash,
      lastRemoteUpdatedAt: p.lastRemoteUpdatedAt
    }
  } catch {
    const fresh: SyncConfig = { provider: null, deviceId: nanoid() }
    saveSyncConfig(fresh)
    return fresh
  }
}

export function saveSyncConfig(c: SyncConfig): void {
  const persisted: Persisted = {
    provider: c.provider,
    deviceId: c.deviceId,
    gist: c.gist
      ? { token: encryptSecret(c.gist.token), gistId: c.gist.gistId, account: c.gist.account }
      : undefined,
    webdav: c.webdav
      ? {
          url: c.webdav.url,
          username: c.webdav.username,
          password: encryptSecret(c.webdav.password),
          account: c.webdav.account
        }
      : undefined,
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
      : undefined,
    autoSync: c.autoSync,
    encryption: c.encryption
      ? { enabled: c.encryption.enabled, passphrase: encryptSecret(c.encryption.passphrase) }
      : undefined,
    lastSyncedAt: c.lastSyncedAt,
    lastStatus: c.lastStatus,
    lastMessage: c.lastMessage,
    lastSyncedHash: c.lastSyncedHash,
    lastRemoteUpdatedAt: c.lastRemoteUpdatedAt
  }
  writeFileSync(configPath(), JSON.stringify(persisted, null, 2), 'utf-8')
}
