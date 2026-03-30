import React, { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { ipc } from '../lib/ipc'
import { useApp } from '../context/AppContext'

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
      className={`w-full cursor-pointer rounded-lg border px-4 py-3 text-center text-sm transition-colors outline-none select-none ${
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
        <span className="text-muted-foreground">Click to record a shortcut</span>
      )}
    </div>
  )
}

export function Onboarding(): React.JSX.Element {
  const { setOnboardingComplete } = useApp()
  const [hotkey, setHotkey] = useState('')
  const [saving, setSaving] = useState(false)

  const handleGetStarted = useCallback(async () => {
    setSaving(true)
    try {
      if (hotkey) {
        await ipc.shortcutsSetGlobal(hotkey)
      }
      setOnboardingComplete(true)
    } finally {
      setSaving(false)
    }
  }, [hotkey, setOnboardingComplete])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-background"
    >
      {/* Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold select-none shadow-xl">
          VH
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Welcome to Vibe Hub</h1>
          <p className="mt-1 text-muted-foreground">Your productivity browser for AI tools</p>
        </div>
      </motion.div>

      {/* Hotkey setup */}
      <motion.div
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-sm space-y-3"
      >
        <div>
          <label className="text-sm font-medium text-foreground">
            Global shortcut <span className="text-muted-foreground font-normal">(optional)</span>
          </label>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Open Vibe Hub from anywhere with a keyboard shortcut
          </p>
        </div>
        <HotkeyRecorder value={hotkey} onChange={setHotkey} />
        {hotkey && (
          <button
            onClick={() => setHotkey('')}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear shortcut
          </button>
        )}
      </motion.div>

      {/* CTA */}
      <motion.button
        initial={{ y: 16, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.3 }}
        onClick={handleGetStarted}
        disabled={saving}
        className="rounded-xl bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-lg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saving ? 'Setting up…' : 'Get Started'}
      </motion.button>
    </motion.div>
  )
}
