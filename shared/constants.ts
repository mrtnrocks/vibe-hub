// IPC Channel Names
// Renderer → Main (invoke)
export const IPC_APP_SWITCH = 'app:switch' as const
export const IPC_APP_PIN = 'app:pin' as const
export const IPC_APP_UNPIN = 'app:unpin' as const
export const IPC_APP_SET_KEEP_ALIVE = 'app:set-keep-alive' as const
export const IPC_APP_ADD_CUSTOM = 'app:add-custom' as const
export const IPC_APP_GET_CATALOG = 'app:get-catalog' as const
export const IPC_APP_GET_CUSTOM = 'app:get-custom' as const

export const IPC_PROMPT_LIST = 'prompt:list' as const
export const IPC_PROMPT_GET = 'prompt:get' as const
export const IPC_PROMPT_CREATE = 'prompt:create' as const
export const IPC_PROMPT_UPDATE = 'prompt:update' as const
export const IPC_PROMPT_DELETE = 'prompt:delete' as const

export const IPC_PREFS_GET = 'prefs:get' as const
export const IPC_PREFS_SET = 'prefs:set' as const

export const IPC_SHORTCUTS_SET_GLOBAL = 'shortcuts:set-global' as const
export const IPC_UPDATER_RESTART = 'updater:restart' as const

// Main → Renderer (send)
export const IPC_VIEW_STATE_CHANGED = 'view:state-changed' as const
export const IPC_VIEW_TOAST = 'view:toast' as const
