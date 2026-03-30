import { useCallback, useEffect, useMemo, useState } from 'react'
import { ipc } from '../lib/ipc'
import type { CatalogApp, CustomApp } from '../../shared/types'
import { useApp } from '../context/AppContext'

export interface DirectoryApp extends CatalogApp {
  isCustom: boolean
}

export function useApps(): {
  apps: DirectoryApp[]
  loading: boolean
  allTags: string[]
  isPinned: (id: string) => boolean
  pin: (appId: string) => Promise<void>
  unpin: (appId: string) => Promise<void>
  addCustomApp: (data: {
    name: string
    url: string
    tags: string[]
  }) => Promise<{ ok: boolean; error?: string }>
} {
  const { sidebarOrder, loadApps: reloadContext } = useApp()
  const [apps, setApps] = useState<DirectoryApp[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [catalogResult, customResult] = await Promise.all([
      ipc.appGetCatalog(),
      ipc.appGetCustom()
    ])

    const customIds = new Set<string>()
    if (customResult.ok) {
      for (const app of customResult.data as CustomApp[]) {
        customIds.add(app.id)
      }
    }

    if (catalogResult.ok) {
      setApps(
        (catalogResult.data as CatalogApp[]).map((app) => ({
          ...app,
          isCustom: customIds.has(app.id)
        }))
      )
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const isPinned = useCallback((id: string) => sidebarOrder.includes(id), [sidebarOrder])

  const pin = useCallback(
    async (appId: string) => {
      await ipc.appPin(appId)
      await reloadContext()
    },
    [reloadContext]
  )

  const unpin = useCallback(
    async (appId: string) => {
      await ipc.appUnpin(appId)
      await reloadContext()
    },
    [reloadContext]
  )

  const addCustomApp = useCallback(
    async (data: { name: string; url: string; tags: string[] }) => {
      const result = await ipc.appAddCustom(data)
      if (result.ok) {
        await load()
        await reloadContext()
        return { ok: true }
      }
      return { ok: false, error: result.error }
    },
    [load, reloadContext]
  )

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const app of apps) {
      for (const tag of app.tags) {
        tags.add(tag)
      }
    }
    return Array.from(tags).sort()
  }, [apps])

  return { apps, loading, allTags, isPinned, pin, unpin, addCustomApp }
}
