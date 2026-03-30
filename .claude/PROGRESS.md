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

## Phase 4–10: (see spec Section 8) ⬜
