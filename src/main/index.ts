import { app, shell, dialog, ipcMain, BrowserWindow, nativeTheme } from 'electron'
import { join } from 'path'
import { IPC } from '@shared/ipc'
import appIconPath from '../../resources/icon.png?asset'
import { PromptRepository } from './store/repository'
import { loadSettings, saveSettings } from './store/config'
import type { CloseAction } from '@shared/types'
import { registerIpc, registerBackupIpc } from './ipc'
import { BackupManager } from './backup'
import { seedIfEmpty } from './seed'
import { setupSystem, destroySystem } from './system'
import { setMainLanguage, mt } from './i18n'
import { SyncEngine } from './sync/engine'
import { registerSyncIpc } from './sync/ipc'
import { setupAutoUpdate } from './update'

let mainWindow: BrowserWindow | null = null
let isQuitting = false
let autoBackupTimer: ReturnType<typeof setInterval> | null = null
let backupManager: BackupManager | null = null

/** Periodic snapshot so an unexpected crash loses at most this interval of work. */
const AUTO_BACKUP_INTERVAL_MS = 5 * 60 * 1000

/** Window-control overlay colors, matched to the warm light/dark canvas. */
function overlayColors(): { color: string; symbolColor: string } {
  return nativeTheme.shouldUseDarkColors
    ? { color: '#0a0a0a', symbolColor: '#a3a3a3' }
    : { color: '#ffffff', symbolColor: '#525252' }
}

const TITLEBAR_HEIGHT = 36

/**
 * First close: explain that the window hides to the tray and let the user pick
 * the other behaviour instead. The answer is persisted when "记住我的选择" is
 * ticked, so this dialog is a one-time cost.
 */
async function askCloseAction(win: BrowserWindow): Promise<void> {
  const { response, checkboxChecked } = await dialog.showMessageBox(win, {
    type: 'question',
    title: mt('关闭 PromptBox'),
    message: mt('关闭窗口后要怎么做？'),
    detail: mt(
      '最小化到托盘：应用继续在后台运行，全局热键仍可随时唤起。\n直接退出：完全关闭，全局热键失效。'
    ),
    buttons: [mt('最小化到托盘'), mt('直接退出'), mt('取消')],
    defaultId: 0,
    cancelId: 2,
    checkboxLabel: mt('记住我的选择'),
    checkboxChecked: true
  })
  if (response === 2) return // cancel — keep the window open
  const choice: CloseAction = response === 1 ? 'quit' : 'tray'
  if (checkboxChecked) saveSettings({ ...loadSettings(), closeAction: choice })
  if (choice === 'quit') {
    isQuitting = true
    app.quit()
  } else {
    win.hide()
  }
}

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 940,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'PromptBox',
    icon: appIconPath,
    backgroundColor: '#f5f4ed',
    // Drop the OS title bar; keep the min/max/close controls as a themed overlay
    // (the app provides its own draggable top bars).
    titleBarStyle: 'hidden',
    titleBarOverlay: { ...overlayColors(), height: TITLEBAR_HEIGHT },
    // macOS keeps its traffic lights even with a hidden title bar. Pin them so
    // they sit centered in the 40px sidebar brand row instead of drifting into
    // the logo/wordmark (the sidebar reserves the matching left inset).
    trafficLightPosition: { x: 16, y: 12 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true
    }
  })

  win.on('ready-to-show', () => win.show())

  // Closing the window hides it to the tray by default so the global hotkey
  // stays live — but that reads as "quit" to most users, so the first close
  // asks and remembers. See AppSettings.closeAction.
  win.on('close', (e) => {
    if (isQuitting) return
    e.preventDefault()
    const action = loadSettings().closeAction
    if (action === 'quit') {
      isQuitting = true
      app.quit()
    } else if (action === 'tray') {
      win.hide()
    } else {
      void askCloseAction(win)
    }
  })

  win.on('closed', () => {
    mainWindow = null
  })

  win.webContents.setWindowOpenHandler((details) => {
    // Only hand http(s)/mailto links to the OS. Markdown from prompts and the
    // imported files are untrusted, so we never let it open file:// or custom
    // protocol handlers (which could launch local apps).
    try {
      const { protocol } = new URL(details.url)
      if (protocol === 'https:' || protocol === 'http:' || protocol === 'mailto:') {
        void shell.openExternal(details.url)
      }
    } catch {
      /* malformed URL — ignore */
    }
    return { action: 'deny' }
  })

  const loadRenderer = (): void => {
    if (process.env['ELECTRON_RENDERER_URL']) {
      void win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    } else {
      void win.loadFile(join(__dirname, '../renderer/index.html'))
    }
  }

  // In dev the Vite server may not be accepting connections on the first paint,
  // which leaves the window blank (ERR_CONNECTION_REFUSED). Retry the load a few
  // times so `npm run dev` comes up reliably regardless of the startup race.
  let loadRetries = 0
  win.webContents.on('did-fail-load', () => {
    if (process.env['ELECTRON_RENDERER_URL'] && loadRetries < 20) {
      loadRetries++
      setTimeout(loadRenderer, 250)
    }
  })

  loadRenderer()

  mainWindow = win
  return win
}

