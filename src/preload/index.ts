import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '@shared/ipc'
import type { PromptBoxApi } from './index.d'

const api: PromptBoxApi = {
  prompts: {
    list: () => ipcRenderer.invoke(IPC.promptsList),
    get: (id) => ipcRenderer.invoke(IPC.promptsGet, id),
    create: (input) => ipcRenderer.invoke(IPC.promptsCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.promptsUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(IPC.promptsDelete, id),
    add: (prompt) => ipcRenderer.invoke(IPC.promptsAdd, prompt),
    duplicate: (id) => ipcRenderer.invoke(IPC.promptsDuplicate, id),
    toggleFavorite: (id) => ipcRenderer.invoke(IPC.promptsToggleFavorite, id),
    togglePin: (id) => ipcRenderer.invoke(IPC.promptsTogglePin, id),
    restoreVersion: (promptId, versionId) =>
      ipcRenderer.invoke(IPC.promptsRestoreVersion, promptId, versionId),
    recordUse: (id) => ipcRenderer.invoke(IPC.promptsRecordUse, id),
    rememberVars: (id, values) => ipcRenderer.invoke(IPC.promptsRememberVars, id, values)
  },
  assets: {
    list: (kind) => ipcRenderer.invoke(IPC.assetsList, kind),
    get: (id) => ipcRenderer.invoke(IPC.assetsGet, id),
    create: (input) => ipcRenderer.invoke(IPC.assetsCreate, input),
    update: (id, patch) => ipcRenderer.invoke(IPC.assetsUpdate, id, patch),
    delete: (id) => ipcRenderer.invoke(IPC.assetsDelete, id),
    add: (asset) => ipcRenderer.invoke(IPC.assetsAdd, asset),
    duplicate: (id) => ipcRenderer.invoke(IPC.assetsDuplicate, id),
    toggleFavorite: (id) => ipcRenderer.invoke(IPC.assetsToggleFavorite, id),
    restoreVersion: (assetId, versionId) =>
      ipcRenderer.invoke(IPC.assetsRestoreVersion, assetId, versionId),
    exportFile: (id) => ipcRenderer.invoke(IPC.assetsExportFile, id),
    importFile: (kind) => ipcRenderer.invoke(IPC.assetsImportFile, kind),
    install: (id, preset) => ipcRenderer.invoke(IPC.assetsInstall, id, preset),
    mergeMcp: (id, preset) => ipcRenderer.invoke(IPC.assetsMergeMcp, id, preset)
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
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore fallback when context isolation is disabled
  window.api = api
}
