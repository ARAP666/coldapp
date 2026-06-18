# Story 012 — Automatic database migration

As an operator,
I need the server to apply its idempotent PostgreSQL migration before boot,
so that a fresh or replaced Railway database cannot accept traffic without
the required tables.

## Brief

- Outcome: `npm start` prepares the PostgreSQL schema before starting Socket.IO.
- User role: Railway operator.
- Business value: deployments recover automatically from an empty database.
- Problem: the server only checked `SELECT 1`; missing tables failed later on
  the first `join_room`.
- In scope: startup command, migration runner, packaged SQL, tests and deploy docs.
- Out of scope: destructive schema changes or a multi-version migration framework.

## Quick Spec

- Entry point: `server/scripts/migrate.js`, invoked by `npm start`.
- Data mutated: idempotent objects defined by migration 001.
- Permissions: the configured PostgreSQL role must create tables, types,
  functions, triggers, indexes, views and extensions.
- Async states: no `DATABASE_URL` skips migration for the in-memory store;
  migration errors stop startup before the HTTP/WebSocket listener opens.

## Architecture

- `db/migration.sql` remains the repository source migration.
- `server/migrations/001-initial.sql` is the deployable copy because Railway
  runs with `server/` as its root directory.
- A test requires both files to remain byte-identical.
- A PostgreSQL advisory lock serializes migrations during overlapping deploys.
- Startup verifies `rooms`, `members` and `messages` after applying SQL.

## Acceptance Criteria

- A fresh PostgreSQL database gains the complete schema on `npm start`.
- An already-migrated database starts without destructive changes.
- Missing `DATABASE_URL` continues using the in-memory store.
- Migration failure exits non-zero and prevents the server from starting.
- Automated tests detect divergence between source and packaged migrations.

## QA Evidence

- `cd server && npm run type-check` — passed.
- `cd server && npm test` — passed: deployment configuration is covered so
  Railway, Nixpacks and Procfile cannot bypass `npm start`.
- `cd server && npm run migrate` without `DATABASE_URL` — skipped cleanly,
  preserving the in-memory development path.

## Rollback

Restore the previous `start` script (`node index.js`) and apply
`db/migration.sql` manually. Existing database objects and data are retained.
