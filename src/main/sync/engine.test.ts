import { describe, it, expect } from 'vitest'
import type { Prompt } from '@shared/types'
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
    // Use recent timestamps so the retention TTL doesn't filter them out.
    const older = Date.now() - 2000
    const newer = Date.now() - 1000
    const out = mergeTombstones([tomb('p1', older)], [tomb('p1', newer)])
    expect(out).toHaveLength(1)
    expect(out[0].deletedAt).toBe(newer)
  })

  it('drops tombstones older than the one-year TTL but keeps recent ones', () => {
    const recent = Date.now() - 1000
    // A device offline for less than a year must still see the deletion; only
    // past that does the tombstone age out and the item resurrect.
    const stillKept = Date.now() - 200 * 24 * 60 * 60 * 1000
    const ancient = Date.now() - 400 * 24 * 60 * 60 * 1000
    const out = mergeTombstones(
      [tomb('recent', recent), tomb('stillKept', stillKept), tomb('ancient', ancient)],
      []
    )
    expect(out.map((t) => t.id)).toEqual(['recent', 'stillKept'])
  })
})

/** A prompt-shaped record, only the fields the merge actually reads. */
const prompt = (over: Partial<Prompt> & Pick<Prompt, 'id' | 'updatedAt'>): Prompt =>
  ({
    title: over.id,
    content: '',
    tags: [],
    favorite: false,
    pinned: false,
    variables: [],
    versions: [],
    useCount: 0,
    lastUsedAt: null,
    createdAt: 0,
    ...over
  }) as Prompt

describe('mergeMeta — metadata rides its own clock', () => {
  const merge = (local: Prompt, remote: Prompt) =>
    mergeBundles(
      { prompts: [local], categories: [], tombstones: [] },
      { prompts: [remote], categories: [], tombstones: [] }
    ).prompts[0]

  it('keeps a favourite toggled on the losing side alongside the winner’s body', () => {
    // The whole point of the split: neither change should destroy the other.
    const local = prompt({ id: 'p1', updatedAt: 100, favorite: true, metaUpdatedAt: 500 })
    const remote = prompt({ id: 'p1', updatedAt: 400, content: 'edited elsewhere' })

    const out = merge(local, remote)
    expect(out.content).toBe('edited elsewhere')
    expect(out.favorite).toBe(true)
  })

  it('does not let stale metadata overwrite newer metadata', () => {
    const local = prompt({ id: 'p1', updatedAt: 100, pinned: true, metaUpdatedAt: 100 })
    const remote = prompt({ id: 'p1', updatedAt: 400, pinned: false, metaUpdatedAt: 400 })

    expect(merge(local, remote).pinned).toBe(false)
  })

  it('carries useCount and lastUsedAt across with the rest of the metadata', () => {
    const local = prompt({
      id: 'p1',
      updatedAt: 100,
      useCount: 9,
      lastUsedAt: 999,
      metaUpdatedAt: 500
    })
    const remote = prompt({ id: 'p1', updatedAt: 400, useCount: 1, lastUsedAt: 1 })

    const out = merge(local, remote)
    expect(out.useCount).toBe(9)
    expect(out.lastUsedAt).toBe(999)
  })

  it('treats a record with no metaUpdatedAt as oldest rather than throwing', () => {
    const local = prompt({ id: 'p1', updatedAt: 400, favorite: false })
    const remote = prompt({ id: 'p1', updatedAt: 100, favorite: true, metaUpdatedAt: 900 })

    expect(merge(local, remote).favorite).toBe(true)
  })
})

describe('mergeBundles — item-level three-way merge', () => {
  it('survives concurrent edits to different items and propagates a deletion', () => {
    const now = Date.now()
    const local = {
      prompts: [item('shared', now, { title: 'local-edit' }), item('localOnly', now)],
      categories: [],
      tombstones: [tomb('removed', now)] // local deleted "removed"
    }
    const remote = {
      prompts: [
        item('shared', now - 1000, { title: 'remote-old' }),
        item('removed', now - 2000), // remote still has the deleted item
        item('remoteOnly', now)
      ],
      categories: [],
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
      tombstones: [] as ReturnType<typeof tomb>[]
    }
    const once = mergeBundles(b, b)
    const twice = mergeBundles(once, once)
    expect(twice.prompts.map((p) => p.id)).toEqual(once.prompts.map((p) => p.id))
    expect(twice.categories.map((c) => c.id)).toEqual(once.categories.map((c) => c.id))
  })
})
