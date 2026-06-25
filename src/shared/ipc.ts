/** Centralized IPC channel names shared by main and preload. */
export const IPC = {
  promptsList: 'prompts:list',
  promptsGet: 'prompts:get',
  promptsCreate: 'prompts:create',
  promptsUpdate: 'prompts:update',
  promptsDelete: 'prompts:delete',
  promptsAdd: 'prompts:add',
  promptsDuplicate: 'prompts:duplicate',
  promptsToggleFavorite: 'prompts:toggleFavorite',
  promptsTogglePin: 'prompts:togglePin',
  promptsRestoreVersion: 'prompts:restoreVersion',
  promptsDeleteVersion: 'prompts:deleteVersion',
  promptsRecordUse: 'prompts:recordUse',
  promptsRememberVars: 'prompts:rememberVars',

  assetsList: 'assets:list',
  assetsGet: 'assets:get',
  assetsCreate: 'assets:create',
  assetsUpdate: 'assets:update',
  assetsDelete: 'assets:delete',
  assetsAdd: 'assets:add',
  assetsDuplicate: 'assets:duplicate',
  assetsToggleFavorite: 'assets:toggleFavorite',
  assetsRestoreVersion: 'assets:restoreVersion',
  assetsExportFile: 'assets:exportFile',
  assetsImportFile: 'assets:importFile',
  assetsInstall: 'assets:install',
  assetsMergeMcp: 'assets:mergeMcp',

  categoriesList: 'categories:list',
  categoriesCreate: 'categories:create',
  categoriesUpdate: 'categories:update',
  categoriesDelete: 'categories:delete',
  categoriesReorder: 'categories:reorder',

  settingsGet: 'settings:get',
  settingsSetTheme: 'settings:setTheme',
  settingsSetLanguage: 'settings:setLanguage',
  settingsSetMarket: 'settings:setMarket',
  settingsSetProxy: 'settings:setProxy',
  settingsSetGithubSources: 'settings:setGithubSources',
  settingsSetMcpRegistries: 'settings:setMcpRegistries',
  settingsSetPromptSources: 'settings:setPromptSources',
  settingsSetHotkey: 'settings:setHotkey',

  registryMcpSearch: 'registry:mcpSearch',
  registryMcpImport: 'registry:mcpImport',
  registryGithubList: 'registry:githubList',
  registryGithubImport: 'registry:githubImport',
  registryPromptSources: 'registry:promptSources',
  registryPromptList: 'registry:promptList',
  registryPromptImport: 'registry:promptImport',
  settingsChooseDataDir: 'settings:chooseDataDir',
  settingsOpenDataDir: 'settings:openDataDir',

  dataExport: 'data:export',
  dataImport: 'data:import',

  backupList: 'backup:list',
  backupCreate: 'backup:create',
  backupRestore: 'backup:restore',
  backupOpenDir: 'backup:openDir',

  syncGetState: 'sync:getState',
  syncConnectGist: 'sync:connectGist',
  syncConnectWebdav: 'sync:connectWebdav',
  syncConnectS3: 'sync:connectS3',
  syncDisconnect: 'sync:disconnect',
  syncSetAuto: 'sync:setAuto',
  syncSetEncryption: 'sync:setEncryption',
  syncRun: 'sync:run',
  syncResolveConflict: 'sync:resolveConflict',
  syncListVersions: 'sync:listVersions',
  syncRestoreVersion: 'sync:restoreVersion',

  updateCheck: 'update:check',
  updateInstall: 'update:install',
  updateGetVersion: 'update:getVersion',

  appQuit: 'app:quit',

  /** main -> renderer: request the command palette to open */
  paletteOpen: 'palette:open',
  /** main -> renderer: an auto-sync run finished (carries SyncResult) */
  syncChanged: 'sync:changed',
  /** main -> renderer: auto-update lifecycle changed (carries UpdateStatus) */
  updateStatus: 'update:status'
} as const