function ensureWindow(): BrowserWindow {
  return mainWindow ?? createWindow()
}

// Single-instance lock: a second launch should focus the running window rather
// than start another process (which stacks duplicate taskbar/tray entries).
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

// Fired in the PRIMARY instance when the user launches the app again.
app.on('second-instance', () => {
  const win = ensureWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
})

app.whenReady().then(() => {
  // Lost the single-instance race — the primary instance owns everything.
  if (!gotSingleInstanceLock) return

  const settings = loadSettings()
  if (settings.theme !== 'system') {
    nativeTheme.themeSource = settings.theme
  }
  setMainLanguage(settings.language)

  const repo = new PromptRepository(settings.dataDir)
  seedIfEmpty(repo)

  const backup = new BackupManager(repo)
  backupManager = backup
  backup.createBackup() // snapshot on launch (deduped against the latest)

  // Periodic backup — createBackup() dedupes against the latest, so idle
  // intervals are cheap no-ops; only real changes produce a new snapshot.
  autoBackupTimer = setInterval(() => backup.createBackup(), AUTO_BACKUP_INTERVAL_MS)

  // Surface unrecoverable write failures instead of silently losing edits.
  repo.onError((err) => {
    dialog.showErrorBox(
      mt('PromptBox 无法保存数据'),
      mt(
        '写入数据文件失败，最近的修改可能仅保存在内存中。\n请检查磁盘空间或文件权限。\n\n{msg}',
        { msg: err.message }
      )
    )
  })

  createWindow()

  // If the data file was corrupt on launch, tell the user what we did.
  const recovery = repo.takeLoadRecovery()
  if (recovery) {
    const detail = recovery.restoredFrom
      ? mt('已从备份「{file}」恢复数据。', { file: recovery.restoredFrom })
      : mt('未找到可用备份，已以空数据启动。')
    dialog.showErrorBox(
      mt('PromptBox 数据文件已损坏'),
      mt('原文件已保留为「{file}」。\n{detail}', { file: recovery.quarantined, detail })
    )
  }

  setupSystem({
    getWindow: () => mainWindow,
    ensureWindow,
    accelerator: settings.globalHotkey,
    quit: () => {
      isQuitting = true
      app.quit()
    }
  })

  registerIpc(repo, backup)
  registerBackupIpc(backup)
  const syncEngine = new SyncEngine(repo)
  syncEngine.setNotifier((result) => {
    mainWindow?.webContents.send(IPC.syncChanged, result)
  })
  registerSyncIpc(syncEngine)

  setupAutoUpdate({
    getWindow: () => mainWindow,
    beforeInstall: () => {
      isQuitting = true
    }
  })

  // Quit from the in-app menu (the window close button only hides to tray).
  ipcMain.handle(IPC.appQuit, () => {
    isQuitting = true
    app.quit()
  })

  app.on('activate', () => {
    ensureWindow().show()
  })

  // Keep the window-control overlay in sync with light/dark theme changes.
  // setTitleBarOverlay is Windows/Linux only; macOS uses native traffic lights.
  if (process.platform !== 'darwin') {
    nativeTheme.on('updated', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.setTitleBarOverlay({ ...overlayColors(), height: TITLEBAR_HEIGHT })
      }
    })
  }
})

app.on('before-quit', () => {
  isQuitting = true
  // Final snapshot so work done since the last interval isn't lost on quit.
  backupManager?.createBackup()
})

app.on('will-quit', () => {
  if (autoBackupTimer) clearInterval(autoBackupTimer)
  destroySystem()
})

// Stay alive in the tray when all windows are closed; quit only via the tray menu.
app.on('window-all-closed', () => {
  // intentionally no-op
})
