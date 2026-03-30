import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Search, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { usePrompts } from '../../hooks/usePrompts'
import { VariableFiller } from './VariableFiller'
import { PromptForm } from './PromptForm'
import type { Prompt } from '../../../shared/types'

interface PromptDrawerProps {
  open: boolean
  onClose: () => void
  onOpenManager: () => void
}

export function PromptDrawer({
  open,
  onClose,
  onOpenManager
}: PromptDrawerProps): React.JSX.Element {
  const {
    prompts,
    loading,
    allTags,
    search,
    setSearch,
    selectedTag,
    setSelectedTag,
    createPrompt
  } = usePrompts()

  const [selected, setSelected] = useState<Prompt | null>(null)
  const [creating, setCreating] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const handleCreate = async (data: {
    title: string
    template: string
    defaults: Record<string, string>
    tags: string[]
  }): Promise<void> => {
    setSubmitting(true)
    const result = await createPrompt(data)
    setSubmitting(false)
    if (result.ok) setCreating(false)
  }

  const filteredPrompts = prompts.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchSearch =
      q === '' ||
      p.title.toLowerCase().includes(q) ||
      p.template.toLowerCase().includes(q)
    const matchTag = !selectedTag || p.tags.includes(selectedTag)
    return matchSearch && matchTag
  })

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="drawer"
            className="fixed right-0 top-0 z-50 flex h-full w-[400px] flex-col border-l border-border bg-card shadow-2xl"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 250 }}
          >
            {/* Header */}
            <div className="flex shrink-0 items-center justify-between border-b border-border px-4 py-3">
              <p className="font-semibold">Prompt Library</p>
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setCreating(true)
                    setSelected(null)
                  }}
                >
                  <Plus size={14} className="mr-1" />
                  New
                </Button>
                <Button size="sm" variant="ghost" onClick={onOpenManager}>
                  Manage
                </Button>
                <button
                  onClick={onClose}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {creating ? (
              <div className="flex-1 overflow-y-auto p-4">
                <PromptForm
                  onSubmit={handleCreate}
                  onCancel={() => setCreating(false)}
                  submitting={submitting}
                />
              </div>
            ) : selected ? (
              <div className="flex-1 overflow-y-auto p-4">
                <VariableFiller prompt={selected} onClose={() => setSelected(null)} />
              </div>
            ) : (
              <>
                {/* Search + tags */}
                <div className="shrink-0 flex flex-col gap-2 border-b border-border px-4 py-3">
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                    <Input
                      className="pl-8 text-sm"
                      placeholder="Search prompts..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </div>
                  {allTags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {allTags.map((tag) => (
                        <button
                          key={tag}
                          onClick={() =>
                            setSelectedTag(selectedTag === tag ? null : tag)
                          }
                          className={`rounded-full px-2 py-0.5 text-xs transition-colors ${
                            selectedTag === tag
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Prompt list */}
                <div className="flex-1 overflow-y-auto">
                  {loading ? (
                    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                      Loading...
                    </div>
                  ) : filteredPrompts.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center text-sm text-muted-foreground">
                      <p>
                        {search || selectedTag
                          ? 'No prompts match your search.'
                          : 'No prompts yet.'}
                      </p>
                      {!search && !selectedTag && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setCreating(true)}
                        >
                          Create your first prompt
                        </Button>
                      )}
                    </div>
                  ) : (
                    <ul className="divide-y divide-border">
                      {filteredPrompts.map((p) => (
                        <li key={p.id}>
                          <button
                            className="w-full px-4 py-3 text-left hover:bg-muted/50 transition-colors"
                            onClick={() => setSelected(p)}
                          >
                            <p className="truncate text-sm font-medium">{p.title}</p>
                            {p.tags.length > 0 && (
                              <div className="mt-1 flex flex-wrap gap-1">
                                {p.tags.map((t) => (
                                  <span
                                    key={t}
                                    className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            )}
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {p.template}
                            </p>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
