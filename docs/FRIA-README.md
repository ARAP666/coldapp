# FRÍA — Calculator-styled group communication

> Calculadora de pantalla falsa que oculta un chat de amigos con mapa en
> tiempo real y alertas rápidas. **No se sube al Play Store nunca** —
> distribución por APK compartido (EAS internal distribution).
>
> Stack: React Native + Expo en el cliente, Node + Express + Socket.IO
> en el server, PostgreSQL como persistencia. Sin auth, sin cuentas, sin
> login: cada vez que abrís la app el server te asigna un nombre clave
> tipo `BRAVO-07` y entrás al room `fria-001`.

## Estructura

```
fria/
├── server/     Express + Socket.IO, store dual (memoria / Postgres)
├── app/        Expo SDK 51 + React Native + TypeScript
├── db/         Migraciones SQL (db/migration.sql)
├── docs/       SPEC, AGENTS, standards, BMAD stories
└── AGENTS.md   Operating guide para Codex y devs
```

## Quick start (desarrollo local)

### Server

```bash
cd server
npm install
cp .env.example .env  # sin DATABASE_URL usa store en memoria
npm test              # corre vitest
npm start             # arranca en :3000
```

### App

```bash
cd app
npm install
cp .env.example .env
# editar EXPO_PUBLIC_SERVER_URL=http://localhost:3000 (o tu Railway)
npm test                 # corre jest
npx expo start           # arranca Metro, escanear QR con Expo Go
```

## Despliegue (Railway)

1. Crear proyecto en [railway.app](https://railway.app).
2. Servicio → "Deploy from GitHub" o subir carpeta `server/`.
3. Agregar plugin de Postgres al mismo proyecto.
4. Variables de entorno del server:
   - `PORT=3000`
   - `CLIENT_ORIGIN=https://tu-app.expo.dev` (o `*` para empezar)
   - `DATABASE_URL=${{Postgres.DATABASE_URL}}`
5. En la pestaña Query del plugin Postgres, pegar `db/migration.sql`.
6. Build del APK con EAS (perfil `preview`):
   ```bash
   cd app
   npm install -g eas-cli
   eas login
   eas build:configure
   eas build --platform android --profile preview
   ```
7. Bajar el APK del dashboard de EAS y compartirlo por chat / drive /
   AirDrop. **No publicar.**

## Calculadora → FRÍA

1. Abrir la app → ves una calculadora normal.
2. Teclear `333 × 2 =` (o cualquier expresión que dé 666).
3. Te lleva a "Unirse" — el server te asigna un nombre clave
   (`BRAVO-07`, `TIGRE-23`, etc.). Nadie tipea alias.
4. Apretás "ENTRAR A LA RED" y entrás al room `fria-001`.

## Salidas

- **"🚪 SALIR SEGURO"** → vuelve a la calculadora. La sesión queda
  abierta en el server pero tu codename se libera.
- **"🔥 borrar todo · salir"** (triple toque en menos de 3s) → le
  dice al server que borre tu fila entera. Si la sala queda vacía
  sin mensajes, también se borra la sala.

## Privacidad / push cover

- Las notificaciones push NUNCA muestran contenido del chat.
- Cada 2 horas de inactividad el server manda un push con el texto
  "Hay una nueva versión de la calculadora…". Es ruido de cobertura
  para que la app parezca una calculadora real incluso en la pantalla
  de bloqueo.
- Cuando todos salen de una sala, la sala se borra sola (purge cada
  5 min, retención 24 h, ajustable por env).

## Documentación

- `AGENTS.md` — guía de operación para Codex y devs.
- `docs/SPEC.md` — contrato del producto (incluye wire protocol).
- `docs/development-standard.md` — reglas de ingeniería.
- `docs/production-readiness.md` — release gate.
- `docs/process/bmad-method.md` — flujo BMAD.
- `docs/stories/` — historias BMAD numeradas (001–011).
- `docs/legacy/calculadora-fria.html` — prototipo HTML original.

## Estado actual

- App: funcional, instalable con `npm install && expo start`.
- Server: funcional en memoria; Postgres listo pero requiere
  `DATABASE_URL` y aplicar `db/migration.sql` antes de usarlo.
- Tests: `npm test` verde en `server/` (47) y `app/` (26).
- Pendiente: assets reales (los placeholders son PNGs negros con
  texto "FRIA"), primer build EAS, dominio custom en Railway,
  probar push en device real.
