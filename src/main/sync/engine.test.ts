import { describe, it, expect } from 'vitest'
import { mergeCollection, mergeTombstones, mergeBundles } from './engine'

// Minimal shape the merge helpers operate on: `{ id, updatedAt }`.
const item = (id: string, updatedAt: number, extra: Record<string, unknown> = {}) => ({
  id,
  updatedAt,
  ...extra
})

const tomb = (id: string, deletedAt: number, type = 'prompt' as const) => ({
  id,
  type,
  deletedAt
})

describe('mergeCollection — newer-wins per id', () => {
  it('keeps the item with the greater updatedAt when ids collide', () => {
    const a = [item('p1', 100, { title: 'old' })]
    const b = [item('p1', 200, { title: 'new' })]
    const out = mergeCollection(a, b, new Map())
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ id: 'p1', title: 'new' })
  })

  it('keeps the local item when it is the newer one (order-independent)', () => {
    const a = [item('p1', 300, { title: 'local-new' })]
    const b = [item('p1', 200, { title: 'remote-old' })]
    expect(mergeCollection(a, b, new Map())[0]).toMatchObject({ title: 'local-new' })
  })

  it('unions disjoint ids from both sides', () => {
    const out = mergeCollection([item('a', 1)], [item('b', 1)], new Map())
    expect(out.map((x) => x.id).sort()).toEqual(['a', 'b'])
  })
})

describe('mergeCollection — tombstone deletion semantics', () => {
  it('drops an item when a tombstone is at or newer than the item', () => {
    const a = [item('p1', 100)]
    const tombs = new Map([['p1', 100]]) // deletedAt === updatedAt → deletion wins
    expect(mergeCollection(a, [], tombs)).toHaveLength(0)
  })

  it('resurrects an item edited AFTER it was deleted (edit newer than tombstone)', () => {
    const a = [item('p1', 200)] // edited at 200
    const tombs = new Map([['p1', 100]]) // deleted earlier at 100
    const out = mergeCollection(a, [], tombs)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('p1')
  })
})

describe('mergeTombstones', () => {
  it('keeps the newest tombstone per id', () => {
    // Use recent timestamps so the 90-day TTL doesn't filter them out.
    const older = Date.now() - 2000
    const newer = Date.now() - 1000
    const out = mergeTombstones([tomb('p1', older)], [tomb('p1', newer)])
    expect(out).toHaveLength(1)
    expect(out[0].deletedAt).toBe(newer)
  })

  it('drops tombstones older than the 90-day TTL but keeps recent ones', () => {
    const recent = Date.now() - 1000
    const ancient = Date.now() - 200 * 24 * 60 * 60 * 1000 // ~200 days old
    const out = mergeTombstones([tomb('recent', recent), tomb('ancient', ancient)], [])
    expect(out.map((t) => t.id)).toEqual(['recent'])
  })
})

describe('mergeBundles — item-level three-way merge', () => {
  it('survives concurrent edits to different items and propagates a deletion', () => {
    const now = Date.now()
    const local = {
      prompts: [item('shared', now, { title: 'local-edit' }), item('localOnly', now)],
      categories: [],
      assets: [],
      tombstones: [tomb('removed', now)] // local deleted "removed"
    }
    const remote = {
      prompts: [
        item('shared', now - 1000, { title: 'remote-old' }),
        item('removed', now - 2000), // remote still has the deleted item
        item('remoteOnly', now)
      ],
      categories: [],
      assets: [],
      tombstones: []
    }
    const merged = mergeBundles(local, remote)
    const ids = merged.prompts.map((p) => p.id).sort()

    // local-only and remote-only both survive; the locally-deleted item is gone
    expect(ids).toEqual(['localOnly', 'remoteOnly', 'shared'])
    // newer (local) edit of the shared item wins
    expect(merged.prompts.find((p) => p.id === 'shared')).toMatchObject({ title: 'local-edit' })
    // the tombstone is carried forward so the deletion keeps propagating
    expect(merged.tombstones.map((t) => t.id)).toContain('removed')
  })

  it('is idempotent — merging the same bundle twice yields the same result', () => {
    const now = Date.now()
    const b = {
      prompts: [item('p1', now)],
      categories: [item('c1', now)],
      assets: [],
      tombstones: [] as ReturnType<typeof tomb>[]
    }
    const once = mergeBundles(b, b)
    const twice = mergeBundles(once, once)
    expect(twice.prompts.map((p) => p.id)).toEqual(once.prompts.map((p) => p.id))
    expect(twice.categories.map((c) => c.id)).toEqual(once.categories.map((c) => c.id))
  })
})
