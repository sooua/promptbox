import { BrowserWindow, Menu, Tray, globalShortcut, nativeImage } from 'electron'
import { IPC } from '@shared/ipc'
import trayIconPath from '../../resources/tray.png?asset'
import { mt, onMainLanguageChange } from './i18n'

interface SystemDeps {
  /** the live window, or null if it was destroyed */
  getWindow: () => BrowserWindow | null
  /** create the window if needed and return it */
  ensureWindow: () => BrowserWindow
  /** flip the quitting flag and actually exit */
  quit: () => void
}

let tray: Tray | null = null
let deps: SystemDeps | null = null
let currentAccelerator = ''

/** Show + focus the window, optionally popping the command palette. */
export function summon(openPalette: boolean): void {
  if (!deps) return
  const win = deps.ensureWindow()
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
  if (openPalette) sendOpenPalette(win)
}

function sendOpenPalette(win: BrowserWindow): void {
  if (win.webContents.isLoading()) {
    win.webContents.once('did-finish-load', () => win.webContents.send(IPC.paletteOpen))
  } else {
    win.webContents.send(IPC.paletteOpen)
  }
}

function buildTrayMenu(): void {
  if (!tray || !deps) return
  const menu = Menu.buildFromTemplate([
    { label: mt('显示 PromptBox'), click: () => summon(false) },
    { label: mt('快速调用…'), click: () => summon(true) },
    { type: 'separator' },
    { label: mt('退出'), click: () => deps?.quit() }
  ])
  tray.setContextMenu(menu)
}

/** (Re)register the global quick-launch hotkey. Returns whether it took. */
export function updateHotkey(accelerator: string): boolean {
  if (currentAccelerator) {
    globalShortcut.unregister(currentAccelerator)
    currentAccelerator = ''
  }
  if (!accelerator) return false
  try {
    const ok = globalShortcut.register(accelerator, () => summon(true))
    if (ok) currentAccelerator = accelerator
    return ok
  } catch {
    return false
  }
}

export function setupSystem(options: SystemDeps & { accelerator: string }): void {
  deps = options

  const image = nativeImage.createFromPath(trayIconPath)
  tray = new Tray(image.isEmpty() ? nativeImage.createEmpty() : image)
  tray.setToolTip(mt('PromptBox — 快速调用提示词'))
  buildTrayMenu()
  // Rebuild the tray menu + tooltip when the UI language changes.
  onMainLanguageChange(() => {
    tray?.setToolTip(mt('PromptBox — 快速调用提示词'))
    buildTrayMenu()
  })
  // Left-click shows the window; right-click uses the context menu.
  tray.on('click', () => summon(false))

  updateHotkey(options.accelerator)
}

export function destroySystem(): void {
  globalShortcut.unregisterAll()
  tray?.destroy()
  tray = null
}
