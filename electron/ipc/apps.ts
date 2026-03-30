import { ipcMain, BrowserWindow } from 'electron'
import Database from 'better-sqlite3'
import type { IpcResult, CatalogApp, CustomApp } from '../../shared/types'
import {
  IPC_APP_SWITCH,
  IPC_APP_PIN,
  IPC_APP_UNPIN,
  IPC_APP_SET_KEEP_ALIVE,
  IPC_APP_ADD_CUSTOM,
  IPC_APP_GET_CATALOG,
  IPC_APP_GET_CUSTOM,
  IPC_VIEW_TOAST
} from '../../shared/constants'
import {
  listCustomApps,
  createCustomApp,
  upsertAppSession,
  decrementAffiliateSession,
  setKeepAlive
} from '../db/queries/apps'
import { switchToApp } from './view-manager'
import { getStore } from './preferences'

// Active affiliate timers keyed by appId — cleared and restarted on each switch
const affiliateTimers = new Map<string, ReturnType<typeof setTimeout>>()

function customAppToCatalogApp(app: CustomApp): CatalogApp {
  return {
    id: app.id,
    name: app.name,
    description: '',
    cleanUrl: app.url,
    affiliateUrl: app.url,
    icon: app.icon ?? '',
    tags: app.tags
  }
}

export function registerAppHandlers(
  db: Database.Database,
  win: BrowserWindow,
  catalogCache: CatalogApp[]
): void {
  ipcMain.handle(IPC_APP_GET_CATALOG, (): IpcResult<CatalogApp[]> => {
    try {
      const custom = listCustomApps(db).map(customAppToCatalogApp)
      return { ok: true, data: [...catalogCache, ...custom] }
    } catch (err) {
      console.error('[ipc:apps] get-catalog failed:', err)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_APP_GET_CUSTOM, (): IpcResult<CustomApp[]> => {
    try {
      return { ok: true, data: listCustomApps(db) }
    } catch (err) {
      console.error('[ipc:apps] get-custom failed:', err)
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(
    IPC_APP_ADD_CUSTOM,
    (
      _event,
      input: { name: string; url: string; icon?: string; tags: string[] }
    ): IpcResult<CustomApp> => {
      try {
        let url = input.url
        if (!/^https?:\/\//i.test(url)) {
          url = `https://${url}`
        }

        try {
          new URL(url)
        } catch {
          return { ok: false, error: 'Invalid URL' }
        }

        const app = createCustomApp(db, { ...input, url })
        return { ok: true, data: app }
      } catch (err) {
        console.error('[ipc:apps] add-custom failed:', err)
        return { ok: false, error: String(err) }
      }
    }
  )

  ipcMain.handle(IPC_APP_PIN, (_event, { appId }: { appId: string }): void => {
    try {
      const store = getStore()
      const order = store.get('sidebarOrder')
      if (!order.includes(appId)) {
        store.set('sidebarOrder', [...order, appId])
      }
    } catch (err) {
      console.error('[ipc:apps] pin failed:', err)
      win.webContents.send(IPC_VIEW_TOAST, { message: 'Failed to pin app' })
    }
  })

  ipcMain.handle(IPC_APP_UNPIN, (_event, { appId }: { appId: string }): void => {
    try {
      const store = getStore()
      const order = store.get('sidebarOrder')
      store.set('sidebarOrder', order.filter((id) => id !== appId))
    } catch (err) {
      console.error('[ipc:apps] unpin failed:', err)
      win.webContents.send(IPC_VIEW_TOAST, { message: 'Failed to unpin app' })
    }
  })

  ipcMain.handle(
    IPC_APP_SET_KEEP_ALIVE,
    (_event, { appId, keepAlive }: { appId: string; keepAlive: boolean }): void => {
      try {
        upsertAppSession(db, appId)
        setKeepAlive(db, appId, keepAlive)
      } catch (err) {
        console.error('[ipc:apps] set-keep-alive failed:', err)
        win.webContents.send(IPC_VIEW_TOAST, { message: 'Failed to update keep-alive setting' })
      }
    }
  )

  ipcMain.handle(IPC_APP_SWITCH, (_event, { appId }: { appId: string }): void => {
    try {
      // Resolve app URLs from catalog or custom apps
      const catalogApp = catalogCache.find((a) => a.id === appId)
      let cleanUrl: string
      let affiliateUrl: string

      if (catalogApp) {
        cleanUrl = catalogApp.cleanUrl
        affiliateUrl = catalogApp.affiliateUrl
      } else {
        const custom = listCustomApps(db).find((a) => a.id === appId)
        if (!custom) {
          console.error('[ipc:apps] app:switch — unknown appId:', appId)
          win.webContents.send(IPC_VIEW_TOAST, { message: 'App not found' })
          return
        }
        cleanUrl = custom.url
        affiliateUrl = custom.url
      }

      // Get or create session record
      const session = upsertAppSession(db, appId)
      const useAffiliate = session.affiliateSessionsRemaining > 0
      const url = useAffiliate ? affiliateUrl : cleanUrl

      switchToApp(appId, url, session.keepAlive, session.affiliateSessionsRemaining, win)

      // Start 30s timer to credit the affiliate session
      if (useAffiliate) {
        const existing = affiliateTimers.get(appId)
        if (existing) clearTimeout(existing)

        const timer = setTimeout(() => {
          affiliateTimers.delete(appId)
          try {
            decrementAffiliateSession(db, appId)
          } catch (err) {
            console.error('[ipc:apps] affiliate decrement failed:', err)
          }
        }, 30_000)

        affiliateTimers.set(appId, timer)
      }
    } catch (err) {
      console.error('[ipc:apps] switch failed:', err)
      win.webContents.send(IPC_VIEW_TOAST, { message: 'Failed to switch app' })
    }
  })
}
