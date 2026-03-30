import { motion } from 'framer-motion'
import { Moon, AlertTriangle } from 'lucide-react'
import { cn } from '../lib/utils'
import type { ViewState } from '../../shared/types'
import type { AppEntry } from '../context/AppContext'

interface AppIconProps {
  app: AppEntry
  isActive: boolean
  viewState: ViewState | undefined
  onClick: () => void
}

function IconAvatar({ app }: { app: AppEntry }): React.JSX.Element {
  if (app.icon) {
    // emoji icon
    return (
      <span className="text-xl leading-none select-none" aria-hidden="true">
        {app.icon}
      </span>
    )
  }
  // letter fallback
  const letter = app.name.charAt(0).toUpperCase()
  return (
    <span className="text-sm font-bold leading-none select-none" aria-hidden="true">
      {letter}
    </span>
  )
}

function StateIndicator({ state }: { state: ViewState | undefined }): React.JSX.Element | null {
  if (!state || state === 'background') return null

  if (state === 'active') {
    return (
      <span className="absolute bottom-0.5 right-0.5 h-2 w-2 rounded-full bg-green-400 ring-1 ring-background" />
    )
  }

  if (state === 'sleeping') {
    return (
      <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-background/80">
        <Moon className="h-2.5 w-2.5 text-muted-foreground" />
      </span>
    )
  }

  if (state === 'crashed') {
    return (
      <span className="absolute bottom-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive/90">
        <AlertTriangle className="h-2.5 w-2.5 text-destructive-foreground" />
      </span>
    )
  }

  return null
}

export function AppIcon({ app, isActive, viewState, onClick }: AppIconProps): React.JSX.Element {
  return (
    <motion.button
      onClick={onClick}
      title={app.name}
      whileTap={{ scale: 0.92 }}
      className={cn(
        'relative flex h-10 w-10 items-center justify-center rounded-xl transition-colors duration-150',
        isActive
          ? 'bg-primary text-primary-foreground shadow-md'
          : 'bg-card/60 text-foreground hover:bg-card hover:text-foreground'
      )}
      aria-label={app.name}
      aria-pressed={isActive}
    >
      <IconAvatar app={app} />
      <StateIndicator state={viewState} />
    </motion.button>
  )
}
