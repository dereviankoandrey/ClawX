# CLAUDE.md — ClawX

ClawX is a cross-platform Electron desktop app (React 19 + Vite + TypeScript) providing a GUI for the OpenClaw AI agent runtime. Package manager: **pnpm** (pinned version in `package.json`).

---

## MemoryHub — mandatory session protocol

MemoryHub is the shared project memory for all AI agents. The MCP server ID is `cfb77dd6-e926-4c3f-a56c-64b9a46e6ae2`. Project slug: **`clawx`**.

### Session start (required)

Call `get_context_pack` before any other work:

```
mcp__cfb77dd6-e926-4c3f-a56c-64b9a46e6ae2__get_context_pack
  project: "clawx"
  agent:   "<your agent id>"
```

Then register yourself as active:

```
mcp__cfb77dd6-e926-4c3f-a56c-64b9a46e6ae2__start_session
  agent_id: "<your agent id>"
  project:  "clawx"
  note:     "<brief description of what you're about to do>"
```

### After any significant decision

Whenever you make a non-trivial architectural or design choice (e.g. new API boundary, data model change, dependency addition, security approach), record it immediately:

```
mcp__cfb77dd6-e926-4c3f-a56c-64b9a46e6ae2__log_decision
  project:   "clawx"
  title:     "<short decision title>"
  rationale: "<why this approach; what alternatives were rejected>"
  agent:     "<your agent id>"
```

### Session end (required)

Before finishing your turn — especially after completing a task or making changes — write a handoff so the next agent can continue:

```
mcp__cfb77dd6-e926-4c3f-a56c-64b9a46e6ae2__append_handoff
  project:       "clawx"
  agent:         "<your agent id>"
  summary:       "<what was done>"
  files_changed: "<comma-separated list of changed files>"
  tests_run:     "<commands run and pass/fail status>"
  blockers:      "<anything that prevented completion, or null>"
  next_step:     "<what the next agent should do>"
```

---

## Project overview

| Layer | Technology |
|-------|------------|
| Renderer process | React 19, Zustand, Tailwind CSS, shadcn/ui, Framer Motion |
| Main process | Electron 40+, Node.js 22+, electron-store, electron-updater |
| Build | Vite, electron-builder, TypeScript 5.9 |
| Testing | Vitest (unit), Playwright (E2E), Harness (spec-driven) |
| Package manager | pnpm 10.31.0 |

Supported messaging channels: Telegram, Discord, WeChat, WeChat Work, WhatsApp, Lark/Feishu, DingTalk, QQ Bot.

---

## Quick reference

| Task | Command |
|------|---------|
| Install deps + download uv | `pnpm run init` |
| Dev server (Vite + Electron) | `pnpm dev` |
| Lint (ESLint, auto-fix) | `pnpm run lint` |
| Type check | `pnpm run typecheck` |
| Unit tests (Vitest) | `pnpm test` |
| E2E tests (Playwright) | `pnpm run test:e2e` |
| E2E with visible window | `pnpm run test:e2e:headed` |
| Comms replay metrics | `pnpm run comms:replay` |
| Comms baseline refresh | `pnpm run comms:baseline` |
| Comms regression compare | `pnpm run comms:compare` |
| Full harness checks (CI) | `pnpm run harness:ci` |
| Build frontend only | `pnpm run build:vite` |
| Full build | `pnpm build` |
| Package current platform | `pnpm package` |

---

## Architecture

### Dual-process model

```
Renderer (React)
  └─ src/lib/api-client.ts   ← unified transport (WS → HTTP → IPC)
        └─ Main Process
              ├─ electron/api/   ← Host API HTTP server (localhost)
              ├─ electron/gateway/manager.ts   ← OpenClaw subprocess supervision
              └─ System services (keychain, file I/O, auto-update)
```

### Directory layout

```
electron/       Main process: window, IPC, gateway, host API server, services
  api/          HTTP routes served on localhost (13 modules)
  gateway/      OpenClaw process lifecycle, config sync, WS client
  services/     Provider auth, OS keychain
  utils/        Cross-cutting helpers (OAuth, paths, logging, channels)
  preload/      Secure IPC bridge to renderer

src/            Renderer (React)
  lib/          api-client.ts, host-api.ts, gateway-client.ts, error-model.ts
  pages/        13 page components (Chat, Agents, Channels, Skills, Cron, Models…)
  components/   36 reusable components + shadcn/ui wrappers
  stores/       Zustand stores (chat.ts 97KB, gateway.ts, providers.ts, …)
  i18n/         en / zh-CN / ja-JP / ru-RU translations via i18next
  extensions/   Plugin registry + auto-generated bridge

shared/         Language detection utilities (used by both processes)
harness/        Spec-driven scenario validation framework
tests/
  unit/         Vitest tests
  e2e/          Playwright Electron tests
scripts/        Build utilities
resources/      Icons, screenshots, bundled binaries
```

