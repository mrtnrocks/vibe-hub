import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { parseVariables, interpolate } from '../../lib/variables'
import type { Prompt } from '../../../shared/types'

interface VariableFillerProps {
  prompt: Prompt
  onClose?: () => void
}

export function VariableFiller({ prompt, onClose }: VariableFillerProps): React.JSX.Element {
  const variables = parseVariables(prompt.template)
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const v of variables) init[v] = prompt.defaults[v] ?? ''
    return init
  })
  const [copied, setCopied] = useState(false)

  const preview = interpolate(prompt.template, values)

  const handleCopy = async (): Promise<void> => {
    await navigator.clipboard.writeText(preview)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-semibold">{prompt.title}</p>
        {prompt.tags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {prompt.tags.map((t) => (
              <span
                key={t}
                className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      {variables.length > 0 && (
        <div className="flex flex-col gap-3">
          {variables.map((v) => (
            <div key={v} className="flex flex-col gap-1">
              <label className="text-sm font-medium">{v}</label>
              <Input
                value={values[v] ?? ''}
                placeholder={prompt.defaults[v] || v}
                onChange={(e) =>
                  setValues((prev) => ({ ...prev, [v]: e.target.value }))
                }
              />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-md border border-border bg-muted/40 p-3">
        <p className="mb-1 text-xs font-medium text-muted-foreground">Preview</p>
        <pre className="whitespace-pre-wrap break-words font-mono text-sm">{preview}</pre>
      </div>

      <div className="flex justify-end gap-2">
        {onClose && (
          <Button variant="outline" size="sm" onClick={onClose}>
            Back
          </Button>
        )}
        <Button size="sm" onClick={() => void handleCopy()}>
          {copied ? (
            <Check size={14} className="mr-1.5" />
          ) : (
            <Copy size={14} className="mr-1.5" />
          )}
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
    </div>
  )
}
