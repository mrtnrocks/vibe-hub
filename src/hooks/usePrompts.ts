import { useCallback, useEffect, useMemo, useState } from 'react'
import { ipc } from '../lib/ipc'
import type { Prompt } from '../../shared/types'

interface UsePromptsReturn {
  prompts: Prompt[]
  loading: boolean
  allTags: string[]
  search: string
  setSearch: (s: string) => void
  selectedTag: string | null
  setSelectedTag: (tag: string | null) => void
  createPrompt: (data: {
    title: string
    template: string
    defaults: Record<string, string>
    tags: string[]
  }) => Promise<{ ok: boolean; error?: string; data?: Prompt }>
  updatePrompt: (data: {
    id: string
    title?: string
    template?: string
    defaults?: Record<string, string>
    tags?: string[]
  }) => Promise<{ ok: boolean; error?: string; data?: Prompt }>
  deletePrompt: (id: string) => Promise<void>
  reload: () => Promise<void>
}

export function usePrompts(): UsePromptsReturn {
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedTag, setSelectedTag] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await ipc.promptList({
      tag: selectedTag ?? undefined,
      search: search.trim() || undefined
    })
    if (result.ok) setPrompts(result.data)
    setLoading(false)
  }, [search, selectedTag])

  useEffect(() => {
    void load()
  }, [load])

  const allTags = useMemo(() => {
    const tags = new Set<string>()
    for (const p of prompts) {
      for (const t of p.tags) tags.add(t)
    }
    return Array.from(tags).sort()
  }, [prompts])

  const createPrompt = useCallback(
    async (data: {
      title: string
      template: string
      defaults: Record<string, string>
      tags: string[]
    }) => {
      const result = await ipc.promptCreate(data)
      if (result.ok) {
        setPrompts((prev) => [result.data, ...prev])
        return { ok: true as const, data: result.data }
      }
      return { ok: false as const, error: result.error }
    },
    []
  )

  const updatePrompt = useCallback(
    async (data: {
      id: string
      title?: string
      template?: string
      defaults?: Record<string, string>
      tags?: string[]
    }) => {
      const result = await ipc.promptUpdate(data)
      if (result.ok) {
        setPrompts((prev) => prev.map((p) => (p.id === result.data.id ? result.data : p)))
        return { ok: true as const, data: result.data }
      }
      return { ok: false as const, error: result.error }
    },
    []
  )

  const deletePrompt = useCallback(async (id: string) => {
    await ipc.promptDelete(id)
    setPrompts((prev) => prev.filter((p) => p.id !== id))
  }, [])

  return {
    prompts,
    loading,
    allTags,
    search,
    setSearch,
    selectedTag,
    setSelectedTag,
    createPrompt,
    updatePrompt,
    deletePrompt,
    reload: load
  }
}
