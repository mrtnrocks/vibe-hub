import React from 'react'
import { cn } from '@/lib/utils'
import type { DirectoryApp } from '../../hooks/useApps'

interface AppCardProps {
  app: DirectoryApp
  pinned: boolean
  onPin: () => void
  onUnpin: () => void
}

export function AppCard({ app, pinned, onPin, onUnpin }: AppCardProps): React.JSX.Element {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
          {app.icon ? app.icon : app.name[0]}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="truncate font-medium text-sm">{app.name}</p>
            {app.isCustom && (
              <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">
                Custom
              </span>
            )}
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {app.description || app.cleanUrl}
          </p>
        </div>
      </div>

      {app.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {app.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <button
        onClick={pinned ? onUnpin : onPin}
        className={cn(
          'mt-auto rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
          pinned
            ? 'bg-muted text-muted-foreground hover:bg-destructive/10 hover:text-destructive'
            : 'bg-primary text-primary-foreground hover:bg-primary/90'
        )}
      >
        {pinned ? 'Unpin' : 'Pin to Sidebar'}
      </button>
    </div>
  )
}
