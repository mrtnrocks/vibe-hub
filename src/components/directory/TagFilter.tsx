import React from 'react'
import { cn } from '@/lib/utils'

interface TagFilterProps {
  tags: string[]
  selected: string[]
  onToggle: (tag: string) => void
}

export function TagFilter({ tags, selected, onToggle }: TagFilterProps): React.JSX.Element {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {tags.map((tag) => (
        <button
          key={tag}
          onClick={() => onToggle(tag)}
          className={cn(
            'shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors',
            selected.includes(tag)
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/70'
          )}
        >
          {tag}
        </button>
      ))}
    </div>
  )
}
