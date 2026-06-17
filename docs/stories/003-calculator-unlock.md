# Story 003 — Calculator unlock (666 trigger)

As a member,
I need the calculator to look and feel like a normal iOS calculator,
and only reveal the chat when I enter an expression that equals 666,
so that the app does not raise suspicion to a casual observer.

## Context

The unlock trigger is the single most important UX detail of FRÍA: it is
the difference between "another calculator" and "a chat app someone
forgot to close".

## Brief

- Outcome: the unlock feels accidental to a bystander.
- User role: anyone with the app installed.
- Business value: the privacy promise of the product.
- Problem: a chat app icon on the home screen defeats the purpose.
- In scope: `CalculatorScreen.tsx` arithmetic, the 666 trigger, the
  400ms delay before transitioning.
- Out of scope: alternative unlock gestures (PIN, biometric, hardware
  button combo) — future story.

## Quick Spec

- Entry: `app/src/screens/CalculatorScreen.tsx`.
- Components: standard iOS-style calculator; AC, +/−, %, ÷, ×, −, +, =, 0–9.
- Data read: none.
- Data mutated: local `cur`, `expr`, `op`, `prev`, `fresh` state.
- Permissions: none.
- Async states: N/A.

## Architecture

- Pure React + RN. `press()` is a `useCallback` over the four state vars.
- On `=`, if `Math.round(res) === 666`, schedule `onUnlock` via
  `setTimeout(400)` to let the `=` animation finish.

## Acceptance Criteria

- `333 × 2 =` → `onUnlock` called exactly once.
- `666 + 0 =` → `onUnlock` called exactly once.
- `333 + 2 =` (335) → `onUnlock` NOT called.
- `100 + 1 =` (101) → `onUnlock` NOT called.
- `AC` clears the display and a subsequent `=` does not unlock.

## QA Evidence

- `app/test/calculator-screen.test.tsx` covers all five cases above.
- `npm test` in `app/` passes.

## Rollback

Revert `CalculatorScreen.tsx` to a no-op stub. The rest of the app
still works; the user just can no longer enter the chat.
