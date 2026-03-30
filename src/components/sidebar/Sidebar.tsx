import { Plus, BookOpen, Settings } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { AppIcon } from './AppIcon'
import { SortableList } from './SortableList'
import { useWebview } from '../../hooks/useWebview'

interface SidebarProps {
  onOpenDirectory: () => void
  onOpenPromptLibrary: () => void
  onOpenSettings: () => void
}

export function Sidebar({ onOpenDirectory, onOpenPromptLibrary, onOpenSettings }: SidebarProps): React.JSX.Element {
  const { pinnedApps, activeAppId, viewStates, sidebarOrder, setSidebarOrder } = useApp()
  const { switchApp } = useWebview()

  return (
    <aside className="flex h-screen w-16 flex-col items-center gap-2 border-r border-border bg-card/50 py-3 backdrop-blur-xl">
      {/* Logo mark */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold select-none">
        VH
      </div>

      <div className="my-1 h-px w-8 bg-border" />

      {/* Pinned apps — sortable */}
      <div
        className="flex flex-1 flex-col items-center gap-2 overflow-y-auto py-1"
        style={{ scrollbarWidth: 'none' }}
      >
        {pinnedApps.length === 0 ? (
          <p className="mt-2 text-[10px] text-muted-foreground text-center leading-tight px-1">
            Pin apps to get started
          </p>
        ) : (
          <SortableList ids={sidebarOrder} onReorder={setSidebarOrder}>
            {(id) => {
              const app = pinnedApps.find((a) => a.id === id)
              if (!app) return null
              return (
                <AppIcon
                  app={app}
                  isActive={activeAppId === app.id}
                  viewState={viewStates.get(app.id)}
                  onClick={() => switchApp(app.id)}
                />
              )
            }}
          </SortableList>
        )}
      </div>

      <div className="my-1 h-px w-8 bg-border" />

      {/* Bottom actions */}
      <div className="flex flex-col items-center gap-2">
        <button
          onClick={onOpenPromptLibrary}
          title="Prompt Library"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          aria-label="Open Prompt Library"
        >
          <BookOpen className="h-5 w-5" />
        </button>
        <button
          onClick={onOpenDirectory}
          title="App Directory"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          aria-label="Open App Directory"
        >
          <Plus className="h-5 w-5" />
        </button>
        <button
          onClick={onOpenSettings}
          title="Settings"
          className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-card hover:text-foreground transition-colors"
          aria-label="Open Settings"
        >
          <Settings className="h-5 w-5" />
        </button>
      </div>
    </aside>
  )
}
