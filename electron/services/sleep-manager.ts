import type { BrowserWindow } from 'electron'
import { destroyView, getViews } from '../ipc/view-manager'

const CHECK_INTERVAL_MS = 30_000

let intervalId: ReturnType<typeof setInterval> | null = null

// Injected for testability
let _getNow: () => number = () => Date.now()
let _getSleepThresholdMs: () => number = () => 5 * 60 * 1000 // 5 minutes default

export function setSleepThresholdProvider(fn: () => number): void {
  _getSleepThresholdMs = fn
}

export function setNowProvider(fn: () => number): void {
  _getNow = fn
}

export function checkSleepTargets(win: BrowserWindow): void {
  const now = _getNow()
  const threshold = _getSleepThresholdMs()

  for (const [appId, managed] of getViews()) {
    if (!managed.view) continue // already sleeping or crashed
    if (managed.keepAlive) continue
    if (now - managed.lastActive > threshold) {
      destroyView(appId, win)
    }
  }
}

export function startSleepManager(win: BrowserWindow): void {
  if (intervalId !== null) return
  intervalId = setInterval(() => checkSleepTargets(win), CHECK_INTERVAL_MS)
}

export function stopSleepManager(): void {
  if (intervalId !== null) {
    clearInterval(intervalId)
    intervalId = null
  }
}
