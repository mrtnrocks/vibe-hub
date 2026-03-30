import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/Sidebar'
import { CrashPlaceholder } from './components/CrashPlaceholder'
import { ToastContainer } from './components/Toast'

function MainContent(): React.JSX.Element {
  const { activeAppId, viewStates, pinnedApps } = useApp()
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false)

  const activeViewState = activeAppId ? viewStates.get(activeAppId) : undefined
  const isCrashed = activeViewState === 'crashed'

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      <Sidebar
        onOpenDirectory={() => setDirectoryOpen(true)}
        onOpenPromptLibrary={() => setPromptLibraryOpen(true)}
      />

      {/* Content area — WebContentsView is injected here by the main process */}
      <main className="relative flex flex-1 overflow-hidden">
        {isCrashed && activeAppId ? (
          <CrashPlaceholder appId={activeAppId} />
        ) : !activeAppId || pinnedApps.length === 0 ? (
          <div className="flex h-full w-full flex-col items-center justify-center gap-3 text-center">
            <p className="text-2xl font-semibold tracking-tight">Vibe Hub</p>
            <p className="text-sm text-muted-foreground">
              Pin an app from the directory to get started
            </p>
            <button
              onClick={() => setDirectoryOpen(true)}
              className="mt-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Browse Apps
            </button>
          </div>
        ) : null}
      </main>

      <ToastContainer />

      {/* Placeholder dialogs — implemented in later phases */}
      {directoryOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setDirectoryOpen(false)}
        >
          <div
            className="rounded-xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold">App Directory</p>
            <p className="mt-1 text-sm text-muted-foreground">Coming in Phase 6</p>
            <button
              className="mt-4 text-sm text-primary hover:underline"
              onClick={() => setDirectoryOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {promptLibraryOpen && (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setPromptLibraryOpen(false)}
        >
          <div
            className="rounded-xl border border-border bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-semibold">Prompt Library</p>
            <p className="mt-1 text-sm text-muted-foreground">Coming in Phase 7</p>
            <button
              className="mt-4 text-sm text-primary hover:underline"
              onClick={() => setPromptLibraryOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function App(): React.JSX.Element {
  return (
    <AppProvider>
      <MainContent />
    </AppProvider>
  )
}

export default App
