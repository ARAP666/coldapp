# FRÍA — Deployment Guide

This is the step-by-step you asked for: Railway for the backend, EAS for
the Android APK. No Play Store. Internal distribution only.

---

## 1. Repo: destrabar el push

Tu `git push` falla con `Permission to ARAP666/coldapp.git denied to PBSDev666`.
Las credenciales cacheadas en Windows son de `PBSDev666`, no de `ARAP666`.

**Opción A — PAT (recomendado, 1 minuto):**

1. Andá a https://github.com/settings/tokens (logueado como **ARAP666**).
2. Generate new token → tipo **Fine-grained** o **Classic**.
3. Scope: `repo` (todo).
4. Expiration: la que prefieras.
5. Pegame el token en el chat y yo corro:

```bash
cd "C:\Users\carlo\Documents\pulse\FRIA\fria-proyecto\fria"
git push https://ARAP666:<TOKEN>@github.com/ARAP666/coldapp.git main
```

(El token queda en el `remote set-url`, después podés seguir usando `git push` normal.)

**Opción B — limpiar credenciales:**

```bash
git credential-manager erase https://github.com
```

La próxima vez que hagas `git push`, Git te va a pedir usuario y contraseña.
Ponés `ARAP666` y el PAT como contraseña.

**Opción C — SSH key:** si ya tenés una key registrada para ARAP666, decime y
cambio el remote a `git@github.com:ARAP666/coldapp.git`.

---

## 2. Railway — Backend

Una vez que el push funcione, configurás el server así:

### Crear proyecto

1. https://railway.app/new → **Deploy from GitHub repo** → elegí `ARAP666/coldapp`.
2. Railway detecta el repo y mira el `package.json` en la raíz. **NO va a
   encontrar un `package.json` ejecutable** porque el código del server vive
   en `server/`. Hay dos formas:
   - **Opción recomendada:** en Railway, en la config del servicio,
     cambiá **Root Directory** a `server` y **Start Command** a `node index.js`.
   - Alternativa: dejá que Railway use Nixpacks y apuntá el build al
     subdirectorio.

### Variables de entorno (Settings → Variables)

Copiá y pegá exactamente esto, reemplazando solo lo marcado:

| Variable | Valor |
|----------|-------|
| `PORT` | `3000` |
| `CLIENT_ORIGIN` | `*` (al principio; ajustá después si querés) |
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (referencia al plugin Postgres) |
| `FRIA_ENCRYPTION_KEY` | una clave base64 de 32 bytes. Generala así en una terminal: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` y pegá el resultado |

### Postgres plugin

1. En el mismo proyecto de Railway, **+ New** → **Database** → **PostgreSQL**.
2. Una vez aprovisionado, abrí el plugin → **Data** → **Query** y pegá
   el contenido completo de `db/migration.sql`. Ejecutá.
3. Eso crea las tablas, el enum `alert_type`, el trigger de cap 200, la
   función `purge_inactive_rooms`, la vista `room_status`, e inserta
   la fila semilla `rooms.id = 'fria-001'`.

### Health check

- El servicio expone `GET /health` que devuelve `{"status":"ok"}`.
- En Settings → **Healthcheck Path** poné `/health` y **Timeout** 30s.

### Verificar deploy

Después del deploy, abrí la URL pública (algo como
`https://coldapp-server.up.railway.app`) y probá:

```bash
curl https://<TU-URL>.up.railway.app/
# {"status":"ok","service":"FRIA Server","store":"pg"}
```

`store: "pg"` confirma que está usando Postgres (no memoria).

---

## 3. EAS — Android APK

Desde la carpeta `app/`:

### Setup inicial (una sola vez)

```bash
cd "C:\Users\carlo\Documents\pulse\FRIA\fria-proyecto\fria\app"
npm install -g eas-cli
eas login                              # logueate con ARAP666
eas build:configure                    # crea eas.json (si no existe)
```

### Setear variables de EAS

```bash
eas env:set EXPO_PUBLIC_SERVER_URL "https://<TU-URL>.up.railway.app" --environment preview
eas env:set EXPO_PUBLIC_EAS_PROJECT_ID "<project-id-que-te-da-eas>" --environment preview
```

