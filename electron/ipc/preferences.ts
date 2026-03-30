import { ipcMain } from 'electron'
import Store from 'electron-store'
import type { IpcResult } from '../../shared/types'
import { IPC_PREFS_GET, IPC_PREFS_SET } from '../../shared/constants'

export interface AppPreferences {
  theme: 'system' | 'light' | 'dark'
  sleepTimerMs: number
  sidebarOrder: string[]
  lastActiveAppId: string | null
  globalHotkey: string | null
  onboardingComplete: boolean
}

const DEFAULTS: AppPreferences = {
  theme: 'system',
  sleepTimerMs: 300_000, // 5 minutes
  sidebarOrder: [],
  lastActiveAppId: null,
  globalHotkey: null,
  onboardingComplete: false
}

let store: Store<AppPreferences> | null = null

export function getStore(): Store<AppPreferences> {
  if (!store) {
    store = new Store<AppPreferences>({ defaults: DEFAULTS })
  }
  return store
}

export function registerPrefsHandlers(): void {
  ipcMain.handle(IPC_PREFS_GET, (_event, { key }: { key: keyof AppPreferences }): IpcResult<unknown> => {
    try {
      const value = getStore().get(key)
      return { ok: true, data: value }
    } catch (err) {
      return { ok: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC_PREFS_SET, (_event, { key, value }: { key: keyof AppPreferences; value: unknown }): void => {
    try {
      getStore().set(key, value as AppPreferences[typeof key])
    } catch (err) {
      console.error('[preferences] Failed to set pref:', key, err)
    }
  })
}

export function getSleepTimerMs(): number {
  return getStore().get('sleepTimerMs') ?? DEFAULTS.sleepTimerMs
}
