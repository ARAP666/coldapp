# FRÍA — SPEC

Version: 2026-06-17
Status: source of truth for Codex

## Product

FRÍA is a calculator-styled group communication app. The home screen looks and
behaves like a normal iOS-style calculator; entering any expression whose
result equals **666** unlocks the rest of the app: a chat with quick alerts,
real-time member presence, and a live map of every connected member.

Use case: a small trusted group of friends who need a low-key channel that
doesn't look like a chat app to a casual observer. Distribution is by
sharing the EAS-built APK out-of-band. **The app is never published on a
store.** The lock-screen experience must look like a calculator app, not a
chat app.

Business outcome: a discreet, fast, ephemeral coordination channel that runs
on a stock Expo app and a tiny Node backend, deployable in one Railway project.

Explicitly out of scope (current version):

- Real end-to-end encryption (badges are decorative today).
- Multi-room UX (one fixed room `fria-001`).
- Authentication, accounts, login. Trust is social.
- Web/desktop clients.
- Play Store / App Store submission.

## Users And Roles

| Role          | Goal                                  | Permissions                                         |
|---------------|---------------------------------------|-----------------------------------------------------|
| Public user   | Use the calculator                    | None. App looks like a calculator.                  |
| Member        | Send messages, alerts, share location | Join `fria-001`; server assigns a `WORD-NN` codename; can purge the room with triple-tap. |
| Server        | Relay messages, persist state, purge  | Background only. Authoritative for codenames, roster, history, and the inactivity push. |
| Admin (future)| Purge rooms, ban aliases              | Not implemented; reserved for `purge_inactive_rooms`. |

## Identity & Session Model

- **No auth.** The app has no notion of "user". Each `join_room` creates a
  new member row.
- **Codename** is server-assigned, format `WORD-NN` (e.g. `BRAVO-07`),
  unique within the room while the member is online. Pool size is ~5,760
  combinations, more than enough for a friend group.
- **Safe exit** disconnects only that device.
- **Global purge** (`purge_room`) deletes the room and all related data,
  then disconnects every member back to the calculator.
- **Push tokens** are stored per member row. A reinstall overwrites the
  token on next `join_room`.

## Architecture

```txt
fria/
├── app/          Expo (React Native + TypeScript)
│   ├── App.tsx          state machine: calculator → join → fria
│   ├── src/screens/     CalculatorScreen, JoinScreen, FriaScreen
│   ├── src/components/  LeafletMap, QuickButton, ChatBubble
│   ├── src/hooks/       useSocket, useLocation
│   ├── src/assets/      mapHtml (Leaflet bundle), quickResponses
│   └── src/types/       shared Message / Member / AlertType + COLORS
├── server/       Express + Socket.IO
│   ├── index.js         HTTP + WS bootstrap
│   ├── src/store.js     PG-backed room store (interface)
│   └── test/            vitest specs
├── db/           migration.sql   rooms/members/messages/location_events/quick_alerts
└── docs/         SPEC, standards, stories
```

## Stack

| Layer | Stack |
|-------|-------|
| Mobile | React Native + Expo SDK 51, TypeScript, StyleSheet |
| Realtime | socket.io-client ↔ socket.io |
| Backend | Node 18+, Express 4, socket.io 4 |
| Database | PostgreSQL 14+ (Railway plugin), `pg` driver |
| Tests | Vitest (server), Jest + @testing-library/react-native (app) |

## Domain Model

- `Room` — identified by short code, default `fria-001`. Has a `last_active`
  timestamp updated on every message or member change.
- `Member` — `(room_id, alias)` unique. Tracks `socket_id`, `joined_at`,
  `last_seen`, `lat`, `lng`, `is_online`.
- `Message` — append-only chat message with `type` ∈ `alert_type` enum and
  `is_quick` flag distinguishing free-text from quick-alert buttons.
- `LocationEvent` — append-only history of location updates. Optional in the
  app path; the server only inserts when explicitly enabled.
- `QuickAlert` — append-only log of quick-alert button presses, separate from
  `messages` so analytics don't pollute chat.

Invariants:

- A `Message` must belong to a known `Room`.
- A room with zero members may be GC'd by `purge_inactive_rooms`.
- `messages` per room is capped at 200 by trigger `trg_message_cap`.
- Aliases are case-normalized upper-case, ≤ 4 chars (enforced client-side).

## API Rules

