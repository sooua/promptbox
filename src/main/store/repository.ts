import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import type {
  Category,
  ExportBundle,
  ImportMode,
  ImportResult,
  Prompt,
  PromptBoxData,
  PromptInput,
  PromptVersion,
  Tombstone
} from '@shared/types'
import { TRASH_TTL_MS } from '@shared/types'
import { syncVariables } from '@shared/variables'
import { ensureDir } from './config'

const DATA_VERSION = 1
const MAX_VERSIONS = 50
/** Edits within this window of the latest snapshot are coalesced into it. */
const VERSION_COALESCE_MS = 3 * 60 * 1000

function now(): number {
  return Date.now()
}

/** Fields whose change counts as an *edit* and therefore orders the sync merge. */
const EDIT_FIELDS = ['title', 'content', 'description', 'categoryId', 'tags', 'variables'] as const

/**
 * A file the user picked is untrusted input. Without this check `bundle.prompts
 * ?? []` turned "this isn't a PromptBox export" into "this export has zero
 * prompts", and a replace-import of any stray .json silently wiped the library
 * while reporting success.
 */
export function isExportBundle(v: unknown): v is ExportBundle {
  const b = v as Partial<ExportBundle> | null
  if (!b || typeof b !== 'object') return false
  if (b.app !== 'promptbox') return false
  if (!Array.isArray(b.prompts) || !Array.isArray(b.categories)) return false
  if (b.tombstones !== undefined && !Array.isArray(b.tombstones)) return false
  const usable = (x: unknown): boolean =>
    !!x &&
    typeof x === 'object' &&
    typeof (x as Prompt).id === 'string' &&
    typeof (x as Prompt).updatedAt === 'number'
  return b.prompts.every(usable) && b.categories.every(usable)
}

/**
 * The one place tags are normalised. The rule (trim, drop a leading `#`, drop
 * empties, dedupe) previously lived in three separate callers — the editor, the
 * bulk action and the markdown importer — so anything reaching the store by a
 * fourth route kept whatever shape it arrived in.
 */
