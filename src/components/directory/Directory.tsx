import React, { useState } from 'react'
import { X } from 'lucide-react'
import { useApps } from '../../hooks/useApps'
import { TagFilter } from './TagFilter'
import { AppCard } from './AppCard'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '../ui/dialog'

interface DirectoryProps {
  open: boolean
  onClose: () => void
}

export function Directory({ open, onClose }: DirectoryProps): React.JSX.Element | null {
  const { apps, loading, allTags, isPinned, pin, unpin, addCustomApp } = useApps()
  const [search, setSearch] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [addOpen, setAddOpen] = useState(false)

  // Custom app form state
  const [formName, setFormName] = useState('')
  const [formUrl, setFormUrl] = useState('')
  const [formTags, setFormTags] = useState('')
  const [formUrlError, setFormUrlError] = useState('')
  const [formSubmitting, setFormSubmitting] = useState(false)

  if (!open) return null

  const toggleTag = (tag: string): void => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const filteredApps = apps.filter((app) => {
    const q = search.trim().toLowerCase()
    const matchesSearch =
      q === '' ||
      app.name.toLowerCase().includes(q) ||
      app.description.toLowerCase().includes(q)
    const matchesTags =
      selectedTags.length === 0 || selectedTags.every((t) => app.tags.includes(t))
    return matchesSearch && matchesTags
  })

  const validateUrl = (url: string): string => {
    const toTest = /^https?:\/\//i.test(url) ? url : `https://${url}`
    try {
      new URL(toTest)
      return ''
    } catch {
      return 'Please enter a valid URL'
    }
  }

  const handleUrlBlur = (): void => {
    if (formUrl) setFormUrlError(validateUrl(formUrl))
  }

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormUrl(e.target.value)
    if (formUrlError) setFormUrlError(validateUrl(e.target.value))
  }

  const handleAddSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const urlError = validateUrl(formUrl)
    if (urlError) {
      setFormUrlError(urlError)
      return
    }
    setFormSubmitting(true)
    const normalizedUrl = /^https?:\/\//i.test(formUrl) ? formUrl : `https://${formUrl}`
    const tags = formTags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const result = await addCustomApp({ name: formName.trim(), url: normalizedUrl, tags })
    setFormSubmitting(false)
    if (result.ok) {
      setAddOpen(false)
      setFormName('')
      setFormUrl('')
      setFormTags('')
      setFormUrlError('')
    } else {
      setFormUrlError(result.error ?? 'Failed to add app')
    }
  }

  const handleCloseAdd = (): void => {
    setAddOpen(false)
    setFormName('')
    setFormUrl('')
    setFormTags('')
    setFormUrlError('')
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <div
          className="relative flex h-[80vh] w-[720px] max-w-[95vw] flex-col rounded-xl border border-border bg-card shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4">
            <p className="font-semibold">App Directory</p>
            <div className="flex items-center gap-2">
              <Button size="sm" onClick={() => setAddOpen(true)}>
                Add Custom App
              </Button>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Search + Tag filter */}
          <div className="shrink-0 flex flex-col gap-3 border-b border-border px-5 py-3">
            <Input
              placeholder="Search apps..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {allTags.length > 0 && (
              <TagFilter tags={allTags} selected={selectedTags} onToggle={toggleTag} />
            )}
          </div>

          {/* Grid */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : filteredApps.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No apps found
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                {filteredApps.map((app) => (
                  <AppCard
                    key={app.id}
                    app={app}
                    pinned={isPinned(app.id)}
                    onPin={() => void pin(app.id)}
                    onUnpin={() => void unpin(app.id)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Custom App dialog — renders in a portal, independent of overlay */}
      <Dialog open={addOpen} onOpenChange={(open) => !open && handleCloseAdd()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom App</DialogTitle>
          </DialogHeader>
          <form onSubmit={(e) => void handleAddSubmit(e)} className="flex flex-col gap-4 pt-1">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                required
                placeholder="My App"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">URL</label>
              <Input
                required
                placeholder="https://example.com"
                value={formUrl}
                onChange={handleUrlChange}
                onBlur={handleUrlBlur}
                className={formUrlError ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
              {formUrlError && <p className="text-xs text-destructive">{formUrlError}</p>}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">
                Tags{' '}
                <span className="font-normal text-muted-foreground">(optional, comma-separated)</span>
              </label>
              <Input
                placeholder="ai, builder, code"
                value={formTags}
                onChange={(e) => setFormTags(e.target.value)}
              />
            </div>
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleCloseAdd}>
                Cancel
              </Button>
              <Button type="submit" disabled={formSubmitting || !formName.trim() || !formUrl.trim()}>
                {formSubmitting ? 'Adding...' : 'Add App'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
