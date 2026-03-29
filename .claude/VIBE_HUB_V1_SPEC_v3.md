# Vibe Hub — V1 Product & Architecture Spec (v3)

> A specialized Productivity Browser and Command Center for the modern Vibe Coding workflow. Users orchestrate multiple AI builders (v0, Bolt.new, Lovable, Replit, Tempo, etc.) from a single, beautiful desktop app.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Desktop Framework | **Electron 41+** (using `WebContentsView`, NOT the `<webview>` tag) |
| Build Tool | **electron-vite** (Vite-based, fast HMR) |
| Packaging | **electron-builder** with `appx` target (produces MSIX-compatible packages for Microsoft Store) |
| Renderer | **React + TypeScript** |
| UI Components | **shadcn/ui** |
| Styling | **Tailwind CSS** |
| Animations | **Framer Motion** (glassmorphism, transitions, sidebar animations) |
| App State | **electron-store** (JSON key-value) |
| User Data | **SQLite via better-sqlite3** |
| Auto-Update (sideload) | **electron-updater** (fallback for non-Store installs only) |
| Testing | **Vitest** (unit), Playwright (E2E, post-launch) |

### Why Electron over Tauri

The app's core value prop is running web-based AI tools reliably. Tools like Bolt.new and StackBlitz use WebContainers which require SharedArrayBuffer and cross-origin isolation headers (COOP/COEP). Electron guarantees full Chromium support for these. Tauri v2 uses OS webviews (WebKit on macOS, WebView2 on Windows) which have inconsistent support for these features — an unacceptable risk.

### Platform Target

**Windows-first.** V1 targets Windows 10/11 as the primary platform. The app is packaged as an appx/MSIX and distributed through the **Microsoft Store**. Electron + electron-builder supports multi-platform output by default, so macOS/Linux builds may work, but cross-platform compatibility is not tested or promised for V1.

### Distribution & Updates

| Channel | Update mechanism |
|---|---|
| **Microsoft Store** (primary) | Store handles certification, signing, and OTA updates automatically. No code signing certificate needed — Microsoft signs MSIX packages for free when distributed through the Store. When a new version is uploaded, the Store pushes updates to users. |
| **Sideloaded installs** (fallback) | For users who install outside the Store (e.g., direct download from website), `electron-updater` provides auto-update from a GitHub Releases or static file host. |

The app detects at runtime whether it's running as a Store install (packaged as appx/MSIX) or a sideloaded install (NSIS/exe), and only activates `electron-updater` for sideloaded installs.

```typescript
// Detection logic in main process
const isStoreInstall = process.windowsStore === true; // Electron sets this for appx packages
```

### Microsoft Store Requirements

- **Microsoft Developer Account** required (one-time $19 fee for individuals).
- **Windows SDK** required on the build machine for appx packaging.
- **Package identity** values (`identityName`, `publisher`, `publisherDisplayName`) are obtained from the Microsoft Partner Center after reserving the app name.
- **electron-builder appx config** in `electron-builder.yml`:

```yaml
appx:
  identityName: "<from Partner Center>"
  publisher: "<CN=XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX>"
  publisherDisplayName: "<Publisher Name>"
  applicationId: "VibeHub"
  backgroundColor: "#1a1a2e"
```

- **Store assets** (logos, tiles) are placed in `resources/appx/` and referenced by electron-builder. Required sizes: StoreLogo (50x50), Square44x44Logo, Square150x150Logo, Wide310x150Logo.

### Window Dimensions

- **Default size:** 1400×900
- **Minimum size:** 1024×700

---

## 2. V1 Feature Set

### 2.1 Icon-Based Sidebar (Primary Navigation)

- Vertical icon rail on the left side of the app (Discord-style).
- Users pin apps from the directory. Icons are reorderable via drag-and-drop.
- **No tab bar.** The sidebar icons ARE the tab switcher. Click an icon → the webview swaps.
- Icons display visual state indicators:
  - 🟢 (or green dot overlay) → **Active** (loaded in memory)
  - 💤 (or moon overlay) → **Sleeping** (destroyed to save RAM)
  - No indicator → **Pinned but not yet opened this session**
- The prompt library can also be pinned as a sidebar icon for full management view.
- **Overflow behavior:** Scrollable icon rail with `overflow-y: auto` and hidden scrollbar styling. The sidebar should feel infinite — no pagination, no "more" menu, no cap on pinned apps.

### 2.2 Remote App Directory

- A built-in "Store" where users browse AI apps.
- **Catalog is hosted as a raw JSON file on a public GitHub repository.** The app fetches from `https://raw.githubusercontent.com/{org}/{repo}/main/catalog.json` on launch.
- A bundled `default-catalog.json` serves as offline/error fallback.
- **Tag-based filtering, not rigid categories.** Each app has multiple tags. Users filter by tag.

#### Catalog Fetch Behavior

1. On app launch, `catalog-sync.ts` fetches the remote URL with a **5-second timeout**.
2. On success → cache the response in memory for the session, serve to renderer.
3. On failure (network down, timeout, non-200 status) → **silently fall back** to bundled `default-catalog.json`. No toast, no error modal. Log the error to console for debugging only.

#### Default Tags

`frontend` · `fullstack` · `mobile` · `design` · `ai-chat` · `coding-agent` · `deployment` · `database` · `resources`

#### App Metadata Schema

```json
{
  "id": "bolt",
  "name": "Bolt.new",
  "description": "Full-stack AI app builder with WebContainers",
  "cleanUrl": "https://bolt.new",
  "affiliateUrl": "https://bolt.new?ref=vibehub",
  "icon": "bolt.svg",
  "tags": ["fullstack", "frontend"]
}
```

