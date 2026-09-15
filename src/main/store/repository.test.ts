import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { PromptRepository } from './repository'
import { BackupManager } from '../backup'
import type { ExportBundle, Prompt, PromptBoxData } from '@shared/types'

let dataDir: string

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'promptbox-test-'))
})

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true })
})

/** A minimal valid on-disk data document. */
const dataDoc = (over: Partial<PromptBoxData> = {}): PromptBoxData => ({
  version: 1,
  prompts: [],
  categories: [],
  tombstones: [],
  ...over
})

/** A minimal on-disk prompt record. */
const promptRecord = (id: string): Prompt => ({
  id,
  title: id,
  content: 'x',
  tags: [],
  favorite: false,
  pinned: false,
  variables: [],
  versions: [],
  useCount: 0,
  lastUsedAt: null,
  createdAt: 1,
  updatedAt: 1
})

const bundle = (over: Partial<ExportBundle> = {}): ExportBundle => ({
  app: 'promptbox',
  version: 1,
  exportedAt: Date.now(),
  prompts: [],
  categories: [],
  tombstones: [],
  ...over
})

describe('PromptRepository — import rejects documents that are not exports', () => {
  const wipeCandidates: Array<[string, unknown]> = [
    ['a foreign JSON object', { some: 'other tool' }],
    ['an empty object', {}],
    ['a bundle with the wrong app tag', { app: 'notpromptbox', prompts: [], categories: [] }],
    ['a bundle whose prompts is not an array', { app: 'promptbox', prompts: {}, categories: [] }],
    [
      'a bundle holding a record with no id',
      { app: 'promptbox', prompts: [{ title: 'x', updatedAt: 1 }], categories: [] }
    ],
    ['null', null]
  ]

  for (const [label, doc] of wipeCandidates) {
    it(`refuses ${label} instead of wiping the library`, () => {
      const repo = new PromptRepository(dataDir)
      repo.createPrompt({ title: 'Precious', content: 'x' })

      // `bundle.prompts ?? []` used to read this as "an export with zero
      // prompts" and replace-mode wiped everything while reporting success.
      expect(() => repo.import(doc as ExportBundle, 'replace')).toThrow()
      expect(repo.listPrompts()).toHaveLength(1)
      expect(repo.getTombstones()).toEqual([])
    })
  }

  it('still accepts a real export with no tombstones key', () => {
    const repo = new PromptRepository(dataDir)
    const doc = { app: 'promptbox', version: 1, exportedAt: 1, prompts: [], categories: [] }
    expect(() => repo.import(doc as ExportBundle, 'merge')).not.toThrow()
  })
})

describe('PromptRepository — tag rules live in one place', () => {
  it('normalises tags however they arrive', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'A', content: 'a', tags: [' #dup ', 'dup', '', '  '] })
    expect(p.tags).toEqual(['dup'])

    const updated = repo.updatePrompt(p.id, { tags: ['#one', 'one', ' two '] })!
    expect(updated.tags).toEqual(['one', 'two'])
  })

})

describe('PromptRepository — edits and metadata use separate clocks', () => {
  it('does not treat favourite or use as an edit', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'A', content: 'a' })
    const editedAt = repo.getPrompt(p.id)!.updatedAt

    repo.toggleFavorite(p.id)
    repo.recordUse(p.id)

    const after = repo.getPrompt(p.id)!
    // `updatedAt` orders the sync merge. If metadata bumped it, toggling a
    // favourite here would overwrite a body edit made on another device.
    expect(after.updatedAt).toBe(editedAt)
    expect(after.metaUpdatedAt).toBeGreaterThanOrEqual(editedAt)
    expect(after.favorite).toBe(true)
    expect(after.useCount).toBe(1)
  })

  it('does not treat pruning history as an edit', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'A', content: 'a' })
    const withVersion = repo.updatePrompt(p.id, { content: 'b' })!
    expect(withVersion.versions).toHaveLength(1)
    const editedAt = withVersion.updatedAt

    const after = repo.deleteVersion(p.id, withVersion.versions[0].id)!

    expect(after.versions).toHaveLength(0)
    expect(after.updatedAt).toBe(editedAt)
  })

  it('gives the bulk favourite path the same answer as the single toggle', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'A', content: 'a' })
    const editedAt = repo.getPrompt(p.id)!.updatedAt

    // The bulk action goes through updatePrompt, the row button through
    // toggleFavorite. Same rule, so it must move the same clock.
    const after = repo.updatePrompt(p.id, { favorite: true })!

    expect(after.favorite).toBe(true)
    expect(after.updatedAt).toBe(editedAt)
    expect(after.metaUpdatedAt).toBeGreaterThanOrEqual(editedAt)
  })

  it('still treats a body edit as an edit', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'A', content: 'a' })
    const before = repo.getPrompt(p.id)!.updatedAt

    const after = repo.updatePrompt(p.id, { content: 'changed' })!

    expect(after.updatedAt).toBeGreaterThanOrEqual(before)
    expect(after.content).toBe('changed')
  })
})

