import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { ipc } from '../lib/ipc'
import type { CatalogApp, CustomApp, ToastPayload, ViewState } from '../../shared/types'

export interface AppEntry {
  id: string
  name: string
  icon: string | null
  url: string
  isCustom: boolean
}

interface ToastItem extends ToastPayload {
  id: string
}

interface AppContextValue {
  // Apps
  pinnedApps: AppEntry[]
  allApps: AppEntry[]
  activeAppId: string | null
  viewStates: Map<string, ViewState>

  // Sidebar order
  sidebarOrder: string[]
  setSidebarOrder: (order: string[]) => void

  // Theme
  theme: 'system' | 'light' | 'dark'
  setTheme: (theme: 'system' | 'light' | 'dark') => void

  // Onboarding
  onboardingComplete: boolean
  setOnboardingComplete: (complete: boolean) => void

  // Toast queue
  toastQueue: ToastItem[]
  addToast: (payload: ToastPayload) => void
  dismissToast: (id: string) => void

  // Actions
  switchApp: (appId: string) => Promise<void>
  reloadApp: (appId: string) => Promise<void>
  loadApps: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

function applyTheme(theme: 'system' | 'light' | 'dark'): void {
  const root = document.documentElement
  if (theme === 'dark') {
    root.classList.add('dark')
  } else if (theme === 'light') {
    root.classList.remove('dark')
  } else {
    // system: follow OS preference
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    if (prefersDark) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }
}

export function AppProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [allApps, setAllApps] = useState<AppEntry[]>([])
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const [viewStates, setViewStates] = useState<Map<string, ViewState>>(new Map())
  const [sidebarOrder, setSidebarOrderState] = useState<string[]>([])
  const [theme, setThemeState] = useState<'system' | 'light' | 'dark'>('system')
  const [onboardingComplete, setOnboardingCompleteState] = useState<boolean>(true)
  const [toastQueue, setToastQueue] = useState<ToastItem[]>([])
  const toastCounter = useRef(0)

  const loadApps = useCallback(async () => {
    const [catalogResult, customResult, orderResult] = await Promise.all([
      ipc.appGetCatalog(),
      ipc.appGetCustom(),
      ipc.prefsGet('sidebarOrder')
    ])

    const entries: AppEntry[] = []

    if (catalogResult.ok) {
      for (const app of catalogResult.data as CatalogApp[]) {
        entries.push({
          id: app.id,
          name: app.name,
          icon: app.icon,
          url: app.cleanUrl,
          isCustom: false
        })
      }
    }

    if (customResult.ok) {
      for (const app of customResult.data as CustomApp[]) {
        entries.push({
          id: app.id,
          name: app.name,
          icon: app.icon,
          url: app.url,
          isCustom: true
        })
      }
    }

    setAllApps(entries)

    if (orderResult.ok && Array.isArray(orderResult.data)) {
      setSidebarOrderState(orderResult.data as string[])
    }
  }, [])

  const setSidebarOrder = useCallback((order: string[]) => {
    setSidebarOrderState(order)
    ipc.prefsSet('sidebarOrder', order)
  }, [])

  const setTheme = useCallback((t: 'system' | 'light' | 'dark') => {
    setThemeState(t)
    applyTheme(t)
    ipc.prefsSet('theme', t)
  }, [])

  const setOnboardingComplete = useCallback((complete: boolean) => {
    setOnboardingCompleteState(complete)
    ipc.prefsSet('onboardingComplete', complete)
  }, [])

  const addToast = useCallback((payload: ToastPayload) => {
    const id = String(++toastCounter.current)
    setToastQueue((q) => [...q, { ...payload, id }])
    setTimeout(() => {
      setToastQueue((q) => q.filter((t) => t.id !== id))
    }, 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToastQueue((q) => q.filter((t) => t.id !== id))
  }, [])

  const switchApp = useCallback(async (appId: string) => {
    setActiveAppId(appId)
    ipc.prefsSet('lastActiveAppId', appId)
    await ipc.appSwitch(appId)
  }, [])

  const reloadApp = useCallback(async (appId: string) => {
    setViewStates((prev) => {
      const next = new Map(prev)
      next.delete(appId)
      return next
    })
    await ipc.appSwitch(appId)
  }, [])

  // Listen for view state changes from main process
  useEffect(() => {
    const unsub = ipc.onViewStateChanged(({ appId, state }) => {
      setViewStates((prev) => {
        const next = new Map(prev)
        next.set(appId, state)
        return next
      })
      if (state === 'active') {
        setActiveAppId(appId)
      }
    })
    return unsub
  }, [])

  // Listen for toasts from main process
  useEffect(() => {
    const unsub = ipc.onToast((payload) => addToast(payload))
    return unsub
  }, [addToast])

  // Listen for keyboard shortcut navigation from main process
  useEffect(() => {
    const unsub = ipc.onShortcutNavigate(({ type, index }) => {
      setSidebarOrderState((order) => {
        setActiveAppId((currentId) => {
          if (order.length === 0) return currentId

          let targetId: string | undefined

          if (type === 'position' && index !== undefined) {
            targetId = order[index]
          } else if (type === 'prev') {
            const idx = currentId ? order.indexOf(currentId) : 0
            targetId = order[idx <= 0 ? order.length - 1 : idx - 1]
          } else if (type === 'next') {
            const idx = currentId ? order.indexOf(currentId) : -1
            targetId = order[idx >= order.length - 1 ? 0 : idx + 1]
          }

          if (targetId && targetId !== currentId) {
            // Trigger switch asynchronously to avoid state update conflicts
            Promise.resolve().then(() => {
              ipc.prefsSet('lastActiveAppId', targetId!)
              ipc.appSwitch(targetId!)
            })
            return targetId
          }
          return currentId
        })
        return order
      })
    })
    return unsub
  }, [])

  // Listen for system dark mode changes when theme is 'system'
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = (): void => {
      if (theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [theme])

  // Load prefs on mount
  useEffect(() => {
    const init = async (): Promise<void> => {
      await loadApps()

      const [themeResult, lastActiveResult, onboardingResult] = await Promise.all([
        ipc.prefsGet('theme'),
        ipc.prefsGet('lastActiveAppId'),
        ipc.prefsGet('onboardingComplete')
      ])

      if (themeResult.ok && themeResult.data) {
        const t = themeResult.data as 'system' | 'light' | 'dark'
        setThemeState(t)
        applyTheme(t)
      } else {
        applyTheme('system')
      }

      if (onboardingResult.ok) {
        setOnboardingCompleteState(onboardingResult.data as boolean)
      }

      if (lastActiveResult.ok && lastActiveResult.data) {
        const lastId = lastActiveResult.data as string
        setActiveAppId(lastId)
        ipc.appSwitch(lastId)
      }
    }
    init()
  }, [loadApps])

  const pinnedApps = React.useMemo(() => {
    if (sidebarOrder.length === 0) return []
    const byId = new Map(allApps.map((a) => [a.id, a]))
    return sidebarOrder.flatMap((id) => {
      const app = byId.get(id)
      return app ? [app] : []
    })
  }, [allApps, sidebarOrder])

  const value: AppContextValue = {
    pinnedApps,
    allApps,
    activeAppId,
    viewStates,
    sidebarOrder,
    setSidebarOrder,
    theme,
    setTheme,
    onboardingComplete,
    setOnboardingComplete,
    toastQueue,
    addToast,
    dismissToast,
    switchApp,
    reloadApp,
    loadApps
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