### 2.3 Custom App Adding

- Users can add any URL as a custom app **instantly** — it works immediately for personal use.
- **V1: No webhook submission.** Custom apps are stored locally in SQLite only. Catalog curation is done manually by reviewing the database or adding a future admin export.
- **URL validation:** Before accepting, validate with `new URL(input)`. If it throws, show an inline validation error. If the user omits a protocol (e.g., types `bolt.new`), prepend `https://` automatically.
- **Privacy toggle and auto-submission are deferred to V2** (no webhook = no privacy concern).

### 2.4 Webview Rendering

- Managed entirely from the **main process** using `WebContentsView` (NOT the HTML `<webview>` tag).
- One visible webview at a time, displayed to the right of the sidebar.
- **Each app gets its own persistent session partition** using `session.fromPartition('persist:${appId}')`. This ensures:
  - Login state survives sleep/wake cycles and app restarts.
  - Affiliate cookies are isolated per app.
  - No cross-app cookie collisions (e.g., two apps using Google OAuth).
- The main process holds a map of all loaded views:

```typescript
interface ManagedView {
  view: WebContentsView | null; // null = sleeping
  url: string;
  partition: string; // 'persist:${appId}'
  lastActive: number; // timestamp
  keepAlive: boolean;
  affiliateSessionsRemaining: number;
}

// Main process state
const views = new Map<string, ManagedView>();
```

- **Swap logic:** User clicks sidebar icon → React sends IPC → main process checks if a live view exists → if yes, swap into visible area; if no, create new `WebContentsView` with the app's partition and load the URL.

#### Crash Handling

- Listen for `'render-process-gone'` on each `WebContentsView`'s `webContents`.
- On crash: destroy the view, set `view = null` in the map, send `view:state-changed { state: 'crashed' }` to renderer.
- Renderer shows an inline placeholder in the content area: **"This app crashed. Click to reload."** (not a modal — modals block everything). Sidebar icon resets to "not loaded" state.
- If the same app crashes **3 times in a single session**, show a toast: "This app keeps crashing — the URL may be incompatible with Vibe Hub."

#### Popup / New Window Handling

- Register `setWindowOpenHandler` on every `WebContentsView`.
- **V1 behavior:** Deny the popup and open the URL in the user's default external browser via `shell.openExternal(url)`.
- Show a brief toast: "Opened in your browser."

### 2.5 Sleep System

- **Default:** Views sleep after **5 minutes** of being in the background.
- **Sleep = destroy** the `WebContentsView` and store the URL. When the user returns, a new view is created (with the same partition) and the app reloads. Login state persists because the session partition is persistent.
- Users can toggle **"Keep Alive"** per app (prevents sleeping).
- Global sleep timer default is adjustable in **Settings**.
- A background timer in the main process checks every 30 seconds for views past the threshold.
- No memory stats shown to the user — state is communicated via sidebar emoji indicators only.

### 2.6 Prompt Library

#### Storage
- Stored in **SQLite** (templates, variables, defaults, tags).

#### Features
- **Variable templates** using `{{placeholder}}` syntax.
- Users can set **default values** per variable (auto-fills on use, overridable).
- **Custom tagging system** — users create and assign their own tags.
- **Search and filter** by tag or name.

#### Access Modes
1. **Slide-out drawer** — quick access overlay on top of the active webview. User searches/selects a prompt, fills variables, clicks "Copy." Never loses context.
2. **Pinnable sidebar icon** — opens the full Prompt Manager in the main content area for creating, editing, organizing, and bulk-managing prompts.

#### Variable Flow
1. User selects a template (e.g., "Build me a {{component_type}} for {{project_name}} using {{tech_stack}}")
2. A dynamic form renders — one input per detected `{{variable}}`
3. Default values are pre-filled if set
4. User adjusts values, clicks "Copy"
5. Interpolated string is written to clipboard

### 2.7 Affiliate System

- Each app in the catalog has a `cleanUrl` and an `affiliateUrl`.
- **First 3 sessions** (where the app loads for 30+ seconds) → use `affiliateUrl`.
- After 3 qualifying sessions → switch to `cleanUrl` permanently.
- Session counter stored in **SQLite** per app per user.
- This logic is invisible to the user.

### 2.8 Keyboard Shortcuts

#### In-App Navigation
- `Ctrl + 1` through `Ctrl + 9` → jump to sidebar app by position
- `Ctrl + [` and `Ctrl + ]` → cycle previous/next app

#### Global Shortcut
- **User-defined hotkey** to summon the app from tray mode or when minimized.
- Hotkey is set during **onboarding** (first launch).
- Can be changed later in Settings.

### 2.9 Tray Mode

- Closing the window **minimizes to system tray** instead of quitting.
- The global hotkey brings the window back.
- Tray icon with right-click menu: "Show Vibe Hub", "Quit."

### 2.10 Theming

- **Default:** System theme (follows OS light/dark setting).
- **Manual override:** Light mode or Dark mode, selectable in Settings.
- The "Vibe" aesthetic: glassmorphism via `backdrop-blur` + `bg-opacity` in Tailwind, smooth layout transitions via Framer Motion.

### 2.11 App Launch Behavior

- **First launch (onboarding):** Single welcome screen — app logo/wordmark at top, a hotkey recorder input in the center (user presses their desired key combo, it captures and displays it), a "Get Started" button at the bottom. On click → mark onboarding complete in `electron-store` → navigate to the App Directory so the user can browse and pin their first apps.
- **Returning user:** Immediately restores the last active webview. No dashboard, no landing page. The sidebar IS the dashboard.

