import { create } from 'zustand'
import type {
  AppSettings,
  Asset,
  AssetInput,
  AssetKind,
  BackupInfo,
  Category,
  ImportMode,
  Language,
  GithubDiscoverItem,
  GithubDiscoverResult,
  GithubSourceConfig,
  McpDiscoverItem,
  McpDiscoverResult,
  McpRegistryConfig,
  PromptDiscoverItem,
  PromptDiscoverResult,
  PromptSource,
  PromptSourceConfig,
  Prompt,
  PromptInput,
  S3ConfigInput,
  SyncResult,
  SyncState,
  SyncVersion,
  ThemeMode,
  UpdateStatus,
  WebDavConfigInput
} from '@shared/types'

const api = window.api

export type View = 'library' | 'settings' | 'discover'
export type Workspace = 'prompts' | AssetKind

/** Special filter sentinels for the category rail. */
export type CategoryFilter =
  | string
  | 'all'
  | 'favorites'
  | 'uncategorized'
  | 'recent'
  | 'frequent'

export const SPECIAL_FILTERS = [
  'all',
  'favorites',
  'uncategorized',
  'recent',
  'frequent'
] as const

export function isCategoryId(f: CategoryFilter): boolean {
  return !(SPECIAL_FILTERS as readonly string[]).includes(f)
}

interface State {
  prompts: Prompt[]
  categories: Category[]
  assets: Asset[]
  settings: AppSettings | null

  workspace: Workspace
  view: View
  selectedId: string | null
  selectedAssetId: string | null
  assetSearch: string
  assetFavOnly: boolean
  assetCategoryId: string | null
  categoryFilter: CategoryFilter
  /** active tag filters combined with AND */
  tagFilters: string[]
  search: string
  loading: boolean
  paletteOpen: boolean
  /** prompt whose variables are being filled before copy, or null */
  quickFillPromptId: string | null

  // cloud sync
  cloudOpen: boolean
  syncState: SyncState | null
  syncBusy: boolean

  // auto update
  appVersion: string
  updateStatus: UpdateStatus | null

  // lifecycle
  init(): Promise<void>
  refreshPrompts(): Promise<void>
  refreshCategories(): Promise<void>
  refreshAssets(): Promise<void>

  // assets
  setWorkspace(w: Workspace): void
  selectAsset(id: string | null): void
  setAssetSearch(s: string): void
  setAssetFavOnly(b: boolean): void
  setAssetCategory(id: string | null): void
  restoreAssetVersion(assetId: string, versionId: string): Promise<void>
  createAsset(kind: AssetKind): Promise<Asset>
  updateAsset(id: string, patch: Partial<AssetInput>): Promise<void>
  deleteAsset(id: string): Promise<void>
  restoreAsset(asset: Asset): Promise<void>
  duplicateAsset(id: string): Promise<void>
  toggleAssetFavorite(id: string): Promise<void>
  exportAsset(id: string): Promise<{ ok: boolean; path?: string }>
  importAssets(kind: AssetKind): Promise<{ ok: boolean; count: number }>
  installAsset(id: string, preset?: string): Promise<{ ok: boolean; path?: string }>
  mergeMcp(id: string, preset?: string): Promise<{ ok: boolean; path?: string; server?: string }>

  // navigation / filters
  setView(v: View): void
  select(id: string | null): void
  setCategoryFilter(f: CategoryFilter): void
  toggleTagFilter(t: string): void
  clearTagFilters(): void
  setSearch(s: string): void

  // prompt mutations
  createPrompt(input: PromptInput): Promise<Prompt>
  updatePrompt(id: string, patch: Partial<PromptInput>): Promise<void>
  deletePrompt(id: string): Promise<void>
  restorePrompt(prompt: Prompt): Promise<void>
  duplicatePrompt(id: string): Promise<void>
  // batch operations over multiple prompts
  bulkDeletePrompts(ids: string[]): Promise<Prompt[]>
  bulkRestorePrompts(prompts: Prompt[]): Promise<void>
  bulkSetCategory(ids: string[], categoryId: string | null): Promise<void>
  bulkSetFavorite(ids: string[], favorite: boolean): Promise<void>
  bulkAddTag(ids: string[], tag: string): Promise<void>
  toggleFavorite(id: string): Promise<void>
  togglePin(id: string): Promise<void>
  restoreVersion(promptId: string, versionId: string): Promise<void>
  deleteVersion(promptId: string, versionId: string): Promise<void>
  recordUse(id: string): Promise<void>
  /** Persist last-entered variable values for a prompt. */
  rememberVarValues(id: string, values: Record<string, string>): Promise<void>
  /** Copy a prompt's raw content to the clipboard and count it as a use. */
  copyAndUse(id: string): Promise<boolean>
  /** Copy already-resolved text (variables filled) and count it as a use. */
  copyResolvedAndUse(id: string, text: string): Promise<boolean>