describe('PromptRepository — wholesale replacement keeps deletions traceable', () => {
  it('tombstones the ids a replace-import drops', () => {
    const repo = new PromptRepository(dataDir)
    const keep = repo.createPrompt({ title: 'Keep', content: 'k' })
    const gone = repo.createPrompt({ title: 'Gone', content: 'g' })

    repo.import(bundle({ prompts: [structuredClone(repo.getPrompt(keep.id)!)] }), 'replace')

    expect(repo.listPrompts().map((p) => p.id)).toEqual([keep.id])
    // Without the tombstone the next sync merge sees only "the peer still has
    // this one" and puts it straight back.
    expect(repo.getTombstones().map((t) => t.id)).toContain(gone.id)
  })

  it('tombstones the ids a backup restore drops', () => {
    const repo = new PromptRepository(dataDir)
    const a = repo.createPrompt({ title: 'A', content: 'a' })
    const b = repo.createPrompt({ title: 'B', content: 'b' })

    repo.replaceAll([structuredClone(repo.getPrompt(a.id)!)], [])

    expect(repo.listPrompts().map((p) => p.id)).toEqual([a.id])
    expect(repo.getTombstones().map((t) => t.id)).toContain(b.id)
  })

  it('clears the tombstone of an id an import re-adds', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'A', content: 'a' })
    const snapshot = structuredClone(repo.getPrompt(p.id)!)
    repo.deletePrompt(p.id)
    repo.purgePrompt(p.id)
    expect(repo.getTombstones().map((t) => t.id)).toContain(p.id)

    repo.import(bundle({ prompts: [snapshot] }), 'merge')

    expect(repo.listPrompts().map((x) => x.id)).toContain(p.id)
    // A live record must never also carry a tombstone, or the merge deletes it
    // again a few seconds after the user imported it.
    expect(repo.getTombstones().map((t) => t.id)).not.toContain(p.id)
  })

  it('invents no tombstones when a sync merge only adds items', () => {
    const repo = new PromptRepository(dataDir)
    const a = repo.createPrompt({ title: 'A', content: 'a' })

    repo.replaceAll(
      [structuredClone(repo.getPrompt(a.id)!), promptRecord('from-peer')],
      [],
      []
    )

    expect(repo.getTombstones()).toEqual([])
    expect(repo.listPrompts()).toHaveLength(2)
  })
})

describe('BackupManager — a snapshot it cannot read is a failed restore', () => {
  it('refuses a snapshot that is not a PromptBox export', () => {
    const repo = new PromptRepository(dataDir)
    repo.createPrompt({ title: 'Precious', content: 'x' })
    const backups = join(dataDir, 'backups')
    mkdirSync(backups, { recursive: true })
    writeFileSync(join(backups, 'promptbox-1.json'), JSON.stringify({ notes: [] }), 'utf-8')

    const mgr = new BackupManager(repo)

    // `data.prompts ?? []` reported success while wiping the library — and now
    // that a replacement records tombstones, that wipe would sync outwards.
    expect(mgr.restoreBackup('promptbox-1.json')).toBe(false)
    expect(repo.listPrompts()).toHaveLength(1)
    expect(repo.getTombstones()).toEqual([])
  })

  it('restores a real snapshot', () => {
    const repo = new PromptRepository(dataDir)
    repo.createPrompt({ title: 'Later', content: 'x' })
    const mgr = new BackupManager(repo)
    const info = mgr.createBackup(true)!
    repo.createPrompt({ title: 'Even later', content: 'y' })

    expect(mgr.restoreBackup(info.file)).toBe(true)
    expect(repo.listPrompts().map((p) => p.title)).toEqual(['Later'])
  })
})

