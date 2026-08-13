import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFileSync, readFileSync } from 'fs'
import { basename } from 'path'
import { IPC } from '@shared/ipc'
import { parseMarkdownPrompt } from '@shared/markdown'
import type {
  CloseAction,
  ExportBundle,
  PromptSourceConfig,
  ImportMode,
  Language,
  PromptInput,
  ThemeMode
} from '@shared/types'
import type { Repository } from './store/repository'
import { loadSettings, saveSettings } from './store/config'
import { updateHotkey } from './system'
import { mt, setMainLanguage } from './i18n'
import { applyProxy } from './net'
import { listPrompts, importPrompt, promptSources } from './registry/prompts'
import type { BackupManager } from './backup'

export function registerIpc(repo: Repository, backup: BackupManager): void {
  // ---- Prompts ----
  ipcMain.handle(IPC.promptsList, () => repo.listPrompts())
  ipcMain.handle(IPC.promptsGet, (_e, id: string) => repo.getPrompt(id))
  ipcMain.handle(IPC.promptsCreate, (_e, input: PromptInput) => repo.createPrompt(input))
  ipcMain.handle(IPC.promptsUpdate, (_e, id: string, patch: Partial<PromptInput>) =>
    repo.updatePrompt(id, patch)
  )
  ipcMain.handle(IPC.promptsAddTag, (_e, id: string, tag: string) => repo.addTag(id, tag))
  ipcMain.handle(IPC.promptsDelete, (_e, id: string) => repo.deletePrompt(id))
  ipcMain.handle(IPC.promptsListDeleted, () => repo.listDeletedPrompts())
  ipcMain.handle(IPC.promptsRestoreDeleted, (_e, id: string) => repo.restoreDeletedPrompt(id))
  ipcMain.handle(IPC.promptsPurge, (_e, id: string) => repo.purgePrompt(id))
  ipcMain.handle(IPC.promptsPurgeAll, () => repo.purgeAllDeleted())
  ipcMain.handle(IPC.promptsDuplicate, (_e, id: string) => repo.duplicatePrompt(id))
  ipcMain.handle(IPC.promptsToggleFavorite, (_e, id: string) => repo.toggleFavorite(id))
  ipcMain.handle(IPC.promptsTogglePin, (_e, id: string) => repo.togglePin(id))
  ipcMain.handle(IPC.promptsRestoreVersion, (_e, promptId: string, versionId: string) =>
    repo.restoreVersion(promptId, versionId)
  )
  ipcMain.handle(IPC.promptsDeleteVersion, (_e, promptId: string, versionId: string) =>
    repo.deleteVersion(promptId, versionId)
  )
  ipcMain.handle(IPC.promptsRecordUse, (_e, id: string) => repo.recordUse(id))
  ipcMain.handle(IPC.promptsRememberVars, (_e, id: string, values: Record<string, string>) =>
    repo.rememberVariableValues(id, values)
  )

  // Bulk-import existing .md/.txt prompts. Unreadable or empty files are
  // reported back by name rather than silently dropped.
  ipcMain.handle(IPC.promptsImportFiles, async (e, categoryId: string | null) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '导入 Markdown 提示词',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Markdown / 文本', extensions: ['md', 'markdown', 'txt'] },
        { name: 'All', extensions: ['*'] }
      ]
    })
    if (result.canceled || result.filePaths.length === 0)
      return { ok: false, count: 0, failed: [] as string[] }

    let count = 0
    const failed: string[] = []
    for (const file of result.filePaths) {
      const name = basename(file)
      try {
        const text = readFileSync(file, 'utf-8')
        if (!text.trim()) {
          failed.push(name)
          continue
        }
        const parsed = parseMarkdownPrompt(text, name.replace(/\.[^.]+$/, ''))
        // createPrompt runs syncVariables(), so {{vars}} are picked up for free.
        repo.createPrompt({ ...parsed, categoryId })
        count++
      } catch {
        failed.push(name)
      }
    }
    return { ok: count > 0, count, failed }
  })

  // ---- Categories ----
  ipcMain.handle(IPC.categoriesList, () => repo.listCategories())
  ipcMain.handle(IPC.categoriesCreate, (_e, name: string, color?: string) =>
    repo.createCategory(name, color)
  )
  ipcMain.handle(IPC.categoriesUpdate, (_e, id: string, patch: { name?: string; color?: string }) =>
    repo.updateCategory(id, patch)
  )
  ipcMain.handle(IPC.categoriesDelete, (_e, id: string) => repo.deleteCategory(id))
  ipcMain.handle(IPC.categoriesReorder, (_e, ids: string[]) => repo.reorderCategories(ids))

  // ---- Settings ----
  ipcMain.handle(IPC.settingsGet, () => ({
    ...loadSettings(),
    dataDir: repo.getDataDir()
  }))

  ipcMain.handle(IPC.settingsSetTheme, (_e, theme: ThemeMode) => {
    const current = loadSettings()
    return saveSettings({ ...current, theme, dataDir: repo.getDataDir() })
  })

  ipcMain.handle(IPC.settingsSetLanguage, (_e, language: Language) => {
    const current = loadSettings()
    const settings = saveSettings({ ...current, language, dataDir: repo.getDataDir() })
    setMainLanguage(language)
    return settings
  })

  ipcMain.handle(IPC.settingsSetMarket, (_e, marketEnabled: boolean) => {
    const current = loadSettings()
    return saveSettings({ ...current, marketEnabled, dataDir: repo.getDataDir() })
  })

  ipcMain.handle(IPC.settingsSetProxy, (_e, proxy: string) => {
    const current = loadSettings()
    const settings = saveSettings({ ...current, proxy, dataDir: repo.getDataDir() })
    applyProxy(proxy)
    return settings
  })

  ipcMain.handle(IPC.settingsSetCloseAction, (_e, closeAction: CloseAction) => {
    const current = loadSettings()
    return saveSettings({ ...current, closeAction, dataDir: repo.getDataDir() })
  })

  ipcMain.handle(IPC.settingsSetPromptSources, (_e, promptSrcs: PromptSourceConfig[]) => {
    const current = loadSettings()
    return saveSettings({ ...current, promptSources: promptSrcs, dataDir: repo.getDataDir() })
  })

  // ---- Discover / marketplace ----
  ipcMain.handle(IPC.registryPromptSources, () => promptSources())
  ipcMain.handle(IPC.registryPromptList, (_e, sourceId: string) => listPrompts(repo, sourceId))
  ipcMain.handle(IPC.registryPromptImport, (_e, item: Parameters<typeof importPrompt>[1]) =>
    importPrompt(repo, item)
  )

  ipcMain.handle(IPC.settingsSetHotkey, (_e, accelerator: string) => {
    const ok = updateHotkey(accelerator)
    const current = loadSettings()
    // Only persist a hotkey that actually registered. Storing a rejected one
    // meant every later launch silently came up with no hotkey while settings
    // displayed the broken combination as if it were active.
    const settings = ok
      ? saveSettings({ ...current, globalHotkey: accelerator, dataDir: repo.getDataDir() })
      : current
    return { ok, settings }
  })

  ipcMain.handle(IPC.settingsChooseDataDir, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '选择数据目录',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const dataDir = result.filePaths[0]
    repo.setDataDir(dataDir)
    return saveSettings({ ...loadSettings(), dataDir })
  })

  ipcMain.handle(IPC.settingsOpenDataDir, async () => {
    await shell.openPath(repo.getDataDir())
  })

  // ---- Import / Export ----
  ipcMain.handle(IPC.dataExport, async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showSaveDialog(win!, {
      title: '导出 PromptBox 数据',
      defaultPath: 'promptbox-export.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    writeFileSync(result.filePath, JSON.stringify(repo.export(), null, 2), 'utf-8')
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle(IPC.dataImport, async (e, mode: ImportMode) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '导入 PromptBox 数据',
      properties: ['openFile'],
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return { ok: false }
    try {
      const bundle = JSON.parse(readFileSync(result.filePaths[0], 'utf-8')) as ExportBundle
      // A replace import destroys everything currently in the library and has no
      // undo. Snapshot first so "设置 → 备份 → 恢复" is always a way back.
      const backedUp = mode === 'replace' ? !!backup.createBackup(true) : false
      const importResult = repo.import(bundle, mode)
      return { ok: true, result: importResult, backedUp }
    } catch (err) {
      // Tell the user *why*. A bare `ok: false` after picking the wrong file
      // reads as "the app is broken" rather than "that file isn't an export".
      // Chinese is the key in the main-process dictionary, so the thrown
      // message translates directly. Without mt() an English user gets Chinese.
      return { ok: false, error: mt(err instanceof Error ? err.message : '导入失败') }
    }
  })
}

export function registerBackupIpc(backup: BackupManager): void {
  ipcMain.handle(IPC.backupList, () => backup.listBackups())
  ipcMain.handle(IPC.backupCreate, () => backup.createBackup(true))
  ipcMain.handle(IPC.backupRestore, (_e, file: string) => backup.restoreBackup(file))
  ipcMain.handle(IPC.backupOpenDir, () => backup.openDir())
}
