import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { PromptRepository } from './repository'
import type { ExportBundle, PromptBoxData } from '@shared/types'

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
  assets: [],
  tombstones: [],
  ...over
})

const bundle = (over: Partial<ExportBundle> = {}): ExportBundle => ({
  app: 'promptbox',
  version: 1,
  exportedAt: Date.now(),
  prompts: [],
  categories: [],
  assets: [],
  tombstones: [],
  ...over
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
    const cat = repo.createCategory('Work')

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
