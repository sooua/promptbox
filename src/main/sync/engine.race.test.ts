import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Repository } from '../store/repository'

/**
 * Concurrency tests for the sync engine. These exercise the two windows that a
 * pure-function merge test can never reach: a local write landing *during* the
 * network round-trip, and a credential that cannot be decrypted on this host.
 *
 * `./config` and `./gist` are mocked so the engine can run without Electron and
 * without the network; everything else is the real engine.
 */
const h = vi.hoisted(() => ({
  config: {} as Record<string, unknown>,
  pull: async (): Promise<string | null> => null,
  pushed: [] as string[]
}))

vi.mock('./config', () => ({
  loadSyncConfig: () => ({ ...h.config }),
  saveSyncConfig: () => {}
}))

vi.mock('./gist', () => ({
  testGistToken: async () => ({ ok: true }),
  GistProvider: class {
    pull(): Promise<string | null> {
      return h.pull()
    }
    async push(payload: string): Promise<void> {
      h.pushed.push(payload)
    }
    listVersions(): Promise<[]> {
      return Promise.resolve([])
    }
    getVersion(): Promise<null> {
      return Promise.resolve(null)
    }
  }
}))

const { SyncEngine } = await import('./engine')

type Rec = { id: string; updatedAt: number; content?: string; deletedAt?: number }

/** In-memory stand-in for the repository, with a hook to mutate it mid-flight. */
function fakeRepo(initial: Rec[]) {
  let prompts = structuredClone(initial)
  return {
    repo: {
      export: () => ({ prompts, categories: [], tombstones: [] }),
      replaceAll: (p: Rec[]) => {
        prompts = structuredClone(p)
      },
      onChange: () => {}
    } as unknown as Repository,
    setAll: (next: Rec[]) => {
      prompts = structuredClone(next)
    },
    current: () => prompts
  }
}

const envelope = (prompts: Rec[]) =>
  JSON.stringify({
    app: 'promptbox',
    schemaVersion: 1,
    updatedAt: 1,
    prompts,
    categories: [],
    tombstones: []
  })

beforeEach(() => {
  h.config = { provider: 'gist', deviceId: 'dev', gist: { token: 't' }, autoSync: false }
  h.pull = async () => null
  h.pushed = []
})

describe('SyncEngine — write landing during the pull round-trip', () => {
  it('keeps an edit that autosaves while the pull is still in flight', async () => {
    const store = fakeRepo([{ id: 'p1', updatedAt: 100, content: 'old' }])
    // The user keeps typing; autosave writes before the pull resolves. The
    // remote also carries an item we do not have, so the run really does reach
    // replaceLocal() rather than short-circuiting on an equal hash.
    h.pull = async () => {
      store.setAll([{ id: 'p1', updatedAt: 300, content: 'typed-during-sync' }])
      return envelope([
        { id: 'p1', updatedAt: 100, content: 'old' },
        { id: 'p2', updatedAt: 200, content: 'from-other-device' }
      ])
    }

    const engine = new SyncEngine(store.repo)
    const result = await engine.run()

    expect(result.status).not.toBe('error')
    // Reading the local bundle before the await merges a stale snapshot and
    // writes 'old' straight back over the user's typing.
    const byId = Object.fromEntries(store.current().map((p) => [p.id, p.content]))
    expect(byId).toEqual({ p1: 'typed-during-sync', p2: 'from-other-device' })
  })

  it('keeps a deletion made while the pull is still in flight', async () => {
    const store = fakeRepo([
      { id: 'p1', updatedAt: 100, content: 'a' },
      { id: 'p2', updatedAt: 100, content: 'b' }
    ])
    // Soft delete is an ordinary field update, so it is exposed to exactly the
    // same window — and losing it silently un-deletes what the user removed.
    h.pull = async () => {
      store.setAll([
        { id: 'p1', updatedAt: 300, content: 'a', deletedAt: 300 },
        { id: 'p2', updatedAt: 100, content: 'b' }
      ])
      return envelope([
        { id: 'p1', updatedAt: 100, content: 'a' },
        { id: 'p2', updatedAt: 100, content: 'b' },
        { id: 'p3', updatedAt: 200, content: 'from-other-device' }
      ])
    }

    await new SyncEngine(store.repo).run()

    expect(store.current().find((p) => p.id === 'p1')?.deletedAt).toBe(300)
  })
})