### 2.12 Auto-Update (Sideloaded Installs Only)

- **Microsoft Store installs** receive updates automatically via the Store. No in-app update mechanism needed — `process.windowsStore` is `true` and the updater is skipped entirely.
- **Sideloaded installs** use `electron-updater` for auto-update:
  1. On app launch, if `process.windowsStore === false`, check for updates in the background.
  2. If an update is available, download silently.
  3. On download complete, show a **non-blocking toast**: "Update ready — restart to apply" with a "Restart Now" button.
  4. If the user ignores the toast, the update applies on the next natural app launch.
- Never force-restart. Never interrupt the user's workflow.

---

## 3. Error Handling Strategy

### 3.1 Principles

- **Background operations fail silently.** Catalog sync, update checks — if they fail, the user should never know unless it affects their workflow.
- **User-facing operations show inline feedback.** Crashes, save failures, validation errors — show contextual, non-blocking UI (inline placeholders, toasts, form errors). Never use modals for errors.
- **Data loss is the worst outcome.** Always keep forms populated on save failure. Always persist to disk before confirming success.

### 3.2 Specific Failure Modes

| Failure | Behavior |
|---|---|
| Remote catalog fetch fails | Silent fallback to bundled `default-catalog.json`. Console log only. |
| `WebContentsView` crashes | Destroy view, show inline "crashed — click to reload" placeholder. 3 crashes in a session → toast warning. |
| SQLite write fails (prompt save, app session update) | Toast: "Couldn't save — your data may not persist." Keep form populated. Do not crash the app. |
| Auto-update download fails (sideloaded only) | Silent retry on next launch. No user notification. |
| Custom app URL validation fails | Inline form error: "Please enter a valid URL." |
| `setWindowOpenHandler` popup intercepted | Open in external browser, show brief toast: "Opened in your browser." |

---

## 4. Data Persistence

### 4.1 electron-store (App State)

- Theme preference (system / light / dark)
- Sleep timer default (milliseconds)
- Sidebar order (array of app IDs)
- Last active app ID (for restore on launch)
- Global hotkey binding
- Onboarding completed flag

### 4.2 SQLite via better-sqlite3 (User Data)

All DB writes are wrapped in try/catch. On failure, a toast is shown and the app continues operating.

#### Tables

**prompts**
- `id` (TEXT, primary key)
- `title` (TEXT)
- `template` (TEXT) — raw template with `{{variables}}`
- `defaults` (TEXT, JSON) — `{ "variable_name": "default_value" }`
- `created_at` (INTEGER, timestamp)
- `updated_at` (INTEGER, timestamp)

**prompt_tags**
- `prompt_id` (TEXT, FK → prompts.id)
- `tag` (TEXT)
- Composite primary key on (prompt_id, tag)

**custom_apps**
- `id` (TEXT, primary key)
- `name` (TEXT)
- `url` (TEXT)
- `icon` (TEXT, nullable) — user-provided or auto-fetched favicon
- `tags` (TEXT, JSON array)
- `created_at` (INTEGER, timestamp)

**app_sessions**
- `app_id` (TEXT, primary key) — references catalog or custom app ID
- `affiliate_sessions_remaining` (INTEGER, default 3)
- `first_opened_at` (INTEGER, timestamp)
- `keep_alive` (INTEGER, boolean, default 0)

---

## 5. IPC Contract

All communication between Renderer (React) and Main (Electron) goes through `contextBridge` with `contextIsolation: true`.

### Response Wrapper

All data-returning IPC channels use a typed result wrapper defined in `shared/types.ts`:

```typescript
type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };
```

Command channels (fire-and-forget actions like `app:pin`, `app:unpin`, `prefs:set`) do not return data — they resolve as `void`. If they fail, the main process logs the error and sends a toast notification via `view:toast`.

### Channels

| Channel | Direction | Payload | Response | Description |
|---|---|---|---|---|
| `app:switch` | Renderer → Main | `{ appId: string }` | `void` | Switch active webview |
| `app:pin` | Renderer → Main | `{ appId: string }` | `void` | Pin app to sidebar |
| `app:unpin` | Renderer → Main | `{ appId: string }` | `void` | Remove from sidebar |
| `app:set-keep-alive` | Renderer → Main | `{ appId: string, keepAlive: boolean }` | `void` | Toggle keep-alive |
| `app:add-custom` | Renderer → Main | `{ name: string, url: string, icon?: string, tags: string[] }` | `IpcResult<CustomApp>` | Add custom app (returns created record) |
| `app:get-catalog` | Renderer → Main | `{}` | `IpcResult<CatalogApp[]>` | Full catalog (merged remote + custom) |
| `app:get-custom` | Renderer → Main | `{}` | `IpcResult<CustomApp[]>` | User's custom apps only |
| `view:state-changed` | Main → Renderer | `{ appId: string, state: 'active' \| 'background' \| 'sleeping' \| 'crashed' }` | — | Notify sidebar of view state |
| `view:toast` | Main → Renderer | `{ message: string, action?: { label: string, ipcChannel: string } }` | — | Show non-blocking toast notification |
| `prompt:list` | Renderer → Main | `{ tag?: string, search?: string }` | `IpcResult<Prompt[]>` | Query prompts with optional filters |
| `prompt:get` | Renderer → Main | `{ id: string }` | `IpcResult<Prompt>` | Get single prompt by ID |
| `prompt:create` | Renderer → Main | `{ title: string, template: string, defaults: Record<string, string>, tags: string[] }` | `IpcResult<Prompt>` | Create prompt (returns created record) |
| `prompt:update` | Renderer → Main | `{ id: string, title?: string, template?: string, defaults?: Record<string, string>, tags?: string[] }` | `IpcResult<Prompt>` | Update prompt (returns updated record) |
| `prompt:delete` | Renderer → Main | `{ id: string }` | `void` | Delete prompt |
| `prefs:get` | Renderer → Main | `{ key: string }` | `IpcResult<any>` | Read preference |
| `prefs:set` | Renderer → Main | `{ key: string, value: any }` | `void` | Write preference |
| `shortcuts:set-global` | Renderer → Main | `{ accelerator: string }` | `IpcResult<{ success: boolean }>` | Set global hotkey (can fail if combo is reserved) |
| `updater:restart` | Renderer → Main | `{}` | `void` | Apply pending update and restart (sideloaded only) |

