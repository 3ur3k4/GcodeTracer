# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Gcode Tracer: a macOS-only Electron + Vue 3 + Pinia GRBL G-code sender. Full requirements/design doc (in Japanese) lives at `docs/redesign_requirements.md` — read it for the rationale behind the architecture below before making structural changes.

## Commands

```bash
npm run dev         # vite dev server + electron
npm run build       # typecheck then vite build (renderer + electron main — no packaging)
npm run package     # build then electron-builder → release/ に dmg/zip を生成
npm run typecheck   # tsc (electron/shared) + vue-tsc (src) — no emit, run both before considering a change done
npm test            # vitest run (electron/**/*.test.ts only — see vite.config.ts `test.include`)
npx vitest run electron/grbl/parser.test.ts   # run a single test file
```

`postinstall` runs `electron-rebuild -f -w serialport` — needed because `serialport` is a native addon; if Electron's ABI/version changes, rerun `npm install` rather than hand-rebuilding.

## Architecture: single-owner modules, no cross-cutting state

The core constraint driving this codebase: **GRBL protocol knowledge and machine state live in exactly one place in the Main process**; everything else either feeds that place or reads from it. This is deliberate (see §3 of the requirements doc) to keep each module small enough that an agent can change it safely after reading only that one file. Do not break these invariants:

- **Parsing**: only `electron/grbl/parser.ts` parses raw GRBL responses (`ok`/`error:N`/`<...>` status reports/alarms/welcome). Never parse GRBL strings anywhere else, including Renderer components.
- **State**: only `electron/grbl/state.ts` (`GrblState`) holds `AppState`. Other modules read/write it only through its public methods (e.g. `setConnection`, `applyGrblEvent`, `setJobProgress`, `appendConsoleLine`) — never reach into another module's private fields.
- **Serial writes**: only `electron/grbl/scheduler.ts` (`GrblScheduler`) writes to the serial port. Jog, console, and job sends all go through `scheduler.enqueue()` — there is no direct-write path, even for one-off commands.
- **IPC boundary**: only `electron/ipc/gateway.ts` (`IpcGateway`) touches `ipcMain`/sends to the renderer. Renderer→Main messages are validated against the zod schema in `shared/ipcContract.ts` before being dispatched to handlers; Main→Renderer state is pushed on a single throttled channel (`IPC_CHANNELS.stateChanged`), never as separate per-feature events.
- **Renderer**: Vue components never parse serial data or hold their own copy of machine state. They read from the single Pinia store (populated via `useIpc().onState`) and dispatch user actions via `useIpc()` (`src/composables/useIpc.ts`), which wraps `window.api` (exposed by `electron/preload.ts`).

Each module directory under `electron/` (`serial/`, `grbl/`, `job/`, `ipc/`, `osc/`) has a `README.md` stating its responsibility and invariants — read the relevant one before editing that directory.

### Module responsibilities (Main process)

