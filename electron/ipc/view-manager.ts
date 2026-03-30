import { WebContentsView, shell, BrowserWindow } from 'electron'
import type { IpcMainInvokeEvent } from 'electron'
import type { ToastPayload } from '../../shared/types'
import { IPC_VIEW_STATE_CHANGED, IPC_VIEW_TOAST } from '../../shared/constants'
import { attachLocalShortcuts } from '../services/shortcuts'

export interface ManagedView {
  view: WebContentsView | null // null = sleeping
  url: string
  partition: string // 'persist:${appId}'
  lastActive: number // timestamp ms
  keepAlive: boolean
  affiliateSessionsRemaining: number
  crashCount: number
}

const views = new Map<string, ManagedView>()
let activeAppId: string | null = null

function sendToRenderer(win: BrowserWindow, channel: string, payload: unknown): void {
  if (!win.isDestroyed()) {
    win.webContents.send(channel, payload)
  }
}

function attachViewListeners(appId: string, view: WebContentsView, win: BrowserWindow): void {
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    sendToRenderer(win, IPC_VIEW_TOAST, { message: 'Opened in your browser.' } satisfies ToastPayload)
    return { action: 'deny' }
  })

  view.webContents.on('render-process-gone', (_event, details) => {
    const managed = views.get(appId)
    if (!managed) return

    managed.crashCount += 1
    managed.view = null

    // Remove from window and close the crashed webContents to free resources
    try {
      win.contentView.removeChildView(view)
    } catch {
      // already removed
    }
    try {
      view.webContents.close()
    } catch {
      // webContents may already be in a bad state
    }

    sendToRenderer(win, IPC_VIEW_STATE_CHANGED, { appId, state: 'crashed' })

    if (managed.crashCount >= 3) {
      sendToRenderer(win, IPC_VIEW_TOAST, {
        message: 'This app keeps crashing — the URL may be incompatible with Vibe Hub.'
      } satisfies ToastPayload)
    }
  })
}

export function getView(appId: string): ManagedView | undefined {
  return views.get(appId)
}

export function getViews(): Map<string, ManagedView> {
  return views
}

export function getActiveAppId(): string | null {
  return activeAppId
}

export function updateLastActive(appId: string): void {
  const managed = views.get(appId)
  if (managed) {
    managed.lastActive = Date.now()
  }
}

export function switchToApp(
  appId: string,
  url: string,
  keepAlive: boolean,
  affiliateSessionsRemaining: number,
  win: BrowserWindow
): void {
  const { width, height } = win.getContentBounds()
  const SIDEBAR_WIDTH = 64

  // Hide the currently active view
  if (activeAppId && activeAppId !== appId) {
    const prev = views.get(activeAppId)
    if (prev?.view) {
      try {
        win.contentView.removeChildView(prev.view)
      } catch {
        // already removed
      }
      sendToRenderer(win, IPC_VIEW_STATE_CHANGED, { appId: activeAppId, state: 'background' })
    }
  }

  activeAppId = appId
  let managed = views.get(appId)

  if (!managed) {
    managed = {
      view: null,
      url,
      partition: `persist:${appId}`,
      lastActive: Date.now(),
      keepAlive,
      affiliateSessionsRemaining,
      crashCount: 0
    }
    views.set(appId, managed)
  } else {
    managed.lastActive = Date.now()
    managed.url = url
    managed.keepAlive = keepAlive
    managed.affiliateSessionsRemaining = affiliateSessionsRemaining
  }

  if (!managed.view) {
    const { session } = require('electron')
    const partition = session.fromPartition(managed.partition)
    const view = new WebContentsView({
      webPreferences: {
        session: partition,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    managed.view = view
    attachViewListeners(appId, view, win)
    attachLocalShortcuts(view.webContents, win)
    view.webContents.loadURL(managed.url)
  }

  win.contentView.addChildView(managed.view)
  managed.view.setBounds({
    x: SIDEBAR_WIDTH,
    y: 0,
    width: width - SIDEBAR_WIDTH,
    height
  })

  sendToRenderer(win, IPC_VIEW_STATE_CHANGED, { appId, state: 'active' })
}

export function destroyView(appId: string, win: BrowserWindow): void {
  const managed = views.get(appId)
  if (!managed?.view) return

  try {
    win.contentView.removeChildView(managed.view)
  } catch {
    // already removed
  }

  managed.view.webContents.close()
  managed.view = null
  sendToRenderer(win, IPC_VIEW_STATE_CHANGED, { appId, state: 'sleeping' })
}

export function destroyAllViews(win: BrowserWindow): void {
  for (const [appId] of views) {
    destroyView(appId, win)
  }
  views.clear()
  activeAppId = null
}

export function resizeActiveView(win: BrowserWindow): void {
  if (!activeAppId) return
  const managed = views.get(activeAppId)
  if (!managed?.view) return

  const { width, height } = win.getContentBounds()
  const SIDEBAR_WIDTH = 64
  managed.view.setBounds({
    x: SIDEBAR_WIDTH,
    y: 0,
    width: width - SIDEBAR_WIDTH,
    height
  })
}

export function registerViewIpcHandlers(
  _event: IpcMainInvokeEvent | null,
  win: BrowserWindow
): void {
  // Exposed so main.ts can call resize on window resize
  win.on('resize', () => resizeActiveView(win))
}
