import { create } from 'zustand'
import type {
  AppSettings,
  BackupInfo,
  CloseAction,
  Category,
  ImportMode,
  Language,
  Prompt,
  PromptInput,
  CategoryPatch,
  Flow,
  S3ConfigInput,
  StageId,
  TrackId,
  SyncResult,
  SyncState,
  SyncVersion,
  ThemeMode,
  UpdateStatus,
  WebDavConfigInput
} from '@shared/types'

const api = window.api

export type View = 'route' | 'choose' | 'library' | 'settings' | 'trash'

/**
 * What the list shows: everything, favourites, one whole stage (`stage:<id>`),
 * or one step (a category id).
 */
export type CategoryFilter = string | 'all' | 'favorites'

export function isCategoryId(f: CategoryFilter): boolean {
  return f !== 'all' && f !== 'favorites' && !f.startsWith('stage:')
}

export function stageOf(f: CategoryFilter): StageId | null {
  return f.startsWith('stage:') ? (f.slice(6) as StageId) : null
}

/**
 * Where the user is on the route. Device-local (never synced): which project
 * type, which starting point, the current step, what's done, and which feature
 * round the build loop is on. `track === null` means the choose screen.
 */
export interface RouteState {
  track: TrackId | null
  flow: Flow
  cur: string | null
  done: string[]
  feature: number
}

const ROUTE_KEY = 'promptbox.route'
const ROUTE_DEFAULT: RouteState = { track: null, flow: 'fresh', cur: null, done: [], feature: 1 }

function loadRoute(): RouteState {
  try {
    const raw = localStorage.getItem(ROUTE_KEY)
    return raw ? { ...ROUTE_DEFAULT, ...(JSON.parse(raw) as Partial<RouteState>) } : ROUTE_DEFAULT
  } catch {
    return ROUTE_DEFAULT
  }
}

interface State {
  prompts: Prompt[]
  /** Soft-deleted prompts, kept separate so nothing else has to filter. */
  deletedPrompts: Prompt[]
  categories: Category[]
  settings: AppSettings | null

  view: View
  route: RouteState
  selectedId: string | null
  categoryFilter: CategoryFilter
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

  // navigation / filters
  setView(v: View): void
  setRoute(patch: Partial<RouteState>): void
  select(id: string | null): void
  setCategoryFilter(f: CategoryFilter): void
  setSearch(s: string): void

  // prompt mutations
  createPrompt(input: PromptInput): Promise<Prompt>
  updatePrompt(id: string, patch: Partial<PromptInput>): Promise<void>
  /** Soft delete — recoverable from the trash. */
  deletePrompt(id: string): Promise<void>
  duplicatePrompt(id: string): Promise<void>
  // trash
  refreshDeleted(): Promise<void>
  restoreDeleted(id: string): Promise<void>
  purgePrompt(id: string): Promise<void>
  purgeAllDeleted(): Promise<number>
  /** Restore many at once (trash's "恢复全部"). */
  bulkRestoreDeleted(ids: string[]): Promise<void>
  toggleFavorite(id: string): Promise<void>
  restoreVersion(promptId: string, versionId: string): Promise<void>
  deleteVersion(promptId: string, versionId: string): Promise<void>
  recordUse(id: string): Promise<void>
  /** Persist last-entered variable values for a prompt. */
  rememberVarValues(id: string, values: Record<string, string>): Promise<void>
  /** Copy a prompt's raw content to the clipboard and count it as a use. */
  copyAndUse(id: string): Promise<boolean>
  /** Copy already-resolved text (variables filled) and count it as a use. */
  copyResolvedAndUse(id: string, text: string): Promise<boolean>
  /** Bulk-import .md/.txt files into `categoryId`. */
  importPromptFiles(
    categoryId: string | null
  ): Promise<{ ok: boolean; count: number; failed: string[] }>

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
  createCategory(input: CategoryPatch): Promise<Category>
  updateCategory(id: string, patch: CategoryPatch): Promise<void>
  deleteCategory(id: string): Promise<void>
  reorderCategories(ids: string[]): Promise<void>

  // settings
  setTheme(theme: ThemeMode): Promise<void>
  setLanguage(language: Language): Promise<void>
  setCloseAction(action: CloseAction): Promise<void>
  setHotkey(accelerator: string): Promise<boolean>

