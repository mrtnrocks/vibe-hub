import { app, Menu, Tray, BrowserWindow, nativeImage } from 'electron'
import { join } from 'path'

let tray: Tray | null = null
let isQuitting = false

/** Create the system tray and override window close to hide-to-tray */
export function initTray(win: BrowserWindow): void {
  // Load tray icon — try resources/tray.png, fall back to empty image
  let icon = nativeImage.createEmpty()
  try {
    const iconPath = join(__dirname, '../../resources/tray.png')
    const loaded = nativeImage.createFromPath(iconPath)
    if (!loaded.isEmpty()) {
      icon = loaded.resize({ width: 16, height: 16 })
    }
  } catch {
    // No icon file — tray will show with empty/system default
  }

  tray = new Tray(icon)
  tray.setToolTip('Vibe Hub')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show Vibe Hub',
      click: () => {
        win.show()
        win.focus()
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Single-click to show on Windows
  tray.on('click', () => {
    win.show()
    win.focus()
  })

  // Override close → hide to tray (unless explicitly quitting)
  win.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  // Mark quitting on before-quit so the close handler lets through
  app.on('before-quit', () => {
    isQuitting = true
  })
}

export function destroyTray(): void {
  tray?.destroy()
  tray = null
}