---

## Critical conventions

### Renderer / Main API boundary

- Renderer **must** call only `src/lib/host-api.ts` and `src/lib/api-client.ts` for all backend operations.
- **Never** add raw `window.electron.ipcRenderer.invoke(...)` calls in pages or components; route them through host-api/api-client instead.
- **Never** call Gateway HTTP endpoints directly from renderer (`fetch('http://127.0.0.1:18789/...')`). Use Main-process proxy channels (`hostapi:fetch`, `gateway:httpProxy`) to avoid CORS / env drift.
- Transport policy is Main-owned and fixed as `WS → HTTP → IPC fallback`. Renderer must not implement protocol switching.

### Comms-change checklist

Any change touching gateway events, runtime send/receive, delivery, or fallback paths must:
1. Run `pnpm run comms:replay`
2. Run `pnpm run comms:compare`
3. Pass both before pushing.

### Spec-driven harness

- AI coding tasks that touch backend communication must start from a spec under `harness/specs/tasks/` and reference `gateway-backend-communication`.
- Run `pnpm harness validate --spec <task-spec>` before implementation review.
- Run `pnpm harness run --spec <task-spec>` (or `--dry-run`) to check the validation flow.
- When adding a new feature or recurring constraint, add or update the harness scenario spec in the same PR.

### UI change validation

Any user-visible UI change must include or update an Electron E2E spec in the same PR so the interaction is covered by Playwright.

### Doc sync

After any functional or architecture change, review `README.md`, `README.zh-CN.md`, and `README.ja-JP.md`. Update docs in the same PR if behavior, flows, or interfaces changed.

---

## Non-obvious caveats

**pnpm version** — Use `corepack enable && corepack prepare` to activate the pinned pnpm version before installing.

**Electron on headless Linux** — `dbus` errors (`Failed to connect to the bus`) are expected and harmless. The app runs with `$DISPLAY` set (e.g. `:1` via Xvfb/VNC).

**`pnpm run lint` race condition** — ESLint may fail with `ENOENT … temp_uv_extract` if `pnpm run uv:download` recently ran. Re-run lint after the download finishes.

**Build script warnings** — Ignored build scripts for `@discordjs/opus` and `koffi` are safe to ignore; they are optional channel dependencies.

**Gateway startup** — OpenClaw Gateway starts automatically on port 18789 when running `pnpm dev`. Readiness takes 10–30 s. The UI works without it (shows "connecting" state); gateway readiness is not required for UI development.

**No database** — The app uses `electron-store` (JSON files) and OS keychain only. No database setup needed.

**AI provider keys** — Actual AI chat requires at least one provider API key in Settings > AI Providers. The app is fully navigable without keys.

**Token usage history** — Reads OpenClaw session transcript `.jsonl` files from the local OpenClaw config directory (not console logs). Scans configured agents and runtime agent directories; treats `.deleted.jsonl` and `.jsonl.reset.*` as valid sources.

**Models page rolling windows** — The 7-day / 30-day filters are rolling windows, not calendar-month buckets. Charts keep all day buckets in the window; only model grouping is capped to top entries.

**OpenClaw Doctor** — Settings > Advanced > Developer exposes `Run Doctor` (`openclaw doctor --json`) and `Run Doctor Fix` (`openclaw doctor --fix --yes --non-interactive`) through the host API. Renderer calls the host route; it does not spawn CLI processes directly.

---

## Environment variables

| Variable | Used for |
|----------|---------|
| `VITE_DEV_SERVER_PORT` | Vite dev server port (default 5173) |
| `OPENCLAW_GATEWAY_PORT` | Gateway port (default 18789) |
| `APPLE_ID` / `APPLE_APP_SPECIFIC_PASSWORD` / `APPLE_TEAM_ID` | macOS notarization |
| `CSC_LINK` / `CSC_KEY_PASSWORD` | Code-signing certificate |
| `GH_TOKEN` | GitHub releases |
| `CI` | CI environment flag |
| `CLAWX_E2E` | E2E mode flag |
| `CLAWX_USER_DATA_DIR` | Custom userData path for E2E tests |

---

## CI workflows

| Workflow | Trigger |
|----------|---------|
| `check.yml` | PR to main — lint, typecheck, unit tests, frontend build |
| `harness.yml` | PR to main — harness spec validation |
| `electron-e2e.yml` | PR to main — Playwright E2E (Linux, macOS, Windows) |
| `comms-regression.yml` | PR to main — comms metrics replay & comparison |
| `release.yml` | Tag push — full multi-platform build + publish |