### Shared Types (`shared/types.ts`)

```typescript
// IPC result wrapper
export type IpcResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

// Database models
export interface Prompt {
  id: string;
  title: string;
  template: string;
  defaults: Record<string, string>;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export interface CatalogApp {
  id: string;
  name: string;
  description: string;
  cleanUrl: string;
  affiliateUrl: string;
  icon: string;
  tags: string[];
}

export interface CustomApp {
  id: string;
  name: string;
  url: string;
  icon: string | null;
  tags: string[];
  createdAt: number;
}

export interface AppSession {
  appId: string;
  affiliateSessionsRemaining: number;
  firstOpenedAt: number;
  keepAlive: boolean;
}

// View state for sidebar indicators
export type ViewState = 'active' | 'background' | 'sleeping' | 'crashed';

// Toast payload
export interface ToastPayload {
  message: string;
  action?: {
    label: string;
    ipcChannel: string;
  };
}
```

---

## 6. Project Structure

```
vibe-hub/
├── shared/                          # Types shared across Main and Renderer
│   ├── types.ts                     # IPC payloads, DB models, IpcResult<T>
│   └── constants.ts                 # IPC channel name strings
├── electron/                        # Main process
│   ├── main.ts                      # App entry, BrowserWindow creation, tray setup
│   ├── preload.ts                   # contextBridge API exposure
│   ├── db/
│   │   ├── connection.ts            # SQLite init, schema setup
│   │   ├── migrations/              # Schema migration files
│   │   └── queries/
│   │       ├── prompts.ts           # Prompt CRUD operations
│   │       └── apps.ts              # App session tracking, custom apps CRUD
│   ├── ipc/
│   │   ├── view-manager.ts          # WebContentsView lifecycle (create, swap, sleep, destroy)
│   │   ├── prompts.ts               # IPC handlers for prompt operations
│   │   ├── apps.ts                  # IPC handlers for catalog, custom URLs, affiliate logic
│   │   └── preferences.ts          # IPC handlers for electron-store read/write
│   └── services/
│       ├── sleep-manager.ts         # Background timer, sleep/wake logic
│       ├── catalog-sync.ts          # Fetch remote catalog JSON from GitHub
│       ├── shortcuts.ts             # Global + in-app keyboard shortcut registration
│       └── updater.ts              # electron-updater for sideloaded installs only (skipped if process.windowsStore)
├── src/                             # Renderer process (React)
│   ├── App.tsx                      # Root component, layout shell
│   ├── components/
│   │   ├── sidebar/
│   │   │   ├── Sidebar.tsx          # Scrollable icon rail + state indicators
│   │   │   ├── AppIcon.tsx          # Single icon with active/sleep/crashed overlay
│   │   │   └── SortableList.tsx     # Drag to reorder pinned apps
│   │   ├── directory/
│   │   │   ├── Directory.tsx        # Main directory grid view
│   │   │   ├── AppCard.tsx          # Single app card in directory
│   │   │   └── TagFilter.tsx        # Tag-based filtering bar
│   │   ├── prompts/
│   │   │   ├── PromptDrawer.tsx     # Slide-out quick access drawer
│   │   │   ├── PromptManager.tsx    # Full management view (when pinned to sidebar)
│   │   │   ├── PromptForm.tsx       # Create/edit form with variable detection
│   │   │   └── VariableFiller.tsx   # Dynamic form for filling {{variables}}
│   │   └── shared/
│   │       ├── Onboarding.tsx       # Single welcome screen: hotkey picker + Get Started
│   │       ├── Settings.tsx         # Theme, sleep defaults, hotkey config
│   │       ├── Toast.tsx            # Non-blocking toast notification component
│   │       └── CrashPlaceholder.tsx # Inline "app crashed — click to reload" view
│   ├── hooks/
│   │   ├── useWebview.ts            # IPC calls for webview management
│   │   ├── usePrompts.ts            # IPC calls for prompt CRUD
│   │   └── useApps.ts              # IPC calls for catalog, pinning, custom apps
│   ├── context/
│   │   └── AppContext.tsx           # Active app, sidebar state, theme, toast queue
│   └── lib/
│       ├── ipc.ts                   # Typed IPC wrapper over window.electronAPI
│       └── variables.ts             # {{placeholder}} parsing + string interpolation
├── tests/
│   ├── unit/                        # Vitest — variables.ts, DB queries, sleep logic
│   └── e2e/                         # Playwright — post-launch
├── resources/
│   ├── icons/                       # Bundled app icons as fallback
│   ├── appx/                        # Microsoft Store assets (StoreLogo, Square44x44, Square150x150, Wide310x150)
│   └── default-catalog.json         # Fallback catalog if remote fetch fails
├── electron-builder.yml             # electron-builder config with appx target + appx identity
├── electron.vite.config.ts          # electron-vite configuration
├── tailwind.config.ts               # Tailwind with dark mode + glassmorphism utilities
├── package.json
└── tsconfig.json
```

