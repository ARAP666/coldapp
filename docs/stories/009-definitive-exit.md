# Story 009 — Definitive exit (triple-tap)

As a member,
I need a way to nuke my presence in the room and return to the calculator
fast — under a second,
so that if my phone gets grabbed I can clear the screen immediately.

## Context

The "🔥 borrar todo · salir" button has existed since v0 but only cleared
the client state. On the server the member row would linger as offline and
the room would still show their codename in any future history replay.

This story makes the triple-tap a real exit: the server deletes the
member's row entirely. If that empties the room AND there are no
remaining messages, the room is dropped too.

## Brief

- Outcome: after triple-tap, the next join in the same room cannot see
  the departed member in any way.
- User role: member.
- Business value: actual privacy, not just client-side theatre.
- Problem: server state survives client clear.
- In scope: `leave_room` socket event, `store.leaveRoom`, the
  `isDefinitiveExit` flag in the disconnect handler, `FriaScreen` calling
  `leaveRoom()` before `onDefinitiveExit`.
- Out of scope: server-side message deletion (messages authored by the
  departing member stay for the others). Privacy is preserved because
  those messages were already broadcast in real time.

## Quick Spec

- Entry: `FriaScreen.handleEmer` triple-tap path.
- Components: server `leave_room` handler; store `leaveRoom`; app
  `useSocket.leaveRoom`.
- Data read: none.
- Data mutated: `DELETE FROM members WHERE room_id = $1 AND socket_id = $2`,
  cascading to `DELETE FROM rooms` when no members and no messages remain.
- Permissions: implicit (must be in the room).
- Async states: socket is force-closed by the server after the delete.

## Architecture

- Client sends `leave_room` (no payload).
- Server sets `isDefinitiveExit = true`, calls `store.leaveRoom`, broadcasts
  the new roster if anyone else remains, then `socket.disconnect(true)`.
- The `disconnect` handler checks `isDefinitiveExit` and skips its own
  `removeMember` call so the member is not double-counted as removed.
- The PG store uses `DELETE FROM members`, not `UPDATE is_online = FALSE`,
  so the row is physically gone.

## Acceptance Criteria

- After `leave_room`, a `getMembers` returns the remaining members
  without the departed one.
- The room is GC'd (room row removed from `rooms`) only if it has zero
  members AND zero messages.
- A subsequent `disconnect` event for the same socket does not produce a
  second `members_update` to the other clients.
- The PG store's `leaveRoom` returns `{ removed, remaining, roomGced }`
  with the expected shape.

## QA Evidence

- `cd server && npm test`:
  - `test/memory-store.test.js > leaveRoom (definitive exit)` — 3 cases.
  - `test/socket-protocol.test.js > leave_room deletes the member and
    broadcasts the updated roster` — confirms broadcast.
  - `test/socket-protocol.test.js > leave_room followed by disconnect does
    not double-remove` — confirms the `isDefinitiveExit` flag works.

## Rollback

Remove the `leave_room` handler; triple-tap falls back to the old
`clearMessages` + `onExit` behaviour. The store's `leaveRoom` method
stays for completeness.
