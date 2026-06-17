# FRÍA — Agents Guide

## Purpose

This is the operating guide for Codex and human developers working on FRÍA.
Treat this project as production software: real users (even if small), real
network exposure (Socket.IO over public internet), real privacy promises, real
deployment on Railway.

FRÍA is a calculator-styled group communication app: a fake iOS calculator
hides a chat + map + quick alerts experience, communicating over Socket.IO with
an Express backend persisted to PostgreSQL.

## Source Of Truth

- `docs/SPEC.md` — product + technical contract.
- `docs/production-readiness.md` — release gate.
- `docs/development-standard.md` — engineering, FE and QA rules.
- `docs/process/bmad-method.md` — BMAD workflow.
- `docs/stories/` — BMAD stories for migration and feature work.
- `docs/legacy/` — old HTML prototype context, not current truth.

If docs and code disagree, inspect the code, document the conflict, and avoid
behavior changes until the product decision is clear.

## CodeGraph

Use CodeGraph first for structural work:

```bash
codegraph_status
codegraph_files
codegraph_explore
codegraph_search
codegraph_callers
codegraph_callees
codegraph_impact
```

Initialize with `npx @colbymchenry/codegraph init -i` if `.codegraph/` is missing.

## BMAD

Use BMAD for meaningful changes:

- New routes, screens, modules or data models.
- Auth, permissions, room/session semantics, destructive actions, persistence changes.
- Cross-module workflows (chat + map + presence).
- Production launch decisions.

Artifacts go to `_bmad-output/` and migration stories to `docs/stories/`.

## Caveman

Caveman mode changes communication density, not engineering rigor. Use only
when the user explicitly asks for compressed communication.

## Stack Defaults (this project)

| Layer | Stack |
|-------|-------|
| Mobile | React Native + Expo SDK 51, TypeScript, NativeWind avoided (StyleSheet) |
| Map    | Leaflet + OpenStreetMap inside a WebView |
| Realtime | socket.io-client ↔ socket.io (Node) |
| Backend | Node.js + Express + Socket.IO, TypeScript-ready (kept in JS for now) |
| Database | PostgreSQL (Railway plugin), accessed via `pg` |
| Migrations | `db/migration.sql`, applied via Railway Query Runner |
| Validation | Zod at boundaries (server) |
| Tests    | Vitest (server), Jest + @testing-library/react-native (app) |

## Non-Negotiables

- No `any`. Use `unknown` + narrowing.
- No secrets in code or docs.
- No fake production data.
- No destructive migrations without explicit approval and rollback plan.
- No route/API/schema rename without impact audit.
- No styling-only task may change behavior.
- No unfinished screen in primary navigation.
- No push without explicit approval.
- Commits use Conventional Commits and do not mention AI.

## QA Gate

Run the smallest meaningful checks before reporting done:

```bash
# server
cd server && npm run type-check && npm run lint && npm test

# app
cd ../app && npm run type-check && npm test
```

Use the commands that actually exist. If a check cannot run, document why and
what should run next.

## Repo Layout

```txt
fria/
├── server/           Node + Express + Socket.IO + Postgres store
├── app/              Expo + React Native + TypeScript
├── db/               SQL migrations (initial: migration.sql)
├── docs/
│   ├── SPEC.md
│   ├── development-standard.md
│   ├── production-readiness.md
│   ├── process/bmad-method.md
│   └── stories/      numbered BMAD stories
├── README.md
└── AGENTS.md         (this file)
```

## Environment

Server (`server/.env`):

```env
PORT=3000
CLIENT_ORIGIN=*
DATABASE_URL=postgresql://user:pass@host:5432/fria
```

App (`app/.env`):

```env
EXPO_PUBLIC_SERVER_URL=https://fria-server-production.up.railway.app
```

## Privacy Posture (FRÍA-specific)

- Default room is `fria-001`. Multi-room support is intentionally not built.
- **Codenames are server-assigned** (format `WORD-NN`, e.g. `BRAVO-07`).
  The client never types an alias — that protects against typos, name
  leakage, and self-doxxing. The generator and the uniqueness check live
  in `server/src/codename.js`.
- **No auth.** No login, no sign-up, no accounts. Distribution is by
  sharing an APK.
- Messages cap at 200 per room; older ones are GC'd by trigger.
- **Triple-tap "🔥 borrar todo · salir"** clears local state AND emits
  `leave_room` to the server, which deletes the member row. If the room
  becomes empty AND has no messages, the room row itself is dropped.
- **Auto-purge** runs server-side every 5 minutes (configurable) and
  drops rooms whose `last_active` is older than 24h (configurable).
- **Inactivity push**: every 2 hours of member silence the server sends
  an Expo push with the cover-story text "Hay una nueva versión de la
  calculadora…". Chat content NEVER appears in push notifications.
- Server stores last-known lat/lng per member in `members.lat/lng`.
  If the user revokes location permission, the next `location_update` is not sent.
- The current channel is Socket.IO over HTTPS; the "AES-256 / E2E" badges in
  the UI are decorative. Real E2E is a future migration story (`docs/stories/`).

## Distribution

- EAS internal distribution only. APK is shared out-of-band (chat, drive,
  AirDrop, etc.). NEVER submitted to Play Store or App Store.
- The Expo project ID is wired via `EXPO_PUBLIC_EAS_PROJECT_ID` so
  `expo-notifications` can produce real push tokens. Without it, push
  registration still returns a token (good for dev / testing) but pushes
  will not actually deliver.