  chooseDataDir(): Promise<void>
  openDataDir(): Promise<void>
  exportData(): Promise<{ ok: boolean; path?: string }>
  importData(
    mode: ImportMode
  ): Promise<{ ok: boolean; result?: unknown; backedUp?: boolean; error?: string }>

  // backups
  listBackups(): Promise<BackupInfo[]>
  createBackup(): Promise<BackupInfo | null>
  restoreBackup(file: string): Promise<boolean>
  openBackupDir(): Promise<void>

  // auto update
  setUpdateStatus(status: UpdateStatus): void
  checkUpdate(): Promise<UpdateStatus>
  installUpdate(): Promise<void>

  /** Quit for real — closing the window only hides to the tray. */
  quitApp(): Promise<void>
}

/** After a pull/restore overwrote local data in main, reload it into the UI. */
async function reloadAfterPull(
  get: () => State,
  set: (partial: Partial<State>) => void
): Promise<void> {
  const [prompts, deletedPrompts, categories] = await Promise.all([
    api.prompts.list(),
    api.prompts.listDeleted(),
    api.categories.list()
  ])
  const promptThere = prompts.some((p) => p.id === get().selectedId)
  set({
    prompts,
    deletedPrompts,
    categories,
    selectedId: promptThere ? get().selectedId : (prompts[0]?.id ?? null)
  })
}

export const useStore = create<State>((set, get) => ({
  prompts: [],
  deletedPrompts: [],
  categories: [],
  settings: null,

  view: 'route',
  route: loadRoute(),
  selectedId: null,
  categoryFilter: 'all',
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
    const [prompts, deletedPrompts, categories, settings, syncState, appVersion] = await Promise.all(
      [
        api.prompts.list(),
        api.prompts.listDeleted(),
        api.categories.list(),
        api.settings.get(),
        api.sync.getState(),
        api.update.getVersion()
      ]
    )
    set({
      prompts,
      deletedPrompts,
      categories,
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

  setView: (view) => set({ view }),
  setRoute: (patch) => {
    const route = { ...get().route, ...patch }
    try {
      localStorage.setItem(ROUTE_KEY, JSON.stringify(route))
    } catch {
      /* private mode etc. — progress just won't survive a restart */
    }
    set({ route })
  },
  select: (selectedId) => set({ selectedId, view: 'library' }),
  setCategoryFilter: (categoryFilter) => set({ categoryFilter, view: 'library' }),
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
    await get().refreshDeleted()
  },

  async refreshDeleted() {
    set({ deletedPrompts: await api.prompts.listDeleted() })
  },

  async restoreDeleted(id) {
    await api.prompts.restoreDeleted(id)
    await Promise.all([get().refreshPrompts(), get().refreshDeleted()])
    set({ selectedId: id })
  },

  async purgePrompt(id) {
    await api.prompts.purge(id)
    await get().refreshDeleted()
  },

  async purgeAllDeleted() {
    const n = await api.prompts.purgeAll()
    await get().refreshDeleted()
    return n
  },

  async duplicatePrompt(id) {
    const copy = await api.prompts.duplicate(id)
    await get().refreshPrompts()
    if (copy) set({ selectedId: copy.id })
  },

  async bulkRestoreDeleted(ids) {
    for (const id of ids) await api.prompts.restoreDeleted(id)
    await Promise.all([get().refreshPrompts(), get().refreshDeleted()])
  },

  async toggleFavorite(id) {
    await api.prompts.toggleFavorite(id)
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

  async importPromptFiles(categoryId) {
    const res = await api.prompts.importFiles(categoryId)
    if (res.count > 0) {
      await get().refreshPrompts()
      // Land on the newest import so the user sees what just arrived.
      set({ selectedId: get().prompts[0]?.id ?? null, view: 'library' })
    }
    return res
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

  async createCategory(input) {
    const c = await api.categories.create(input)
    await get().refreshCategories()
    return c
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

  async setCloseAction(action) {
    const settings = await api.settings.setCloseAction(action)
    set({ settings })
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
  },

  async quitApp() {
    await api.quit()
  }
}))
