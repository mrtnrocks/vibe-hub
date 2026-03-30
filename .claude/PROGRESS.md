# Vibe Hub — Build Progress

## Phase 1: Skeleton & Tooling ✅

- [x] Scaffold project with `electron-vite` (React + TypeScript)
- [x] Configure `tailwind.config.ts` with dark mode (`class` strategy)
- [x] Set up `shadcn/ui` (Button, Input, Dialog, Toast)
- [x] Create `shared/types.ts` — `IpcResult<T>`, `Prompt`, `CatalogApp`, `CustomApp`, `AppSession`, `ViewState`, `ToastPayload`
- [x] Create `shared/constants.ts` — all 17 IPC channel name constants
- [x] Create `electron/preload.ts` — `contextBridge` with typed `window.electronAPI` stubs
- [x] Create `src/lib/ipc.ts` — typed wrapper over `window.electronAPI`
- [x] Verify: `npm run dev` boots Electron, shows React page with Tailwind styling

### Key decisions / notes
- Electron **41.1.0** (latest stable, per spec)
- Tailwind **v3** (class-based config, compatible with shadcn/ui)
- Vite **6.x** + electron-vite **5.x** + @vitejs/plugin-react **4.x** (peer-compatible set)
- Dark theme active by default (`<html class="dark">`)

## Phase 2: Database Layer ✅

- [x] Install `better-sqlite3` + `@types/better-sqlite3` + `@electron/rebuild`
- [x] Create `electron/db/connection.ts` — `initDb(dbPath)`, WAL mode, FK on, runs migration
- [x] Create initial migration (4 tables: prompts, prompt_tags, custom_apps, app_sessions)
- [x] Create `electron/db/queries/prompts.ts` — listPrompts, getPrompt, createPrompt, updatePrompt, deletePrompt
- [x] Create `electron/db/queries/apps.ts` — listCustomApps, getCustomApp, createCustomApp, deleteCustomApp, upsertAppSession, getAppSession, decrementAffiliateSession, setKeepAlive
- [x] Write Vitest tests (35 tests across db-prompts.test.ts and db-apps.test.ts)
- [x] Verify: All 35 tests pass

### Key decisions / notes
- `initDb(dbPath)` accepts `:memory:` for tests — no singleton, db passed as param to all query functions
- `npm run test` rebuilds better-sqlite3 for Node.js (tests), then back to Electron (dev) — both rebuild steps automated in the script
- `vitest.config.ts` created (no prior config existed)

## Phase 3: Core Main Process Services ✅

- [x] Create `resources/default-catalog.json` — 7 starter apps (Bolt.new, v0, Lovable, Replit, Cursor, ChatGPT, Claude)
- [x] Create `electron/services/catalog-sync.ts` — 5s timeout fetch, silent fallback to bundled JSON
- [x] Create `electron/ipc/view-manager.ts` — Map<string, ManagedView>, switchToApp, destroyView, setWindowOpenHandler (shell.openExternal + toast), render-process-gone listener, crash count → toast at 3
- [x] Create `electron/services/sleep-manager.ts` — 30s interval, threshold check, destroys expired non-keepAlive views, sends view:state-changed
- [x] Create `electron/ipc/preferences.ts` — electron-store with defaults (theme, sleepTimerMs, sidebarOrder, lastActiveAppId, globalHotkey, onboardingComplete), prefs:get / prefs:set handlers
- [x] Wire catalog-sync, sleep-manager, preferences, view-manager into main.ts
- [x] Write Vitest tests for sleep-manager.ts (8 tests, mocked timestamps via setNowProvider/setSleepThresholdProvider)
- [x] Verify: All 43 tests pass (35 Phase 2 + 8 new)

### Key decisions / notes
- `setNowProvider` / `setSleepThresholdProvider` injected on `sleep-manager` for testability without Electron
- `electron-store` v11 installed; `getSleepTimerMs()` exported so sleep manager reads live preference
- `view-manager` uses `require('electron').session` inside `switchToApp` to avoid top-level import issues

## Phase 4: IPC Handlers ✅

