import type {
  AppSettings,
  BackupInfo,
  CloseAction,
  Category,
  ImportMode,
  ImportResult,
  CategoryPatch,
  Prompt,
  PromptInput,
  S3ConfigInput,
  SyncResult,
  SyncState,
  Language,
  SyncVersion,
  ThemeMode,
  UpdateStatus,
  WebDavConfigInput
} from '@shared/types'

export interface PromptBoxApi {
  prompts: {
    list(): Promise<Prompt[]>
    get(id: string): Promise<Prompt | undefined>
    create(input: PromptInput): Promise<Prompt>
    update(id: string, patch: Partial<PromptInput>): Promise<Prompt | undefined>
    /** Append one tag. Normalised and deduped in the main process. */
    /** Soft delete — the prompt moves to the trash and stays restorable. */
    delete(id: string): Promise<boolean>
    listDeleted(): Promise<Prompt[]>
    restoreDeleted(id: string): Promise<Prompt | undefined>
    /** Irreversible. */
    purge(id: string): Promise<boolean>
    purgeAll(): Promise<number>
    duplicate(id: string): Promise<Prompt | undefined>
    toggleFavorite(id: string): Promise<Prompt | undefined>
    restoreVersion(promptId: string, versionId: string): Promise<Prompt | undefined>
    deleteVersion(promptId: string, versionId: string): Promise<Prompt | undefined>
    recordUse(id: string): Promise<Prompt | undefined>
    rememberVars(id: string, values: Record<string, string>): Promise<Prompt | undefined>
    /** Bulk-import .md/.txt files picked in a native dialog. */
    importFiles(
      categoryId: string | null
    ): Promise<{ ok: boolean; count: number; failed: string[] }>
  }
  categories: {
    list(): Promise<Category[]>
    create(input: CategoryPatch): Promise<Category>
    update(id: string, patch: CategoryPatch): Promise<Category | undefined>
    delete(id: string): Promise<boolean>
    reorder(ids: string[]): Promise<Category[]>
  }
  settings: {
    get(): Promise<AppSettings>
    setTheme(theme: ThemeMode): Promise<AppSettings>
    setLanguage(language: Language): Promise<AppSettings>
    setProxy(proxy: string): Promise<AppSettings>
    setCloseAction(action: CloseAction): Promise<AppSettings>
    setHotkey(accelerator: string): Promise<{ ok: boolean; settings: AppSettings }>
    chooseDataDir(): Promise<AppSettings | null>
    openDataDir(): Promise<void>
  }
  data: {
    export(): Promise<{ ok: boolean; path?: string }>
    /** `backedUp` is true when a replace import auto-snapshotted the old data first. */
    import(mode: ImportMode): Promise<{
      ok: boolean
      result?: ImportResult
      backedUp?: boolean
      /** Why the import was rejected — shown verbatim to the user. */
      error?: string
    }>
  }
  backup: {
    list(): Promise<BackupInfo[]>
    create(): Promise<BackupInfo | null>
    restore(file: string): Promise<boolean>
    openDir(): Promise<void>
  }
  sync: {
    getState(): Promise<SyncState>
    connectGist(token: string): Promise<SyncState>
    connectWebdav(cfg: WebDavConfigInput): Promise<SyncState>
    connectS3(cfg: S3ConfigInput): Promise<SyncState>
    disconnect(): Promise<SyncState>
    setAuto(enabled: boolean): Promise<SyncState>
    setEncryption(enabled: boolean, passphrase: string): Promise<SyncState>
    run(): Promise<SyncResult>
    resolveConflict(choice: 'local' | 'remote'): Promise<SyncResult>
    listVersions(): Promise<SyncVersion[]>
    restoreVersion(id: string): Promise<SyncResult>
  }
  /** Quit the app entirely (the window close button only hides to tray). */
  quit(): Promise<void>
  update: {
    check(): Promise<UpdateStatus>
    install(): Promise<void>
    getVersion(): Promise<string>
    /** Subscribe to update lifecycle events. Returns an unsubscribe fn. */
    onStatus(cb: (status: UpdateStatus) => void): () => void
  }
  /** Subscribe to main-process requests to open the palette. Returns an unsubscribe fn. */
  onOpenPalette(cb: () => void): () => void
  /** Subscribe to auto-sync completion events. Returns an unsubscribe fn. */
  onSyncChanged(cb: (result: SyncResult) => void): () => void
  /** The Node.js process.platform value ('darwin' | 'win32' | 'linux'). */
  platform: string
}

declare global {
  interface Window {
    api: PromptBoxApi
  }
}
