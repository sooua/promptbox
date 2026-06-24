import { existsSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'fs'
import { join } from 'path'
import { nanoid } from 'nanoid'
import type {
  Asset,
  AssetInput,
  AssetKind,
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
import { syncVariables } from '@shared/variables'
import { ensureDir } from './config'

const DATA_VERSION = 1
const MAX_VERSIONS = 50
/** Edits within this window of the latest snapshot are coalesced into it. */
const VERSION_COALESCE_MS = 3 * 60 * 1000

function now(): number {
  return Date.now()
}

function emptyData(): PromptBoxData {
  return { version: DATA_VERSION, prompts: [], categories: [], assets: [], tombstones: [] }
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
  getPrompt(id: string): Prompt | undefined
  createPrompt(input: PromptInput): Prompt
  updatePrompt(id: string, patch: Partial<PromptInput>): Prompt | undefined
  addPrompt(prompt: Prompt): Prompt
  deletePrompt(id: string): boolean
  duplicatePrompt(id: string): Prompt | undefined
  toggleFavorite(id: string): Prompt | undefined
  togglePin(id: string): Prompt | undefined
  recordUse(id: string): Prompt | undefined
  rememberVariableValues(promptId: string, values: Record<string, string>): Prompt | undefined
  restoreVersion(promptId: string, versionId: string): Prompt | undefined

  listCategories(): Category[]
  createCategory(name: string, color?: string): Category
  reorderCategories(idsInOrder: string[]): Category[]
  updateCategory(id: string, patch: Partial<Pick<Category, 'name' | 'color'>>): Category | undefined
  deleteCategory(id: string): boolean

  listAssets(kind?: AssetKind): Asset[]
  getAsset(id: string): Asset | undefined
  createAsset(input: AssetInput): Asset
  updateAsset(id: string, patch: Partial<AssetInput>): Asset | undefined
  restoreAssetVersion(assetId: string, versionId: string): Asset | undefined
  addAsset(asset: Asset): Asset
  deleteAsset(id: string): boolean
  duplicateAsset(id: string): Asset | undefined
  toggleAssetFavorite(id: string): Asset | undefined

  replaceAll(
    prompts: Prompt[],
    categories: Category[],
    assets?: Asset[],
    tombstones?: Tombstone[]
  ): void
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
    return {
      version: parsed.version ?? DATA_VERSION,
      prompts: (parsed.prompts ?? []).map((p) => ({
        ...p,
        pinned: p.pinned ?? false,
        useCount: p.useCount ?? 0,
        lastUsedAt: p.lastUsedAt ?? null
      })),
      categories: (parsed.categories ?? []).map((c) => ({
        ...c,
        order: c.order ?? categoriesByCreated.findIndex((x) => x.id === c.id),
        updatedAt: c.updatedAt ?? c.createdAt
      })),
      assets: (parsed.assets ?? []).map((a) => ({
        ...a,
        categoryId: a.categoryId ?? null,
        files: a.files ?? [],
        versions: a.versions ?? []
      })),
      tombstones: parsed.tombstones ?? []
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

  listPrompts(): Prompt[] {
    return [...this.data.prompts].sort((a, b) => b.updatedAt - a.updatedAt)
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
      tags: input.tags ?? [],
      favorite: input.favorite ?? false,
      pinned: false,
      variables: syncVariables(input.content ?? '', input.variables ?? []),
      versions: [],
      useCount: 0,
      lastUsedAt: null,
      createdAt: ts,
      updatedAt: ts
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
    if (patch.tags !== undefined) prompt.tags = patch.tags
    if (patch.favorite !== undefined) prompt.favorite = patch.favorite

    // Keep variable definitions reconciled with the (possibly new) content.
    prompt.variables = syncVariables(
      prompt.content,
      patch.variables ?? prompt.variables
    )
    prompt.updatedAt = now()
    this.flush()
    return prompt
  }

  /** Re-insert a previously-deleted prompt verbatim (undo). */
  addPrompt(prompt: Prompt): Prompt {
    if (!this.data.prompts.some((p) => p.id === prompt.id)) {
      this.data.prompts.push(structuredClone(prompt))
      this.data.tombstones = this.data.tombstones.filter((t) => t.id !== prompt.id)
      this.flush()
    }
    return prompt
  }

  deletePrompt(id: string): boolean {
    const before = this.data.prompts.length
    this.data.prompts = this.data.prompts.filter((p) => p.id !== id)
    const changed = this.data.prompts.length !== before
    if (changed) {
      this.tomb(id, 'prompt')
      this.flush()
    }
    return changed
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
      createdAt: ts,
      updatedAt: ts
    }
    this.data.prompts.push(copy)
    this.flush()
    return copy
  }

  toggleFavorite(id: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined
    prompt.favorite = !prompt.favorite
    prompt.updatedAt = now()
    this.flush()
    return prompt
  }

  togglePin(id: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined
    prompt.pinned = !prompt.pinned
    // pin is metadata — don't bump updatedAt or churn the edit-order
    this.flush()
    return prompt
  }

  /**
   * Record that a prompt was copied/used. Intentionally does NOT touch
   * updatedAt or create a version — usage is metadata, not an edit.
   */
  recordUse(id: string): Prompt | undefined {
    const prompt = this.getPrompt(id)
    if (!prompt) return undefined
    prompt.useCount = (prompt.useCount ?? 0) + 1
    prompt.lastUsedAt = now()
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
    // Orphaned prompts and assets fall back to "uncategorized".
    for (const p of this.data.prompts) {
      if (p.categoryId === id) p.categoryId = null
    }
    for (const a of this.data.assets) {
      if (a.categoryId === id) a.categoryId = null
    }
    const changed = this.data.categories.length !== before
    if (changed) {
      this.tomb(id, 'category')
      this.flush()
    }
    return changed
  }

  // ---- Assets ----

  listAssets(kind?: AssetKind): Asset[] {
    const all = kind ? this.data.assets.filter((a) => a.kind === kind) : this.data.assets
    return [...all].sort((a, b) => b.updatedAt - a.updatedAt)
  }

  getAsset(id: string): Asset | undefined {
    return this.data.assets.find((a) => a.id === id)
  }

  createAsset(input: AssetInput): Asset {
    const ts = now()
    const asset: Asset = {
      id: nanoid(),
      kind: input.kind,
      name: input.name?.trim() || '未命名',
      description: input.description ?? '',
      categoryId: input.categoryId ?? null,
      tags: input.tags ?? [],
      favorite: false,
      content: input.content ?? '',
      meta: input.meta ?? {},
      files: input.files ?? [],
      versions: [],
      createdAt: ts,
      updatedAt: ts
    }
    this.data.assets.push(asset)
    this.flush()
    return asset
  }

  updateAsset(id: string, patch: Partial<AssetInput>): Asset | undefined {
    const asset = this.getAsset(id)
    if (!asset) return undefined

    const contentChanged = patch.content !== undefined && patch.content !== asset.content
    const metaChanged =
      patch.meta !== undefined &&
      JSON.stringify({ ...asset.meta, ...patch.meta }) !== JSON.stringify(asset.meta)

    // Snapshot prior state on meaningful changes, coalescing rapid edits.
    if (contentChanged || metaChanged) {
      const latest = asset.versions[0]
      const fresh = latest && now() - latest.createdAt < VERSION_COALESCE_MS
      if (!fresh) {
        asset.versions = [
          {
            id: nanoid(),
            name: asset.name,
            content: asset.content,
            meta: { ...asset.meta },
            createdAt: asset.updatedAt
          },
          ...asset.versions
        ].slice(0, MAX_VERSIONS)
      }
    }

    if (patch.name !== undefined) asset.name = patch.name.trim() || '未命名'
    if (patch.description !== undefined) asset.description = patch.description
    if (patch.categoryId !== undefined) asset.categoryId = patch.categoryId
    if (patch.tags !== undefined) asset.tags = patch.tags
    if (patch.content !== undefined) asset.content = patch.content
    if (patch.meta !== undefined) asset.meta = { ...asset.meta, ...patch.meta }
    if (patch.files !== undefined) asset.files = patch.files
    asset.updatedAt = now()
    this.flush()
    return asset
  }

  restoreAssetVersion(assetId: string, versionId: string): Asset | undefined {
    const asset = this.getAsset(assetId)
    if (!asset) return undefined
    const version = asset.versions.find((v) => v.id === versionId)
    if (!version) return undefined
    // snapshot the current state, then fully replace content + meta
    asset.versions = [
      {
        id: nanoid(),
        name: asset.name,
        content: asset.content,
        meta: { ...asset.meta },
        createdAt: asset.updatedAt
      },
      ...asset.versions
    ].slice(0, MAX_VERSIONS)
    asset.content = version.content
    asset.meta = { ...version.meta }
    asset.updatedAt = now()
    this.flush()
    return asset
  }

  /** Re-insert a previously-deleted asset verbatim (undo). */
  addAsset(asset: Asset): Asset {
    if (!this.data.assets.some((a) => a.id === asset.id)) {
      this.data.assets.push(structuredClone(asset))
      this.data.tombstones = this.data.tombstones.filter((t) => t.id !== asset.id)
      this.flush()
    }
    return asset
  }

  deleteAsset(id: string): boolean {
    const before = this.data.assets.length
    this.data.assets = this.data.assets.filter((a) => a.id !== id)
    const changed = this.data.assets.length !== before
    if (changed) {
      this.tomb(id, 'asset')
      this.flush()
    }
    return changed
  }

  duplicateAsset(id: string): Asset | undefined {
    const src = this.getAsset(id)
    if (!src) return undefined
    const ts = now()
    const copy: Asset = {
      ...structuredClone(src),
      id: nanoid(),
      name: `${src.name} (副本)`,
      favorite: false,
      versions: [],
      createdAt: ts,
      updatedAt: ts
    }
    this.data.assets.push(copy)
    this.flush()
    return copy
  }

  toggleAssetFavorite(id: string): Asset | undefined {
    const asset = this.getAsset(id)
    if (!asset) return undefined
    asset.favorite = !asset.favorite
    asset.updatedAt = now()
    this.flush()
    return asset
  }

  /** Wholesale replace of all data — used when applying a merged sync snapshot. */
  replaceAll(
    prompts: Prompt[],
    categories: Category[],
    assets: Asset[] = [],
    tombstones?: Tombstone[]
  ): void {
    this.data.prompts = structuredClone(prompts)
    this.data.categories = structuredClone(categories)
    this.data.assets = structuredClone(assets)
    if (tombstones) this.data.tombstones = structuredClone(tombstones)
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
      assets: this.data.assets,
      tombstones: this.data.tombstones
    }
  }

  getTombstones(): Tombstone[] {
    return this.data.tombstones
  }

  import(bundle: ExportBundle, mode: ImportMode): ImportResult {
    const incomingPrompts = bundle.prompts ?? []
    const incomingCategories = bundle.categories ?? []
    const incomingAssets = bundle.assets ?? []

    if (mode === 'replace') {
      this.data.prompts = structuredClone(incomingPrompts)
      this.data.categories = structuredClone(incomingCategories)
      this.data.assets = structuredClone(incomingAssets)
      this.flush()
      return {
        importedPrompts: incomingPrompts.length,
        importedCategories: incomingCategories.length
      }
    }

    // merge: keep existing, add new ids, regenerate clashing ids.
    const existingPromptIds = new Set(this.data.prompts.map((p) => p.id))
    const existingCategoryIds = new Set(this.data.categories.map((c) => c.id))
    const existingAssetIds = new Set(this.data.assets.map((a) => a.id))

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
    for (const a of incomingAssets) {
      const clone = structuredClone(a)
      if (existingAssetIds.has(clone.id)) clone.id = nanoid()
      this.data.assets.push(clone)
      existingAssetIds.add(clone.id)
    }
    this.flush()
    return { importedPrompts, importedCategories }
  }
}