describe('PromptRepository — trash (soft delete)', () => {
  it('hides a deleted prompt from listPrompts but keeps it restorable', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'Doomed', content: 'x' })

    expect(repo.deletePrompt(p.id)).toBe(true)
    expect(repo.listPrompts().map((x) => x.id)).not.toContain(p.id)
    expect(repo.listDeletedPrompts().map((x) => x.id)).toEqual([p.id])
    // No tombstone yet — a soft delete must not propagate as a hard delete.
    expect(repo.getTombstones().some((t) => t.id === p.id)).toBe(false)

    const restored = repo.restoreDeletedPrompt(p.id)
    expect(restored?.deletedAt).toBeNull()
    expect(repo.listPrompts().map((x) => x.id)).toContain(p.id)
    expect(repo.listDeletedPrompts()).toHaveLength(0)
  })

  it('deleting twice is a no-op and content survives the round trip', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'Keep', content: 'body {{v}}' })
    repo.deletePrompt(p.id)
    expect(repo.deletePrompt(p.id)).toBe(false)
    const back = repo.restoreDeletedPrompt(p.id)
    expect(back?.content).toBe('body {{v}}')
    expect(back?.variables.map((v) => v.name)).toEqual(['v'])
  })

  it('purge removes the record and records a tombstone so peers follow', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'Gone', content: 'x' })
    repo.deletePrompt(p.id)

    expect(repo.purgePrompt(p.id)).toBe(true)
    expect(repo.listDeletedPrompts()).toHaveLength(0)
    expect(repo.getTombstones().some((t) => t.id === p.id && t.type === 'prompt')).toBe(true)
  })

  it('purgeAllDeleted clears the trash and leaves live prompts alone', () => {
    const repo = new PromptRepository(dataDir)
    const keep = repo.createPrompt({ title: 'Keep', content: 'x' })
    const a = repo.createPrompt({ title: 'A', content: 'x' })
    const b = repo.createPrompt({ title: 'B', content: 'x' })
    repo.deletePrompt(a.id)
    repo.deletePrompt(b.id)

    expect(repo.purgeAllDeleted()).toBe(2)
    expect(repo.listPrompts().map((p) => p.id)).toEqual([keep.id])
    expect(repo.getTombstones()).toHaveLength(2)
  })

  it('purges trash older than the retention window on load', () => {
    const stale = Date.now() - 31 * 24 * 60 * 60 * 1000
    const fresh = Date.now() - 1000
    writeFileSync(
      join(dataDir, 'promptbox.json'),
      JSON.stringify(
        dataDoc({
          prompts: [
            { ...promptRecord('old'), deletedAt: stale },
            { ...promptRecord('recent'), deletedAt: fresh },
            promptRecord('live')
          ]
        })
      ),
      'utf-8'
    )

    const repo = new PromptRepository(dataDir)
    expect(repo.listPrompts().map((p) => p.id)).toEqual(['live'])
    expect(repo.listDeletedPrompts().map((p) => p.id)).toEqual(['recent'])
    // The expired one leaves a tombstone so other devices drop it too.
    expect(repo.getTombstones().some((t) => t.id === 'old' && t.type === 'prompt')).toBe(true)
  })

  it('a duplicate of a restored prompt is never itself in the trash', () => {
    const repo = new PromptRepository(dataDir)
    const p = repo.createPrompt({ title: 'Src', content: 'x' })
    repo.deletePrompt(p.id)
    repo.restoreDeletedPrompt(p.id)
    const copy = repo.duplicatePrompt(p.id)
    expect(copy?.deletedAt).toBeNull()
    expect(repo.listDeletedPrompts()).toHaveLength(0)
  })
})