- `electron/serial/transport.ts` — port list/open/close/write/read only. Knows nothing about GRBL syntax or line framing. `mockTransport.ts` is the test double (returns canned `ok`/`error:N`/status strings) used in place of real hardware.
- `electron/grbl/parser.ts` — raw bytes → structured events. Stateless except for newline-framing buffer; no cross-report memory (e.g. WCO caching belongs to `state.ts`, not here).
- `electron/grbl/state.ts` — the single `AppState` (Single Source of Truth), built from parser events.
- `electron/grbl/scheduler.ts` — Character-Counting send queue (GRBL's 127-byte RX buffer) plus immediate-bypass realtime commands (`?`, `~`, `!`, 0x18/Ctrl-X), and ACK-based status polling (never fixed-interval fire-and-forget).
- `electron/grbl/errors.ts` — `error:N`/`ALARM:N` → human-readable text, display-only.
- `electron/job/jobRunner.ts` — G-code file line-feeding, pause/resume/cancel, progress tracking. `currentLine` counts lines that received `ok`/`error` (completed), not lines sent. `pause()` doesn't stop an in-flight (awaiting-ok) line; it stops new sends and pulls unsent queued lines back via `scheduler.clearQueue()`.
- `electron/ipc/gateway.ts` — see IPC boundary above.
- `electron/osc/oscBridge.ts` — subscribes to `state.ts` changes, sends WPos over OSC. Dedupes against the last-sent value; fires independently of renderer draw rate, never on a render-synced timer.
- `electron/app.ts` — composition root. Wires all the above together via dependency injection (`createApp({ win, createTransport })`); this indirection exists specifically so tests/main.ts can inject `MockTransport` instead of the real one. `electron/main.ts` only creates the `BrowserWindow` and calls `createApp`.

### Shared contract

`shared/ipcContract.ts` has zero Node/Electron dependency and is imported by all three processes (main/preload/renderer). It defines:
- `rendererToMainMessageSchema` (zod discriminated union) — every user action dispatched from the renderer.
- `appStateSchema` / `AppState` — the single pushed state shape (`connection`, `grbl`, `job`, `osc`, `console`).
- `IPC_CHANNELS` — the 2-3 channel names (`dispatch`, `stateChanged`, `listPorts`) used by `preload.ts`/`gateway.ts`. `list-ports` is an `invoke`-style request/response outside the push channel since it isn't part of machine state.

When adding a new renderer→main action, add a variant to `rendererToMainMessageSchema`, a handler in `GatewayHandlers` (`electron/ipc/gateway.ts`), a wiring entry in `electron/app.ts`, and a wrapper method in `src/composables/useIpc.ts` — components should never call `window.api` directly.

## Renderer-side persistent state (display settings)

The rule "renderer never holds its own copy of machine state" applies specifically to **machine state** — anything that originates from GRBL, the serial port, or job execution. That state lives only in `electron/grbl/state.ts` and flows to the renderer as a single pushed snapshot via `IPC_CHANNELS.stateChanged`.

**Display settings** are a distinct category: values that are purely renderer-scoped, have no effect on GRBL or serial communication, and do not need to be known by the Main process. These may be persisted in `localStorage` without violating the architecture.

Criteria for a value to qualify as a display setting (all must hold):
1. It does not affect any Main-process behavior (no GRBL commands, no serial writes, no job logic).
2. It is not part of `AppState` and does not need to flow through IPC.
3. It is used only within the renderer (one or more components/composables).

**Implementation rule**: components must not read `localStorage` directly. Wrap all display settings in a dedicated composable under `src/composables/` (e.g. `useDisplayCalibration.ts`) that owns the `localStorage` key, exposes a typed reactive ref, and persists changes internally. Components import the composable — they never call `localStorage` themselves. This keeps the storage key and serialization logic in one place, and makes future migration (e.g. to an Electron settings file) a one-file change.

Current display settings stored in `localStorage`:

| Composable | Key | Description |
|---|---|---|
| `useDisplayCalibration` | `display.calibrationFactor` | Physical-size correction multiplier for the Visualizer (1.0 = CSS-standard 96 dpi) |

## Testing

- Vitest only runs `electron/**/*.test.ts` (see `vite.config.ts` `test.include`) — there's no renderer test suite yet.
- `parser.ts` and `scheduler.ts` have required unit tests; use `mockTransport.ts` to drive `jobRunner.ts`/`scheduler.ts` tests without real hardware.

## Design tokens

Colors/spacing/typography are CSS variables in `src/styles/tokens.css` — never hardcode raw color/spacing values in component `<style>` blocks. Light/dark mode follows `prefers-color-scheme` (macOS-only app, no manual theme toggle). Base tokens: `--color-white`/`--color-black`/`--color-accent` (`#0fd140`), plus derived `--color-surface`, `--color-text-primary/secondary`, `--color-border`, `--color-danger`, `--color-warning`. GRBL machine states map to colors: `Idle`→secondary text, `Run`→accent, `Hold`→warning, `Alarm`→danger.

## Build note

`vite.config.ts` marks `serialport`/`@serialport/bindings-cpp` as external in the main-process Rolldown build (Vite 8 uses Rolldown, hence `rolldownOptions` not `rollupOptions`) — bundling them breaks the native addon's prebuild-resolution logic and causes ABI mismatches. Don't remove this external list when touching the Electron build config.
