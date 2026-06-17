# Story 008 — Server-assigned codenames

As a member,
I want the app to give me a name like "BRAVO-07" instead of making me type one,
so that I can drop in fast and no one has to remember or invent an alias.

## Context

Originally the JoinScreen asked the user to type a 4-character alias. For a
friend group that just wants to coordinate quickly, that's friction — and it
leaks the user's choice to anyone who glances at the screen.

This story makes the server the authority for codenames. The client only
shows what it received.

## Brief

- Outcome: typing 666 + choosing an alias is reduced to "type 666, see your
  codename, enter".
- User role: member.
- Business value: zero typing in the field; covers the "don't make me think"
  case; reinforces that the room identity is temporary.
- Problem: typing aliases on a phone is slow and error-prone.
- In scope: `server/src/codename.js`, `join_room` handler, `joined` event,
  JoinScreen UI, `useSocket.codename` field.
- Out of scope: custom aliases, "remember my codename" persistence.

## Quick Spec

- Entry: `server/src/codename.js` (pure module) + `server/index.js`
  (`assignCodename`) + `app/src/hooks/useSocket.ts` (consumes `joined` event).
- Components: `JoinScreen` shows a spinner while waiting, then the assigned
  codename, then enables "ENTRAR A LA RED".
- Data read: existing room members' aliases (for uniqueness check).
- Data mutated: none server-side beyond the existing `addMember`.
- Permissions: none.

## Architecture

- Codename format: `WORD-NN` where `WORD` is from a 60-word ASCII pool and
  `NN` is in `10..99`. Pool chosen for short, neutral Spanish words (no
  people names, no insults). ~5,760 possible codenames per room.
- Uniqueness: checked against the set of current members in the room at
  join time. Up to 50 retries; throws if a room is full (in practice
  impossible for a friend group).
- Wire: server emits `joined` with `{ alias, roomId }` right after
  `addMember`. Client updates state; the rest of the protocol (message,
  location_update, quick_alert) keeps using the codename.
- Backward compat: if a client sends `alias` in `join_room`, the server
  still accepts it. This keeps the door open for tests and future
  tooling.

## Acceptance Criteria

- A `join_room` with no `alias` results in a `joined` event with a valid
  `WORD-NN` codename.
- Two concurrent joins get distinct codenames.
- A codename is never reused within a room while the original member is
  online.
- `JoinScreen` shows the codename in monospace with a 32pt font; the
  "ENTRAR" button is disabled until both `connected` and `codename` are set.
- 50 codenames generated with `Math.random` produce 50 distinct values
  (the uniqueness check works under default rng).

## QA Evidence

- `cd server && npm test`:
  - `test/codename.test.js` — 9 cases (format, range, pool membership,
    uniqueness, retries, throw after maxAttempts, deterministic with rng).
  - `test/socket-protocol.test.js` — `assigns a codename when the client
    joins without one` and `produces distinct codenames for concurrent
    joins`.
- `cd app && npm test`:
  - `test/join-screen.test.tsx` — 5 cases (loading state, assigned display,
    disabled-when-not-ready, enter pressed, abort pressed).

## Rollback

Restore the manual alias input on `JoinScreen` and remove the codename
generator. The `joined` event becomes optional; clients fall back to
sending `alias` in `join_room`. The codename module stays as dead code
until removed in a later cleanup story.
