import { describe, it, expect } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { PromptRepository } from './store/repository'
import { seedIfEmpty } from './seed'

describe('seedIfEmpty', () => {
  it('seeds 13 steps; every prompt has at most one {{一句话}} and a step; seeding twice is a no-op', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pb-seed-'))
    try {
      const repo = new PromptRepository(dir)
      seedIfEmpty(repo)
      const steps = repo.listCategories().filter((c) => c.stage)
      const prompts = repo.listPrompts()
      expect(steps).toHaveLength(13)
      expect(prompts.length).toBeGreaterThan(13)
      for (const p of prompts) {
        expect((p.content.match(/{{/g) ?? []).length).toBeLessThanOrEqual(1)
        expect(p.variables.length).toBe(p.content.includes('{{一句话}}') ? 1 : 0)
        expect(steps.some((s) => s.id === p.categoryId)).toBe(true)
      }
      seedIfEmpty(repo)
      expect(repo.listPrompts()).toHaveLength(prompts.length)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
