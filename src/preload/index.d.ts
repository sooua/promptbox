import type {
  AppSettings,
  Asset,
  AssetInput,
  AssetKind,
  BackupInfo,
  Category,
  ExportBundle,
  ImportMode,
  ImportResult,
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
    delete(id: string): Promise<boolean>
    add(prompt: Prompt): Promise<Prompt>
    duplicate(id: string): Promise<Prompt | undefined>
    toggleFavorite(id: string): Promise<Prompt | undefined>
    togglePin(id: string): Promise<Prompt | undefined>
    restoreVersion(promptId: string, versionId: string): Promise<Prompt | undefined>
    deleteVersion(promptId: string, versionId: string): Promise<Prompt | undefined>
    recordUse(id: string): Promise<Prompt | undefined>
    rememberVars(id: string, values: Record<string, string>): Promise<Prompt | undefined>
  }
  assets: {
    list(kind?: AssetKind): Promise<Asset[]>
    get(id: string): Promise<Asset | undefined>
    create(input: AssetInput): Promise<Asset>
    update(id: string, patch: Partial<AssetInput>): Promise<Asset | undefined>
    delete(id: string): Promise<boolean>
    add(asset: Asset): Promise<Asset>
    duplicate(id: string): Promise<Asset | undefined>
    toggleFavorite(id: string): Promise<Asset | undefined>
    restoreVersion(assetId: string, versionId: string): Promise<Asset | undefined>
    exportFile(id: string): Promise<{ ok: boolean; path?: string }>
    importFile(kind: AssetKind): Promise<{ ok: boolean; count: number; failed: string[] }>
    install(id: string, preset?: string): Promise<{ ok: boolean; path?: string }>
    mergeMcp(id: string, preset?: string): Promise<{ ok: boolean; path?: string; server?: string }>
  }
  categories: {
    list(): Promise<Category[]>
    create(name: string, color?: string): Promise<Category>
    update(id: string, patch: { name?: string; color?: string }): Promise<Category | undefined>
    delete(id: string): Promise<boolean>
    reorder(ids: string[]): Promise<Category[]>
  }
  settings: {
    get(): Promise<AppSettings>
    setTheme(theme: ThemeMode): Promise<AppSettings>
    setLanguage(language: Language): Promise<AppSettings>
    setMarket(enabled: boolean): Promise<AppSettings>
    setProxy(proxy: string): Promise<AppSettings>
    setGithubSources(sources: GithubSourceConfig[]): Promise<AppSettings>
    setMcpRegistries(regs: McpRegistryConfig[]): Promise<AppSettings>
    setPromptSources(sources: PromptSourceConfig[]): Promise<AppSettings>
    setHotkey(accelerator: string): Promise<{ ok: boolean; settings: AppSettings }>
    chooseDataDir(): Promise<AppSettings | null>
    openDataDir(): Promise<void>
  }
  data: {
    export(): Promise<{ ok: boolean; path?: string }>
    import(mode: ImportMode): Promise<{ ok: boolean; result?: ImportResult }>
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
  market: {
    mcpSearch(query: string, cursor?: string, registry?: string): Promise<McpDiscoverResult>
    mcpImport(item: McpDiscoverItem): Promise<{ id: string; duplicate: boolean }>
    githubList(kind: 'skill' | 'agent'): Promise<GithubDiscoverResult>
    githubImport(item: GithubDiscoverItem): Promise<{ id: string; duplicate: boolean }>
    promptSources(): Promise<PromptSource[]>
    promptList(sourceId: string): Promise<PromptDiscoverResult>
    promptImport(item: PromptDiscoverItem): Promise<{ id: string; duplicate: boolean }>
  }
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
}

declare global {
  interface Window {
    api: PromptBoxApi
  }
}
