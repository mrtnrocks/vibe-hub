// IPC result wrapper
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Database models
export interface Prompt {
  id: string
  title: string
  template: string
  defaults: Record<string, string>
  tags: string[]
  createdAt: number
  updatedAt: number
}

export interface CatalogApp {
  id: string
  name: string
  description: string
  cleanUrl: string
  affiliateUrl: string
  icon: string
  tags: string[]
}

export interface CustomApp {
  id: string
  name: string
  url: string
  icon: string | null
  tags: string[]
  createdAt: number
}

export interface AppSession {
  appId: string
  affiliateSessionsRemaining: number
  firstOpenedAt: number
  keepAlive: boolean
}

// View state for sidebar indicators
export type ViewState = 'active' | 'background' | 'sleeping' | 'crashed'

// Toast payload
export interface ToastPayload {
  message: string
  action?: {
    label: string
    ipcChannel: string
  }
}
