# Story 011 — "Actualizá la calculadora" cover push

As a member,
I want the app to send me an innocuous notification every couple of hours
if I left the chat open and idle,
so that nobody around me sees a chat app's notification on my lock screen.

## Context

The product's hardest privacy problem is the notification surface. If the
app shows "TIGRE-42: hola" on the lock screen, the cover is blown the
moment someone glances. The fix is to never show chat content in
notifications — but we still need a way to nudge idle users back so the
connection doesn't look suspicious either.

The chosen nudge: a notification whose body is "Hay una nueva versión de
la calculadora. Mantené la app actualizada…" — a perfectly normal
reminder for a calculator app. If the user actually opens the app, they
land on the calculator; the chat is unlocked only with the 666 trigger.

## Brief

- Outcome: every 2 hours of inactivity, the user gets a "update the
  calculator" push. No chat content ever leaks to the OS notification
  surface.
- User role: member.
- Business value: keeps the cover story consistent.
- Problem: a chat app must not show chat notifications.
- In scope: `app/src/push.ts` (token registration), `server/src/push.js`
  (Expo push client), `findInactiveSessions` and the periodic
  `inactivityTimer` in `server/index.js`, schema migration for
  `push_token` + `activity_at`.
- Out of scope: rich notifications, action buttons, in-app banners for
  incoming messages (those are intentional — chat content stays in-app).

## Quick Spec

- Entry: client registers for push on mount; sends the token in
  `join_room` payload. Server stores it on the member row.
- Components: Expo's push endpoint, server's `sendExpoPush` + periodic
  timer.
- Data read: `members WHERE is_online AND push_token IS NOT NULL AND
  activity_at < NOW() - 2 hours`.
- Data mutated: `activity_at` gets bumped after a successful push so we
  do not spam every 10 minutes.
- Permissions: user must have granted notification permission. The app
  treats denial as a no-op (no token → no push).

## Architecture

- Codename never appears in the push body. The push is generic.
- `INACTIVITY_MS` (default 2h) and `INACTIVITY_TICK_MS` (default 10m)
  are env vars for tweaking.
- After sending the push, the server appends a `__inactivity_push_sent__`
  message which bumps `activity_at` via the normal message path — this
  is a cheap trick that reuses the existing `appendMessage` plumbing
  and keeps the pusher stateless.
- `data.kind = 'update_calculator'` is set on the push payload so future
  analytics can split these from other pushes.

## Acceptance Criteria

- A member with `activity_at` older than `INACTIVITY_MS` AND a push
  token gets a push with the cover-story text on the next tick.
- A member who sent a message in the last `INACTIVITY_MS` is skipped.
- A member without a push token is skipped (silently).
- The push body does NOT contain the codename or any message text.
- After the push is sent, that member's `activity_at` is bumped so they
  do not get another push for another `INACTIVITY_MS`.

## QA Evidence

- `cd server && npm test`:
  - `test/push.test.js` — 4 cases (empty no-op, POST shape, non-2xx
    throws, `buildUpdateCalculatorPush` text).
  - `test/memory-store.test.js > findInactiveSessions > returns only
    online sessions that have a push token and are past the threshold`.
- Manual: register a real Expo push token, join a room, idle for 2h,
  receive the push on a physical device.

## Operational Notes

- Push tokens are scoped per device + app install. When a user reinstalls
  the APK they get a new token; the server overwrites the old one on
  next `join_room`.
- The Expo push endpoint (`https://exp.host/--/api/v2/push/send`) is
  rate-limited to 600 req/min per Expo account. The 10-minute tick +
  small friend group stays well under that.
- The push body deliberately mentions "calculadora" to keep the cover
  consistent. If the wording is ever changed, `buildUpdateCalculatorPush`
  in `server/src/push.js` is the only place to edit.

## Rollback

Set `INACTIVITY_MS` to a very large value (e.g. `31536000000` for a year)
or skip the timer block. `expo-notifications` can also be removed from
the app's `package.json`.
