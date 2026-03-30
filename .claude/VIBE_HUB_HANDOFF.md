# Vibe Hub — Claude Code Handoff Cheat Sheet

Copy-paste these prompts into Claude Code one phase at a time. Wait for each phase to be complete and verified before starting the next.

**Setup:** Add `VIBE_HUB_V1_SPEC_v3.md` and `CLAUDE.md` to your Claude Code project context so they're always available.

---

## Phase 1: Skeleton & Tooling

```
Read CLAUDE.md and VIBE_HUB_V1_SPEC_v3.md. Implement Phase 1: Skeleton & Tooling.

Scaffold the project with electron-vite (React + TypeScript template). Set up Tailwind with dark mode (class strategy) and shadcn/ui. Create shared/types.ts with all interfaces from the spec (IpcResult<T>, Prompt, CatalogApp, CustomApp, AppSession, ViewState, ToastPayload). Create shared/constants.ts with all IPC channel names. Stub out the preload.ts contextBridge and src/lib/ipc.ts typed wrapper.

Verify: npm run dev boots Electron and shows a React page with Tailwind styling.
```

---

## Phase 2: Database Layer

```
Phases 1 is complete. Implement Phase 2: Database Layer.

Install better-sqlite3. Create electron/db/connection.ts that initializes SQLite at app.getPath('userData')/vibe-hub.db. Create the initial migration with all 4 tables (prompts, prompt_tags, custom_apps, app_sessions) matching the schemas in the spec exactly. Create electron/db/queries/prompts.ts and electron/db/queries/apps.ts with all CRUD functions. All DB writes must be wrapped in try/catch.

Write Vitest tests for every query function using an in-memory SQLite instance. Verify: all tests pass.
```

---

## Phase 3: Core Main Process Services

```
Phases 1-2 are complete. Implement Phase 3: Core Main Process Services.

Create catalog-sync.ts (fetch remote JSON with 5s timeout, fallback to bundled default-catalog.json). Create default-catalog.json with starter apps: Bolt.new, v0, Lovable, Replit, Cursor, ChatGPT, Claude.

Create view-manager.ts — maintains Map<string, ManagedView>, handles switchToApp (creates WebContentsView with partition persist:${appId}), destroyView, setWindowOpenHandler (shell.openExternal), render-process-gone listener, crash count tracking (toast after 3).

Create sleep-manager.ts — 30-second interval, checks lastActive against threshold, destroys expired views, sends view:state-changed to renderer.

Create preferences.ts — electron-store handlers with defaults from the spec. Wire everything in main.ts. Write Vitest tests for sleep-manager.ts with mocked timestamps.
```

---

## Phase 4: IPC Handlers (Prompts & Apps)

```
Phases 1-3 are complete. Implement Phase 4: IPC Handlers.

Create electron/ipc/prompts.ts — handlers for prompt:list, prompt:get, prompt:create, prompt:update, prompt:delete. Each wraps DB calls in try/catch and returns IpcResult<T>.

Create electron/ipc/apps.ts — handlers for app:get-catalog (merge remote + custom), app:get-custom, app:add-custom (validate URL with new URL(), prepend https:// if missing), app:pin, app:unpin, app:set-keep-alive.

Wire affiliate logic into app:switch: look up app_sessions, decide affiliateUrl vs cleanUrl, start 30s timer, decrement counter on completion.

Register all handlers in main.ts. Verify: IPC channels respond correctly when called from renderer dev tools console.
```

---

## Phase 5: Sidebar & App Switching UI

```
Phases 1-4 are complete. Implement Phase 5: Sidebar & App Switching UI.

Create AppContext.tsx with state for activeAppId, sidebarOrder, viewStates map, theme, toastQueue. Create AppIcon.tsx (icon + state overlay: green dot, moon, crash icon, or none). Create SortableList.tsx with @dnd-kit/sortable for drag reorder. Create Sidebar.tsx — scrollable icon rail (overflow-y: auto, hidden scrollbar), "+" button for directory, prompt library icon.

Create useWebview.ts hook — switchApp sends app:switch IPC, listens for view:state-changed. Create Toast.tsx — non-blocking, 4-second auto-dismiss, optional action button. Create CrashPlaceholder.tsx — inline "app crashed, click to reload" view.

Create App.tsx layout: Sidebar fixed left (~64px), content area fills remaining space. Verify: can pin apps, see them in sidebar, click to switch, see state indicators, drag to reorder.
```

---

## Phase 6: App Directory

