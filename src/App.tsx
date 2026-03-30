function App(): React.JSX.Element {
  return (
    <div className="flex h-screen w-screen bg-background text-foreground">
      {/* Sidebar placeholder */}
      <aside className="flex w-16 flex-col items-center gap-2 border-r border-border bg-card/50 py-4 backdrop-blur-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground text-sm font-bold">
          VH
        </div>
      </aside>

      {/* Main content area */}
      <main className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight">Vibe Hub</h1>
          <p className="text-muted-foreground text-lg">
            Your AI builder command center
          </p>
          <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm text-muted-foreground backdrop-blur-sm">
            Phase 1 — Skeleton &amp; Tooling
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
