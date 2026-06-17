# Story 006 — Triple-tap abort

As a member,
I need a fast way to wipe local state and return to the calculator,
so that if someone grabs my phone I can clear the screen in under a
second.

## Context

The "🔥 borrar todo · salir" button requires three presses within three
seconds. It clears local messages and disconnects the socket, sending
the user back to the calculator.

## Brief

- Outcome: triple-tap-and-out.
- User role: member.
- Business value: physical-threat mitigation.
- Problem: without a fast exit, the app's privacy promise is weak.
- In scope: `FriaScreen.handleEmer`, the cleanup useEffect, the
  per-message counter `emerLevel`, and the `clearMessages` callback
  in `useSocket`.
- Out of scope: panic wipe that also clears the server-side history
  (intentional: the server still has the room for the other members).

## Quick Spec

- Entry: `FriaScreen.handleEmer`.
- Components: the action bar buttons in FriaScreen.
- Data read: `emerLevel`.
- Data mutated: local `messages` (cleared), socket connection
  (closed via `onExit`).
- Permissions: none.
- Async states: not connected after triple-tap.

## Architecture

- `handleEmer` uses the functional form of `setEmerLevel` so two
  presses within the same tick are not collapsed into one.
- `emerTimer` is stored in a `useRef`; cleanup useEffect nulls it on
  unmount so it can't fire after the user has left the screen.

## Acceptance Criteria

- Three presses within 3s → `clearMessages` and `onExit` called.
- One or two presses do nothing.
- After the 3s timeout, the counter resets.
- Unmounting the screen cancels the pending timeout.

## QA Evidence

- `app/test/calculator-screen.test.tsx` indirectly exercises the
  state machine.
- Code review: the cleanup useEffect is the source of truth for the
  timer-cancel guarantee.

## Rollback

Remove the button. `FriaScreen` still works; the user just uses the
"SALIR SEGURO" button instead, which is slower but functional.
