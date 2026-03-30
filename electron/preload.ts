import { contextBridge, ipcRenderer } from 'electron'
import type { IpcResult } from '../shared/types'
import type { CatalogApp, CustomApp, Prompt, ToastPayload } from '../shared/types'
import type { ViewState } from '../shared/types'
import {
  IPC_APP_SWITCH,
  IPC_APP_PIN,
  IPC_APP_UNPIN,
  IPC_APP_SET_KEEP_ALIVE,
  IPC_APP_ADD_CUSTOM,
  IPC_APP_GET_CATALOG,
  IPC_APP_GET_CUSTOM,
  IPC_PROMPT_LIST,
  IPC_PROMPT_GET,
  IPC_PROMPT_CREATE,
  IPC_PROMPT_UPDATE,
  IPC_PROMPT_DELETE,
  IPC_PREFS_GET,
  IPC_PREFS_SET,
  IPC_SHORTCUTS_SET_GLOBAL,
  IPC_SHORTCUTS_NAVIGATE,
  IPC_UPDATER_RESTART,
  IPC_VIEW_STATE_CHANGED,
  IPC_VIEW_TOAST
} from '../shared/constants'

const electronAPI = {
  // App management (Renderer → Main)
  appSwitch: (appId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_SWITCH, { appId }),
  appPin: (appId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_PIN, { appId }),
  appUnpin: (appId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_UNPIN, { appId }),
  appSetKeepAlive: (appId: string, keepAlive: boolean): Promise<void> =>
    ipcRenderer.invoke(IPC_APP_SET_KEEP_ALIVE, { appId, keepAlive }),
  appAddCustom: (data: {
    name: string
    url: string
    icon?: string
    tags: string[]
  }): Promise<IpcResult<CustomApp>> =>
    ipcRenderer.invoke(IPC_APP_ADD_CUSTOM, data),
  appGetCatalog: (): Promise<IpcResult<CatalogApp[]>> =>
    ipcRenderer.invoke(IPC_APP_GET_CATALOG),
  appGetCustom: (): Promise<IpcResult<CustomApp[]>> =>
    ipcRenderer.invoke(IPC_APP_GET_CUSTOM),

  // Prompt management (Renderer → Main)
  promptList: (filters?: {
    tag?: string
    search?: string
  }): Promise<IpcResult<Prompt[]>> =>
    ipcRenderer.invoke(IPC_PROMPT_LIST, filters ?? {}),
  promptGet: (id: string): Promise<IpcResult<Prompt>> =>
    ipcRenderer.invoke(IPC_PROMPT_GET, { id }),
  promptCreate: (data: {
    title: string
    template: string
    defaults: Record<string, string>
    tags: string[]
  }): Promise<IpcResult<Prompt>> =>
    ipcRenderer.invoke(IPC_PROMPT_CREATE, data),
  promptUpdate: (data: {
    id: string
    title?: string
    template?: string
    defaults?: Record<string, string>
    tags?: string[]
  }): Promise<IpcResult<Prompt>> =>
    ipcRenderer.invoke(IPC_PROMPT_UPDATE, data),
  promptDelete: (id: string): Promise<void> =>
    ipcRenderer.invoke(IPC_PROMPT_DELETE, { id }),

  // Preferences (Renderer → Main)
  prefsGet: (key: string): Promise<IpcResult<unknown>> =>
    ipcRenderer.invoke(IPC_PREFS_GET, { key }),
  prefsSet: (key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke(IPC_PREFS_SET, { key, value }),

  // Shortcuts (Renderer → Main)
  shortcutsSetGlobal: (
    accelerator: string
  ): Promise<IpcResult<{ success: boolean }>> =>
    ipcRenderer.invoke(IPC_SHORTCUTS_SET_GLOBAL, { accelerator }),

  // Updater (Renderer → Main)
  updaterRestart: (): Promise<void> =>
    ipcRenderer.invoke(IPC_UPDATER_RESTART),

  // Main → Renderer listeners
  onViewStateChanged: (
    callback: (data: { appId: string; state: ViewState }) => void
  ): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: { appId: string; state: ViewState }): void => {
      callback(data)
    }
    ipcRenderer.on(IPC_VIEW_STATE_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC_VIEW_STATE_CHANGED, handler)
  },

  onToast: (callback: (data: ToastPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: ToastPayload): void => {
      callback(data)
    }
    ipcRenderer.on(IPC_VIEW_TOAST, handler)
    return () => ipcRenderer.removeListener(IPC_VIEW_TOAST, handler)
  },

  // Shortcut navigation (Main → Renderer)
  onShortcutNavigate: (
    callback: (data: { type: 'position' | 'prev' | 'next'; index?: number }) => void
  ): (() => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      data: { type: 'position' | 'prev' | 'next'; index?: number }
    ): void => {
      callback(data)
    }
    ipcRenderer.on(IPC_SHORTCUTS_NAVIGATE, handler)
    return () => ipcRenderer.removeListener(IPC_SHORTCUTS_NAVIGATE, handler)
  },

  // Generic action invoke for toast action buttons (e.g., updater restart)
  invokeAction: (channel: string): Promise<void> =>
    ipcRenderer.invoke(channel)
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)

export type ElectronAPI = typeof electronAPI
