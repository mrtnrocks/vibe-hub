import React, { useState } from 'react'
import { AppProvider, useApp } from './context/AppContext'
import { Sidebar } from './components/sidebar/Sidebar'
import { CrashPlaceholder } from './components/shared/CrashPlaceholder'
import { ToastContainer } from './components/shared/Toast'
import { Directory } from './components/directory/Directory'
import { PromptDrawer } from './components/prompts/PromptDrawer'
import { PromptManager } from './components/prompts/PromptManager'
import { Onboarding } from './components/Onboarding'
import { Settings } from './components/Settings'

function MainContent(): React.JSX.Element {
  const { activeAppId, viewStates, pinnedApps, onboardingComplete } = useApp()
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false)
  const [promptManagerOpen, setPromptManagerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const activeViewState = activeAppId ? viewStates.get(activeAppId) : undefined
  const isCrashed = activeViewState === 'crashed'

  return (
    <div className="flex h-screen w-screen bg-background text-foreground overflow-hidden">
      {/* Onboarding overlay — shown on first launch */}
      {!onboardingComplete && <Onboarding />}

      <Sidebar
        onOpenDirectory={() => setDirectoryOpen(true)}
        onOpenPromptLibrary={() => setPromptDrawerOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
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

      <Directory open={directoryOpen} onClose={() => setDirectoryOpen(false)} />

      <Settings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <PromptDrawer
        open={promptDrawerOpen}
        onClose={() => setPromptDrawerOpen(false)}
        onOpenManager={() => {
          setPromptDrawerOpen(false)
          setPromptManagerOpen(true)
        }}
      />

      {promptManagerOpen && (
        <PromptManager onClose={() => setPromptManagerOpen(false)} />
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
