# Story 001 — HTML to React Native + Expo

As a developer,
I need FRÍA's calculator UI to live in a real React Native + Expo app,
so that the app can ship as a native binary and use platform APIs
(location, haptics, secure store) instead of only the browser.

## Context

FRÍA started as a single `calculadora-fria.html` file: an iOS-styled
calculator that, when the result of an expression equals 666, replaces the
display with a chat + map view using a hand-rolled socket.io-client shim.

The HTML prototype is preserved at `docs/legacy/calculadora-fria.html`. It
is no longer the source of truth.

## Brief

- Outcome: the same UX exists as a real Expo app on iOS and Android.
- User role: anyone with the app installed.
- Business value: distribution via App Store / Play Store; access to
  Expo Location; future-proofing for native modules.
- Problem: the HTML version cannot ship as an app, has no native APIs,
  and cannot use the device's real location at the OS level.
- In scope: CalculatorScreen, JoinScreen, FriaScreen, the socket hook,
  the location hook, the Leaflet WebView map, the quick-alert buttons.
- Out of scope: real E2E encryption, push notifications, multi-room.

## Quick Spec

- Entry: `app/App.tsx` — `useState` machine over `calculator → join → fria`.
- Components:
  - `src/screens/CalculatorScreen.tsx`
  - `src/screens/JoinScreen.tsx`
  - `src/screens/FriaScreen.tsx`
  - `src/components/LeafletMap.tsx`
  - `src/components/QuickButton.tsx`
  - `src/components/ChatBubble.tsx`
  - `src/hooks/useSocket.ts`
  - `src/hooks/useLocation.ts`
  - `src/assets/mapHtml.ts`
  - `src/assets/quickResponses.ts`
  - `src/types/index.ts`
- Data read: alias chosen by user.
- Data mutated: chat history on server (via socket), member state.
- Permissions: `ACCESS_FINE_LOCATION`, `NSLocationWhenInUseUsageDescription`.
- Async states: connecting, connected, disconnected, permission denied.

## Architecture

- Stack: Expo SDK 51 + React Native 0.74 + TypeScript + socket.io-client.
- Map: Leaflet 1.9.4 in a `react-native-webview`. RN ↔ WebView via
  `postMessage` (both `window` and `document` listeners for Android compat).
- State: local component state + a single `useSocket` hook. No Redux.
- Module-resolver removed from `babel.config.js` (path alias unused).

## Acceptance Criteria

- `cd app && npm install && npx expo start` boots without errors.
- Calculator evaluates arithmetic correctly for non-666 inputs.
- Calculator + 666 (e.g. `333 × 2`) transitions to JoinScreen after 400ms.
- JoinScreen enforces 4-char uppercase alias.
- FriaScreen renders MAP and CHAT tabs; both show "desconectado" with
  red dot when no socket is connected.
- Triple-tap on "🔥 borrar todo · salir" within 3s clears local messages
  and returns to CalculatorScreen.
- Placeholder PNG assets exist at `app/assets/icon.png`,
  `app/assets/splash.png`, `app/assets/adaptive-icon.png`,
  `app/assets/favicon.png` so `eas build` does not fail.

## QA Evidence

- `npm test` in `app/` passes:
  - `test/calculator-screen.test.tsx` (5 cases including the 666 unlock).
  - `test/join-screen.test.tsx` (5 cases for alias normalization).
  - `test/quick-button.test.tsx` (3 cases including 3-press confirm).
  - `test/quick-responses.test.ts` (4 cases).
  - `test/types.test.ts` (3 cases).
  - `test/map-html.test.ts` (5 cases).
- `npm run type-check` in `app/` passes.

## Rollback

Revert to the previous `app/` tree (calculator-html-only). The HTML
prototype at `docs/legacy/calculadora-fria.html` is independent and
remains untouched as a safety net.
