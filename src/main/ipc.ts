import { BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { writeFileSync, readFileSync, mkdirSync, existsSync, renameSync } from 'fs'
import { basename, dirname, isAbsolute, join, relative, resolve } from 'path'
import { homedir } from 'os'
import { IPC } from '@shared/ipc'
import type {
  Asset,
  AssetInput,
  AssetKind,
  ExportBundle,
  GithubSourceConfig,
  McpRegistryConfig,
  PromptSourceConfig,
  ImportMode,
  Language,
  PromptInput,
  ThemeMode
} from '@shared/types'
import {
  assetToText,
  extensionFor,
  fileNameFor,
  mcpServerObject,
  parseAssetFile,
  slugFor
} from '@shared/assetFormat'

/** Cline (VS Code extension) stores MCP servers in its globalStorage settings. */
function clineSettingsPath(): string {
  const rel = ['Code', 'User', 'globalStorage', 'saoudrizwan.claude-dev', 'settings', 'cline_mcp_settings.json']
  if (process.platform === 'win32') return join(homedir(), 'AppData', 'Roaming', ...rel)
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', ...rel)
  return join(homedir(), '.config', ...rel)
}

function atomicWrite(file: string, content: string): void {
  const tmp = `${file}.tmp`
  try {
    writeFileSync(tmp, content, 'utf-8')
    renameSync(tmp, file)
  } catch {
    writeFileSync(file, content, 'utf-8')
  }
}

/** Write a skill as a folder: SKILL.md plus any bundled files. */
function writeSkillFolder(folder: string, asset: Asset): string {
  mkdirSync(folder, { recursive: true })
  const main = join(folder, 'SKILL.md')
  writeFileSync(main, assetToText(asset), 'utf-8')
  for (const f of asset.files ?? []) {
    if (!f.path) continue
    // Resolve the target and verify it stays inside `folder`. String-stripping
    // ".." is bypassable (e.g. "....//" collapses back to "../"), so we compare
    // the resolved paths instead and skip anything that escapes the folder.
    const dest = resolve(folder, f.path)
    const rel = relative(folder, dest)
    if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) continue
    mkdirSync(dirname(dest), { recursive: true })
    writeFileSync(dest, f.content ?? '', 'utf-8')
  }
  return main
}
import type { Repository } from './store/repository'
import { loadSettings, saveSettings } from './store/config'
import { updateHotkey } from './system'
import { setMainLanguage } from './i18n'
import { applyProxy } from './net'
import { searchMcp, importMcp } from './registry/mcp'
import { listGithub, importGithub } from './registry/github'
import { listPrompts, importPrompt, promptSources } from './registry/prompts'
import type { BackupManager } from './backup'

