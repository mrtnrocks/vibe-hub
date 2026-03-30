import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Hoist mock refs so they are available inside vi.mock factories
const { mockDestroyView, mockViews } = vi.hoisted(() => ({
  mockDestroyView: vi.fn(),
  mockViews: new Map()
}))

// Mock electron before any imports
vi.mock('electron', () => ({
  BrowserWindow: class {},
  WebContentsView: class {},
  shell: { openExternal: vi.fn() },
  ipcMain: { handle: vi.fn() }
}))

// Mock view-manager so we control getViews and spy on destroyView
vi.mock('../../electron/ipc/view-manager', () => ({
  getViews: () => mockViews,
  destroyView: mockDestroyView
}))

import {
  checkSleepTargets,
  setNowProvider,
  setSleepThresholdProvider
} from '../../electron/services/sleep-manager'

// Fake BrowserWindow for tests
const fakeWin = {} as import('electron').BrowserWindow

describe('sleep-manager', () => {
  beforeEach(() => {
    mockViews.clear()
    mockDestroyView.mockReset()
    // Restore defaults
    setNowProvider(() => Date.now())
    setSleepThresholdProvider(() => 300_000)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not destroy views that are already sleeping (view = null)', () => {
    const now = 1_000_000
    setNowProvider(() => now)
    setSleepThresholdProvider(() => 60_000)

    mockViews.set('app-1', {
      view: null,
      lastActive: now - 120_000, // 2 minutes ago
      keepAlive: false
    })

    checkSleepTargets(fakeWin)
    expect(mockDestroyView).not.toHaveBeenCalled()
  })

  it('does not destroy keepAlive views even if past threshold', () => {
    const now = 1_000_000
    setNowProvider(() => now)
    setSleepThresholdProvider(() => 60_000)

    const fakeView = { webContents: {} }
    mockViews.set('app-keep', {
      view: fakeView,
      lastActive: now - 200_000, // well past threshold
      keepAlive: true
    })

    checkSleepTargets(fakeWin)
    expect(mockDestroyView).not.toHaveBeenCalled()
  })

  it('destroys views that are past the sleep threshold', () => {
    const now = 1_000_000
    setNowProvider(() => now)
    setSleepThresholdProvider(() => 60_000)

    const fakeView = { webContents: {} }
    mockViews.set('app-stale', {
      view: fakeView,
      lastActive: now - 90_000, // 90s > 60s threshold
      keepAlive: false
    })

    checkSleepTargets(fakeWin)
    expect(mockDestroyView).toHaveBeenCalledOnce()
    expect(mockDestroyView).toHaveBeenCalledWith('app-stale', fakeWin)
  })

  it('does not destroy views that are within the sleep threshold', () => {
    const now = 1_000_000
    setNowProvider(() => now)
    setSleepThresholdProvider(() => 300_000)

    const fakeView = { webContents: {} }
    mockViews.set('app-fresh', {
      view: fakeView,
      lastActive: now - 60_000, // 1 minute ago, threshold is 5 minutes
      keepAlive: false
    })

    checkSleepTargets(fakeWin)
    expect(mockDestroyView).not.toHaveBeenCalled()
  })

  it('only destroys views past threshold, leaves fresh ones alone', () => {
    const now = 1_000_000
    setNowProvider(() => now)
    setSleepThresholdProvider(() => 300_000)

    const staleView = { webContents: {} }
    const freshView = { webContents: {} }

    mockViews.set('app-stale', {
      view: staleView,
      lastActive: now - 400_000, // 6.6 minutes, past 5m threshold
      keepAlive: false
    })
    mockViews.set('app-fresh', {
      view: freshView,
      lastActive: now - 60_000, // 1 minute, within threshold
      keepAlive: false
    })

    checkSleepTargets(fakeWin)
    expect(mockDestroyView).toHaveBeenCalledOnce()
    expect(mockDestroyView).toHaveBeenCalledWith('app-stale', fakeWin)
  })

  it('destroys multiple views if all are past threshold', () => {
    const now = 1_000_000
    setNowProvider(() => now)
    setSleepThresholdProvider(() => 60_000)

    mockViews.set('app-1', {
      view: { webContents: {} },
      lastActive: now - 120_000,
      keepAlive: false
    })
    mockViews.set('app-2', {
      view: { webContents: {} },
      lastActive: now - 180_000,
      keepAlive: false
    })

    checkSleepTargets(fakeWin)
    expect(mockDestroyView).toHaveBeenCalledTimes(2)
  })

  it('respects a custom sleep threshold from preferences', () => {
    const now = 1_000_000
    setNowProvider(() => now)
    setSleepThresholdProvider(() => 10_000) // 10 seconds custom threshold

    const fakeView = { webContents: {} }
    mockViews.set('app-1', {
      view: fakeView,
      lastActive: now - 15_000, // 15s > 10s threshold
      keepAlive: false
    })

    checkSleepTargets(fakeWin)
    expect(mockDestroyView).toHaveBeenCalledWith('app-1', fakeWin)
  })

  it('handles an empty view map gracefully', () => {
    checkSleepTargets(fakeWin)
    expect(mockDestroyView).not.toHaveBeenCalled()
  })
})
