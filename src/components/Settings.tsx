import React, { useCallback, useEffect, useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { ipc } from '../lib/ipc'
import { useApp } from '../context/AppContext'

const SLEEP_OPTIONS = [
  { label: '1 minute', value: 60_000 },
  { label: '5 minutes', value: 300_000 },
  { label: '15 minutes', value: 900_000 },
  { label: '30 minutes', value: 1_800_000 },
  { label: 'Never', value: Number.MAX_SAFE_INTEGER }
]

function HotkeyRecorder({
  value,
  onChange
}: {
  value: string
  onChange: (v: string) => void
}): React.JSX.Element {
  const [recording, setRecording] = useState(false)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!recording) return
      e.preventDefault()

      const parts: string[] = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')

      const key = e.key
      if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
        parts.push(key.length === 1 ? key.toUpperCase() : key)
      }

      if (parts.length >= 2) {
        onChange(parts.join('+'))
        setRecording(false)
      }
    },
    [recording, onChange]
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onFocus={() => setRecording(true)}
      onBlur={() => setRecording(false)}
      onKeyDown={handleKeyDown}
      className={`w-full cursor-pointer rounded-lg border px-4 py-2.5 text-sm transition-colors outline-none select-none ${
        recording
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border bg-card text-foreground hover:border-primary/50'
      }`}
    >
      {recording ? (
        <span className="animate-pulse">Press your shortcut…</span>
      ) : value ? (
        <span className="font-mono">{value}</span>
      ) : (
        <span className="text-muted-foreground">Click to record</span>
      )}
    </div>
  )
}

interface SettingsProps {
  open: boolean
  onClose: () => void
}

export function Settings({ open, onClose }: SettingsProps): React.JSX.Element {
  const { theme, setTheme } = useApp()

  const [sleepTimerMs, setSleepTimerMs] = useState(300_000)
  const [hotkey, setHotkey] = useState('')
  const [hotkeyStatus, setHotkeyStatus] = useState<'idle' | 'saved' | 'failed'>('idle')

  // Load current prefs when dialog opens
  useEffect(() => {
    if (!open) return
    Promise.all([ipc.prefsGet('sleepTimerMs'), ipc.prefsGet('globalHotkey')]).then(
      ([sleepResult, hotkeyResult]) => {
        if (sleepResult.ok && sleepResult.data != null) {
          setSleepTimerMs(sleepResult.data as number)
        }
        if (hotkeyResult.ok && hotkeyResult.data) {
          setHotkey(hotkeyResult.data as string)
        } else {
          setHotkey('')
        }
        setHotkeyStatus('idle')
      }
    )
  }, [open])

  const handleSleepChange = useCallback((value: number) => {
    setSleepTimerMs(value)
    ipc.prefsSet('sleepTimerMs', value)
  }, [])

  const handleHotkeySave = useCallback(async (accelerator: string) => {
    setHotkey(accelerator)
    const result = await ipc.shortcutsSetGlobal(accelerator)
    if (result.ok && result.data.success) {
      setHotkeyStatus('saved')
    } else {
      setHotkeyStatus('failed')
    }
    setTimeout(() => setHotkeyStatus('idle'), 2000)
  }, [])

  const handleHotkeyClear = useCallback(async () => {
    setHotkey('')
    await ipc.shortcutsSetGlobal('')
    setHotkeyStatus('idle')
  }, [])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-2xl">
          <div className="mb-5 flex items-center justify-between">
            <Dialog.Title className="text-lg font-semibold">Settings</Dialog.Title>
            <Dialog.Close
              className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Dialog.Close>
          </div>

          <div className="space-y-6">
            {/* Theme */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Theme</label>
              <div className="flex gap-2">
                {(['system', 'light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTheme(t)}
                    className={`flex-1 rounded-lg border py-2 text-sm capitalize transition-colors ${
                      theme === t
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-background text-foreground hover:border-primary/50'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Sleep timer */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Sleep timer</label>
              <p className="text-xs text-muted-foreground">
                Unload inactive apps to save memory
              </p>
              <select
                value={sleepTimerMs}
                onChange={(e) => handleSleepChange(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary"
              >
                {SLEEP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Global hotkey */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Global shortcut</label>
              <p className="text-xs text-muted-foreground">
                Open Vibe Hub from anywhere
              </p>
              <HotkeyRecorder value={hotkey} onChange={handleHotkeySave} />
              <div className="flex items-center justify-between">
                {hotkeyStatus === 'saved' && (
                  <span className="text-xs text-green-500">Shortcut saved</span>
                )}
                {hotkeyStatus === 'failed' && (
                  <span className="text-xs text-destructive">
                    Shortcut already in use — try another
                  </span>
                )}
                {hotkeyStatus === 'idle' && <span />}
                {hotkey && (
                  <button
                    onClick={handleHotkeyClear}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
