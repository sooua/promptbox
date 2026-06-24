import type { SyncVersion } from '@shared/types'

/**
 * A pluggable cloud backend. Providers move opaque string payloads — the engine
 * owns (de)serialization and optional encryption, so providers stay agnostic.
 */
export interface SyncProvider {
  /** Fetch the remote document text, or null if none exists yet. */
  pull(): Promise<string | null>
  /** Overwrite the remote document with a new payload. */
  push(payload: string): Promise<void>
  /** List historical versions (most recent first). */
  listVersions(): Promise<SyncVersion[]>
  /** Fetch a specific historical version's text. */
  getVersion(id: string): Promise<string | null>
}

export interface ConnectionResult {
  ok: boolean
  account?: string
  error?: string
}