```
Phases 1-5 are complete. Implement Phase 6: App Directory.

Create useApps.ts hook — fetches catalog, manages pinning, handles custom app adding. Create TagFilter.tsx — horizontal tag bar with multi-select. Create AppCard.tsx — icon, name, description, tags, Pin/Unpin button, "Custom" badge for user-added apps. Create Directory.tsx — grid layout, tag filter at top, search input, "Add Custom App" button that opens a form dialog.

Custom app form: name, URL, optional tags. Inline URL validation (red border + error text). Auto-prepend https:// if protocol missing.

Verify: can browse catalog, filter by tags, search by name, pin apps (appear in sidebar), add a custom URL.
```

---

## Phase 7: Prompt Library

```
Phases 1-6 are complete. Implement Phase 7: Prompt Library.

Create src/lib/variables.ts — parseVariables(template) extracts {{var}} names, interpolate(template, values) replaces them. Write Vitest tests for both functions including edge cases (nested braces, empty strings, missing values).

Create usePrompts.ts hook — CRUD via IPC with local cache. Create VariableFiller.tsx — dynamic form with one input per {{variable}}, pre-filled defaults, "Copy" button writes interpolated string to clipboard. Create PromptForm.tsx — create/edit with title, template (monospace textarea), tags, live variable preview. Create PromptDrawer.tsx — Framer Motion slide-out panel, search bar, prompt list, click to fill. Create PromptManager.tsx — full-page view for bulk management.

Verify: can create prompts, fill variables, copy interpolated text, search/filter by tags.
```

---

## Phase 8: Keyboard Shortcuts, Tray, Onboarding & Theming

```
Phases 1-7 are complete. Implement Phase 8: Polish layer.

Create shortcuts.ts — globalShortcut for user hotkey, Ctrl+1-9 for sidebar position, Ctrl+[/] for cycling. Handle registration failures gracefully.

Set up tray in main.ts — Tray with icon, right-click menu ("Show Vibe Hub", "Quit"), window close hides to tray.

Create Onboarding.tsx — full-screen overlay (only if onboardingComplete === false), logo, hotkey recorder input, "Get Started" button that saves hotkey and navigates to Directory.

Create Settings.tsx — theme selector (System/Light/Dark), sleep timer dropdown, hotkey recorder. Implement theming in AppContext (dark class on <html>, system mode via matchMedia).

Create updater.ts — guard on process.windowsStore, only activate electron-updater for sideloaded installs, toast on update-downloaded.

Verify: global hotkey works, tray works, onboarding flow completes, theme switches apply, keyboard shortcuts navigate sidebar.
```

---

## Phase 9: Packaging & Store Submission

```
Phases 1-8 are complete. Implement Phase 9: Packaging & Store Submission.

Create resources/appx/ with placeholder Store assets (StoreLogo 50x50, Square44x44Logo, Square150x150Logo, Wide310x150Logo — transparent backgrounds).

Configure electron-builder.yml:
- appx target with identity values from Microsoft Partner Center
- win.target includes both appx (Store) and nsis (sideload)
- electron-updater publish config for sideloaded NSIS builds

Build and test:
- npx electron-builder --win appx → test with Add-AppxPackage
- npx electron-builder --win nsis → test on clean machine/VM

Note: actual Partner Center identity values and Store upload are manual steps I'll handle.
```

---

## Phase 10: Integration Testing

```
Phases 1-9 are complete. Final pass: Phase 10 Integration Testing.

Test these flows end-to-end and fix any bugs:
1. First launch → onboarding → set hotkey → browse directory → pin 3 apps → switch between them
2. Sleep/wake: wait for sleep timer, verify sidebar shows sleeping state, click to wake, verify login state preserved
3. Crash recovery: force-crash a webview, verify placeholder shows, click to reload
4. Prompt lifecycle: create with variables → fill → copy → edit → delete
5. Custom app: add URL → validates → appears in directory → pin → loads
6. Affiliate: open app 3 times for 30+ seconds → verify URL switches to clean
7. Edge cases: 20+ pinned apps (sidebar scrolls), malformed URL (rejected), popup (opens external browser)
8. Store detection: verify process.windowsStore check, confirm updater skips for Store installs

Final cleanup: remove console.logs, verify error handling paths, check for memory leaks (views not destroyed on sleep).
```

---

## Troubleshooting Tips

**better-sqlite3 won't compile** — It needs electron-rebuild. Run `npx electron-rebuild -f -w better-sqlite3` after install.

**WebContentsView not rendering** — Make sure you're calling `window.contentView.addChildView(view)` and setting bounds with `view.setBounds({ x, y, width, height })`. The view won't show without explicit bounds.

**Tailwind dark mode not working** — Verify `tailwind.config.ts` has `darkMode: 'class'` and that AppContext is toggling the `dark` class on `document.documentElement`.

**IPC channels returning undefined** — Check that the channel name in the renderer matches `shared/constants.ts` exactly, and that the handler is registered in `main.ts` before the window loads.

**appx build fails** — Windows SDK must be installed. Check that `electron-builder.yml` has valid `identityName` and `publisher` from Partner Center.
