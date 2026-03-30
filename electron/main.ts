import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { initDb } from './db/connection'
import { syncCatalog } from './services/catalog-sync'
import { startSleepManager, stopSleepManager, setSleepThresholdProvider } from './services/sleep-manager'
import { registerPrefsHandlers, getSleepTimerMs } from './ipc/preferences'
import { registerViewIpcHandlers, destroyAllViews } from './ipc/view-manager'

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
  initDb(dbPath)

  // Pre-fetch catalog in background (result cached by IPC handler in Phase 4)
  syncCatalog().catch((err) => console.error('[main] catalog sync error:', err))

  createWindow()

  if (mainWindow) {
    startSleepManager(mainWindow)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('before-quit', () => {
  stopSleepManager()
  if (mainWindow) {
    destroyAllViews(mainWindow)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