---

## 7. Key Implementation Notes

### WebContentsView Management
- All `WebContentsView` instances are created and managed in the **main process only**.
- The renderer never directly touches webviews. It sends IPC messages; the main process handles the rest.
- Views are attached to the `BrowserWindow` using `window.contentView.addChildView(view)` and positioned programmatically to sit to the right of the sidebar.
- Each view is created with its own persistent session: `session.fromPartition('persist:${appId}')`.

### Security
- `contextIsolation: true` — always on, non-negotiable.
- `nodeIntegration: false` in all webview-loaded content.
- `contextBridge` exposes a strict, typed API surface in `preload.ts`.

### Affiliate URL Logic
```
On app open:
  1. Look up app_sessions.affiliate_sessions_remaining
  2. If > 0 → load affiliateUrl, start a 30-second timer
  3. If timer completes (user stayed 30s) → decrement counter, save
  4. If counter == 0 → load cleanUrl from now on
  5. On save failure → log error, do not block the user
```

### Sleep Manager Logic
```
Every 30 seconds:
  For each entry in views Map:
    If view is not null
    AND keepAlive is false
    AND (now - lastActive) > sleepThreshold:
      → destroy view, set view to null
      → send view:state-changed { state: 'sleeping' } to renderer
```

Note: When waking a sleeping view, create the new `WebContentsView` with the same partition (`persist:${appId}`) so login state and cookies are preserved.

### Popup Handling
```
On every new WebContentsView:
  view.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    // send view:toast { message: 'Opened in your browser' }
    return { action: 'deny' };
  });
```

### Store Detection & Conditional Updater
```typescript
// In main.ts, after app.whenReady()
const isStoreInstall = process.windowsStore === true;

if (!isStoreInstall) {
  // Only initialize electron-updater for sideloaded installs
  const { initUpdater } = require('./services/updater');
  initUpdater();
}
// Store installs receive updates via Microsoft Store — no in-app mechanism needed
```

### State Management
- React Context + hooks for v1. Covers: active app ID, sidebar order, theme, drawer state, toast queue.
- If performance issues arise, migrate to **Zustand** (lightweight, ~10 min migration).

### Testing Priority (V1)
1. `variables.ts` — template parsing and interpolation (pure logic, easy to test)
2. `db/queries/` — prompt and app CRUD against an in-memory SQLite instance
3. `sleep-manager.ts` — timer logic with mocked timestamps
4. E2E with Playwright — post-launch

---

## 8. Build Phases

A phased implementation plan for Claude Code. Each phase builds on the previous one. Do not skip ahead — later phases depend on earlier ones compiling and running.

### Phase 1: Skeleton & Tooling
**Goal:** Bootable Electron app with electron-vite, React rendering, and the shared type system in place.

- [ ] Scaffold project with `electron-vite` (React + TypeScript template)
- [ ] Configure `tailwind.config.ts` with dark mode (`class` strategy) and glassmorphism utility classes
- [ ] Set up `shadcn/ui` (install CLI, add base components: Button, Input, Dialog, Toast)
- [ ] Create `shared/types.ts` with all interfaces: `IpcResult<T>`, `Prompt`, `CatalogApp`, `CustomApp`, `AppSession`, `ViewState`, `ToastPayload`
- [ ] Create `shared/constants.ts` with all IPC channel name strings as typed constants
- [ ] Create `electron/preload.ts` with `contextBridge` exposing a typed `window.electronAPI` object (stubs for all IPC channels)
- [ ] Create `src/lib/ipc.ts` — typed wrapper that calls `window.electronAPI` methods
- [ ] Verify: `npm run dev` boots Electron, shows a React page with Tailwind styling

**Depends on:** Nothing
**Deliverable:** Bootable app with type system, IPC plumbing stubbed, Tailwind + shadcn working

### Phase 2: Database Layer
**Goal:** SQLite initialized with schema, all CRUD queries working and tested.

- [ ] Install `better-sqlite3`
- [ ] Create `electron/db/connection.ts` — initializes SQLite at `app.getPath('userData')/vibe-hub.db`, runs migrations
- [ ] Create initial migration in `electron/db/migrations/` — all 4 tables (`prompts`, `prompt_tags`, `custom_apps`, `app_sessions`)
- [ ] Create `electron/db/queries/prompts.ts` — CRUD: `listPrompts(tag?, search?)`, `getPrompt(id)`, `createPrompt(...)`, `updatePrompt(...)`, `deletePrompt(id)`. All writes wrapped in try/catch.
- [ ] Create `electron/db/queries/apps.ts` — CRUD: `getCustomApps()`, `addCustomApp(...)`, `getAppSession(appId)`, `upsertAppSession(...)`, `decrementAffiliateCounter(appId)`
- [ ] Write Vitest tests for all query functions using an in-memory SQLite instance
- [ ] Verify: All tests pass

**Depends on:** Phase 1 (shared types)
**Deliverable:** Fully tested data layer

### Phase 3: Core Main Process Services
**Goal:** View manager, sleep manager, catalog sync, and preferences — the main process backbone.