  // command palette
  openPalette(): void
  closePalette(): void

  // quick-fill on copy
  openQuickFill(id: string): void
  closeQuickFill(): void

  // cloud sync
  openCloud(): void
  closeCloud(): void
  refreshSyncState(): Promise<void>
  connectGist(token: string): Promise<boolean>
  connectWebdav(cfg: WebDavConfigInput): Promise<boolean>
  connectS3(cfg: S3ConfigInput): Promise<boolean>
  disconnectSync(): Promise<void>
  setAutoSync(enabled: boolean): Promise<void>
  setEncryption(enabled: boolean, passphrase: string): Promise<void>
  /** handle an auto-sync completion pushed from main */
  onAutoSync(result: SyncResult): Promise<void>
  runSync(): Promise<SyncResult>
  resolveConflict(choice: 'local' | 'remote'): Promise<SyncResult>
  listSyncVersions(): Promise<SyncVersion[]>
  restoreSyncVersion(id: string): Promise<SyncResult>

  // category mutations
  createCategory(name: string, color?: string): Promise<void>
  updateCategory(id: string, patch: { name?: string; color?: string }): Promise<void>
  deleteCategory(id: string): Promise<void>
  reorderCategories(ids: string[]): Promise<void>

  // settings
  setTheme(theme: ThemeMode): Promise<void>
  setLanguage(language: Language): Promise<void>
  setMarket(enabled: boolean): Promise<void>
  setProxy(proxy: string): Promise<void>
  setGithubSources(sources: GithubSourceConfig[]): Promise<void>
  setMcpRegistries(regs: McpRegistryConfig[]): Promise<void>
  setPromptSources(sources: PromptSourceConfig[]): Promise<void>
  setHotkey(accelerator: string): Promise<boolean>

  // discover / marketplace
  searchMcp(query: string, cursor?: string, registry?: string): Promise<McpDiscoverResult>
  importMcp(item: McpDiscoverItem): Promise<{ id: string; duplicate: boolean }>
  listGithub(kind: 'skill' | 'agent'): Promise<GithubDiscoverResult>
  importGithub(item: GithubDiscoverItem): Promise<{ id: string; duplicate: boolean }>
  listPromptSources(): Promise<PromptSource[]>
  listPrompts(sourceId: string): Promise<PromptDiscoverResult>
  importPrompt(item: PromptDiscoverItem): Promise<{ id: string; duplicate: boolean }>
  chooseDataDir(): Promise<void>
  openDataDir(): Promise<void>
  exportData(): Promise<{ ok: boolean; path?: string }>
  importData(mode: ImportMode): Promise<{ ok: boolean; result?: unknown }>

  // backups
  listBackups(): Promise<BackupInfo[]>
  createBackup(): Promise<BackupInfo | null>
  restoreBackup(file: string): Promise<boolean>
  openBackupDir(): Promise<void>

  // auto update
  setUpdateStatus(status: UpdateStatus): void
  checkUpdate(): Promise<UpdateStatus>
  installUpdate(): Promise<void>
}

/** After a pull/restore overwrote local data in main, reload it into the UI. */
async function reloadAfterPull(
  get: () => State,
  set: (partial: Partial<State>) => void
): Promise<void> {
  const [prompts, categories, assets] = await Promise.all([
    api.prompts.list(),
    api.categories.list(),
    api.assets.list()
  ])
  const promptThere = prompts.some((p) => p.id === get().selectedId)
  const assetThere = assets.some((a) => a.id === get().selectedAssetId)
  set({
    prompts,
    categories,
    assets,
    selectedId: promptThere ? get().selectedId : (prompts[0]?.id ?? null),
    selectedAssetId: assetThere ? get().selectedAssetId : (assets[0]?.id ?? null)
  })
}

