// Postgres-backed store. Mirrors the in-memory store's interface so the
// socket layer is store-agnostic. Schema lives in /db/migration.sql.
//
// Sensitive columns (alias, push_token, message text) are encrypted at
// rest with AES-256-GCM via src/crypto.js. The key is held by the server
// and never sent to the client.

const HISTORY_LIMIT = 50;
const MESSAGE_CAP = 200;
const { encrypt, decrypt, packEnvelope, unpackEnvelope } = require('../crypto');

function createPgStore(pool) {
  return {
    kind: 'pg',
    MESSAGE_CAP,
    HISTORY_LIMIT,

    async addMember(roomId, { alias, socketId }) {
      await pool.query(
        `INSERT INTO rooms (id) VALUES ($1)
         ON CONFLICT (id) DO NOTHING`,
        [roomId]
      );
      const aliasEnv = encrypt(alias);
      const aliasBlob = packEnvelope(aliasEnv);
      await pool.query(
        `INSERT INTO members
           (room_id, alias, socket_id, joined_at, last_seen, is_online, activity_at, ct)
         VALUES ($1, $2, $3, NOW(), NOW(), TRUE, NOW(), $4)
         ON CONFLICT (room_id, alias) DO UPDATE
           SET socket_id  = EXCLUDED.socket_id,
               joined_at  = NOW(),
               last_seen  = NOW(),
               is_online  = TRUE,
               activity_at = NOW(),
               ct          = EXCLUDED.ct`,
        [roomId, alias, socketId, aliasBlob]
      );
      await pool.query(`UPDATE rooms SET last_active = NOW() WHERE id = $1`, [roomId]);
      return this.getMembers(roomId);
    },

    async leaveRoom(roomId, socketId) {
      const { rows: existingRows } = await pool.query(
        `SELECT socket_id, alias, joined_at, last_seen, lat, lng, activity_at, pushed_at, ct
           FROM members WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId]
      );
      if (existingRows.length === 0) {
        return { removed: null, remaining: [], roomGced: false };
      }
      const removed = rowToMember(existingRows[0]);
      await pool.query(
        `DELETE FROM members WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId]
      );
      const remaining = await this.getMembers(roomId);
      const roomGced = await this._maybeDropEmptyRoom(roomId);
      return { removed, remaining, roomGced };
    },

    async markInactive(roomId, socketId) {
      const { rowCount } = await pool.query(
        `UPDATE members SET is_online = FALSE, socket_id = NULL, last_seen = NOW()
          WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId]
      );
      if (rowCount === 0) return [];
      return this.getMembers(roomId);
    },

    async removeMember(roomId, socketId) {
      return this.markInactive(roomId, socketId);
    },

    async forceDeleteMember(roomId, socketId) {
      const { rows: existingRows } = await pool.query(
        `SELECT socket_id, alias, joined_at, last_seen, lat, lng, activity_at, pushed_at, ct
           FROM members WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId]
      );
      if (existingRows.length === 0) {
        return { removed: null, remaining: [], roomGced: false };
      }
      const removed = rowToMember(existingRows[0]);
      await pool.query(
        `DELETE FROM members WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId]
      );
      const remaining = await this.getMembers(roomId);
      const roomGced = await this._maybeDropEmptyRoom(roomId);
      return { removed, remaining, roomGced };
    },

    async purgeRoom(roomId) {
      const { rowCount } = await pool.query(
        `DELETE FROM rooms WHERE id = $1`,
        [roomId]
      );
      return rowCount > 0;
    },

    async updateMemberLocation(roomId, socketId, lat, lng) {
      const { rows: aliasRows } = await pool.query(
        `SELECT alias FROM members WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId]
      );
      if (aliasRows.length === 0) return null;
      const alias = aliasRows[0].alias;
      await pool.query(
        `UPDATE members SET lat = $3, lng = $4, last_seen = NOW()
          WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId, lat, lng]
      );
      return { alias, lat, lng };
    },

    async getMembers(roomId) {
      const { rows } = await pool.query(
        `SELECT socket_id, alias, joined_at, last_seen, lat, lng, activity_at, pushed_at, ct
           FROM members
          WHERE room_id = $1 AND is_online = TRUE
          ORDER BY joined_at ASC`,
        [roomId]
      );
      return rows.map(rowToMember);
    },

    async getAllMembers(roomId) {
      const { rows } = await pool.query(
        `SELECT socket_id, alias, joined_at, last_seen, lat, lng, activity_at, pushed_at, ct
           FROM members
          WHERE room_id = $1
          ORDER BY joined_at ASC`,
        [roomId]
      );
      return rows.map(rowToMember);
    },

    async getHistory(roomId, limit = HISTORY_LIMIT) {
      const { rows } = await pool.query(
        `SELECT id, alias, text, type, color, timestamp, is_quick
           FROM messages
          WHERE room_id = $1
          ORDER BY timestamp DESC
          LIMIT $2`,
        [roomId, limit]
      );
      return rows.reverse().map(rowToMessage);
    },

    async appendMessage(roomId, msg) {
      await pool.query(
        `INSERT INTO rooms (id) VALUES ($1)
         ON CONFLICT (id) DO NOTHING`,
        [roomId]
      );
      const id = msg.id || `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const timestamp = msg.timestamp ? new Date(msg.timestamp) : new Date();
      const textEnv = encrypt(msg.text);
      const textBlob = packEnvelope(textEnv);
      await pool.query(
        `INSERT INTO messages (id, room_id, alias, text, type, color, is_quick, timestamp)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          id,
          roomId,
          msg.alias,
          textBlob,
          msg.type || 'text',
          msg.color || null,
          Boolean(msg.isQuick),
          timestamp,
        ]
      );
      await pool.query(
        `UPDATE rooms SET last_active = NOW() WHERE id = $1`,
        [roomId]
      );
      if (msg.socketId) {
        await pool.query(
          `UPDATE members
              SET activity_at = NOW(),
                  pushed_at   = NULL
            WHERE room_id = $1 AND socket_id = $2`,
          [roomId, msg.socketId]
        );
      }
      return {
        id,
        alias: msg.alias,
        text: msg.text,
        type: msg.type || 'text',
        color: msg.color || null,
        timestamp: timestamp.getTime(),
        isQuick: Boolean(msg.isQuick),
      };
    },

    async setPushToken(roomId, socketId, token) {
      const enc = encrypt(token);
      const blob = packEnvelope(enc);
      const { rowCount } = await pool.query(
        `UPDATE members SET push_token = $3
          WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId, blob]
      );
      return rowCount > 0;
    },

    async findPushCandidates(olderThanMs, repushAfterMs) {
      const { rows } = await pool.query(
        `SELECT room_id, socket_id, alias, activity_at, pushed_at, push_token
           FROM members
          WHERE push_token IS NOT NULL
            AND activity_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
            AND (pushed_at IS NULL
                 OR pushed_at < NOW() - ($2::bigint * INTERVAL '1 millisecond'))`,
        [olderThanMs, repushAfterMs]
      );
      return rows.map((r) => ({
        roomId: r.room_id,
        socketId: r.socket_id,
        alias: r.alias,
        activityAt: new Date(r.activity_at).getTime(),
        pushedAt: r.pushed_at ? new Date(r.pushed_at).getTime() : null,
        // Return push tokens in plaintext (server-side only).
        pushToken: decrypt(unpackEnvelope(r.push_token)),
      }));
    },

    async findExpiredSessions(pushedAtOlderThanMs) {
      const { rows } = await pool.query(
        `SELECT room_id, socket_id, alias, pushed_at, activity_at
           FROM members
          WHERE pushed_at IS NOT NULL
            AND pushed_at < NOW() - ($1::bigint * INTERVAL '1 millisecond')
            AND activity_at < pushed_at`,
        [pushedAtOlderThanMs]
      );
      return rows.map((r) => ({
        roomId: r.room_id,
        socketId: r.socket_id,
        alias: r.alias,
        pushedAt: new Date(r.pushed_at).getTime(),
        activityAt: new Date(r.activity_at).getTime(),
      }));
    },

    async markPushSent(roomId, socketId) {
      const { rowCount } = await pool.query(
        `UPDATE members SET pushed_at = NOW()
          WHERE room_id = $1 AND socket_id = $2`,
        [roomId, socketId]
      );
      return rowCount > 0;
    },

    async purgeInactiveRooms(olderThanHours) {
      const { rows } = await pool.query(
        `DELETE FROM rooms
          WHERE last_active < NOW() - ($1::double precision * INTERVAL '1 hour')
          RETURNING id`,
        [olderThanHours]
      );
      return rows.map((row) => row.id);
    },

    // Dropping the last member deletes the room and all cascaded history.
    async _maybeDropEmptyRoom(roomId) {
      const { rows } = await pool.query(
        `SELECT COUNT(*) AS member_count FROM members WHERE room_id = $1`,
        [roomId]
      );
      if (Number(rows[0].member_count) === 0) {
        await pool.query(`DELETE FROM rooms WHERE id = $1`, [roomId]);
        return true;
      }
      return false;
    },

    async close() {
      await pool.end();
    },
  };
}

