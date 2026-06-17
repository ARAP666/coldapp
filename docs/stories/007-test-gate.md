# Story 007 — Test gate and CI

As an operator,
I need unit tests that prove the migration works,
so that I can ship without manually re-running every flow each time.

## Context

This story is the gate behind all the others. It exists so a future
change cannot regress the calculator unlock, the socket protocol, the
message cap, or the Leaflet HTML contract without a red test.

## Brief

- Outcome: `npm test` is green in both `server/` and `app/`.
- User role: developer / operator.
- Business value: catch regressions before they hit Railway.
- Problem: today the only QA is "open Expo and try".
- In scope: Vitest in `server/`, Jest in `app/`, the QA gate command
  in `AGENTS.md`.
- Out of scope: E2E (Detox / Playwright Mobile) — future story.

## Quick Spec

- Server (`server/test/`):
  - `memory-store.test.js` — contract for the in-memory backend.
  - `store-factory.test.js` — picks the right backend.
  - `socket-protocol.test.js` — wire protocol across two clients.
  - `message-cap.test.js` — 200-msg cap at the socket layer.
- App (`app/test/`):
  - `calculator-screen.test.tsx` — unlock flow.
  - `join-screen.test.tsx` — alias normalization.
  - `quick-button.test.tsx` — 3-press confirm.
  - `quick-responses.test.ts` — alerts inventory.
  - `types.test.ts` — color tables.
  - `map-html.test.ts` — Leaflet HTML contract.

## Architecture

- Server: Vitest 1.x. Each test boots a real Express + Socket.IO server
  on a random port; tests use `socket.io-client` to drive it.
- App: Jest 29 + `jest-expo` preset + `@testing-library/react-native`.
  Native modules are mocked in `app/jest.setup.js`.

## Acceptance Criteria

- `cd server && npm test` → all green.
- `cd app && npm test` → all green.
- `cd server && npm run type-check` → clean.
- `cd app && npm run type-check` → clean.
- Adding a regression to `CalculatorScreen` that breaks the 666 unlock
  causes `npm test` to fail.

## QA Evidence

- Run both test suites. Capture the output in this story's "Notes"
  section as it evolves.

## Rollback

Delete the `test/` directories and the `test`/`test:watch` scripts in
each `package.json`. No production code changes.
