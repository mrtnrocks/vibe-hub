import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useApp } from '../context/AppContext'

export function CrashPlaceholder({ appId }: { appId: string }): React.JSX.Element {
  const { reloadApp } = useApp()

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
        <AlertTriangle className="h-7 w-7 text-destructive" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium text-foreground">This app crashed</p>
        <p className="text-xs text-muted-foreground">Click below to reload it</p>
      </div>
      <button
        onClick={() => reloadApp(appId)}
        className="flex items-center gap-2 rounded-lg bg-card px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border hover:bg-card/80 transition-colors"
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Reload
      </button>
    </div>
  )
}