- [ ] Create `electron/services/catalog-sync.ts` — fetches remote JSON with 5s timeout, falls back to bundled `resources/default-catalog.json`. Returns `CatalogApp[]`.
- [ ] Create `resources/default-catalog.json` with 5-8 starter apps (Bolt.new, v0, Lovable, Replit, Cursor, ChatGPT, Claude)
- [ ] Create `electron/ipc/view-manager.ts`:
  - Maintains `Map<string, ManagedView>`
  - `switchToApp(appId)` — checks map, creates or swaps `WebContentsView` with partition `persist:${appId}`
  - `destroyView(appId)` — tears down view, sets to null
  - Registers `setWindowOpenHandler` on every new view (→ `shell.openExternal`)
  - Listens for `render-process-gone` on every new view (→ destroy, send `view:state-changed { state: 'crashed' }`)
  - Tracks crash count per app per session, sends toast warning after 3
- [ ] Create `electron/services/sleep-manager.ts`:
  - 30-second interval timer
  - Checks each view's `lastActive` against threshold from `electron-store`
  - Calls `viewManager.destroyView()` for expired views
  - Sends `view:state-changed { state: 'sleeping' }` to renderer
- [ ] Create `electron/ipc/preferences.ts` — `electron-store` handlers for `prefs:get` and `prefs:set`
- [ ] Set up `electron-store` with defaults: `{ theme: 'system', sleepTimerMs: 300000, sidebarOrder: [], lastActiveAppId: null, globalHotkey: null, onboardingComplete: false }`
- [ ] Wire all IPC handlers in `electron/main.ts`
- [ ] Write Vitest tests for `sleep-manager.ts` (mocked timestamps)

**Depends on:** Phase 2 (DB queries used by view-manager for affiliate logic and app sessions)
**Deliverable:** Main process can manage views, sleep them, fetch catalog, read/write preferences

### Phase 4: IPC Handlers (Prompts & Apps)
**Goal:** All remaining IPC channels wired — prompts and app management.

- [ ] Create `electron/ipc/prompts.ts` — handlers for `prompt:list`, `prompt:get`, `prompt:create`, `prompt:update`, `prompt:delete`. Each wraps DB calls in try/catch and returns `IpcResult<T>`.
- [ ] Create `electron/ipc/apps.ts` — handlers for `app:get-catalog` (merges remote catalog + custom apps), `app:get-custom`, `app:add-custom` (validates URL with `new URL()`, prepends `https://` if missing), `app:pin`, `app:unpin`, `app:set-keep-alive`
- [ ] Affiliate logic in `app:switch`: look up session, decide `affiliateUrl` vs `cleanUrl`, start 30s timer, decrement on completion
- [ ] Register all handlers in `main.ts`
- [ ] Verify: All IPC channels respond correctly when called from renderer dev tools

**Depends on:** Phase 3 (view-manager, catalog-sync, preferences)
**Deliverable:** Complete IPC layer — renderer can call any channel and get typed responses

### Phase 5: Sidebar & App Switching UI
**Goal:** Working sidebar with icons, state indicators, drag-to-reorder, and live app switching.

- [ ] Create `src/context/AppContext.tsx` — state: `activeAppId`, `sidebarOrder`, `viewStates: Map<string, ViewState>`, `theme`, `toastQueue`
- [ ] Create `src/components/sidebar/AppIcon.tsx` — renders icon with state overlay (green dot, moon, no indicator, crash icon). Click handler calls `useWebview().switchApp(appId)`.
- [ ] Create `src/components/sidebar/SortableList.tsx` — drag-to-reorder using `@dnd-kit/sortable`. On reorder, update `sidebarOrder` in context and persist via `prefs:set`.
- [ ] Create `src/components/sidebar/Sidebar.tsx` — scrollable icon rail (`overflow-y: auto`, hidden scrollbar), renders `SortableList` of `AppIcon` components. Includes a "+" button at bottom to open Directory, and a prompt library icon.
- [ ] Create `src/hooks/useWebview.ts` — `switchApp(appId)` sends `app:switch` IPC, updates context. Listens for `view:state-changed` events and updates `viewStates` map.
- [ ] Create `src/components/shared/Toast.tsx` — non-blocking toast component. Listens for `view:toast` IPC events. Auto-dismisses after 4 seconds. Optional action button (e.g., "Restart Now" for updates).
- [ ] Create `src/components/shared/CrashPlaceholder.tsx` — inline content area shown when `viewState === 'crashed'`. "Click to reload" triggers `app:switch` again.
- [ ] Create `src/App.tsx` — layout shell: Sidebar (fixed left, ~64px wide), content area (fills remaining space). Content area conditionally shows Directory, PromptManager, CrashPlaceholder, or is empty (webview renders behind it in main process).
- [ ] Verify: Can pin apps, see them in sidebar, click to switch, see state indicators, reorder via drag

**Depends on:** Phase 4 (IPC handlers for switching, pinning)
**Deliverable:** Functional sidebar + app switching

### Phase 6: App Directory
**Goal:** Browsable directory with tag filtering, app cards, pin/unpin, and custom app adding.

- [ ] Create `src/hooks/useApps.ts` — calls `app:get-catalog`, `app:add-custom`, `app:pin`, `app:unpin`. Caches catalog in state.
- [ ] Create `src/components/directory/TagFilter.tsx` — horizontal tag bar, multi-select, "All" default. Uses catalog's tag set.
- [ ] Create `src/components/directory/AppCard.tsx` — displays app icon, name, description, tags. "Pin" button (toggles to "Unpin" if already pinned). For custom apps, show a subtle "Custom" badge.
- [ ] Create `src/components/directory/Directory.tsx` — grid layout of `AppCard` components. Tag filter at top. Search input for name filtering. "Add Custom App" button opens a form dialog.
- [ ] Custom app form: name, URL, optional tags. URL validation inline (red border + error text on invalid). Prepends `https://` if protocol missing.
- [ ] Verify: Can browse catalog, filter by tags, search by name, pin apps (appear in sidebar), add custom URL

