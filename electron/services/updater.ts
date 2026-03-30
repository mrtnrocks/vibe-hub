import { ipcMain, BrowserWindow } from 'electron'
import { IPC_UPDATER_RESTART, IPC_VIEW_TOAST } from '../../shared/constants'
import type { ToastPayload } from '../../shared/types'

declare const process: NodeJS.Process & { windowsStore?: boolean }

/** Initialize electron-updater for sideloaded installs only.
 *  Microsoft Store installs are skipped — the Store manages updates. */
export function initUpdater(win: BrowserWindow): void {
  // Register IPC handler regardless so the renderer can always invoke it
  ipcMain.handle(IPC_UPDATER_RESTART, () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { autoUpdater } = require('electron-updater')
      autoUpdater.quitAndInstall()
    } catch (err) {
      console.error('[updater] quitAndInstall failed:', err)
    }
  })

  // Skip auto-update for Store installs
  if (process.windowsStore) {
    console.log('[updater] Microsoft Store install detected — skipping auto-updater')
    return
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { autoUpdater } = require('electron-updater')

    autoUpdater.autoDownload = true
    autoUpdater.autoInstallOnAppQuit = true

    autoUpdater.on('update-downloaded', () => {
      if (win.isDestroyed()) return
      const payload: ToastPayload = {
        message: 'Update ready — restart to install.',
        action: {
          label: 'Restart',
          ipcChannel: IPC_UPDATER_RESTART
        }
      }
      win.webContents.send(IPC_VIEW_TOAST, payload)
    })

    autoUpdater.on('error', (err: unknown) => {
      console.error('[updater] error:', err)
    })

    autoUpdater.checkForUpdatesAndNotify().catch((err: unknown) => {
      console.error('[updater] checkForUpdatesAndNotify failed:', err)
    })
  } catch (err) {
    console.error('[updater] Failed to initialize electron-updater:', err)
  }
}