describe('SyncEngine — peer clock skew', () => {
  it('reports a peer whose clock runs ahead instead of losing edits silently', async () => {
    const store = fakeRepo([{ id: 'p1', updatedAt: 100, content: 'mine' }])
    h.pull = async () =>
      JSON.stringify({
        app: 'promptbox',
        schemaVersion: 2,
        updatedAt: Date.now() + 20 * 60 * 1000, // peer is 20 minutes ahead
        prompts: [{ id: 'p2', updatedAt: 200 }],
        categories: [],
        tombstones: []
      })

    const result = await new SyncEngine(store.repo).run()

    expect(result.message).toContain('比本机快')
  })

  it('says nothing when the peer clock is close enough', async () => {
    const store = fakeRepo([{ id: 'p1', updatedAt: 100 }])
    h.pull = async () =>
      JSON.stringify({
        app: 'promptbox',
        schemaVersion: 2,
        updatedAt: Date.now(),
        prompts: [{ id: 'p2', updatedAt: 200 }],
        categories: [],
        tombstones: []
      })

    const result = await new SyncEngine(store.repo).run()

    expect(result.message).not.toContain('比本机快')
  })
})

describe('SyncEngine — old client, newer remote', () => {
  it('refuses a blob written by a newer schema instead of mis-merging it', async () => {
    const store = fakeRepo([{ id: 'p1', updatedAt: 100, content: 'mine' }])
    h.pull = async () =>
      JSON.stringify({
        app: 'promptbox',
        schemaVersion: 99,
        updatedAt: 1,
        prompts: [],
        categories: [],
        tombstones: []
      })

    const result = await new SyncEngine(store.repo).run()

    expect(result.status).toBe('error')
    // The damage this prevents is the push: merging under the wrong rules and
    // then writing the result back is what destroys the other device's data.
    expect(h.pushed).toEqual([])
    expect(store.current()).toHaveLength(1)
  })

  it('accepts an envelope with no schemaVersion at all', async () => {
    const store = fakeRepo([{ id: 'p1', updatedAt: 100 }])
    h.pull = async () =>
      JSON.stringify({ app: 'promptbox', prompts: [{ id: 'p2', updatedAt: 200 }] })

    const result = await new SyncEngine(store.repo).run()

    expect(result.status).not.toBe('error')
    expect(store.current().map((p) => p.id).sort()).toEqual(['p1', 'p2'])
  })
})

describe('SyncEngine — undecryptable credentials', () => {
  it('refuses to sync rather than pushing without the stored secret', async () => {
    h.config = { provider: 'gist', deviceId: 'dev', credentialError: true }
    const store = fakeRepo([{ id: 'p1', updatedAt: 100 }])
    h.pull = async () => {
      throw new Error('pull should never be attempted')
    }

    const result = await new SyncEngine(store.repo).run()

    expect(result.status).toBe('error')
    expect(result.message).toContain('重新连接')
    expect(h.pushed).toEqual([])
  })

  it('refuses when only the E2E passphrase failed to decrypt', async () => {
    // Without the guard the engine would encode with `encryption: undefined`
    // and replace the encrypted remote blob with plaintext.
    h.config = { provider: 'gist', deviceId: 'dev', gist: { token: 't' }, credentialError: true }
    const store = fakeRepo([{ id: 'p1', updatedAt: 100, content: 'secret' }])

    await new SyncEngine(store.repo).run()

    expect(h.pushed).toEqual([])
  })
})