function rowToMember(r) {
  // The ct column holds the encrypted alias envelope. Plaintext alias
  // was kept for backwards compatibility in earlier writes, so fall
  // back to it when ct is empty.
  let alias = r.alias;
  if (r.ct && r.ct.length > 0) {
    const env = unpackEnvelope(r.ct);
    const decrypted = decrypt(env);
    if (decrypted) alias = decrypted;
  }
  return {
    socketId: r.socket_id,
    alias,
    joinedAt: new Date(r.joined_at).getTime(),
    lastSeen: new Date(r.last_seen).getTime(),
    lat: r.lat == null ? undefined : Number(r.lat),
    lng: r.lng == null ? undefined : Number(r.lng),
    activityAt: r.activity_at ? new Date(r.activity_at).getTime() : undefined,
    pushedAt: r.pushed_at ? new Date(r.pushed_at).getTime() : null,
  };
}

function rowToMessage(r) {
  let text = '';
  if (r.text) {
    const env = unpackEnvelope(r.text);
    const decrypted = decrypt(env);
    if (decrypted) text = decrypted;
  }
  return {
    id: r.id,
    alias: r.alias,
    text,
    type: r.type,
    color: r.color,
    timestamp: new Date(r.timestamp).getTime(),
    isQuick: r.is_quick,
  };
}

module.exports = { createPgStore, MESSAGE_CAP, HISTORY_LIMIT };
