import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDb } from './db/connection'
import { syncCatalog } from './services/catalog-sync'
import { startSleepManager, stopSleepManager, setSleepThresholdProvider } from './services/sleep-manager'
import { initTray, destroyTray } from './services/tray'
import {
  registerShortcutsIpc,
  restoreGlobalHotkey,
  unregisterAllGlobalShortcuts,
  attachLocalShortcuts
} from './services/shortcuts'
import { initUpdater } from './services/updater'
import { registerPrefsHandlers, getSleepTimerMs } from './ipc/preferences'
import { registerViewIpcHandlers, destroyAllViews } from './ipc/view-manager'
import { registerPromptHandlers } from './ipc/prompts'
import { registerAppHandlers } from './ipc/apps'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Wire view resize on window resize
  registerViewIpcHandlers(null, mainWindow)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(async () => {
  // Initialize preferences store
  registerPrefsHandlers()

  // Connect sleep manager threshold to preferences
  setSleepThresholdProvider(() => getSleepTimerMs())

  // Initialize database
  const dbPath = join(app.getPath('userData'), 'vibe-hub.db')
  const db = initDb(dbPath)

  // Fetch catalog — has 5s timeout with bundled fallback, always resolves
  const catalog = await syncCatalog()

  createWindow()

  if (mainWindow) {
    registerPromptHandlers(db)
    registerAppHandlers(db, mainWindow, catalog)
    startSleepManager(mainWindow)

    // Register Ctrl+1-9 and Ctrl+[/] on the renderer webContents too
    // (WebContentsViews register their own interceptors in view-manager)
    attachLocalShortcuts(mainWindow.webContents, mainWindow)

    // Register IPC handler for shortcuts:set-global and restore saved hotkey
    registerShortcutsIpc(mainWindow)
    restoreGlobalHotkey(mainWindow)

    // System tray (hide-to-tray on close)
    initTray(mainWindow)

    // Auto-updater (skipped for Store installs)
    initUpdater(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  unregisterAllGlobalShortcuts()
  stopSleepManager()
  destroyTray()
  if (mainWindow) {
    destroyAllViews(mainWindow)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