function normalizeTags(tags: string[]): string[] {
  const out: string[] = []
  for (const raw of tags) {
    if (typeof raw !== 'string') continue
    const tag = raw.trim().replace(/^#/, '').trim()
    if (tag && !out.includes(tag)) out.push(tag)
  }
  return out
}

function emptyData(): PromptBoxData {
  return { version: DATA_VERSION, prompts: [], categories: [], tombstones: [] }
}

/**
 * The persistence contract. Everything in the app (IPC, backup, sync) depends on
 * this interface rather than a concrete class, so an alternative backend (e.g.
 * SQLite for very large libraries) is a clean drop-in: implement `Repository`
 * and the rest of the app is unchanged. `PromptRepository` below is the default
 * JSON-file implementation; `implements Repository` makes the match compiler-checked.
 */
export interface Repository {
  onChange(cb: () => void): void
  onError(cb: (err: Error) => void): void
  takeLoadRecovery(): { quarantined: string; restoredFrom?: string } | null
  setDataDir(dataDir: string): void
  getDataDir(): string

  listPrompts(): Prompt[]
  listDeletedPrompts(): Prompt[]
  getPrompt(id: string): Prompt | undefined
  createPrompt(input: PromptInput): Prompt
  updatePrompt(id: string, patch: Partial<PromptInput>): Prompt | undefined
  addTag(id: string, tag: string): Prompt | undefined
  /** Soft delete — recoverable from the trash for TRASH_TTL_MS. */
  deletePrompt(id: string): boolean
  restoreDeletedPrompt(id: string): Prompt | undefined
  /** Irreversible: drops the record and records a tombstone so peers follow. */
  purgePrompt(id: string): boolean
  purgeAllDeleted(): number
  duplicatePrompt(id: string): Prompt | undefined
  toggleFavorite(id: string): Prompt | undefined
  togglePin(id: string): Prompt | undefined
  recordUse(id: string): Prompt | undefined
  rememberVariableValues(promptId: string, values: Record<string, string>): Prompt | undefined
  restoreVersion(promptId: string, versionId: string): Prompt | undefined
  deleteVersion(promptId: string, versionId: string): Prompt | undefined

  listCategories(): Category[]
  createCategory(name: string, color?: string): Category
  reorderCategories(idsInOrder: string[]): Category[]
  updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Category | undefined
  deleteCategory(id: string): boolean

  replaceAll(prompts: Prompt[], categories: Category[], tombstones?: Tombstone[]): void
  export(): ExportBundle
  getTombstones(): Tombstone[]
  import(bundle: ExportBundle, mode: ImportMode): ImportResult
}

/**
 * JSON-file backed repository — the default `Repository` implementation. All
 * persistence is funneled through here.
 */
export class PromptRepository implements Repository {
  private dataDir: string
  private data: PromptBoxData
  private listeners: Array<() => void> = []
  private errorListeners: Array<(err: Error) => void> = []
  /** Serializes writes and guards against re-entrant flushes corrupting state. */
  private writing = false
  /** Monotonic counter for unique temp-file names (no shared .tmp clobber). */
  private writeSeq = 0
  /** Set when the on-disk file failed to parse and was quarantined on load. */
  private loadRecovered: { quarantined: string; restoredFrom?: string } | null = null

  constructor(dataDir: string) {
    this.dataDir = dataDir
    this.data = this.read()
  }

  /** Subscribe to persistence changes (every flush). Used by auto-sync. */
  onChange(cb: () => void): void {
    this.listeners.push(cb)
  }

  /** Subscribe to unrecoverable write failures so the UI can warn the user. */
  onError(cb: (err: Error) => void): void {
    this.errorListeners.push(cb)
  }

  /**
   * If the data file was corrupt on load, returns details of what happened
   * (the quarantined file and any backup it was recovered from) exactly once.
   */
  takeLoadRecovery(): { quarantined: string; restoredFrom?: string } | null {
    const r = this.loadRecovered
    this.loadRecovered = null
    return r
  }

  private filePath(): string {
    return join(this.dataDir, 'promptbox.json')
  }

  private read(): PromptBoxData {
    ensureDir(this.dataDir)
    const path = this.filePath()
    if (!existsSync(path)) {
      const seeded = emptyData()
      writeFileSync(path, JSON.stringify(seeded, null, 2), 'utf-8')
      return seeded
    }
    const raw = readFileSync(path, 'utf-8')
    try {
      return this.normalize(JSON.parse(raw) as PromptBoxData)
    } catch {
      // The data file is corrupt. NEVER silently return empty — that would let
      // the next flush overwrite recoverable data with nothing. Instead:
      //  1. quarantine the bad file so it can be inspected/recovered by hand,
      //  2. try to restore from the newest valid backup,
      //  3. only then fall back to empty.
      return this.recoverCorrupt(path)
    }
  }

  /** Backfill fields added after the initial schema so older files load cleanly. */
  private normalize(parsed: PromptBoxData): PromptBoxData {
    const categoriesByCreated = [...(parsed.categories ?? [])].sort(
      (a, b) => a.createdAt - b.createdAt
    )
    this.archiveDroppedAssets(parsed)

    // Trash retention is enforced on load rather than on a timer: an app that
    // sat closed for months still cleans up the moment it comes back.
    const cutoff = now() - TRASH_TTL_MS
    const expired = (parsed.prompts ?? []).filter((p) => p.deletedAt && p.deletedAt < cutoff)
    const tombstones = [...(parsed.tombstones ?? [])]
    for (const p of expired) {
      if (!tombstones.some((t) => t.id === p.id)) {
        tombstones.push({ id: p.id, type: 'prompt', deletedAt: p.deletedAt as number })
      }
    }

    return {
      version: parsed.version ?? DATA_VERSION,
      prompts: (parsed.prompts ?? [])
        .filter((p) => !(p.deletedAt && p.deletedAt < cutoff))
        .map((p) => ({
          ...p,
          pinned: p.pinned ?? false,
          useCount: p.useCount ?? 0,
          lastUsedAt: p.lastUsedAt ?? null,
          // Pre-split records carried metadata on `updatedAt`; seeding from it
          // keeps their relative order intact through the first merge.
          metaUpdatedAt: p.metaUpdatedAt ?? p.updatedAt
        })),
      categories: (parsed.categories ?? []).map((c) => ({
        ...c,
        order: c.order ?? categoriesByCreated.findIndex((x) => x.id === c.id),
        updatedAt: c.updatedAt ?? c.createdAt
      })),
      tombstones
    }
  }

  /**
   * Skill/Agent/MCP assets were removed from the product. Any still on disk are
   * written out once to a sidecar file before being dropped, so users who had
   * them keep a recoverable copy instead of losing data on the next flush.
   */
  private archiveDroppedAssets(parsed: PromptBoxData & { assets?: unknown[] }): void {
    if (!Array.isArray(parsed.assets) || parsed.assets.length === 0) return
    const path = join(this.dataDir, 'assets-archive.json')
    if (existsSync(path)) return
    try {
      writeFileSync(path, JSON.stringify(parsed.assets, null, 2), 'utf-8')
    } catch {
      /* best effort — never block loading the library over the archive */
    }
  }

  private recoverCorrupt(path: string): PromptBoxData {
    const stamp = now()
    const quarantined = `promptbox.corrupt-${stamp}.json`
    try {
      renameSync(path, join(this.dataDir, quarantined))
    } catch {
      /* if we can't move it, leave it; the restore below still won't clobber it */
    }
    // Try the newest parseable backup under <dataDir>/backups.
    const backupsDir = join(this.dataDir, 'backups')
    if (existsSync(backupsDir)) {
      const files = readdirSync(backupsDir)
        .filter((f) => f.startsWith('promptbox-') && f.endsWith('.json'))
        .sort((a, b) => b.localeCompare(a))
      for (const f of files) {
        try {
          const data = this.normalize(JSON.parse(readFileSync(join(backupsDir, f), 'utf-8')))
          this.loadRecovered = { quarantined, restoredFrom: f }
          return data
        } catch {
          /* try the next-oldest backup */
        }
      }
    }
    this.loadRecovered = { quarantined }
    return emptyData()
  }

  private flush(): void {
    // Serialize writes: if a listener callback (e.g. auto-sync) triggers another
    // flush re-entrantly, coalesce it into a single follow-up write instead of
    // interleaving two writes to the same file.
    if (this.writing) {
      this.pendingFlush = true
      return
    }
    this.writing = true
    try {
      this.writeToDisk()
    } finally {
      this.writing = false
    }
    for (const cb of this.listeners) cb()
    if (this.pendingFlush) {
      this.pendingFlush = false
      this.flush()
    }
  }

  private pendingFlush = false

  private writeToDisk(): void {
    ensureDir(this.dataDir)
    const path = this.filePath()
    const json = JSON.stringify(this.data, null, 2)
    // Atomic write: write to a per-write temp file then rename, so a crash
    // mid-write can never leave a half-written (corrupt) promptbox.json, and
    // overlapping writes never share a temp path.
    const tmp = `${path}.${process.pid}.${++this.writeSeq}.tmp`
    try {
      writeFileSync(tmp, json, 'utf-8')
      renameSync(tmp, path)
    } catch (err) {
      // fall back to a direct write if the rename path fails (e.g. AV lock)
      try {
        writeFileSync(path, json, 'utf-8')
      } catch (err2) {
        // Both paths failed — the change is only in memory. Surface it so the
        // user can act (free disk, fix permissions) rather than losing data.
        const e = err2 instanceof Error ? err2 : new Error(String(err2 ?? err))
        for (const cb of this.errorListeners) cb(e)
      }
    }
  }

  /** Point the repository at a new directory and reload from it. */
  setDataDir(dataDir: string): void {
    this.dataDir = dataDir
    this.data = this.read()
  }

  getDataDir(): string {
    return this.dataDir
  }

  /** Record a deletion so it propagates during item-level sync merges. */
  private tomb(id: string, type: Tombstone['type']): void {
    this.data.tombstones = this.data.tombstones.filter((t) => t.id !== id)
    this.data.tombstones.push({ id, type, deletedAt: now() })
  }

  // ---- Prompts ----

  /**
   * Soft-deleted prompts are filtered out here rather than in the renderer.
   * This is the single source the UI reads from, so every list, count, filter
   * and search index stays correct without touching any of them.
   */
  listPrompts(): Prompt[] {
    return this.data.prompts.filter((p) => !p.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt)
  }

  listDeletedPrompts(): Prompt[] {
    return this.data.prompts
      .filter((p) => p.deletedAt)
      .sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0))
  }

  getPrompt(id: string): Prompt | undefined {
    return this.data.prompts.find((p) => p.id === id)
  }

  createPrompt(input: PromptInput): Prompt {
    const ts = now()
    const prompt: Prompt = {
      id: nanoid(),
      title: input.title?.trim() || '未命名 Prompt',
      content: input.content ?? '',
      description: input.description ?? '',
      categoryId: input.categoryId ?? null,
      tags: normalizeTags(input.tags ?? []),
      favorite: input.favorite ?? false,
      pinned: false,
      variables: syncVariables(input.content ?? '', input.variables ?? []),
      versions: [],
      useCount: 0,
      lastUsedAt: null,
      createdAt: ts,
      updatedAt: ts,
      metaUpdatedAt: ts
    }
    this.data.prompts.push(prompt)
    this.flush()
    return prompt
  }

  updatePrompt(id: string, patch: Partial<PromptInput>): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined

    const contentChanged =
      patch.content !== undefined && patch.content !== prompt.content

    // Snapshot the prior state into history when content changes — but coalesce
    // a continuous editing session: skip if the latest snapshot is still fresh,
    // so typing every 500ms doesn't pile up dozens of near-identical versions.
    if (contentChanged) {
      const latest = prompt.versions[0]
      const fresh = latest && now() - latest.createdAt < VERSION_COALESCE_MS
      if (!fresh) {
        const snapshot: PromptVersion = {
          id: nanoid(),
          title: prompt.title,
          content: prompt.content,
          createdAt: prompt.updatedAt
        }
        prompt.versions = [snapshot, ...prompt.versions].slice(0, MAX_VERSIONS)
      }
    }

    if (patch.title !== undefined) prompt.title = patch.title.trim() || '未命名 Prompt'
    if (patch.content !== undefined) prompt.content = patch.content
    if (patch.description !== undefined) prompt.description = patch.description
    if (patch.categoryId !== undefined) prompt.categoryId = patch.categoryId
    if (patch.tags !== undefined) prompt.tags = normalizeTags(patch.tags)
    if (patch.favorite !== undefined) prompt.favorite = patch.favorite

    // Keep variable definitions reconciled with the (possibly new) content.
    prompt.variables = syncVariables(
      prompt.content,
      patch.variables ?? prompt.variables
    )
    // Which clock moves is decided from the patch, not from the caller. Setting
    // a favourite through this method (the bulk action does) must behave the
    // same as toggleFavorite, or the same rule has two answers.
    if (EDIT_FIELDS.some((k) => patch[k] !== undefined)) prompt.updatedAt = now()
    if (patch.favorite !== undefined) this.touchMeta(prompt)
    this.flush()
    return prompt
  }

  /**
   * Append a tag. Lives here rather than in the caller because "read the tags,
   * append if absent, write them back" across the IPC boundary races anything
   * that changes tags in between — a cloud pull, or the next id in a bulk run.
   */
  addTag(id: string, tag: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined
    const [clean] = normalizeTags([tag])
    if (!clean || prompt.tags.includes(clean)) return prompt
    prompt.tags = [...prompt.tags, clean]
    prompt.updatedAt = now()
    this.flush()
    return prompt
  }

  /**
   * Soft delete. `updatedAt` is bumped so the change wins the sync merge and the
   * trash stays consistent across devices — no tombstone until it is purged.
   */
  deletePrompt(id: string): boolean {
    const prompt = this.getPrompt(id)
    if (!prompt || prompt.deletedAt) return false
    prompt.deletedAt = now()
    prompt.updatedAt = prompt.deletedAt
    this.flush()
    return true
  }

  restoreDeletedPrompt(id: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt?.deletedAt) return undefined
    prompt.deletedAt = null
    prompt.updatedAt = now()
    this.flush()
    return prompt
  }

  purgePrompt(id: string): boolean {
    const before = this.data.prompts.length
    this.data.prompts = this.data.prompts.filter((p) => p.id !== id)
    const changed = this.data.prompts.length !== before
    if (changed) {
      this.tomb(id, 'prompt')
      this.flush()
    }
    return changed
  }

  purgeAllDeleted(): number {
    const doomed = this.data.prompts.filter((p) => p.deletedAt)
    if (doomed.length === 0) return 0
    this.data.prompts = this.data.prompts.filter((p) => !p.deletedAt)
    for (const p of doomed) this.tomb(p.id, 'prompt')
    this.flush()
    return doomed.length
  }

  duplicatePrompt(id: string): Prompt | undefined {
    const src = this.getPrompt(id)
    if (!src) return undefined
    const ts = now()
    const copy: Prompt = {
      ...structuredClone(src),
      id: nanoid(),
      title: `${src.title} (副本)`,
      versions: [],
      favorite: false,
      pinned: false,
      useCount: 0,
      lastUsedAt: null,
      deletedAt: null,
      createdAt: ts,
      updatedAt: ts,
      metaUpdatedAt: ts
    }
    this.data.prompts.push(copy)
    this.flush()
    return copy
  }

  /**
   * The four metadata fields share one clock, separate from `updatedAt`. None
   * of them is an edit, so none of them should be able to win — or lose — a
   * merge against someone else's body edit.
   */
  private touchMeta(prompt: Prompt): void {
    prompt.metaUpdatedAt = now()
  }

  toggleFavorite(id: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined
    prompt.favorite = !prompt.favorite
    this.touchMeta(prompt)
    this.flush()
    return prompt
  }

  togglePin(id: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined
    prompt.pinned = !prompt.pinned
    this.touchMeta(prompt)
    this.flush()
    return prompt
  }

  /** Record that a prompt was copied/used. Usage is metadata, not an edit. */
  recordUse(id: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined
    prompt.useCount = (prompt.useCount ?? 0) + 1
    prompt.lastUsedAt = now()
    this.touchMeta(prompt)
    this.flush()
    return prompt
  }

  /** Persist the last-entered variable values (metadata; no version/edit bump). */
  rememberVariableValues(promptId: string, values: Record<string, string>): Prompt | undefined {
    const prompt = this.getPrompt(promptId)
    if (!prompt) return undefined
    for (const v of prompt.variables) {
      if (values[v.name] !== undefined) v.lastValue = values[v.name]
    }
    this.flush()
    return prompt
  }

  restoreVersion(promptId: string, versionId: string): Prompt | undefined {
    const prompt = this.getPrompt(promptId)
    if (!prompt) return undefined
    const version = prompt.versions.find((v) => v.id === versionId)
    if (!version) return undefined
    return this.updatePrompt(promptId, {
      title: version.title,
      content: version.content
    })
  }

  /**
   * Remove a single saved version. Does not touch the current content — and so
   * must not bump `updatedAt` either: pruning history on one device used to win
   * the merge outright and wipe out a body edit made on another.
   */
  deleteVersion(promptId: string, versionId: string): Prompt | undefined {
    const prompt = this.getPrompt(promptId)
    if (!prompt) return undefined
    const next = prompt.versions.filter((v) => v.id !== versionId)
    if (next.length === prompt.versions.length) return prompt
    prompt.versions = next
    this.flush()
    return prompt
  }

  // ---- Categories ----

  listCategories(): Category[] {
    return [...this.data.categories].sort(
      (a, b) => a.order - b.order || a.createdAt - b.createdAt
    )
  }

  createCategory(name: string, color?: string): Category {
    const maxOrder = this.data.categories.reduce((m, c) => Math.max(m, c.order), -1)
    const ts = now()
    const category: Category = {
      id: nanoid(),
      name: name.trim() || '未命名分类',
      color,
      order: maxOrder + 1,
      createdAt: ts,
      updatedAt: ts
    }
    this.data.categories.push(category)
    this.flush()
    return category
  }

  /** Apply a new manual order given category ids in the desired sequence. */
  reorderCategories(idsInOrder: string[]): Category[] {
    const rank = new Map(idsInOrder.map((id, i) => [id, i]))
    const ts = now()
    for (const c of this.data.categories) {
      const r = rank.get(c.id)
      if (r !== undefined && c.order !== r) {
        c.order = r
        c.updatedAt = ts
      }
    }
    this.flush()
    return this.listCategories()
  }

  updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Category | undefined {
    const category = this.data.categories.find((c) => c.id === id)
    if (!category) return undefined
    if (patch.name !== undefined) category.name = patch.name.trim() || category.name
    if (patch.color !== undefined) category.color = patch.color
    category.updatedAt = now()
    this.flush()
    return category
  }

  deleteCategory(id: string): boolean {
    const before = this.data.categories.length
    this.data.categories = this.data.categories.filter((c) => c.id !== id)
    // Orphaned prompts fall back to "uncategorized".
    for (const p of this.data.prompts) {
      if (p.categoryId === id) p.categoryId = null
    }
    const changed = this.data.categories.length !== before
    if (changed) {
      this.tomb(id, 'category')
      this.flush()
    }
    return changed
  }

  /**
   * Ids a wholesale replacement drops. A replacement that leaves no tombstone
   * is invisible to peers: the next merge only sees "the other device still
   * has these items" and resurrects every one of them, so an import or a
   * backup restore silently undoes itself on the next sync.
   */
  private droppedIds(
    prompts: Prompt[],
    categories: Category[]
  ): Array<[string, Tombstone['type']]> {
    const keptPrompts = new Set(prompts.map((p) => p.id))
    const keptCategories = new Set(categories.map((c) => c.id))
    const out: Array<[string, Tombstone['type']]> = []
    for (const p of this.data.prompts) if (!keptPrompts.has(p.id)) out.push([p.id, 'prompt'])
    for (const c of this.data.categories) if (!keptCategories.has(c.id)) out.push([c.id, 'category'])
    return out
  }

  /**
   * Invariant: a record that is present must not also carry a tombstone.
   * Re-adding an id (import, restore) is an explicit resurrection and has to
   * clear the old deletion, or the merge deletes it again behind the user.
   */
  private pruneResurrected(): void {
    const live = new Set([
      ...this.data.prompts.map((p) => p.id),
      ...this.data.categories.map((c) => c.id)
    ])
    this.data.tombstones = this.data.tombstones.filter((t) => !live.has(t.id))
  }

  /** Wholesale replace of all data — used when applying a merged sync snapshot. */
  replaceAll(prompts: Prompt[], categories: Category[], tombstones?: Tombstone[]): void {
    const dropped = this.droppedIds(prompts, categories)
    this.data.prompts = structuredClone(prompts)
    this.data.categories = structuredClone(categories)
    if (tombstones) this.data.tombstones = structuredClone(tombstones)
    // No-op for a sync merge (its output is a superset of local minus items
    // already tombstoned); the deletions it records are the ones a restore or
    // a replace-import would otherwise lose.
    for (const [id, type] of dropped) {
      if (!this.data.tombstones.some((t) => t.id === id)) this.tomb(id, type)
    }
    this.pruneResurrected()
    this.flush()
  }

  // ---- Import / Export ----

  export(): ExportBundle {
    return {
      app: 'promptbox',
      version: DATA_VERSION,
      exportedAt: now(),
      prompts: this.data.prompts,
      categories: this.data.categories,
      tombstones: this.data.tombstones
    }
  }

  getTombstones(): Tombstone[] {
    return this.data.tombstones
  }

  import(bundle: ExportBundle, mode: ImportMode): ImportResult {
    // Enforced here rather than at the IPC handler so no future entry point can
    // reach a destructive replace with an unvalidated document.
    if (!isExportBundle(bundle)) {
      throw new Error('这不是 PromptBox 导出文件，或文件已损坏')
    }
    const incomingPrompts = bundle.prompts
    const incomingCategories = bundle.categories

    if (mode === 'replace') {
      // Routed through replaceAll so the ids this drops are tombstoned and the
      // ids it (re)introduces lose theirs — otherwise the next sync undoes the
      // whole import.
      this.replaceAll(incomingPrompts, incomingCategories)
      return {
        importedPrompts: incomingPrompts.length,
        importedCategories: incomingCategories.length
      }
    }

    // merge: keep existing, add new ids, regenerate clashing ids.
    const existingPromptIds = new Set(this.data.prompts.map((p) => p.id))
    const existingCategoryIds = new Set(this.data.categories.map((c) => c.id))

    let importedPrompts = 0
    let importedCategories = 0

    for (const c of incomingCategories) {
      if (!existingCategoryIds.has(c.id)) {
        this.data.categories.push(structuredClone(c))
        existingCategoryIds.add(c.id)
        importedCategories++
      }
    }
    for (const p of incomingPrompts) {
      const clone = structuredClone(p)
      if (existingPromptIds.has(clone.id)) {
        clone.id = nanoid()
        clone.title = `${clone.title} (导入)`
      }
      this.data.prompts.push(clone)
      existingPromptIds.add(clone.id)
      importedPrompts++
    }
    this.pruneResurrected()
    this.flush()
    return { importedPrompts, importedCategories }
  }
}
