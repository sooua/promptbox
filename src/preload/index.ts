import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { PromptBoxApi } from './index.d'

const api: PromptBoxApi = {
  prompts: {
    list: () => ipcRenderer.invoke(IPC.promptsList),
    get: (id) => ipcRenderer.invoke(IPC.promptsGet, id),
    create: (input) => ipcRenderer.invoke(IPC.promptsCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.promptsUpdate, id, patch),
    addTag: (id, tag) => ipcRenderer.invoke(IPC.promptsAddTag, id, tag),
    delete: (id) => ipcRenderer.invoke(IPC.promptsDelete, id),
    listDeleted: () => ipcRenderer.invoke(IPC.promptsListDeleted),
    restoreDeleted: (id) => ipcRenderer.invoke(IPC.promptsRestoreDeleted, id),
    purge: (id) => ipcRenderer.invoke(IPC.promptsPurge, id),
    purgeAll: () => ipcRenderer.invoke(IPC.promptsPurgeAll),
    duplicate: (id) => ipcRenderer.invoke(IPC.promptsDuplicate, id),
    toggleFavorite: (id) => ipcRenderer.invoke(IPC.promptsToggleFavorite, id),
    togglePin: (id) => ipcRenderer.invoke(IPC.promptsTogglePin, id),
    restoreVersion: (promptId, versionId) =>
      ipcRenderer.invoke(IPC.promptsRestoreVersion, promptId, versionId),
    deleteVersion: (promptId, versionId) =>
      ipcRenderer.invoke(IPC.promptsDeleteVersion, promptId, versionId),
    recordUse: (id) => ipcRenderer.invoke(IPC.promptsRecordUse, id),
    rememberVars: (id, values) => ipcRenderer.invoke(IPC.promptsRememberVars, id, values),
    importFiles: (categoryId) => ipcRenderer.invoke(IPC.promptsImportFiles, categoryId)
  },
  categories: {
    list: () => ipcRenderer.invoke(IPC.categoriesList),
    create: (name, color) => ipcRenderer.invoke(IPC.categoriesCreate, name, color),
    update: (id, patch) => ipcRenderer.invoke(IPC.categoriesUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(IPC.categoriesDelete, id),
    reorder: (ids) => ipcRenderer.invoke(IPC.categoriesReorder, ids)
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC.settingsGet),
    setTheme: (theme) => ipcRenderer.invoke(IPC.settingsSetTheme, theme),
    setLanguage: (language) => ipcRenderer.invoke(IPC.settingsSetLanguage, language),
    setMarket: (enabled) => ipcRenderer.invoke(IPC.settingsSetMarket, enabled),
    setProxy: (proxy) => ipcRenderer.invoke(IPC.settingsSetProxy, proxy),
    setCloseAction: (action) => ipcRenderer.invoke(IPC.settingsSetCloseAction, action),
    setPromptSources: (sources) => ipcRenderer.invoke(IPC.settingsSetPromptSources, sources),
    setHotkey: (accelerator) => ipcRenderer.invoke(IPC.settingsSetHotkey, accelerator),
    chooseDataDir: () => ipcRenderer.invoke(IPC.settingsChooseDataDir),
    openDataDir: () => ipcRenderer.invoke(IPC.settingsOpenDataDir)
  },
  data: {
    export: () => ipcRenderer.invoke(IPC.dataExport),
    import: (mode) => ipcRenderer.invoke(IPC.dataImport, mode)
  },
  backup: {
    list: () => ipcRenderer.invoke(IPC.backupList),
    create: () => ipcRenderer.invoke(IPC.backupCreate),
    restore: (file) => ipcRenderer.invoke(IPC.backupRestore, file),
    openDir: () => ipcRenderer.invoke(IPC.backupOpenDir)
  },
  sync: {
    getState: () => ipcRenderer.invoke(IPC.syncGetState),
    connectGist: (token) => ipcRenderer.invoke(IPC.syncConnectGist, token),
    connectWebdav: (cfg) => ipcRenderer.invoke(IPC.syncConnectWebdav, cfg),
    connectS3: (cfg) => ipcRenderer.invoke(IPC.syncConnectS3, cfg),
    disconnect: () => ipcRenderer.invoke(IPC.syncDisconnect),
    setAuto: (enabled) => ipcRenderer.invoke(IPC.syncSetAuto, enabled),
    setEncryption: (enabled, passphrase) =>
      ipcRenderer.invoke(IPC.syncSetEncryption, enabled, passphrase),
    run: () => ipcRenderer.invoke(IPC.syncRun),
    resolveConflict: (choice) => ipcRenderer.invoke(IPC.syncResolveConflict, choice),
    listVersions: () => ipcRenderer.invoke(IPC.syncListVersions),
    restoreVersion: (id) => ipcRenderer.invoke(IPC.syncRestoreVersion, id)
  },
  quit: () => ipcRenderer.invoke(IPC.appQuit),
  market: {
    promptSources: () => ipcRenderer.invoke(IPC.registryPromptSources),
    promptList: (sourceId) => ipcRenderer.invoke(IPC.registryPromptList, sourceId),
    promptImport: (item) => ipcRenderer.invoke(IPC.registryPromptImport, item)
  },
  update: {
    check: () => ipcRenderer.invoke(IPC.updateCheck),
    install: () => ipcRenderer.invoke(IPC.updateInstall),
    getVersion: () => ipcRenderer.invoke(IPC.updateGetVersion),
    onStatus: (cb) => {
      const listener = (_e: unknown, status: Parameters<typeof cb>[0]): void => cb(status)
      ipcRenderer.on(IPC.updateStatus, listener)
      return () => ipcRenderer.removeListener(IPC.updateStatus, listener)
    }
  },
  onOpenPalette: (cb) => {
    const listener = (): void => cb()
    ipcRenderer.on(IPC.paletteOpen, listener)
    return () => ipcRenderer.removeListener(IPC.paletteOpen, listener)
  },
  onSyncChanged: (cb) => {
    const listener = (_e: unknown, result: Parameters<typeof cb>[0]): void => cb(result)
    ipcRenderer.on(IPC.syncChanged, listener)
    return () => ipcRenderer.removeListener(IPC.syncChanged, listener)
  },
  platform: process.platform
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore fallback when context isolation is disabled
  window.api = api
}
