import { app, ipcMain, type BrowserWindow } from 'electron'
import electronUpdater from 'electron-updater'
import { IPC } from '@shared/ipc'
import type { UpdateStatus } from '@shared/types'

const { autoUpdater } = electronUpdater

/** Delay before the first background check so startup isn't blocked. */
const FIRST_CHECK_DELAY_MS = 4000

/**
 * Wire electron-updater to IPC. Updates download in the background and install
 * on the user's confirmation (or automatically on next quit). The renderer drives
 * the UI via the `update:status` event and the check/install handlers.
 *
 * Requires a `publish` provider in electron-builder.yml and published releases;
 * in an unpackaged dev build every check short-circuits to the `dev` state.
 */
export function setupAutoUpdate(opts: {
  getWindow: () => BrowserWindow | null
  /** called right before quitting to install, so the close handler really quits */
  beforeInstall: () => void
}): void {
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  const send = (status: UpdateStatus): void => {
    const win = opts.getWindow()
    if (win && !win.isDestroyed()) win.webContents.send(IPC.updateStatus, status)
  }

  autoUpdater.on('checking-for-update', () => send({ state: 'checking' }))
  autoUpdater.on('update-available', (info) => send({ state: 'available', version: info.version }))
  autoUpdater.on('update-not-available', () => send({ state: 'none' }))
  autoUpdater.on('download-progress', (p) =>
    send({ state: 'downloading', percent: Math.round(p.percent) })
  )
  autoUpdater.on('update-downloaded', (info) => send({ state: 'downloaded', version: info.version }))
  autoUpdater.on('error', (err) =>
    send({ state: 'error', message: err == null ? '未知错误' : (err as Error).message })
  )

  ipcMain.handle(IPC.updateGetVersion, () => app.getVersion())

  ipcMain.handle(IPC.updateCheck, async (): Promise<UpdateStatus> => {
    // Updates only work in a packaged, signed build; skip cleanly in dev.
    if (!app.isPackaged) return { state: 'dev', version: app.getVersion() }
    try {
      await autoUpdater.checkForUpdates()
      return { state: 'checking' }
    } catch (e) {
      return { state: 'error', message: e instanceof Error ? e.message : String(e) }
    }
  })

  ipcMain.handle(IPC.updateInstall, () => {
    opts.beforeInstall()
    autoUpdater.quitAndInstall()
  })

  // Quiet background check shortly after launch (packaged builds only).
  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdates().catch(() => {
        /* offline or no release yet — ignored; the user can check manually */
      })
    }, FIRST_CHECK_DELAY_MS)
  }
}