describe('PromptRepository.import — merge mode', () => {
  it('regenerates a clashing prompt id and tags the title, keeping both copies', () => {
    const repo = new PromptRepository(dataDir)
    const existing = repo.createPrompt({ title: 'Mine', content: 'a' })

    const result = repo.import(
      bundle({
        prompts: [
          {
            ...existing, // same id as the one we just created → collision
            content: 'imported'
          }
        ]
      }),
      'merge'
    )

    expect(result.importedPrompts).toBe(1)
    const all = repo.listPrompts()
    expect(all).toHaveLength(2)
    // original id preserved, imported copy got a fresh id + "(导入)" suffix
    const ids = all.map((p) => p.id)
    expect(new Set(ids).size).toBe(2)
    expect(all.some((p) => p.title.includes('(导入)'))).toBe(true)
  })

  it('does not duplicate a category that already exists by id', () => {
    const repo = new PromptRepository(dataDir)
    const cat = repo.createCategory({ name: 'Work' })

    const result = repo.import(bundle({ categories: [cat] }), 'merge')

    expect(result.importedCategories).toBe(0)
    expect(repo.listCategories()).toHaveLength(1)
  })

  it('adds genuinely new categories from the bundle', () => {
    const repo = new PromptRepository(dataDir)
    const result = repo.import(
      bundle({
        categories: [
          { id: 'new-cat', name: 'Imported', color: '#fff', order: 0, createdAt: 1, updatedAt: 1 }
        ]
      }),
      'merge'
    )
    expect(result.importedCategories).toBe(1)
    expect(repo.listCategories().map((c) => c.id)).toContain('new-cat')
  })
})

describe('PromptRepository.import — replace mode', () => {
  it('wipes existing data and installs the bundle wholesale', () => {
    const repo = new PromptRepository(dataDir)
    repo.createPrompt({ title: 'old', content: 'x' })

    repo.import(
      bundle({
        prompts: [
          {
            id: 'fresh',
            title: 'new',
            content: 'y',
            description: '',
            categoryId: null,
            tags: [],
            favorite: false,
            pinned: false,
            variables: [],
            versions: [],
            useCount: 0,
            lastUsedAt: null,
            createdAt: 1,
            updatedAt: 1
          }
        ]
      }),
      'replace'
    )

    const all = repo.listPrompts()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('fresh')
  })
})

describe('PromptRepository — corruption recovery on load', () => {
  it('quarantines a corrupt file and restores from the newest valid backup', () => {
    // Corrupt main file.
    writeFileSync(join(dataDir, 'promptbox.json'), '{ this is not json', 'utf-8')
    // Two backups; the lexicographically-greatest name is treated as newest.
    const backups = join(dataDir, 'backups')
    mkdirSync(backups)
    writeFileSync(
      join(backups, 'promptbox-2024-01-01.json'),
      JSON.stringify(dataDoc({ prompts: [] })),
      'utf-8'
    )
    writeFileSync(
      join(backups, 'promptbox-2024-06-01.json'),
      JSON.stringify(
        dataDoc({
          prompts: [
            {
              id: 'restored',
              title: 'from backup',
              content: '',
              description: '',
              categoryId: null,
              tags: [],
              favorite: false,
              pinned: false,
              variables: [],
              versions: [],
              useCount: 0,
              lastUsedAt: null,
              createdAt: 1,
              updatedAt: 1
            }
          ]
        })
      ),
      'utf-8'
    )

    const repo = new PromptRepository(dataDir)

    // Restored from the newest backup.
    expect(repo.listPrompts().map((p) => p.id)).toEqual(['restored'])
    // Recovery details surfaced exactly once.
    const recovery = repo.takeLoadRecovery()
    expect(recovery?.restoredFrom).toBe('promptbox-2024-06-01.json')
    expect(repo.takeLoadRecovery()).toBeNull() // consumed
    // The bad file was quarantined, not deleted.
    expect(readdirSync(dataDir).some((f) => f.startsWith('promptbox.corrupt-'))).toBe(true)
  })

  it('falls back to empty data when corrupt and no backups exist', () => {
    writeFileSync(join(dataDir, 'promptbox.json'), 'totally broken', 'utf-8')
    const repo = new PromptRepository(dataDir)
    expect(repo.listPrompts()).toEqual([])
    const recovery = repo.takeLoadRecovery()
    expect(recovery).not.toBeNull()
    expect(recovery?.restoredFrom).toBeUndefined()
  })
})