**Depends on:** Phase 5 (sidebar to show pinned results)
**Deliverable:** Full directory experience

### Phase 7: Prompt Library
**Goal:** Full prompt CRUD, variable interpolation, drawer + manager views.

- [ ] Create `src/lib/variables.ts` — `parseVariables(template: string): string[]` extracts `{{var}}` names. `interpolate(template: string, values: Record<string, string>): string` replaces variables. Write Vitest tests.
- [ ] Create `src/hooks/usePrompts.ts` — CRUD calls via IPC, local state cache.
- [ ] Create `src/components/prompts/VariableFiller.tsx` — given a template, renders a form with one input per `{{variable}}`. Pre-fills defaults. "Copy" button writes interpolated result to clipboard.
- [ ] Create `src/components/prompts/PromptForm.tsx` — create/edit form. Fields: title, template (textarea with monospace font), tags (comma-separated or chip input). Live preview of detected variables below the textarea.
- [ ] Create `src/components/prompts/PromptDrawer.tsx` — slide-out panel (Framer Motion `AnimatePresence`), overlays content area. Search bar at top, prompt list, click to expand `VariableFiller`. "Close" returns to webview without losing context.
- [ ] Create `src/components/prompts/PromptManager.tsx` — full-page view (renders in content area when prompt icon is active in sidebar). List of all prompts with search/filter, edit/delete actions, "New Prompt" button opens `PromptForm`.
- [ ] Wire drawer toggle to a keyboard shortcut (e.g., `Ctrl + P` — but check for conflicts with Chromium shortcuts first, may need a different binding)
- [ ] Verify: Can create prompts, fill variables with defaults, copy interpolated text, search/filter by tags

**Depends on:** Phase 5 (sidebar for pinning prompt manager), Phase 4 (prompt IPC handlers)
**Deliverable:** Complete prompt library

### Phase 8: Keyboard Shortcuts, Tray, Onboarding & Theming
**Goal:** Polish layer — everything that makes it feel like a real desktop app.

- [ ] Create `electron/services/shortcuts.ts`:
  - Register `globalShortcut` for user's hotkey (show/hide window)
  - Register in-app shortcuts: `Ctrl+1-9` (sidebar position), `Ctrl+[/]` (cycle apps)
  - Handle shortcut registration failure (reserved combos) — return `IpcResult` with error
- [ ] Set up tray in `main.ts`:
  - Create `Tray` with app icon
  - Right-click menu: "Show Vibe Hub", "Quit"
  - `window.on('close')` → hide to tray instead of quit (unless explicitly quitting)
- [ ] Create `src/components/shared/Onboarding.tsx`:
  - Full-screen overlay (only shown if `onboardingComplete === false`)
  - App logo/wordmark at top
  - Hotkey recorder input (captures key combo on keydown, displays it)
  - "Get Started" button → saves hotkey via `shortcuts:set-global`, sets `onboardingComplete: true` via `prefs:set`, navigates to Directory
- [ ] Create `src/components/shared/Settings.tsx`:
  - Theme selector: System / Light / Dark (saves via `prefs:set`, applies Tailwind `dark` class)
  - Sleep timer: dropdown or number input (1 min, 5 min, 15 min, 30 min, Never)
  - Global hotkey: recorder input (same component as onboarding)
- [ ] Implement theming: `AppContext` reads theme pref, applies `dark` class to `<html>`. System mode uses `window.matchMedia('(prefers-color-scheme: dark)')`.
- [ ] Create `electron/services/updater.ts`:
  - Guard: if `process.windowsStore === true`, export a no-op `initUpdater()` and return
  - For sideloaded installs: on app ready, call `autoUpdater.checkForUpdates()`
  - On `update-downloaded`, send `view:toast` with message + "Restart Now" action (triggers `updater:restart`)
- [ ] Verify: Global hotkey summons app, tray works, onboarding flows, theme switches, shortcuts navigate sidebar, update toast appears (mock for sideloaded mode)

**Depends on:** Phase 7 (all features complete, this is the polish pass)
**Deliverable:** Shippable V1

### Phase 9: Packaging & Store Submission
**Goal:** Produce a Store-ready appx/MSIX package and a sideloadable installer.

- [ ] Create `resources/appx/` directory with required Store assets:
  - `StoreLogo.png` (50×50)
  - `Square44x44Logo.png`
  - `Square150x150Logo.png`
  - `Wide310x150Logo.png`
  - All with transparent backgrounds
- [ ] Configure `electron-builder.yml`:
  - Set `appx` target with `identityName`, `publisher`, `publisherDisplayName`, `applicationId` from Microsoft Partner Center
  - Set `win.target` to include both `appx` (for Store) and `nsis` (for sideloaded direct download)
  - Configure `electron-updater` publish target (GitHub Releases or static host) for sideloaded NSIS builds
- [ ] Build appx package: `npx electron-builder --win appx`
- [ ] Test appx installation locally using `Add-AppxPackage` (requires dev certificate for local testing)
- [ ] Build NSIS installer: `npx electron-builder --win nsis`
- [ ] Test NSIS installer on a clean Windows machine or VM
- [ ] Upload appx to Microsoft Partner Center for certification
- [ ] Address any certification feedback (e.g., `runFullTrust` capability explanation — standard for Electron apps)

