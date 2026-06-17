# Story 002 — Postgres-backed room store

As an operator,
I need the FRÍA server to persist rooms, members, messages, quick alerts
and location events to PostgreSQL,
so that data survives Railway restarts and we have auditable history.

## Context

`server/index.js` originally kept everything in a `Map` in process memory.
That works for a dev demo but loses all state on Railway redeploy or crash.
`db/migration.sql` already defines the full schema. The server just isn't
talking to it.

## Brief

- Outcome: the same socket protocol works against either an in-memory
  store or Postgres, controlled by `DATABASE_URL`.
- User role: operator (deploy) and member (read/write at runtime).
- Business value: reliable state across restarts; analytics on
  quick_alerts; future replays from location_events.
- Problem: today's server has no persistence; deploys wipe state.
- In scope: `server/src/store/{memory,pg,index}.js` and a refactor of
  `server/index.js` to use them.
- Out of scope: schema changes (covered by `db/migration.sql` already),
  analytics dashboards, retention policies beyond `purge_inactive_rooms`.

## Quick Spec

- Entry: `server/index.js` (refactored).
- Components:
  - `src/store/index.js` — picks backend.
  - `src/store/memory.js` — dev/test backend.
  - `src/store/pg.js` — production backend.
  - `db/migration.sql` — schema (moved from project root).
- Data read: rooms, members, messages, quick_alerts, location_events.
- Data mutated: same.
- Permissions: server-internal only (no client role changes).
- Async states: same socket events; PG failures surface as
  `[store] Postgres connection failed` on boot.

## Architecture

- Two implementations of one interface:
  - `addMember(roomId, { alias, socketId }) → Member[]`
  - `removeMember(roomId, socketId) → Member[]`
  - `updateMemberLocation(roomId, socketId, lat, lng) → { alias, lat, lng } | null`
  - `getMembers(roomId) → Member[]`
  - `getHistory(roomId, limit = 50) → Message[]`
  - `appendMessage(roomId, msg) → Message`
  - `close()`
- Both expose `MESSAGE_CAP = 200`, `HISTORY_LIMIT = 50`.
- Postgres impl uses `INSERT … ON CONFLICT DO UPDATE` for member upsert,
  and relies on the `trg_message_cap` trigger for the 200-msg cap so the
  behavior is identical to memory even if someone bypasses the app.
- `purge_inactive_rooms(older_than_hours)` is exposed as a SQL function
  in the migration; not yet wired to a cron (future story).

## Acceptance Criteria

- With no `DATABASE_URL`, `npm start` boots the in-memory store and
  the existing socket behavior is byte-identical to before this story.
- With `DATABASE_URL=postgres://…`, the same `npm start` boots the PG
  store and connects on `SELECT 1`.
- After connecting a client, sending 5 messages, restarting the server,
  and reconnecting: a fresh client receives all 5 messages via the
  `history` event.
- Trigger caps messages at 200 in PG; verified by direct insert.
- `purge_inactive_rooms(0)` returns a positive count after a member
  joins a fresh room and the room's `last_active` is in the past.

## QA Evidence

- `cd server && npm test` passes:
  - `test/memory-store.test.js` — unit-level contract.
  - `test/store-factory.test.js` — factory picks correctly.
  - `test/socket-protocol.test.js` — wire protocol unchanged.
  - `test/message-cap.test.js` — cap enforced at the socket layer.
- `npm run type-check` in `server/` passes (`node --check`).
- Manual: connect to a Railway Postgres, run `db/migration.sql`,
  set `DATABASE_URL`, `npm start`, send messages, restart, see history.

## Rollback

Set `DATABASE_URL` to empty string (or unset) on Railway; server falls
back to in-memory. No data loss because the PG store is read+write but
the in-memory store is the system of record during rollback.
