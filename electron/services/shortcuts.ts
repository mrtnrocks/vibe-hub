import { globalShortcut, ipcMain, BrowserWindow } from 'electron'
import type { WebContents } from 'electron'
import type { IpcResult } from '../../shared/types'
import {
  IPC_SHORTCUTS_SET_GLOBAL,
  IPC_SHORTCUTS_NAVIGATE
} from '../../shared/constants'
import { getStore } from '../ipc/preferences'

let currentGlobalAccelerator: string | null = null

function sendNavigate(
  win: BrowserWindow,
  type: 'position' | 'prev' | 'next',
  index?: number
): void {
  if (!win.isDestroyed()) {
    win.webContents.send(IPC_SHORTCUTS_NAVIGATE, { type, index })
  }
}

function handleInput(
  event: Electron.Event,
  input: Electron.Input,
  win: BrowserWindow
): void {
  if (!input.control || input.type !== 'keyDown') return

  // Ctrl+1-9: switch to sidebar position by index
  const digit = parseInt(input.key)
  if (!isNaN(digit) && digit >= 1 && digit <= 9) {
    event.preventDefault()
    sendNavigate(win, 'position', digit - 1)
    return
  }

  // Ctrl+[ : previous app
  if (input.key === '[') {
    event.preventDefault()
    sendNavigate(win, 'prev')
    return
  }

  // Ctrl+] : next app
  if (input.key === ']') {
    event.preventDefault()
    sendNavigate(win, 'next')
  }
}

/** Attach local Ctrl+1-9/[/] shortcut interceptor to any webContents */
export function attachLocalShortcuts(webContents: WebContents, win: BrowserWindow): void {
  webContents.on('before-input-event', (event, input) => {
    handleInput(event, input, win)
  })
}

/** Register the IPC handler for shortcuts:set-global */
export function registerShortcutsIpc(win: BrowserWindow): void {
  ipcMain.handle(
    IPC_SHORTCUTS_SET_GLOBAL,
    (_event, { accelerator }: { accelerator: string }): IpcResult<{ success: boolean }> => {
      try {
        // Unregister current hotkey first
        if (currentGlobalAccelerator) {
          globalShortcut.unregister(currentGlobalAccelerator)
          currentGlobalAccelerator = null
        }

        if (!accelerator) {
          getStore().set('globalHotkey', null)
          return { ok: true, data: { success: true } }
        }

        const registered = globalShortcut.register(accelerator, () => {
          if (!win.isDestroyed()) {
            win.show()
            win.focus()
          }
        })

        if (registered) {
          currentGlobalAccelerator = accelerator
          getStore().set('globalHotkey', accelerator)
          return { ok: true, data: { success: true } }
        }

        // accelerator may be already taken by another app
        return { ok: true, data: { success: false } }
      } catch (err) {
        console.error('[shortcuts] set-global failed:', err)
        return { ok: false, error: String(err) }
      }
    }
  )
}

/** Re-register the saved global hotkey on app start */
export function restoreGlobalHotkey(win: BrowserWindow): void {
  const hotkey = getStore().get('globalHotkey')
  if (!hotkey) return

  try {
    const registered = globalShortcut.register(hotkey, () => {
      if (!win.isDestroyed()) {
        win.show()
        win.focus()
      }
    })

    if (registered) {
      currentGlobalAccelerator = hotkey
    } else {
      console.warn('[shortcuts] Failed to restore global hotkey — already registered:', hotkey)
    }
  } catch (err) {
    console.error('[shortcuts] restore-global failed:', err)
  }
}

export function unregisterAllGlobalShortcuts(): void {
  globalShortcut.unregisterAll()
  currentGlobalAccelerator = null
}