**Depends on:** Phase 8
**Deliverable:** Store-certified appx + sideloadable NSIS installer

### Phase 10: Integration Testing & Bug Fixing
**Goal:** End-to-end smoke testing of all features working together.

- [ ] Test full lifecycle: first launch → onboarding → pin apps → switch between them → sleep/wake → crash recovery
- [ ] Test prompt lifecycle: create → fill variables → copy → edit → delete
- [ ] Test custom app flow: add URL → validates → appears in directory → pin → loads in webview
- [ ] Test affiliate flow: open app 3 times for 30+ seconds each → verify URL switches from affiliate to clean
- [ ] Test edge cases: 20+ pinned apps (sidebar scrolls), malformed URL (rejected), popup interception (opens external)
- [ ] Test Store install path: verify `process.windowsStore === true`, confirm electron-updater does NOT activate
- [ ] Test sideloaded install path: verify electron-updater activates and can check for updates
- [ ] Fix any bugs found
- [ ] Final pass: remove console.logs, verify all error handling paths, check for memory leaks (views not being destroyed)

**Depends on:** Phase 9
**Deliverable:** Tested, stable V1 published to Microsoft Store

---

## 9. Out of Scope (V2+)

| Feature | Reason for deferral |
|---|---|
| **Workspace / Session Isolation** | Requires partition-based session management, workspace switcher UI, per-workspace state persistence. Significant architecture change. |
| **Global Prompt Bar** | Requires per-app DOM injection adapters. Fragile, high maintenance, breaks when third-party apps update their UI. |
| **Context Bridge / Drag-and-Drop** | Requires intercepting clipboard/drag events across sandboxed webviews with different code editors. Technically fragile. |
| **Custom App Webhook Submission** | V1 stores custom apps locally only. Webhook for catalog curation pipeline deferred. |
| **Privacy Toggle** | No webhook = no auto-submission = no privacy concern. Bring back when webhook ships. |
| **Zustand migration** | Only if React Context causes re-render performance issues. |
| **E2E testing** | Post-launch. Unit tests cover critical logic in V1. |
| **macOS / Linux builds** | Windows-first for V1. Cross-platform QA and distribution deferred. |

---

## 10. Package Dependencies

### Core
- `electron` (v41+)
- `electron-vite`
- `electron-builder`
- `electron-store`
- `electron-updater` (sideloaded installs only)
- `better-sqlite3`

### Renderer
- `react`, `react-dom`
- `tailwindcss`, `postcss`, `autoprefixer`
- `framer-motion`
- `@radix-ui/*` (via shadcn/ui)
- `class-variance-authority`, `clsx`, `tailwind-merge` (shadcn/ui utilities)
- `@dnd-kit/core`, `@dnd-kit/sortable` (sidebar drag-and-drop reorder)
- `lucide-react` (icons)

### Testing
- `vitest`
- `@playwright/test` (post-launch)

---

## Clarification Log

### Round 1 — Error Handling, IPC Responses, Edge Cases
- **Error handling strategy defined:** silent fallback for background ops, inline feedback for user-facing failures, data preservation on save errors.
- **IPC response typing decided:** `IpcResult<T>` wrapper for data-returning channels only; command channels are fire-and-forget `void`.
- **Edge cases confirmed:** sidebar scroll overflow, auth-walled URLs (solved by persistent partitions), popup interception (`shell.openExternal`), malformed URL validation (`new URL()` + `https://` prepend).

### Round 2 — Sessions, Updates, Platform
- **Session partition strategy:** one partition per app ID for all apps (`persist:${appId}`). Prevents cookie collisions, preserves login across sleep/wake, ensures affiliate cookie isolation.
- **Auto-update:** `electron-updater` with silent background download, non-blocking "Restart Now" toast. Never force-restart.
- **Platform:** Current development OS only for V1. Cross-platform builds may work but are not tested.

### Round 3 — Catalog, Onboarding, Build Phases
- **Catalog endpoint:** Raw JSON on public GitHub repo. 5-second fetch timeout, silent fallback to bundled default.
- **Onboarding:** Single welcome screen — logo, hotkey recorder, "Get Started" button → Directory.
- **Build phases:** 9 detailed phases with task-level granularity and dependency chains added to spec.

### Round 4 — Webhook, Window, Output
- **Custom app webhook:** Skipped for V1. Store locally only, curate manually.
- **Window dimensions:** 1400×900 default, 1024×700 minimum.

### Round 5 — Electron Version, Platform & Distribution
- **Electron version:** Updated from 33+ to **41+** (current latest stable: v41.0.3, Chromium 146, Node v24.14.0).
- **Platform:** Changed from "current OS" to **Windows-first** (Windows 10/11).
- **Distribution:** Primary via **Microsoft Store** as appx/MSIX. Store handles certification, signing (free), and OTA updates. No code signing certificate purchase needed.
- **Build tooling:** Stayed with **electron-builder** + `appx` target (Electron Forge's MSIX maker is still experimental).
- **electron-updater:** Kept as **sideload fallback only**. Conditionally activated when `process.windowsStore === false`. Store installs skip it entirely.
- **Keyboard shortcuts:** Simplified from `Cmd/Ctrl` to `Ctrl` only (Windows-first).
- **New build phase added:** Phase 9 (Packaging & Store Submission) with appx asset preparation, electron-builder config, and certification flow. Previous Phase 9 (testing) renumbered to Phase 10.

---

**Document Version**: 3.0
**Clarification Rounds**: 5
**Quality Score**: 92/100