### HTTP

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/`        | none | Liveness JSON |
| GET    | `/health`  | none | Railway healthcheck |

### Socket.IO events

| Direction | Event | Payload | Effect |
|-----------|-------|---------|--------|
| C → S | `join_room` | `{ roomId, alias?, pushToken? }` | Register member; server assigns codename if `alias` omitted. |
| S → C | `joined` | `{ alias, roomId }` | Confirms the codename the server assigned. |
| S → C | `history` | `Message[]` (last 50) | Replay |
| S → C | `members_update` | `Member[]` | Roster refresh |
| C → S | `message` | `{ text, type, color? }` | Append message, broadcast |
| S → C | `message` | `Message` | New message (room-wide) |
| C → S | `location_update` | `{ lat, lng }` | Update member coords, broadcast |
| S → C | `peer_location` | `PeerLocation` | One peer's new position |
| C → S | `quick_alert` | `{ label, icon, alertType, color }` | Append alert + broadcast |
| S → C | `quick_alert` | `QuickAlert` | Mirror for analytics UI |
| C → S | `leave_room` | — | Definitive exit for one member: server deletes its row. |
| C → S | `purge_room` | — | Delete the room and all related data for every member. |
| S → C | `room_purged` | — | Clear local FRÍA data and return to the calculator. |
| built-in | `disconnect` | — | Soft disconnect; member marked offline. Skipped if `leave_room` already handled it. |

Every event payload is validated server-side. Unrecognized payloads are ignored
and logged at debug level.

## Database Rules

- Migrations are additive and idempotent (`CREATE … IF NOT EXISTS`,
  `DO $$ … EXCEPTION WHEN duplicate_object`).
- Rollback is the explicit block at the bottom of `db/migration.sql`.
- The 200-message cap is enforced by a trigger, not by application code, so
  direct DB writes can't bypass it.
- Seed data is one row in `rooms` for `fria-001`. Removable without data loss.

## UI Rules

Every screen handles:

- Loading
- Empty
- Error
- Success
- Disabled (no alias / not connected)
- Permission denied (location)

Every screen also defines:

- User role
- Data read
- Data mutated
- Primary action
- Mobile-only (tablet not supported)
- Accessibility notes (high contrast, dark theme only)

## Calculator Unlocking — Acceptance Criteria

- Typing any operation whose integer result is exactly `666` and pressing `=`
  transitions the app from `CalculatorScreen` to `JoinScreen` after a brief
  delay (visually confirms the unlock).
- The calculator must remain usable as a real calculator for other inputs
  (no false positives).
- `AC` resets the expression and current value.

## Join Flow — Acceptance Criteria

- The `JoinScreen` shows a "asignando…" spinner while waiting for the
  server to assign a codename.
- When the server responds (`joined` event), the assigned `WORD-NN`
  codename is shown in large monospace text and the "ENTRAR A LA RED"
  button is enabled.
- Pressing "ENTRAR A LA RED" transitions to `FriaScreen` with that
  codename as the user's identity.
- Pressing "volver a la calculadora" before entering tears down the
  socket and returns to the calculator.
- No user input is accepted for the codename — the server is the only
  source of truth.

## Push Cover — Acceptance Criteria

- When the server detects a member with `activity_at` older than 2h AND
  a registered push token, it sends an Expo push with title "Actualizá la
  calculadora" and the cover-story body.
- The push body NEVER contains the codename, message text, or any other
  room content.
- After sending, the member's `activity_at` is bumped so the same push
  is not sent again for another 2h.
- A user who has revoked notification permission gets no push (silent
  no-op).

## Ephemerality — Acceptance Criteria

- A room with zero members AND zero messages is deleted by the next
  `purge_inactive_rooms` tick (within 5 min by default).
- A triple-tap on "🔥 borrar todo · salir" emits `purge_room`, deletes the
  room and every cascaded record, and immediately returns all connected
  members to the calculator.

## Network And Auth Posture

- The current iteration has **no auth**. Joining a room requires only the
  room code (one fixed value) and a 4-char alias. Trust is social.
- CORS is permissive (`CLIENT_ORIGIN=*`) for now; tightening it is a future
  story once Expo dev/preview origins are pinned.
- All traffic is HTTPS in production (Railway terminates TLS).

## Acceptance Gate

Before shipping a change:

- BMAD spec/story exists for any non-trivial change.
- TypeScript passes (`npm run type-check` in both packages).
- Tests pass (`npm test` in both packages).
- Lint passes (if configured).
- No `any`, no secrets, no fake production data.
- Docs updated: `docs/SPEC.md`, `docs/stories/`, this file's "Status" header.
- DB migration is idempotent and rollback-block is documented.
