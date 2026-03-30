import React, { useEffect, useState } from 'react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { parseVariables, interpolate } from '../../lib/variables'
import type { Prompt } from '../../../shared/types'

interface PromptFormProps {
  initial?: Prompt
  onSubmit: (data: {
    title: string
    template: string
    defaults: Record<string, string>
    tags: string[]
  }) => Promise<void>
  onCancel: () => void
  submitting?: boolean
}

export function PromptForm({
  initial,
  onSubmit,
  onCancel,
  submitting
}: PromptFormProps): React.JSX.Element {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [template, setTemplate] = useState(initial?.template ?? '')
  const [tagsStr, setTagsStr] = useState(initial?.tags.join(', ') ?? '')
  const [defaults, setDefaults] = useState<Record<string, string>>(initial?.defaults ?? {})

  const variables = parseVariables(template)

  // Keep defaults in sync with detected variables
  useEffect(() => {
    setDefaults((prev) => {
      const next: Record<string, string> = {}
      for (const v of variables) next[v] = prev[v] ?? ''
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template])

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const tags = tagsStr
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    await onSubmit({ title: title.trim(), template, defaults, tags })
  }

  const livePreview = interpolate(template, defaults)

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Title</label>
        <Input
          required
          placeholder="My Prompt"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">Template</label>
        <textarea
          required
          rows={6}
          placeholder={`Write your prompt here.\nUse {{variable}} for dynamic placeholders.`}
          value={template}
          onChange={(e) => setTemplate(e.target.value)}
          className="rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm shadow-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
        />
      </div>

      {variables.length > 0 && (
        <>
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              Default Values{' '}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </p>
            {variables.map((v) => (
              <div key={v} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate font-mono text-xs text-muted-foreground">{`{{${v}}}`}</span>
                <Input
                  placeholder={`default for ${v}`}
                  value={defaults[v] ?? ''}
                  onChange={(e) =>
                    setDefaults((prev) => ({ ...prev, [v]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>

          <div className="rounded-md border border-border bg-muted/40 p-3">
            <p className="mb-1 text-xs font-medium text-muted-foreground">
              Live Preview (with defaults)
            </p>
            <pre className="whitespace-pre-wrap break-words font-mono text-sm">{livePreview}</pre>
          </div>
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">
          Tags{' '}
          <span className="font-normal text-muted-foreground">(comma-separated, optional)</span>
        </label>
        <Input
          placeholder="coding, writing, ..."
          value={tagsStr}
          onChange={(e) => setTagsStr(e.target.value)}
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={submitting || !title.trim() || !template.trim()}
        >
          {submitting ? 'Saving...' : initial ? 'Save Changes' : 'Create Prompt'}
        </Button>
      </div>
    </form>
  )
}