- [x] Create `electron/ipc/prompts.ts` — `registerPromptHandlers(db)` with handlers for all 5 prompt channels (`prompt:list`, `prompt:get`, `prompt:create`, `prompt:update`, `prompt:delete`), each wrapped in try/catch returning `IpcResult<T>`
- [x] Create `electron/ipc/apps.ts` — `registerAppHandlers(db, win, catalogCache)` with handlers for all 7 app channels
  - `app:get-catalog` — merges catalogCache + custom apps (CustomApp mapped to CatalogApp shape)
  - `app:get-custom` — DB list only
  - `app:add-custom` — prepends `https://` if missing, validates with `new URL()`, creates in DB
  - `app:pin` / `app:unpin` — reads/writes `sidebarOrder` array in electron-store
  - `app:set-keep-alive` — upserts session then sets flag in DB
  - `app:switch` — resolves URL from catalog or custom apps, upserts session, picks affiliateUrl (if remaining > 0) or cleanUrl, calls `switchToApp`, starts/restarts 30s timer to decrement affiliate counter
- [x] Update `electron/main.ts` — capture `db` from `initDb`, await `syncCatalog()`, register prompt + app handlers after `createWindow()`
- [x] Verify: `tsc --noEmit` passes with 0 errors

### Key decisions / notes
- `syncCatalog()` is now awaited in `app.whenReady()` before `createWindow()` — always resolves (5s timeout + bundled fallback), so startup delay is bounded
- Affiliate timers stored in a module-level `Map<string, NodeJS.Timeout>` in `apps.ts`; existing timer is cleared and restarted on each `app:switch` call to the same appId
- `prompt:delete` returns `void` (no `IpcResult`) per spec — errors are logged silently, not surfaced to the renderer

## Phase 5: Sidebar & App Switching UI ✅

- [x] Install `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `framer-motion`
- [x] Create `src/context/AppContext.tsx` — `AppProvider` with state: `activeAppId`, `sidebarOrder`, `viewStates: Map<string, ViewState>`, `theme`, `toastQueue`; loads catalog + custom apps on mount; restores `lastActiveAppId` from prefs; persists sidebar order via `prefs:set`; listens for `view:state-changed` and `view:toast` from main process
- [x] Create `src/hooks/useWebview.ts` — thin hook wrapping `switchApp` from context
- [x] Create `src/components/AppIcon.tsx` — 40×40 rounded button; emoji icon or letter fallback; state overlays: green dot (active), moon icon (sleeping), red triangle (crashed), nothing (background); Framer Motion `whileTap` scale
- [x] Create `src/components/SortableList.tsx` — `@dnd-kit/sortable` vertical list, `PointerSensor` with 5px activation distance, `arrayMove` on drag end, calls `onReorder` callback
- [x] Create `src/components/Sidebar.tsx` — 64px fixed rail; VH logo mark; scrollable sortable icon list (hidden scrollbar via `scrollbar-width: none`); Prompt Library (BookOpen) and Add App (Plus) icon buttons at bottom
- [x] Create `src/components/Toast.tsx` — `ToastContainer` with Framer Motion `AnimatePresence`; 4s auto-dismiss via `setTimeout` in context; optional action button; manual X dismiss
- [x] Create `src/components/CrashPlaceholder.tsx` — centered crash card with AlertTriangle icon and Reload button that calls `reloadApp(appId)`
- [x] Rewrite `src/App.tsx` — `AppProvider` wrapping `MainContent`; Sidebar fixed left (64px); content area fills remaining space; shows `CrashPlaceholder` when active app is crashed; shows empty state with "Browse Apps" CTA when no pinned apps; placeholder dialogs for App Directory (Phase 6) and Prompt Library (Phase 7)
- [x] Verify: `tsc --noEmit` passes with 0 errors

### Key decisions / notes
- `AppContext` loads both catalog and custom apps into a unified `AppEntry[]` shape to avoid duplicating fetch logic in components
- `SortableList` renders children via render-prop `(id) => ReactNode` pattern so the parent (`Sidebar`) controls what each sortable item looks like
- `reloadApp` clears the viewState entry for the appId before calling `app:switch` so the crashed placeholder disappears immediately on click
- Placeholder dialogs for Directory and Prompt Library added in `App.tsx` to keep Phase 5 self-contained without blocking the sidebar from being testable end-to-end

## Phase 6–10: (see spec Section 8) ⬜
