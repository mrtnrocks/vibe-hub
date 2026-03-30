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
- [x] Create `src/components/sidebar/AppIcon.tsx` — 40×40 rounded button; emoji icon or letter fallback; state overlays: green dot (active), moon icon (sleeping), red triangle (crashed), nothing (background); Framer Motion `whileTap` scale
- [x] Create `src/components/sidebar/SortableList.tsx` — `@dnd-kit/sortable` vertical list, `PointerSensor` with 5px activation distance, `arrayMove` on drag end, calls `onReorder` callback
- [x] Create `src/components/sidebar/Sidebar.tsx` — 64px fixed rail; VH logo mark; scrollable sortable icon list (hidden scrollbar via `scrollbar-width: none`); Prompt Library (BookOpen) and Add App (Plus) icon buttons at bottom
- [x] Create `src/components/shared/Toast.tsx` — `ToastContainer` with Framer Motion `AnimatePresence`; 4s auto-dismiss via `setTimeout` in context; optional action button (calls `ipc.invokeAction(channel)`); manual X dismiss
- [x] Create `src/components/shared/CrashPlaceholder.tsx` — centered crash card with AlertTriangle icon and Reload button that calls `reloadApp(appId)`
- [x] Create `src/App.tsx` — `AppProvider` wrapping `MainContent`; Sidebar fixed left (64px); content area fills remaining space; shows `CrashPlaceholder` when active app is crashed; shows empty state with "Browse Apps" CTA when no pinned apps; placeholder dialogs for App Directory (Phase 6) and Prompt Library (Phase 7)
- [x] Add `invokeAction(channel)` to `electron/preload.ts` — generic `ipcRenderer.invoke` for toast action buttons (e.g., updater restart)
- [x] Verify: `tsc --noEmit` passes with 0 errors; `electron-vite build` succeeds with 0 errors

### Key decisions / notes
- Components placed in `src/components/sidebar/` and `src/components/shared/` per spec — not flat in `src/components/`
- `AppContext` loads both catalog and custom apps into a unified `AppEntry[]` shape to avoid duplicating fetch logic in components
- `SortableList` renders children via render-prop `(id) => ReactNode` pattern so the parent (`Sidebar`) controls what each sortable item looks like
- `reloadApp` clears the viewState entry for the appId before calling `app:switch` so the crashed placeholder disappears immediately on click
- Toast action was previously incorrectly calling `ipc.appSwitch(ipcChannel)` — fixed by adding `invokeAction` to the preload API; toast action buttons now invoke arbitrary IPC channels (only safe because main process only handles registered channels)
- Placeholder dialogs for Directory and Prompt Library in `App.tsx` keep Phase 5 self-contained without blocking the sidebar from being testable end-to-end

## Phase 6: App Directory ✅

- [x] Create `src/hooks/useApps.ts` — fetches full CatalogApp+CustomApp data via IPC; exposes `isPinned`, `pin`, `unpin`, `addCustomApp`, `allTags`; reloads context after mutations
- [x] Create `src/components/directory/TagFilter.tsx` — horizontal scrollable tag bar, multi-select toggle
- [x] Create `src/components/directory/AppCard.tsx` — icon, name, description, tag chips, "Custom" badge for user-added apps, Pin/Unpin button
- [x] Create `src/components/directory/Directory.tsx` — 80vh modal; search input + TagFilter; 2-3 col responsive grid of AppCards; "Add Custom App" button opens form dialog
- [x] Custom app form: name (required), URL (required, inline validation with red border + error text, auto-prepend `https://`), tags (optional, comma-separated)
- [x] Update `src/App.tsx` — replace Phase 5 placeholder dialog with real `<Directory>` component
- [x] Verify: `tsc --noEmit` 0 errors; `electron-vite build` succeeds

