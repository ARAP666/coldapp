# FRÍA — Production Readiness

## Environment

- `server/.env.example` documents every required variable.
- Secrets are not committed. `.env` is gitignored in both packages.
- Production target: Railway. Local target: same Node 18+ runtime.
- App env vars are all `EXPO_PUBLIC_*`, safe to embed in the bundle.

## Database

- `db/migration.sql` applies cleanly on a fresh Railway Postgres plugin.
- Rollback block at the bottom of `db/migration.sql` is documented.
- No destructive migrations ship without an explicit story + manual approval.
- Seed data (the `fria-001` row) is idempotent (`ON CONFLICT DO NOTHING`).

## Security

- No auth in v1; documented in `SPEC.md`. Adding auth is a separate story.
- Socket.IO CORS: `CLIENT_ORIGIN` is a single origin in production, `*`
  only in dev.
- No stack traces or member-private data leak to other members.
- Quick-alert "ABORTAR" requires triple confirmation; not bypassable from
  the network.

## Frontend

- Calculator must function as a normal calculator for all non-666 inputs.
- Unlock animation is `setTimeout(400ms)`; any behavior change is a story.
- Map degrades gracefully when peers are empty (just shows the user's pin).
- Chat handles disconnected state visibly (red dot, "desconectado" label).
- Triple-tap abort clears local state and disconnects the socket.
- All async surfaces handle: loading, empty, error, success, disabled,
  permission denied.

## Tests

Run project-specific checks before declaring done:

```bash
# server
cd server
npm run type-check
npm test

# app
cd ../app
npm run type-check
npm test
```

Add E2E (Detox or Playwright Mobile) for the unlock flow before public launch.

## Release Checklist (v1)

- [ ] Migration applied on Railway Postgres (`db/migration.sql`).
- [ ] `members.push_token` and `members.activity_at` columns exist.
- [ ] Server deployed; `/health` returns 200.
- [ ] `EXPO_PUBLIC_SERVER_URL` points at the deployed server.
- [ ] `EXPO_PUBLIC_EAS_PROJECT_ID` set on the EAS project so push
      tokens are real.
- [ ] EAS internal-distribution build succeeds for Android preview
      profile. APK is downloaded and stored somewhere shareable.
- [ ] Manual: unlock with `333 × 2 =`, see a server-assigned codename
      like `BRAVO-07`, press enter.
- [ ] Manual: a second device unlocks and gets a DIFFERENT codename
      (`TIGRE-12` or similar). Both see each other on the map.
- [ ] Manual: send a quick alert, it appears in chat on both.
- [ ] Manual: revoke location permission on one device, the other
      continues working.
- [ ] Manual: triple-tap "🔥 borrar todo · salir" on one device. After
      a refresh, the other device's roster no longer shows the departed
      member's codename.
- [ ] Manual: leave the app idle on a real device for 2h, receive the
      "Actualizá la calculadora" push. The push body contains no chat
      content.
- [ ] Manual: wait for the room to be empty, observe `purge` log line
      `[purge] removed N inactive rooms` within 5 minutes.
- [ ] All unit tests green (`server` and `app`).
