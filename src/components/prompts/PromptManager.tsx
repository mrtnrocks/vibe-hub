import React, { useState } from 'react'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { usePrompts } from '../../hooks/usePrompts'
import { PromptForm } from './PromptForm'
import { VariableFiller } from './VariableFiller'
import type { Prompt } from '../../../shared/types'

interface PromptManagerProps {
  onClose: () => void
}

export function PromptManager({ onClose }: PromptManagerProps): React.JSX.Element {
  const {
    prompts,
    loading,
    allTags,
    search,
    setSearch,
    selectedTag,
    setSelectedTag,
    createPrompt,
    updatePrompt,
    deletePrompt
  } = usePrompts()

  const [editing, setEditing] = useState<Prompt | null>(null)
  const [creating, setCreating] = useState(false)
  const [filling, setFilling] = useState<Prompt | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const filteredPrompts = prompts.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchSearch =
      q === '' ||
      p.title.toLowerCase().includes(q) ||
      p.template.toLowerCase().includes(q)
    const matchTag = !selectedTag || p.tags.includes(selectedTag)
    return matchSearch && matchTag
  })

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

  const handleUpdate = async (data: {
    title: string
    template: string
    defaults: Record<string, string>
    tags: string[]
  }): Promise<void> => {
    if (!editing) return
    setSubmitting(true)
    const result = await updatePrompt({ id: editing.id, ...data })
    setSubmitting(false)
    if (result.ok) setEditing(null)
  }

  const handleDelete = async (id: string): Promise<void> => {
    await deletePrompt(id)
    if (editing?.id === id) setEditing(null)
    if (filling?.id === id) setFilling(null)
  }

  const openFill = (p: Prompt): void => {
    setFilling(p)
    setEditing(null)
    setCreating(false)
  }

  const openEdit = (p: Prompt): void => {
    setEditing(p)
    setFilling(null)
    setCreating(false)
  }

  const openCreate = (): void => {
    setCreating(true)
    setEditing(null)
    setFilling(null)
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative flex h-[85vh] w-[900px] max-w-[95vw] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
          <p className="font-semibold">Prompt Library</p>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={openCreate}>
              <Plus size={14} className="mr-1.5" />
              New Prompt
            </Button>
            <button
              onClick={onClose}
              className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel — list */}
          <div className="flex w-72 shrink-0 flex-col border-r border-border">
            <div className="shrink-0 flex flex-col gap-2 border-b border-border px-3 py-3">
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
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

            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  Loading...
                </div>
              ) : filteredPrompts.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
                  {search || selectedTag ? 'No prompts match.' : 'No prompts yet.'}
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {filteredPrompts.map((p) => {
                    const isActive = editing?.id === p.id || filling?.id === p.id
                    return (
                      <li
                        key={p.id}
                        className={`group flex items-start gap-1 px-3 py-3 hover:bg-muted/50 transition-colors ${
                          isActive ? 'bg-muted/50' : ''
                        }`}
                      >
                        <button
                          className="min-w-0 flex-1 text-left"
                          onClick={() => openFill(p)}
                        >
                          <p className="truncate text-sm font-medium">{p.title}</p>
                          {p.tags.length > 0 && (
                            <div className="mt-0.5 flex flex-wrap gap-1">
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
                        </button>
                        <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              openEdit(p)
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                            title="Edit"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              void handleDelete(p.id)
                            }}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                            title="Delete"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* Right panel */}
          <div className="flex-1 overflow-y-auto p-5">
            {creating ? (
              <PromptForm
                onSubmit={handleCreate}
                onCancel={() => setCreating(false)}
                submitting={submitting}
              />
            ) : editing ? (
              <PromptForm
                initial={editing}
                onSubmit={handleUpdate}
                onCancel={() => setEditing(null)}
                submitting={submitting}
              />
            ) : filling ? (
              <VariableFiller prompt={filling} onClose={() => setFilling(null)} />
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-1 text-center text-sm text-muted-foreground">
                <p>Select a prompt to fill variables and copy,</p>
                <p>or create a new one.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
