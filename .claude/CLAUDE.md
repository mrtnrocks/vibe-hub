# CLAUDE.md — Vibe Hub

## What This Project Is

Vibe Hub is a Windows desktop app (Electron 41+) that lets vibe coders manage multiple AI builder tools — Bolt.new, v0, Lovable, Replit, etc. — from a single interface. It's a productivity browser, not a generic browser.

## Source of Truth

**VIBE_HUB_V1_SPEC_v3.md** is the spec. Every architectural decision, data model, IPC channel, and UI component is defined there. If you're unsure about anything, check the spec first. Don't invent new patterns when the spec already has an answer.

## Tech Stack

- Electron 41+ with `WebContentsView` (NOT `<webview>` tag)
- electron-vite (build tool)
- electron-builder with `appx` target (packaging)
- React + TypeScript (renderer)
- shadcn/ui + Tailwind CSS (UI)
- Framer Motion (animations)
- electron-store (app preferences)
- better-sqlite3 (user data)
- electron-updater (sideloaded installs only)

## Architecture Rules

1. **WebContentsView lives in the main process only.** The renderer never touches webviews. It sends IPC messages; the main process does the rest.
2. **contextIsolation: true, always.** nodeIntegration is false. Everything goes through contextBridge.
3. **One session partition per app** — `session.fromPartition('persist:${appId}')`. This is non-negotiable; it prevents cookie collisions and preserves login state across sleep/wake.
4. **IPC uses typed contracts.** Data-returning channels use `IpcResult<T>`. Command channels return `void`. Types live in `shared/types.ts`.
5. **Errors don't crash the app.** Background ops fail silently. User-facing failures get inline feedback (toasts, placeholders). Never use modals for errors.

## Project Structure

```
shared/          → Cross-process types and constants
electron/        → Main process (db/, ipc/, services/)
src/             → Renderer (React components, hooks, context)
resources/       → Bundled icons, default catalog, Store assets
tests/           → Vitest unit tests
```

Key files:
- `shared/types.ts` — all interfaces and IpcResult<T>
- `shared/constants.ts` — IPC channel name strings
- `electron/ipc/view-manager.ts` — WebContentsView lifecycle
- `electron/services/sleep-manager.ts` — background sleep timer
- `src/lib/variables.ts` — {{placeholder}} template parsing

## Build Phases

The spec defines 10 phases. Implement them in order. Each phase has a "Depends on" and a "Verify" step. Don't skip the verification — later phases assume earlier ones work.

## Code Conventions

- Use the types from `shared/types.ts` everywhere. Don't create parallel type definitions.
- IPC channel names come from `shared/constants.ts`. Don't hardcode channel strings.
- DB writes are always wrapped in try/catch. On failure, send a toast via `view:toast`, don't throw.
- Use `@dnd-kit/sortable` for drag-and-drop (sidebar reorder). Don't bring in another DnD library.
- Tailwind for all styling. No CSS modules, no styled-components.
- Framer Motion for animations. Keep them subtle — glassmorphism transitions, slide-out drawer, sidebar reorder.

## Testing

- Vitest for unit tests. Priority targets: `variables.ts`, `db/queries/`, `sleep-manager.ts`.
- Tests go in `tests/unit/`. Mirror the source structure.
- Use in-memory SQLite (`:memory:`) for DB tests.
- Playwright is post-launch. Don't set it up now.

## Platform

- Windows-first (Windows 10/11). macOS/Linux are not tested for V1.
- Primary distribution: Microsoft Store via appx/MSIX.
- Sideloaded installs use electron-updater. Store installs skip the updater (`process.windowsStore === true`).
- Keyboard shortcuts use `Ctrl`, not `Cmd/Ctrl`.

## Things NOT to Build

These are explicitly out of scope for V1 (see spec Section 9):
- Global Prompt Bar (DOM injection into third-party apps)
- Context Bridge / drag-and-drop between webviews
- Workspace / Session Isolation
- Custom app webhook submission
- Zustand (only if React Context causes perf issues)
- E2E tests (post-launch)
