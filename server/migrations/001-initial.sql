-- =============================================================
--  FRÍA — Migración PostgreSQL
--  Versión: 001
--  Descripción: Schema inicial para persistencia opcional del servidor
--
--  Uso:
--    psql $DATABASE_URL -f fria_migration.sql
--  o en Railway:
--    Pega esto en el Query Runner del plugin de PostgreSQL
-- =============================================================

BEGIN;

-- -----------------------------------------------------------
-- Extensiones
-- -----------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid() + encrypt/decrypt
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- búsqueda de texto en alias

-- -----------------------------------------------------------
-- 1. ROOMS
--    Una sala por código (ej: "fria-001").
--    created_at persiste aunque se vacíe de miembros.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS rooms (
  id           TEXT        PRIMARY KEY,          -- "fria-001", cualquier código libre
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------
-- 2. MEMBERS (snapshots of conexión)
--    Cada vez que alguien se une se inserta/actualiza una fila.
--    socket_id cambia en cada reconexión → upsert por (room_id, alias).
--    is_online = TRUE sólo cuando hay un socket activo.
--    Un disconnect accidental NO borra la fila: marca is_online=FALSE
--    y conserva last_seen/activity_at por si el usuario regresa.
--    Sólo `leave_room` (triple-tap definitivo) borra la fila.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id      TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  alias        TEXT        NOT NULL,
  socket_id    TEXT,                             -- puede quedar NULL al desconectar
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lat          DOUBLE PRECISION,
  lng          DOUBLE PRECISION,
  is_online    BOOLEAN     NOT NULL DEFAULT TRUE,
  push_token   TEXT,                             -- Expo push token (opcional, para "actualizar calculadora")
  activity_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- último message/alert/quick_alert del miembro
  pushed_at    TIMESTAMPTZ,                          -- cuando se le envió el último push de inactividad
  ct           BYTEA       NOT NULL DEFAULT '\x'::bytea,  -- ciphertext de columnas sensibles (pgcrypto)

  CONSTRAINT members_room_alias UNIQUE (room_id, alias)
);

CREATE INDEX IF NOT EXISTS idx_members_room     ON members (room_id);
CREATE INDEX IF NOT EXISTS idx_members_online   ON members (room_id, is_online);
CREATE INDEX IF NOT EXISTS idx_members_activity ON members (room_id, is_online, activity_at);

-- -----------------------------------------------------------
-- 3. ALERT_TYPES  (enum controlado — espeja AlertType de TS)
-- -----------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE alert_type AS ENUM (
    'text', 'status', 'alert', 'police', 'danger',
    'warn', 'stop', 'distance', 'service', 'food',
    'restroom', 'clear', 'abort'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -----------------------------------------------------------
-- 4. MESSAGES
--    Máximo lógico de 200 por sala (se aplica vía trigger).
--    is_quick distingue botones rápidos de texto libre.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS messages (
  id           TEXT        PRIMARY KEY,          -- "${timestamp}-${nanoid}" generado en el server
  room_id      TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  alias        TEXT        NOT NULL,
  text         TEXT        NOT NULL,
  type         alert_type  NOT NULL DEFAULT 'text',
  color        TEXT,                             -- hex opcional (personalización futura)
  is_quick     BOOLEAN     NOT NULL DEFAULT FALSE,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_room_ts ON messages (room_id, timestamp DESC);

-- -----------------------------------------------------------
-- 4a. Trigger: mantener ≤ 200 mensajes por sala
--     Al insertar el mensaje 201+ borra el más antiguo.
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION enforce_message_cap()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  excess INT;
BEGIN
  SELECT COUNT(*) - 200
    INTO excess
    FROM messages
   WHERE room_id = NEW.room_id;

  IF excess > 0 THEN
    DELETE FROM messages
     WHERE id IN (
       SELECT id FROM messages
        WHERE room_id = NEW.room_id
        ORDER BY timestamp ASC
        LIMIT excess
     );
  END IF;

  RETURN NULL;  -- AFTER trigger, no necesita retornar la fila
END;
$$;

DROP TRIGGER IF EXISTS trg_message_cap ON messages;
CREATE TRIGGER trg_message_cap
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION enforce_message_cap();

-- -----------------------------------------------------------
-- 5. LOCATION_EVENTS  (historial de ubicaciones — opcional)
--    Permite replay de rutas. Si no se quiere historial,
--    simplemente no insertar aquí y usar solo members.lat/lng.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS location_events (
  id           BIGSERIAL   PRIMARY KEY,
  room_id      TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  alias        TEXT        NOT NULL,
  lat          DOUBLE PRECISION NOT NULL,
  lng          DOUBLE PRECISION NOT NULL,
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loc_room_alias_ts
  ON location_events (room_id, alias, recorded_at DESC);

-- -----------------------------------------------------------
-- 6. QUICK_ALERTS  (log de alertas rápidas, separado de messages)
--    Permite analítica de qué botones se usan más sin tocar
--    el flujo principal de mensajes.
-- -----------------------------------------------------------
CREATE TABLE IF NOT EXISTS quick_alerts (
  id           BIGSERIAL   PRIMARY KEY,
  room_id      TEXT        NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  alias        TEXT        NOT NULL,
  label        TEXT        NOT NULL,
  icon         TEXT        NOT NULL,
  alert_type   alert_type  NOT NULL,
  color        TEXT,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qa_room_ts ON quick_alerts (room_id, triggered_at DESC);

-- -----------------------------------------------------------
-- 7. Función helper: limpiar salas vacías e inactivas
--    Llamar periódicamente (ej: pg_cron o un endpoint de admin).
--    Por diseño FRÍA no persiste datos → borra salas sin
--    actividad en las últimas N horas.
-- -----------------------------------------------------------
CREATE OR REPLACE FUNCTION purge_inactive_rooms(older_than_hours INT DEFAULT 24)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE
  deleted INT;
BEGIN
  DELETE FROM rooms
   WHERE last_active < NOW() - (older_than_hours || ' hours')::INTERVAL;

  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- -----------------------------------------------------------
-- 8. Vista útil: estado actual de cada sala
-- -----------------------------------------------------------
CREATE OR REPLACE VIEW room_status AS
SELECT
  r.id                                        AS room_id,
  r.created_at,
  r.last_active,
  COUNT(m.id) FILTER (WHERE m.is_online)      AS online_members,
  COUNT(m.id)                                 AS total_members_ever,
  (SELECT COUNT(*) FROM messages msg WHERE msg.room_id = r.id) AS message_count
FROM rooms r
LEFT JOIN members m ON m.room_id = r.id
GROUP BY r.id, r.created_at, r.last_active;

-- -----------------------------------------------------------
-- 9. Insertar sala por defecto (la que usa la app)
-- -----------------------------------------------------------
INSERT INTO rooms (id) VALUES ('fria-001')
  ON CONFLICT (id) DO NOTHING;

COMMIT;

-- =============================================================
--  ROLLBACK (ejecutar solo si necesitas deshacer todo)
-- =============================================================
-- BEGIN;
-- DROP VIEW  IF EXISTS room_status;
-- DROP TABLE IF EXISTS quick_alerts       CASCADE;
-- DROP TABLE IF EXISTS location_events    CASCADE;
-- DROP TABLE IF EXISTS messages           CASCADE;
-- DROP TABLE IF EXISTS members            CASCADE;
-- DROP TABLE IF EXISTS rooms              CASCADE;
-- DROP TYPE  IF EXISTS alert_type;
-- DROP FUNCTION IF EXISTS enforce_message_cap();
-- DROP FUNCTION IF EXISTS purge_inactive_rooms(INT);
-- COMMIT;
