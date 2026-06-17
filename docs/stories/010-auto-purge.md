# Story 010 — Auto-purge empty rooms

As an operator,
I need the server to drop rooms that have been silent for too long,
so that I do not have to write a cron job or run maintenance by hand.

## Context

Even with the in-memory store, empty rooms linger as Map keys until
process restart. With the Postgres store, room rows would accumulate
forever if nobody pruned them. The `purge_inactive_rooms` SQL function
already exists in the migration; we just need to call it on a timer.

## Brief

- Outcome: rooms that have been empty for >24h are deleted server-side
  on a 5-minute cadence.
- User role: operator (background job; no UX).
- Business value: no manual DB cleanup; storage stays bounded.
- Problem: orphan rooms accumulate.
- In scope: `setInterval` in `server/index.js`, `store.purgeInactiveRooms`.
- Out of scope: configurable retention windows per room; purge of rooms
  that still have members (intentionally not done — we only purge rooms
  that are already empty and stale).

## Quick Spec

- Entry: top-level `setInterval` in `server/index.js`.
- Components: `store.purgeInactiveRooms(olderThanHours)` (calls the SQL
  function in PG; mirrors the behaviour in memory).
- Data read: `rooms.last_active`.
- Data mutated: `DELETE FROM rooms WHERE last_active < NOW() - N hours`,
  cascading to `members`, `messages`, `location_events`, `quick_alerts`.
- Permissions: server-internal only.

## Architecture

- Defaults: 5-minute cadence, 24-hour retention. Override via env vars
  `PURGE_INTERVAL_MS` and `PURGE_OLDER_THAN_HOURS`.
- The timer is created with `unref()` so it does not keep the Node
  process alive during shutdown.
- Errors are logged at `console.error` and swallowed; one bad run does
  not break the next.
- The migration's `purge_inactive_rooms(N)` function is the source of
  truth for the SQL semantics; the in-memory store mirrors it.

## Acceptance Criteria

- A room whose `last_active` is older than the cutoff AND has no
  members is removed on the next tick.
- A room with members is not removed (even if old).
- A purge failure logs but does not crash the server.
- The interval is cleared on SIGTERM / SIGINT.

## QA Evidence

- `cd server && npm test`:
  - `test/memory-store.test.js > purgeInactiveRooms > removes rooms whose
    last_active is older than the cutoff` — covers the happy path and
    the "don't purge active rooms" invariant.
  - Manual: run server with `DATABASE_URL` pointing at a Railway Postgres,
    `purge_inactive_rooms(0)` returns 0; insert a stale row, next tick
    purges it.

## Rollback

Comment out the `setInterval` block in `server/index.js`. The
`purgeInactiveRooms` store method remains available for ad-hoc admin
use.
