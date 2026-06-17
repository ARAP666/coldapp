# Story 005 — Leaflet map in WebView

As a member,
I need to see the live positions of everyone in `fria-001` on a map,
so that I can coordinate spatially without sharing screenshots.

## Context

The map is built with Leaflet inside a `react-native-webview`. Tiles
come from OpenStreetMap; member positions come from `location_update`
events.

## Brief

- Outcome: each connected member has a colored pin on the map; pins
  move in real time; pins disappear when members disconnect.
- User role: member.
- Business value: spatial context for coordination.
- Problem: a chat-only app cannot represent "where" people are.
- In scope: `LeafletMap.tsx`, `mapHtml.ts`, `useLocation.ts`,
  `location_update` event.
- Out of scope: turn-by-turn directions, custom tile providers,
  offline tiles.

## Quick Spec

- Entry: `app/src/components/LeafletMap.tsx`.
- Components: LeafletMap + buildMapHtml.
- Data read: `peerLocations: Map<alias, PeerLocation>` from
  `useSocket`.
- Data mutated: posts `update_me`, `update_peer`, `remove_peer`,
  `center_me` to the WebView.
- Permissions: foreground location.
- Async states: location permission pending / granted / denied.

## Architecture

- `mapHtml.ts` returns a string of HTML+JS+CSS. It includes
  Leaflet 1.9.4 from unpkg, OSM tiles, custom HTML markers with the
  member alias as text, and a `pulse` keyframe on the user's own pin.
- The WebView receives `postMessage` payloads as JSON.
- Listener is attached to both `window.message` and `document.message`
  because Android's WebView delivers on `document`.
- `remove_peer` removes the marker from the map and from the
  `peerMarkers` index; this is critical when a peer disconnects.
- `useLocation` uses `expo-location`'s `watchPositionAsync` and
  cleans up the subscription on unmount. It also keeps the latest
  `onUpdate` callback in a ref so the watcher effect does not re-run
  on every parent render.

## Acceptance Criteria

- On Android, `postMessage` payloads reach the WebView JS (covered
  by the dual-listener code path).
- `update_peer` for an existing alias moves the marker; for a new
  alias, creates a marker with the next color in the palette.
- `remove_peer` deletes the marker.
- `useLocation` cleans up the watcher on unmount (verified by reading
  the code; covered indirectly by the React lifecycle test).
- The user's own pin pulses; peers' pins do not.

## QA Evidence

- `app/test/map-html.test.ts` covers the dual-listener and
  `remove_peer` requirements.
- Manual: launch on two real devices, see each other's pin move.

## Rollback

`FriaScreen` falls back to a list of member names. The socket protocol
stays the same; only the renderer changes.