export function registerIpc(repo: Repository): void {
  // ---- Prompts ----
  ipcMain.handle(IPC.promptsList, () => repo.listPrompts())
  ipcMain.handle(IPC.promptsGet, (_e, id: string) => repo.getPrompt(id))
  ipcMain.handle(IPC.promptsCreate, (_e, input: PromptInput) => repo.createPrompt(input))
  ipcMain.handle(IPC.promptsUpdate, (_e, id: string, patch: Partial<PromptInput>) =>
    repo.updatePrompt(id, patch)
  )
  ipcMain.handle(IPC.promptsDelete, (_e, id: string) => repo.deletePrompt(id))
  ipcMain.handle(IPC.promptsAdd, (_e, prompt) => repo.addPrompt(prompt))
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

  // ---- Assets ----
  ipcMain.handle(IPC.assetsList, (_e, kind?: AssetKind) => repo.listAssets(kind))
  ipcMain.handle(IPC.assetsGet, (_e, id: string) => repo.getAsset(id))
  ipcMain.handle(IPC.assetsCreate, (_e, input: AssetInput) => repo.createAsset(input))
  ipcMain.handle(IPC.assetsUpdate, (_e, id: string, patch: Partial<AssetInput>) =>
    repo.updateAsset(id, patch)
  )
  ipcMain.handle(IPC.assetsDelete, (_e, id: string) => repo.deleteAsset(id))
  ipcMain.handle(IPC.assetsAdd, (_e, asset) => repo.addAsset(asset))
  ipcMain.handle(IPC.assetsDuplicate, (_e, id: string) => repo.duplicateAsset(id))
  ipcMain.handle(IPC.assetsToggleFavorite, (_e, id: string) => repo.toggleAssetFavorite(id))
  ipcMain.handle(IPC.assetsRestoreVersion, (_e, assetId: string, versionId: string) =>
    repo.restoreAssetVersion(assetId, versionId)
  )

  ipcMain.handle(IPC.assetsExportFile, async (e, id: string) => {
    const asset = repo.getAsset(id)
    if (!asset) return { ok: false }
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined

    // Skills are a folder: pick a parent dir, then create <slug>/SKILL.md.
    // This is the canonical layout and avoids the "always SKILL.md" collision.
    if (asset.kind === 'skill') {
      const dir = await dialog.showOpenDialog(win!, {
        title: '选择导出位置（将创建 <名称>/SKILL.md）',
        properties: ['openDirectory', 'createDirectory']
      })
      if (dir.canceled || dir.filePaths.length === 0) return { ok: false }
      const folder = join(dir.filePaths[0], slugFor(asset.name))
      const path = writeSkillFolder(folder, asset)
      return { ok: true, path }
    }

    const result = await dialog.showSaveDialog(win!, {
      title: '导出资产',
      defaultPath: fileNameFor(asset),
      filters: [extensionFor(asset.kind)]
    })
    if (result.canceled || !result.filePath) return { ok: false }
    writeFileSync(result.filePath, assetToText(asset), 'utf-8')
    return { ok: true, path: result.filePath }
  })

  ipcMain.handle(IPC.assetsImportFile, async (e, kind: AssetKind) => {
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined
    const result = await dialog.showOpenDialog(win!, {
      title: '导入资产',
      properties: ['openFile', 'multiSelections'],
      filters: [extensionFor(kind), { name: 'All', extensions: ['*'] }]
    })
    if (result.canceled || result.filePaths.length === 0)
      return { ok: false, count: 0, failed: [] }
    let count = 0
    const failed: string[] = []
    for (const file of result.filePaths) {
      try {
        const text = readFileSync(file, 'utf-8')
        const fallback = basename(file).replace(/\.[^.]+$/, '')
        const inputs = parseAssetFile(kind, text, fallback)
        if (inputs.length === 0) {
          failed.push(basename(file))
          continue
        }
        for (const input of inputs) {
          repo.createAsset(input)
          count++
        }
      } catch {
        // Unreadable or unparseable — record the name so the UI can report it
        // instead of silently dropping the file.
        failed.push(basename(file))
      }
    }
    return { ok: count > 0, count, failed }
  })

  // Install a skill (folder) / agent (file) into a target directory.
  ipcMain.handle(IPC.assetsInstall, async (e, id: string, preset?: string) => {
    const asset = repo.getAsset(id)
    if (!asset || asset.kind === 'mcp') return { ok: false }
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined

    const sub = asset.kind === 'skill' ? 'skills' : 'agents'
    let dir: string
    if (preset === 'claude') {
      dir = join(homedir(), '.claude', sub)
    } else if (preset === 'claude-project') {
      const r = await dialog.showOpenDialog(win!, {
        title: '选择项目目录（将写入 .claude/' + sub + '）',
        properties: ['openDirectory', 'createDirectory']
      })
      if (r.canceled || r.filePaths.length === 0) return { ok: false }
      dir = join(r.filePaths[0], '.claude', sub)
    } else {
      const r = await dialog.showOpenDialog(win!, {
        title: '选择安装目录',
        properties: ['openDirectory', 'createDirectory']
      })
      if (r.canceled || r.filePaths.length === 0) return { ok: false }
      dir = r.filePaths[0]
    }
    try {
      if (asset.kind === 'skill') {
        const folder = join(dir, slugFor(asset.name))
        const path = writeSkillFolder(folder, asset)
        return { ok: true, path }
      }
      mkdirSync(dir, { recursive: true })
      const path = join(dir, `${slugFor(asset.name)}.md`)
      writeFileSync(path, assetToText(asset), 'utf-8')
      return { ok: true, path }
    } catch {
      return { ok: false }
    }
  })

  // Non-destructively merge an MCP server into a target mcp.json.
  ipcMain.handle(IPC.assetsMergeMcp, async (e, id: string, preset?: string) => {
    const asset = repo.getAsset(id)
    if (!asset || asset.kind !== 'mcp') return { ok: false }
    const win = BrowserWindow.fromWebContents(e.sender) ?? undefined

    let file: string
    if (preset === 'cursor') {
      file = join(homedir(), '.cursor', 'mcp.json')
    } else if (preset === 'windsurf') {
      file = join(homedir(), '.codeium', 'windsurf', 'mcp_config.json')
    } else if (preset === 'cline') {
      file = clineSettingsPath()
    } else if (preset === 'vscode-project' || preset === 'claude-project') {
      const r = await dialog.showOpenDialog(win!, {
        title: '选择项目目录',
        properties: ['openDirectory', 'createDirectory']
      })
      if (r.canceled || r.filePaths.length === 0) return { ok: false }
      file =
        preset === 'vscode-project'
          ? join(r.filePaths[0], '.vscode', 'mcp.json')
          : join(r.filePaths[0], '.mcp.json')
    } else {
      const r = await dialog.showSaveDialog(win!, {
        title: '选择或新建 mcp.json',
        defaultPath: 'mcp.json',
        filters: [{ name: 'JSON', extensions: ['json'] }]
      })
      if (r.canceled || !r.filePath) return { ok: false }
      file = r.filePath
    }
    try {
      mkdirSync(dirname(file), { recursive: true })
      let json: Record<string, unknown> = {}
      if (existsSync(file)) {
        try {
          json = JSON.parse(readFileSync(file, 'utf-8'))
        } catch {
          json = {}
        }
      }
      const key = asset.meta.schemaKey === 'servers' ? 'servers' : 'mcpServers'
      const servers = (json[key] && typeof json[key] === 'object' ? json[key] : {}) as Record<
        string,
        unknown
      >
      servers[asset.name] = mcpServerObject(asset)
      json[key] = servers
      atomicWrite(file, JSON.stringify(json, null, 2))
      return { ok: true, path: file, server: asset.name }
    } catch {
      return { ok: false }
    }
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

  ipcMain.handle(IPC.settingsSetGithubSources, (_e, githubSources: GithubSourceConfig[]) => {
    const current = loadSettings()
    return saveSettings({ ...current, githubSources, dataDir: repo.getDataDir() })
  })

  ipcMain.handle(IPC.settingsSetMcpRegistries, (_e, mcpRegistries: McpRegistryConfig[]) => {
    const current = loadSettings()
    return saveSettings({ ...current, mcpRegistries, dataDir: repo.getDataDir() })
  })

  ipcMain.handle(IPC.settingsSetPromptSources, (_e, promptSrcs: PromptSourceConfig[]) => {
    const current = loadSettings()
    return saveSettings({ ...current, promptSources: promptSrcs, dataDir: repo.getDataDir() })
  })

  // ---- Discover / marketplace ----
  ipcMain.handle(IPC.registryMcpSearch, (_e, query: string, cursor?: string, registry?: string) =>
    searchMcp(repo, query ?? '', cursor, registry)
  )
  ipcMain.handle(IPC.registryMcpImport, (_e, item: Parameters<typeof importMcp>[1]) =>
    importMcp(repo, item)
  )
  ipcMain.handle(IPC.registryGithubList, (_e, kind: 'skill' | 'agent') => listGithub(repo, kind))
  ipcMain.handle(IPC.registryGithubImport, (_e, item: Parameters<typeof importGithub>[1]) =>
    importGithub(repo, item)
  )
  ipcMain.handle(IPC.registryPromptSources, () => promptSources())
  ipcMain.handle(IPC.registryPromptList, (_e, sourceId: string) => listPrompts(repo, sourceId))
  ipcMain.handle(IPC.registryPromptImport, (_e, item: Parameters<typeof importPrompt>[1]) =>
    importPrompt(repo, item)
  )

  ipcMain.handle(IPC.settingsSetHotkey, (_e, accelerator: string) => {
    const ok = updateHotkey(accelerator)
    const current = loadSettings()
    // Persist even if registration failed so the choice survives; the renderer
    // surfaces the failure via `ok` (likely an OS-level conflict).
    const settings = saveSettings({
      ...current,
      globalHotkey: accelerator,
      dataDir: repo.getDataDir()
    })
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
      const importResult = repo.import(bundle, mode)
      return { ok: true, result: importResult }
    } catch {
      return { ok: false }
    }
  })
}

export function registerBackupIpc(backup: BackupManager): void {
  ipcMain.handle(IPC.backupList, () => backup.listBackups())
  ipcMain.handle(IPC.backupCreate, () => backup.createBackup(true))
  ipcMain.handle(IPC.backupRestore, (_e, file: string) => backup.restoreBackup(file))
  ipcMain.handle(IPC.backupOpenDir, () => backup.openDir())
}
