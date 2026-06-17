# Story 004 — Socket.IO chat + quick alerts

As a member,
I need to send text messages and 1-tap quick alerts to everyone in
`fria-001`,
so that the group can coordinate in real time with minimal friction.

## Context

This story covers the core communication loop: connect, join, send,
receive, see member list, see quick-alert buttons, and the `abort` flow.

## Brief

- Outcome: two devices on the same Wi-Fi can exchange messages and
  alerts within 200ms of each other.
- User role: member.
- Business value: the actual product.
- Problem: without this, FRÍA is just a calculator.
- In scope: `useSocket`, `useLocation`, `FriaScreen`, `QuickButton`,
  server handlers for `join_room`, `message`, `quick_alert`,
  `location_update`, `disconnect`.
- Out of scope: typing indicators, read receipts, file attachments.

## Quick Spec

- Entry: `app/src/hooks/useSocket.ts`.
- Components: `FriaScreen`, `QuickButton`, `ChatBubble`.
- Data read: history on join, members_update on roster change.
- Data mutated: messages, member coords.
- Permissions: location (for `location_update`).
- Async states: `connected: boolean`, `members`, `messages`,
  `peerLocations`.

## Architecture

- Socket.IO 4 with `transports: ['websocket']`, 5 reconnect attempts.
- Server events: `join_room`, `message`, `quick_alert`,
  `location_update`, plus built-in `disconnect`.
- Client events: `history`, `members_update`, `message`,
  `peer_location`, `quick_alert`.
- All persistence flows through the store interface from story 002.
- 200-msg cap is enforced server-side; client caps locally too
  (`setMessages((prev) => [...prev.slice(-199), msg])`) to stay in sync.

## Acceptance Criteria

- `join_room` emits `history` with the last ≤ 50 messages.
- `members_update` arrives for every join and every disconnect.
- `message` from socket A is received by socket B but never re-echoed
  to A in a way that produces duplicates.
- `quick_alert` emits both a `message` (with `isQuick: true`) and a
  separate `quick_alert` event with the label/icon.
- `location_update` from A is broadcast to B as `peer_location` but
  NOT back to A.
- `disconnect` removes the member from the room; the room is GC'd
  if empty.
- The `ABORTAR` quick button requires 3 presses within 3s; otherwise
  it does nothing.

## QA Evidence

- `server/test/socket-protocol.test.js` covers all six bullets above.
- `server/test/message-cap.test.js` covers the cap.
- `app/test/quick-button.test.tsx` covers the 3-press confirm.

## Rollback

Server: revert `index.js` to the in-memory direct version (still
covered by the in-memory store). App: revert `FriaScreen`,
`useSocket`, `useLocation`. The app reverts to "calculator only".