(`eas build:configure` te da el `projectId`; también aparece en `eas.json`
después de la primera build.)

### Build del APK

```bash
eas build --platform android --profile preview
```

- El perfil `preview` ya está configurado en `app/eas.json` (genera APK, no
  AAB; apunta a variables de entorno de preview).
- Tarda ~5–10 min la primera vez.
- Cuando termina, EAS te da un link para bajar el APK.

### Distribuir el APK

- Bajar el APK del link.
- Compartirlo por WhatsApp / drive / AirDrop a tus amigos.
- Ellos: activar **"Orígenes desconocidos"** en Ajustes → Seguridad,
  abrir el APK, instalar.

### Primera vez en el teléfono

Cuando abran la app y desbloqueen con `666`, va a salir un **alert nativo**
pidiéndoles que borren el ZIP y la carpeta extraída de Descargas. La app
ofrece un botón "Buscar y borrar" que abre el Filesystem picker de Android.
Si el sistema les da permiso temporal, se borra solo. Si no, les dice qué
borrar manualmente. Después de hacerlo, el alert **nunca más vuelve a salir**
(queda persistido en `expo-secure-store`).

---

## 4. Smoke test end-to-end

1. **Server vivo:** abrí la URL de Railway en el browser. Tiene que devolver
   `{"status":"ok"}`.
2. **DB conectada:** `GET /` debe decir `"store":"pg"`, no `"memory"`.
3. **Migración aplicada:** en el Query del plugin Postgres, corré
   `SELECT COUNT(*) FROM rooms;` → debe devolver `1` (la sala `fria-001`).
4. **APK instalado:** abrí la app en el teléfono → ves la calculadora.
5. **Unlock:** tipeá `333 × 2 =` → te lleva a la pantalla de "Unirse" con un
   codename tipo `BRAVO-07`.
6. **Segundo dispositivo:** instalá el APK en otro teléfono. Hacé el mismo
   unlock. Deberías ver al primero en el mapa.
7. **Push de cobertura:** dejá la app abierta 2 horas sin tocar nada. En
   algún momento Android te muestra la notificación "Actualizá la
   calculadora". Si la tocás, abrís la calculadora (nada de chat).
8. **Salir seguro vs triple-tap:**
   - **SALIR SEGURO** → tu codename queda en la sala (el otro dispositivo
     te sigue viendo). Volvé a entrar y seguís siendo `BRAVO-07`.
   - **Triple-tap 🔥** → tu fila se borra del server. El otro dispositivo
     ya no te ve.

---

## 5. Si algo falla

| Síntoma | Causa probable | Fix |
|---------|----------------|-----|
| `npm install` falla en Railway | versión de Node | Railway lee `engines.node >= 18` del `server/package.json`; ya está |
| `DATABASE_URL not set` en logs | falta el plugin Postgres o la variable | revisar Variables del servicio en Railway |
| `permission denied` al crear la sala | falta correr `db/migration.sql` | ir al Query del plugin Postgres y pegar el SQL |
| `EAS build` falla con "no credentials" | falta configurar la keystore | `eas credentials` o dejar que EAS la genere automática |
| Push no llega a un dispositivo | token de Expo no registrado | verificar permisos de notificación en el dispositivo; `eas env:list` para confirmar `EXPO_PUBLIC_EAS_PROJECT_ID` |
| `disconnected` constante en el mapa | el server no acepta CORS desde el cliente Expo | revisar `CLIENT_ORIGIN` en Railway, debería ser `*` durante dev |

---

## Resumen ejecutivo (lo único que tenés que recordar)

1. **Pegame el PAT de ARAP666** → yo pusheo el repo.
2. En Railway: Root Dir = `server`, env vars como arriba, plugin Postgres,
   correr `db/migration.sql`.
3. En EAS: `eas login` (con ARAP666), `eas build:configure`,
   `eas env:set EXPO_PUBLIC_SERVER_URL=...`, `eas build --platform android --profile preview`.
4. Compartir el APK con tus amigos. Deciles que activen orígenes
   desconocidos, instalen, y borren el ZIP después.