export const useStore = create<State>((set, get) => ({
  prompts: [],
  categories: [],
  assets: [],
  settings: null,

  workspace: 'prompts',
  view: 'library',
  selectedId: null,
  selectedAssetId: null,
  assetSearch: '',
  assetFavOnly: false,
  assetCategoryId: null,
  categoryFilter: 'all',
  tagFilters: [],
  search: '',
  loading: true,
  paletteOpen: false,
  quickFillPromptId: null,
  cloudOpen: false,
  syncState: null,
  syncBusy: false,
  appVersion: '',
  updateStatus: null,

  async init() {
    const [prompts, categories, assets, settings, syncState, appVersion] = await Promise.all([
      api.prompts.list(),
      api.categories.list(),
      api.assets.list(),
      api.settings.get(),
      api.sync.getState(),
      api.update.getVersion()
    ])
    set({
      prompts,
      categories,
      assets,
      settings,
      syncState,
      appVersion,
      loading: false,
      selectedId: prompts[0]?.id ?? null
    })
  },

  async refreshPrompts() {
    set({ prompts: await api.prompts.list() })
  },

  async refreshCategories() {
    set({ categories: await api.categories.list() })
  },

  async refreshAssets() {
    set({ assets: await api.assets.list() })
  },

  setWorkspace(workspace) {
    const firstOfKind =
      workspace === 'prompts'
        ? null
        : (get().assets.find((a) => a.kind === workspace)?.id ?? null)
    set({ workspace, view: 'library', selectedAssetId: firstOfKind })
  },

  selectAsset: (selectedAssetId) => set({ selectedAssetId, view: 'library' }),
  setAssetSearch: (assetSearch) => set({ assetSearch }),
  setAssetFavOnly: (assetFavOnly) => set({ assetFavOnly, assetCategoryId: null }),
  setAssetCategory: (assetCategoryId) => set({ assetCategoryId, assetFavOnly: false }),

  async restoreAssetVersion(assetId, versionId) {
    await api.assets.restoreVersion(assetId, versionId)
    await get().refreshAssets()
  },

  async createAsset(kind) {
    const asset = await api.assets.create({ kind, name: '未命名' })
    await get().refreshAssets()
    set({ selectedAssetId: asset.id })
    return asset
  },

  async updateAsset(id, patch) {
    await api.assets.update(id, patch)
    await get().refreshAssets()
  },

  async deleteAsset(id) {
    await api.assets.delete(id)
    const remaining = get().assets.filter((a) => a.id !== id)
    const sameKind = remaining.filter((a) => a.kind === get().workspace)
    set({
      assets: remaining,
      selectedAssetId:
        get().selectedAssetId === id ? (sameKind[0]?.id ?? null) : get().selectedAssetId
    })
  },

  async restoreAsset(asset) {
    await api.assets.add(asset)
    await get().refreshAssets()
    set({ selectedAssetId: asset.id })
  },

  async duplicateAsset(id) {
    const copy = await api.assets.duplicate(id)
    await get().refreshAssets()
    if (copy) set({ selectedAssetId: copy.id })
  },

  async toggleAssetFavorite(id) {
    await api.assets.toggleFavorite(id)
    await get().refreshAssets()
  },

  exportAsset(id) {
    return api.assets.exportFile(id)
  },

  installAsset(id, preset) {
    return api.assets.install(id, preset)
  },

  mergeMcp(id, preset) {
    return api.assets.mergeMcp(id, preset)
  },

  async importAssets(kind) {
    const res = await api.assets.importFile(kind)
    if (res.ok) {
      await get().refreshAssets()
      const first = get().assets.find((a) => a.kind === kind)
      if (first) set({ selectedAssetId: first.id })
    }
    return res
  },

  setView: (view) => set({ view }),
  select: (selectedId) => set({ selectedId, view: 'library' }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter, tagFilters: [], view: 'library' }),
  toggleTagFilter: (tag) =>
    set((s) => ({
      tagFilters: s.tagFilters.includes(tag)
        ? s.tagFilters.filter((t) => t !== tag)
        : [...s.tagFilters, tag]
    })),
  clearTagFilters: () => set({ tagFilters: [] }),
  setSearch: (search) => set({ search }),

  async createPrompt(input) {
    const prompt = await api.prompts.create(input)
    await get().refreshPrompts()
    set({ selectedId: prompt.id, view: 'library' })
    return prompt
  },

  async updatePrompt(id, patch) {
    await api.prompts.update(id, patch)
    await get().refreshPrompts()
  },

  async deletePrompt(id) {
    await api.prompts.delete(id)
    const remaining = get().prompts.filter((p) => p.id !== id)
    set({
      prompts: remaining,
      selectedId: get().selectedId === id ? (remaining[0]?.id ?? null) : get().selectedId
    })
  },

  async restorePrompt(prompt) {
    await api.prompts.add(prompt)
    await get().refreshPrompts()
    set({ selectedId: prompt.id })
  },

  async duplicatePrompt(id) {
    const copy = await api.prompts.duplicate(id)
    await get().refreshPrompts()
    if (copy) set({ selectedId: copy.id })
  },

  async bulkDeletePrompts(ids) {
    const idSet = new Set(ids)
    const snapshots = get().prompts.filter((p) => idSet.has(p.id))
    for (const id of ids) await api.prompts.delete(id)
    const remaining = get().prompts.filter((p) => !idSet.has(p.id))
    set({
      prompts: remaining,
      selectedId: idSet.has(get().selectedId ?? '')
        ? (remaining[0]?.id ?? null)
        : get().selectedId
    })
    return snapshots
  },

  async bulkRestorePrompts(prompts) {
    for (const p of prompts) await api.prompts.add(p)
    await get().refreshPrompts()
  },

  async bulkSetCategory(ids, categoryId) {
    for (const id of ids) await api.prompts.update(id, { categoryId })
    await get().refreshPrompts()
  },

  async bulkSetFavorite(ids, favorite) {
    for (const id of ids) await api.prompts.update(id, { favorite })
    await get().refreshPrompts()
  },

  async bulkAddTag(ids, tag) {
    const t = tag.trim().replace(/^#/, '')
    if (!t) return
    for (const id of ids) {
      const p = get().prompts.find((x) => x.id === id)
      if (p && !p.tags.includes(t)) await api.prompts.update(id, { tags: [...p.tags, t] })
    }
    await get().refreshPrompts()
  },

  async toggleFavorite(id) {
    await api.prompts.toggleFavorite(id)
    await get().refreshPrompts()
  },

  async togglePin(id) {
    await api.prompts.togglePin(id)
    await get().refreshPrompts()
  },

  async restoreVersion(promptId, versionId) {
    await api.prompts.restoreVersion(promptId, versionId)
    await get().refreshPrompts()
  },

  async deleteVersion(promptId, versionId) {
    await api.prompts.deleteVersion(promptId, versionId)
    await get().refreshPrompts()
  },

  async recordUse(id) {
    await api.prompts.recordUse(id)
    await get().refreshPrompts()
  },

  async rememberVarValues(id, values) {
    await api.prompts.rememberVars(id, values)
    await get().refreshPrompts()
  },

  async copyAndUse(id) {
    const prompt = get().prompts.find((p) => p.id === id)
    if (!prompt) return false
    try {
      await navigator.clipboard.writeText(prompt.content)
    } catch {
      return false
    }
    await get().recordUse(id)
    return true
  },

  async copyResolvedAndUse(id, text) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      return false
    }
    await get().recordUse(id)
    return true
  },

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),

  openQuickFill: (id) => set({ quickFillPromptId: id, paletteOpen: false }),
  closeQuickFill: () => set({ quickFillPromptId: null }),

  openCloud: () => set({ cloudOpen: true }),
  closeCloud: () => set({ cloudOpen: false }),

  async refreshSyncState() {
    set({ syncState: await api.sync.getState() })
  },

  async connectGist(token) {
    const syncState = await api.sync.connectGist(token)
    set({ syncState })
    return syncState.connected
  },

  async connectWebdav(cfg) {
    const syncState = await api.sync.connectWebdav(cfg)
    set({ syncState })
    return syncState.connected
  },

  async connectS3(cfg) {
    const syncState = await api.sync.connectS3(cfg)
    set({ syncState })
    return syncState.connected
  },

  async disconnectSync() {
    set({ syncState: await api.sync.disconnect() })
  },

  async setAutoSync(enabled) {
    set({ syncState: await api.sync.setAuto(enabled) })
  },

  async setEncryption(enabled, passphrase) {
    set({ syncState: await api.sync.setEncryption(enabled, passphrase) })
  },

  async onAutoSync(result) {
    await get().refreshSyncState()
    if (result.status === 'pulled') await reloadAfterPull(get, set)
  },

  async runSync() {
    set({ syncBusy: true })
    const result = await api.sync.run()
    set({ syncBusy: false })
    await get().refreshSyncState()
    if (result.status === 'pulled') await reloadAfterPull(get, set)
    return result
  },

  async resolveConflict(choice) {
    set({ syncBusy: true })
    const result = await api.sync.resolveConflict(choice)
    set({ syncBusy: false })
    await get().refreshSyncState()
    if (result.status === 'pulled') await reloadAfterPull(get, set)
    return result
  },

  listSyncVersions() {
    return api.sync.listVersions()
  },

  async restoreSyncVersion(id) {
    set({ syncBusy: true })
    const result = await api.sync.restoreVersion(id)
    set({ syncBusy: false })
    await get().refreshSyncState()
    if (result.status === 'pulled') await reloadAfterPull(get, set)
    return result
  },

  async createCategory(name, color) {
    await api.categories.create(name, color)
    await get().refreshCategories()
  },

  async updateCategory(id, patch) {
    await api.categories.update(id, patch)
    await get().refreshCategories()
  },

  async deleteCategory(id) {
    await api.categories.delete(id)
    await Promise.all([get().refreshCategories(), get().refreshPrompts()])
    if (get().categoryFilter === id) set({ categoryFilter: 'all' })
  },

  async reorderCategories(ids) {
    // optimistic: reflect the new order immediately, then persist
    const byId = new Map(get().categories.map((c) => [c.id, c]))
    const reordered = ids.flatMap((id) => {
      const c = byId.get(id)
      return c ? [c] : []
    })
    set({ categories: reordered })
    const categories = await api.categories.reorder(ids)
    set({ categories })
  },

  async setTheme(theme) {
    const settings = await api.settings.setTheme(theme)
    set({ settings })
  },

  async setLanguage(language) {
    const settings = await api.settings.setLanguage(language)
    set({ settings })
  },

  async setMarket(enabled) {
    const settings = await api.settings.setMarket(enabled)
    set({ settings })
  },

  async setProxy(proxy) {
    const settings = await api.settings.setProxy(proxy)
    set({ settings })
  },

  async setGithubSources(sources) {
    const settings = await api.settings.setGithubSources(sources)
    set({ settings })
  },

  async setMcpRegistries(regs) {
    const settings = await api.settings.setMcpRegistries(regs)
    set({ settings })
  },

  async setPromptSources(sources) {
    const settings = await api.settings.setPromptSources(sources)
    set({ settings })
  },

  searchMcp(query, cursor, registry) {
    return api.market.mcpSearch(query, cursor, registry)
  },

  async importMcp(item) {
    const r = await api.market.mcpImport(item)
    await get().refreshAssets()
    return r
  },

  listGithub(kind) {
    return api.market.githubList(kind)
  },

  async importGithub(item) {
    const r = await api.market.githubImport(item)
    await get().refreshAssets()
    return r
  },

  listPromptSources() {
    return api.market.promptSources()
  },

  listPrompts(sourceId) {
    return api.market.promptList(sourceId)
  },

  async importPrompt(item) {
    const r = await api.market.promptImport(item)
    await get().refreshPrompts()
    return r
  },

  async setHotkey(accelerator) {
    const { ok, settings } = await api.settings.setHotkey(accelerator)
    set({ settings })
    return ok
  },

  async chooseDataDir() {
    const settings = await api.settings.chooseDataDir()
    if (settings) {
      set({ settings })
      await Promise.all([get().refreshPrompts(), get().refreshCategories()])
      set({ selectedId: get().prompts[0]?.id ?? null })
    }
  },

  async openDataDir() {
    await api.settings.openDataDir()
  },

  async exportData() {
    return api.data.export()
  },

  async importData(mode) {
    const res = await api.data.import(mode)
    if (res.ok) {
      await Promise.all([get().refreshPrompts(), get().refreshCategories()])
      set({ selectedId: get().prompts[0]?.id ?? null })
    }
    return res
  },

  listBackups() {
    return api.backup.list()
  },

  createBackup() {
    return api.backup.create()
  },

  async restoreBackup(file) {
    const ok = await api.backup.restore(file)
    if (ok) await reloadAfterPull(get, set)
    return ok
  },

  openBackupDir() {
    return api.backup.openDir()
  },

  setUpdateStatus: (updateStatus) => set({ updateStatus }),

  async checkUpdate() {
    const status = await api.update.check()
    set({ updateStatus: status })
    return status
  },

  async installUpdate() {
    await api.update.install()
  }
}))
