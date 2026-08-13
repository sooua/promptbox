import { shell } from 'electron'
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs'
import { join } from 'path'
import type { BackupInfo } from '@shared/types'
import { isExportBundle, type Repository } from './store/repository'

const MAX_BACKUPS = 20
const PREFIX = 'promptbox-'

/**
 * Timestamped JSON snapshots of the data store, kept under <dataDir>/backups.
 * One is taken on each launch (deduped against the latest) plus on demand.
 */
export class BackupManager {
  constructor(private repo: Repository) {}

  private dir(): string {
    return join(this.repo.getDataDir(), 'backups')
  }

  createBackup(force = false): BackupInfo | null {
    const data = this.repo.export()
    if (!force && data.prompts.length === 0 && data.categories.length === 0) return null
    const json = JSON.stringify(data, null, 2)

    // Skip if nothing changed since the most recent snapshot.
    const latest = this.listBackups()[0]
    if (!force && latest) {
      try {
        const prev = readFileSync(join(this.dir(), latest.file), 'utf-8')
        if (sameData(prev, json)) return latest
      } catch {
        /* fall through and create a new one */
      }
    }

    if (!existsSync(this.dir())) mkdirSync(this.dir(), { recursive: true })
    const ts = Date.now()
    const file = `${PREFIX}${ts}.json`
    writeFileSync(join(this.dir(), file), json, 'utf-8')
    this.prune()
    return { file, createdAt: ts, size: Buffer.byteLength(json) }
  }

  listBackups(): BackupInfo[] {
    if (!existsSync(this.dir())) return []
    return readdirSync(this.dir())
      .filter((f) => f.startsWith(PREFIX) && f.endsWith('.json'))
      .map((f) => {
        const ts = parseInt(f.slice(PREFIX.length, -5), 10)
        let size = 0
        try {
          size = statSync(join(this.dir(), f)).size
        } catch {
          /* ignore */
        }
        return { file: f, createdAt: Number.isFinite(ts) ? ts : 0, size }
      })
      .sort((a, b) => b.createdAt - a.createdAt)
  }

  restoreBackup(file: string): boolean {
    try {
      const data: unknown = JSON.parse(readFileSync(join(this.dir(), file), 'utf-8'))
      // `data.prompts ?? []` turned a truncated or foreign snapshot into a
      // silent full wipe that still reported success — and now that a
      // replacement records tombstones, that wipe would propagate to every
      // synced device. A snapshot we cannot read is a failed restore.
      if (!isExportBundle(data)) return false
      // Passing `undefined` (not `[]`) keeps the current tombstones when the
      // snapshot predates them; `[]` would erase every deletion record.
      this.repo.replaceAll(data.prompts, data.categories, data.tombstones)
      return true
    } catch {
      return false
    }
  }

  openDir(): Promise<string> {
    if (!existsSync(this.dir())) mkdirSync(this.dir(), { recursive: true })
    return shell.openPath(this.dir())
  }

  private prune(): void {
    for (const b of this.listBackups().slice(MAX_BACKUPS)) {
      try {
        unlinkSync(join(this.dir(), b.file))
      } catch {
        /* ignore */
      }
    }
  }
}

function sameData(a: string, b: string): boolean {
  try {
    const pa = JSON.parse(a)
    const pb = JSON.parse(b)
    return (
      JSON.stringify({ p: pa.prompts, c: pa.categories }) ===
      JSON.stringify({ p: pb.prompts, c: pb.categories })
    )
  } catch {
    return false
  }
}