### Key decisions / notes
- `useApps` fetches both `app:get-catalog` and `app:get-custom` so it can mark each entry with `isCustom` (the catalog endpoint merges custom apps but doesn't flag them)
- `pin`/`unpin` call IPC then `loadApps()` from context to keep `sidebarOrder` in sync with electron-store
- URL validation runs on blur and on every keystroke after first blur attempt; `https://` is prepended before validation and before saving if protocol is missing
- Directory renders as a custom overlay (not a shadcn Dialog) so the inner "Add Custom App" Dialog portal stacks above it cleanly at z-50

## Phase 7: Prompt Library ✅

- [x] Create `src/lib/variables.ts` — `parseVariables(template)` extracts unique `{{var}}` names in order; `interpolate(template, values)` replaces placeholders, leaving unmatched ones intact
- [x] Write `tests/unit/variables.test.ts` — 23 tests covering: empty strings, single/multiple variables, deduplication, whitespace trimming, adjacent placeholders, `$`-in-values, multiline templates, missing values, no-placeholder passthrough
- [x] Create `src/hooks/usePrompts.ts` — CRUD hook with local cache; `search` + `selectedTag` filters drive `ipc.promptList`; optimistic cache updates on create/update/delete
- [x] Create `src/components/prompts/VariableFiller.tsx` — dynamic form (one Input per `{{variable}}`), pre-filled from `prompt.defaults`, live interpolation preview, "Copy" writes result to clipboard with 2s "Copied!" feedback
- [x] Create `src/components/prompts/PromptForm.tsx` — create/edit form with title, monospace template textarea, auto-detected variable defaults section (synced via `useEffect` on template change), live preview with defaults applied, tags input
- [x] Create `src/components/prompts/PromptDrawer.tsx` — Framer Motion spring slide-out from right edge; search bar + tag filter chips; prompt list → click to open VariableFiller; inline create flow; "Manage" button hands off to PromptManager
- [x] Create `src/components/prompts/PromptManager.tsx` — full-page modal, two-panel layout: 72-unit left list with search/tag filter + hover edit/delete actions; right panel renders PromptForm or VariableFiller based on selection
- [x] Update `src/App.tsx` — replace Phase 5 placeholder with `<PromptDrawer>` (opened by sidebar BookOpen button) + `<PromptManager>` (opened via "Manage" from drawer)
- [x] Verify: All 23 new tests pass (66 total); `tsc --noEmit` 0 errors

### Key decisions / notes
- `parseVariables` uses `[^{}]+` in the regex — cannot match `{` or `}`, so strictly `{{name}}` only; `{{{x}}}` resolves to `x` because `{{x}}` matches at offset 1 (documented in test)
- `interpolate` uses `String.prototype.replace` with a function callback (not a replacement string) so `$` characters in values are passed through literally
- `usePrompts` does server-side filtering via `ipc.promptList` for tag/search — list rerenders when either filter changes via `useCallback` dependency
- `PromptDrawer` and `PromptManager` each instantiate their own `usePrompts` — no shared state needed since both are not open simultaneously
- `PromptForm` `useEffect` on `template` keeps `defaults` keys in sync: new vars get empty default, removed vars are dropped, existing values are preserved

## Phase 8: Polish Layer ✅

- [x] Install `electron-updater`
- [x] Add `IPC_SHORTCUTS_NAVIGATE = 'shortcuts:navigate'` to `shared/constants.ts` (Main → Renderer)
- [x] Create `electron/services/shortcuts.ts`
  - `attachLocalShortcuts(webContents, win)` — `before-input-event` interceptor for Ctrl+1-9 (switch to sidebar position by 0-based index) and Ctrl+[ / ] (cycle prev/next); sends `shortcuts:navigate` to renderer
  - `registerShortcutsIpc(win)` — `shortcuts:set-global` IPC handler; unregisters previous hotkey, registers new one via `globalShortcut`, saves to prefs; returns `{ success: false }` (not an error) if accelerator is already claimed by another app
  - `restoreGlobalHotkey(win)` — re-registers saved hotkey from prefs on startup
  - `unregisterAllGlobalShortcuts()` — called on `before-quit`
- [x] Create `electron/services/tray.ts`
  - `initTray(win)` — creates `Tray` with optional icon (`resources/tray.png`, gracefully falls back to `nativeImage.createEmpty()`), tooltip "Vibe Hub", right-click context menu (Show / Quit), single-click to show/focus
  - Window `close` event is overridden to `win.hide()` unless `isQuitting` flag is set
  - `app.before-quit` sets `isQuitting = true` so the final quit flows through
  - `destroyTray()` — called on `before-quit`
- [x] Create `electron/services/updater.ts`
  - Guards on `process.windowsStore` — skips `autoUpdater` initialization for Store installs; `IPC_UPDATER_RESTART` handler is always registered so the toast action button works regardless
  - On `update-downloaded` → sends toast with message and **Restart** action button (`IPC_UPDATER_RESTART` channel)
  - `autoUpdater.checkForUpdatesAndNotify()` errors caught silently
- [x] Update `electron/ipc/view-manager.ts` — call `attachLocalShortcuts(view.webContents, win)` when creating each `WebContentsView`, so Ctrl+1-9 works even when an embedded browser has keyboard focus
- [x] Update `electron/main.ts` — import and wire tray, shortcuts (renderer webContents + IPC handler + hotkey restore), and updater
- [x] Update `electron/preload.ts` — add `onShortcutNavigate` listener exposing `shortcuts:navigate` events to the renderer
- [x] Update `src/context/AppContext.tsx`
  - `applyTheme(theme)` — adds/removes `.dark` class on `document.documentElement`; system mode uses `window.matchMedia('(prefers-color-scheme: dark)')` with a live `change` listener
  - `setTheme` now calls `applyTheme` immediately on change
  - Theme applied on mount after loading saved pref
  - Exposes `onboardingComplete` / `setOnboardingComplete` (reads/writes `onboardingComplete` pref)
  - Listens to `shortcuts:navigate` events: resolves target appId from `sidebarOrder` + `activeAppId`, then calls `ipc.appSwitch` asynchronously
- [x] Create `src/components/Onboarding.tsx`
  - Full-screen `z-50` overlay with Framer Motion fade-in; shown when `onboardingComplete === false`
  - VH logo mark, headline, subhead
  - `HotkeyRecorder` — focusable div that captures `onKeyDown`, builds Ctrl/Alt/Shift+Key string, requires at least 2 parts (modifier + key)
  - **Get Started** button — calls `ipc.shortcutsSetGlobal(hotkey)` if a hotkey was entered, then `setOnboardingComplete(true)`
- [x] Create `src/components/Settings.tsx`
  - Radix UI Dialog modal
  - **Theme** — three-button toggle (System / Light / Dark), calls `setTheme` from context
  - **Sleep timer** — `<select>` with options: 1 min / 5 min / 15 min / 30 min / Never (`Number.MAX_SAFE_INTEGER`); persists via `prefs:set`
  - **Global shortcut** — reuses `HotkeyRecorder`; calls `ipc.shortcutsSetGlobal` on change, shows "Saved" / "Already in use" inline feedback; Clear button unregisters and clears pref
  - Loads current pref values when dialog opens
- [x] Update `src/components/sidebar/Sidebar.tsx` — add Settings (gear) icon button at bottom, wired via new `onOpenSettings` prop
- [x] Update `src/App.tsx` — mount `<Onboarding>` overlay and `<Settings>` dialog; pass `onOpenSettings` to Sidebar
- [x] Verify: `tsc --noEmit` 0 errors; `electron-vite build` succeeds (main 26 kB, preload 3.4 kB, renderer 1.2 MB)

### Key decisions / notes
- Global hotkey registration failure returns `{ ok: true, data: { success: false } }` — not an error — so the renderer can show "already in use" feedback without treating it as a crash
- Tray icon is loaded from `resources/tray.png` at runtime; if absent, `nativeImage.createEmpty()` is used as a no-crash fallback (tray will appear blank on Windows — replace with a real 16×16 PNG before shipping)
- `IPC_UPDATER_RESTART` handler is registered unconditionally; only the `autoUpdater` listener is skipped for Store installs — this way the existing Toast action button infrastructure keeps working
- `attachLocalShortcuts` is called on both the renderer webContents (for when no WebContentsView is active) and on each new `WebContentsView` (for when an embedded browser has focus)
- `applyTheme` is a plain function (not a hook) so it can be called at module init time from outside React
- Onboarding default state is `true` (complete) to avoid flash; it's set to `false` only after the pref is loaded from the main process — new installs default to `false` in `AppPreferences`

## Phase 9: Packaging & Store Submission ✅

- [x] Create `resources/appx/` with placeholder transparent-background Store assets:
  - `StoreLogo.png` (50×50)
  - `Square44x44Logo.png` (44×44)
  - `Square150x150Logo.png` (150×150)
  - `Wide310x150Logo.png` (310×150)
  - Generated via `scripts/generate-store-assets.mjs` (pure Node.js, no external deps)
- [x] Create `electron-builder.yml`:
  - `appId: com.vibehub.app`, `productName: Vibe Hub`
  - `win.target`: both `appx` (x64) and `nsis` (x64)
  - `appx` block with placeholder Partner Center values (`identityName`, `publisher`, `publisherDisplayName`, `applicationId`, `displayName`, `backgroundColor`)
  - `nsis` block: non-one-click, per-user install, desktop + Start Menu shortcuts
  - `publish` block: GitHub Releases provider (`mrtnrocks/vibe-hub`) for sideloaded NSIS auto-update
- [x] Install `electron-builder` v26.8.1 (devDependency)
- [x] Add build scripts to `package.json`: `pack:appx`, `pack:nsis`, `pack:all`
- [x] Verify: `electron-builder --version` returns 26.8.1; dry-run exits 0

### Key decisions / notes
- Placeholder PNGs are pure transparent pixels — replace with real branded assets before Store submission
- `win.icon` is commented out until `resources/icon.ico` exists (electron-builder will error if the path is set but the file is absent); add 256×256 multi-res ICO and uncomment before building
- `identityName`, `publisher`, `publisherDisplayName` are all `PLACEHOLDER` — fill in from Microsoft Partner Center → App management → App identity before running `pack:appx`
- Store installs are detected via `process.windowsStore === true`; `electron-updater` is already guarded in Phase 8's `updater.ts` — no changes needed here
- To publish a signed NSIS release: `GH_TOKEN=<token> npx electron-builder --win nsis --publish always`  
  
### Before building  
  resources/appx/ — 4 placeholder transparent PNGs:               
  - StoreLogo.png (50×50)                                         
  - Square44x44Logo.png (44×44)                                   
  - Square150x150Logo.png (150×150)                               
  - Wide310x150Logo.png (310×150)                                 
                                                                  
  electron-builder.yml — fully configured with:
  - appx target (x64) with placeholder Partner Center identity
  values
  - nsis target (x64) with standard one-click-off installer
  options
  - GitHub Releases publish config for NSIS auto-update
  - buildResources: resources so appx assets are picked up
  automatically

  package.json — 3 new scripts added:
  - pack:appx — builds then packages appx only
  - pack:nsis — builds then packages NSIS only
  - pack:all — builds then packages both

  electron-builder v26.8.1 installed as a devDependency.

  Before running a real build, you need to:
  1. Put your real resources/icon.ico and uncomment the icon: line
   in the yml
  2. Replace the 3 PLACEHOLDER values in electron-builder.yml with
   your actual Partner Center identity values
  3. Replace the transparent PNGs in resources/appx/ with branded
  assets before Store submission  


## Phase 10: Integration Testing & Bug Fixing ⬜
