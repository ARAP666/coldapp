// In-memory store. Default implementation used in dev and in unit tests.
// Behavior must match the Postgres implementation event-for-event.

const MESSAGE_CAP = 200;
const HISTORY_LIMIT = 50;

function createRoom(roomId) {
  return {
    id: roomId,
    members: new Map(),
    messages: [],
    lastActive: Date.now(),
  };
}

function createMemoryStore() {
  const rooms = new Map();

  function getOrCreate(roomId) {
    if (!rooms.has(roomId)) rooms.set(roomId, createRoom(roomId));
    return rooms.get(roomId);
  }

  return {
    kind: 'memory',
    MESSAGE_CAP,
    HISTORY_LIMIT,

    async addMember(roomId, { alias, socketId }) {
      const room = getOrCreate(roomId);
      const now = Date.now();
      // If a row with this alias exists (offline), reclaim it: drop the
      // old socket_id entry and create a fresh one under the new socket.
      // Preserves joinedAt so the member's "since" timestamp is stable.
      let priorJoinedAt = null;
      for (const [sid, m] of room.members.entries()) {
        if (m.alias === alias) {
          priorJoinedAt = m.joinedAt;
          room.members.delete(sid);
          break;
        }
      }
      room.members.set(socketId, {
        socketId,
        alias,
        isOnline: true,
        joinedAt: priorJoinedAt ?? now,
        lastSeen: now,
        activityAt: now,
        pushedAt: null,
      });
      room.lastActive = now;
      return Array.from(room.members.values()).filter((m) => m.isOnline);
    },

    // Definitive exit: deletes the member row entirely.
    async leaveRoom(roomId, socketId) {
      const room = rooms.get(roomId);
      if (!room) return { removed: null, remaining: [], roomGced: false };
      const removed = room.members.get(socketId);
      room.members.delete(socketId);
      if (room.members.size === 0) {
        rooms.delete(roomId);
        return { removed: removed || null, remaining: [], roomGced: true };
      }
      return {
        removed: removed || null,
        remaining: Array.from(room.members.values()).filter((m) => m.isOnline),
        roomGced: false,
      };
    },

    // Soft disconnect: mark the member offline but KEEP the row.
    // Used when the socket drops (network blip, app killed). The user can
    // come back, reconnect, and pick up where they left off. Only an
    // explicit `leave_room` (triple-tap) deletes the row.
    async markInactive(roomId, socketId) {
      const room = rooms.get(roomId);
      if (!room) return [];
      const m = room.members.get(socketId);
      if (!m) return [];
      m.isOnline = false;
      m.socketId = null;
      m.lastSeen = Date.now();
      return Array.from(room.members.values()).filter((mm) => mm.isOnline);
    },

    async removeMember(roomId, socketId) {
      // Backwards-compatible alias for markInactive. New code should call
      // markInactive explicitly to make intent obvious.
      return this.markInactive(roomId, socketId);
    },

    async forceDeleteMember(roomId, socketId) {
      // Used by the inactivity expiration path. Like leaveRoom but does
      // not depend on the client being connected.
      const room = rooms.get(roomId);
      if (!room) return { removed: null, remaining: [], roomGced: false };
      const removed = room.members.get(socketId);
      room.members.delete(socketId);
      if (room.members.size === 0) {
        rooms.delete(roomId);
        return { removed: removed || null, remaining: [], roomGced: true };
      }
      return {
        removed: removed || null,
        remaining: Array.from(room.members.values()).filter((m) => m.isOnline),
        roomGced: false,
      };
    },

    async purgeRoom(roomId) {
      return rooms.delete(roomId);
    },

    async updateMemberLocation(roomId, socketId, lat, lng) {
      const room = rooms.get(roomId);
      if (!room) return null;
      const m = room.members.get(socketId);
      if (!m) return null;
      m.lat = lat;
      m.lng = lng;
      m.lastSeen = Date.now();
      return { alias: m.alias, lat, lng };
    },

    async getMembers(roomId) {
      const room = rooms.get(roomId);
      if (!room) return [];
      return Array.from(room.members.values()).filter((m) => m.isOnline);
    },

    async getAllMembers(roomId) {
      const room = rooms.get(roomId);
      if (!room) return [];
      return Array.from(room.members.values());
    },

    async getHistory(roomId, limit = HISTORY_LIMIT) {
      const room = rooms.get(roomId);
      if (!room) return [];
      return room.messages.slice(-limit);
    },

    async appendMessage(roomId, msg) {
      const room = getOrCreate(roomId);
      const cap = this.MESSAGE_CAP;
      const id =
        msg.id ||
        `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const stored = {
        ...msg,
        id,
        timestamp: msg.timestamp || Date.now(),
        isQuick: Boolean(msg.isQuick),
      };
      room.messages.push(stored);
      if (room.messages.length > cap) {
        room.messages.splice(0, room.messages.length - cap);
      }
      const now = Date.now();
      room.lastActive = now;
      // Bump the author's activity_at (by socket_id match) so the
      // inactivity pusher skips them. Clear pushedAt so they get a fresh
      // 2h window after responding.
      if (msg.socketId) {
        const m = room.members.get(msg.socketId);
        if (m) {
          m.activityAt = now;
          m.pushedAt = null;
        }
      }
      return stored;
    },

    async setPushToken(roomId, socketId, token) {
      const room = rooms.get(roomId);
      if (!room) return false;
      const m = room.members.get(socketId);
      if (!m) return false;
      m.pushToken = token;
      return true;
    },

    // Returns members that have been quiet for >= olderThanMs AND have a
    // push token AND have not been pushed yet (or were pushed so long ago
    // that it's worth re-pushing). Used by the inactivity pusher.
    async findPushCandidates(olderThanMs, repushAfterMs) {
      const now = Date.now();
      const out = [];
      for (const [roomId, room] of rooms.entries()) {
        for (const m of room.members.values()) {
          if (!m.pushToken) continue;
          const quietFor = now - m.activityAt;
          if (quietFor < olderThanMs) continue;
          const pushedRecently =
            m.pushedAt && now - m.pushedAt < repushAfterMs;
          if (pushedRecently) continue;
          out.push({
            roomId,
            alias: m.alias,
            socketId: m.socketId,
            pushToken: m.pushToken,
            activityAt: m.activityAt,
            pushedAt: m.pushedAt,
            quietForMs: quietFor,
          });
        }
      }
      return out;
    },

    // Returns members whose push was sent >= pushedAtOlderThanMs ago and
    // who have not produced any activity since (so the nudge was ignored).
    // The inactivity path uses this to force-delete them after the grace
    // window (default 5 min).
    async findExpiredSessions(pushedAtOlderThanMs) {
      const now = Date.now();
      const out = [];
      for (const [roomId, room] of rooms.entries()) {
        for (const [socketId, m] of room.members.entries()) {
          if (!m.pushedAt) continue;
          if (now - m.pushedAt < pushedAtOlderThanMs) continue;
          if (m.activityAt > m.pushedAt) continue;
          out.push({
            roomId,
            alias: m.alias,
            socketId,
            pushedAt: m.pushedAt,
            activityAt: m.activityAt,
          });
        }
      }
      return out;
    },

    async markPushSent(roomId, socketId) {
      const room = rooms.get(roomId);
      if (!room) return false;
      const m = room.members.get(socketId);
      if (!m) return false;
      m.pushedAt = Date.now();
      return true;
    },

    async purgeInactiveRooms(olderThanHours) {
      const cutoff = Date.now() - olderThanHours * 3600 * 1000;
      let removed = 0;
      for (const [roomId, room] of rooms.entries()) {
        if (room.members.size === 0 && room.lastActive < cutoff) {
          rooms.delete(roomId);
          removed++;
        }
      }
      return removed;
    },

    async close() {
      rooms.clear();
    },

    // Test-only: clear all rooms so tests start from a clean slate.
    _reset() {
      rooms.clear();
    },
  };
}

module.exports = { createMemoryStore, MESSAGE_CAP, HISTORY_LIMIT };
