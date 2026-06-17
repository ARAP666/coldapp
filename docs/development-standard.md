# FRÍA — Development Standard

## Philosophy

Build practical, typed, tested, rollback-friendly software. FRÍA's code must
read like a small, disciplined tool, not a framework. The current product is
two screens and a backend: keep the moving parts visible.

## SOLID In Practice

- Single responsibility: `screens/*` render, `hooks/*` orchestrate effects,
  `server/src/store.js` persists, validators validate at the socket boundary.
- Open/closed: `store.js` exposes an interface; the in-memory implementation
  and the Postgres implementation both satisfy it. New persistence = new file.
- Liskov: any replacement of `store.js` must keep the same event semantics.
- Interface segregation: hooks accept small option objects (`useSocket({…})`).
- Dependency inversion: hooks and screens depend on the socket contract,
  not on socket.io's `Socket` type when avoidable.

## Modern React (RN)

- Hooks are the unit of reuse; no class components.
- Keep derived state derived (`useMemo` only when the cost is real).
- Cleanup every `useEffect` that opens a resource (`watchPositionAsync`,
  socket, timers).
- Model async states explicitly: `connected` is a real boolean; never
  infer it from "did the message go through?".
- Avoid prop drilling past two levels; lift state to `App.tsx` for now.
- Do not memoize by reflex; profile first.

## Backend Rules

- Validate every socket payload at the boundary; reject silently + log on
  bad input.
- Keep `GET` read-only. No state changes outside socket handlers or the
  future REST surface.
- Make membership / message writes idempotent where retries are likely
  (join_room on reconnect should upsert the member row).
- Log connection lifecycle events; never log full messages (privacy).
- No stack traces in production responses.

## Postgres

- Constraints enforce important invariants:
  - `members_room_alias UNIQUE (room_id, alias)`,
  - `messages.alert_type` is a real enum,
  - the 200-msg cap is a `BEFORE`/`AFTER` trigger, not application code.
- Indexes for common filters: `(room_id)`, `(room_id, is_online)`,
  `(room_id, timestamp DESC)`, `(room_id, alias, recorded_at DESC)`.
- Migrations are idempotent. Rollback is documented in `db/migration.sql`.

## Release Rule

No known broken screen, hook, socket event, migration, or critical workflow
ships. Every release candidate must pass:

```bash
# server
cd server && npm run type-check && npm test

# app
cd ../app && npm run type-check && npm test
```

## FRÍA-Specific Don'ts

- Do not add real auth without a BMAD story.
- Do not add multi-room UX without a BMAD story.
- Do not change `alert_type` enum values without a migration that adds the
  new value as `ADD VALUE` first (Postgres enums can't be reordered).
- Do not persist full message bodies outside of `db/migration.sql` paths.
- Do not log alias + message + location together, ever.
