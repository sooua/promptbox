import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { S3ConfigInput, WebDavConfigInput } from '@shared/types'
import type { SyncEngine } from './engine'

export function registerSyncIpc(engine: SyncEngine): void {
  ipcMain.handle(IPC.syncGetState, () => engine.getState())
  ipcMain.handle(IPC.syncConnectGist, (_e, token: string) => engine.connectGist(token))
  ipcMain.handle(IPC.syncConnectWebdav, (_e, cfg: WebDavConfigInput) => engine.connectWebDav(cfg))
  ipcMain.handle(IPC.syncConnectS3, (_e, cfg: S3ConfigInput) => engine.connectS3(cfg))
  ipcMain.handle(IPC.syncDisconnect, () => engine.disconnect())
  ipcMain.handle(IPC.syncSetAuto, (_e, enabled: boolean) => engine.setAutoSync(enabled))
  ipcMain.handle(IPC.syncSetEncryption, (_e, enabled: boolean, passphrase: string) =>
    engine.setEncryption(enabled, passphrase)
  )
  ipcMain.handle(IPC.syncRun, () => engine.run())
  ipcMain.handle(IPC.syncResolveConflict, () => engine.resolveConflict())
  ipcMain.handle(IPC.syncListVersions, () => engine.listVersions())
  ipcMain.handle(IPC.syncRestoreVersion, (_e, id: string) => engine.restoreVersion(id))
}
