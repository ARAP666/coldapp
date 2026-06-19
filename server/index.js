require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { createStore, MESSAGE_CAP, HISTORY_LIMIT } = require('./src/store');
const { generateUniqueCodename } = require('./src/codename');
const { sendExpoPush, buildUpdateCalculatorPush } = require('./src/push');

const ALLOWED_ORIGIN = process.env.CLIENT_ORIGIN || '*';
const DATABASE_URL = process.env.DATABASE_URL || null;
const PORT = process.env.PORT || 3000;

// Periodic jobs.
const PURGE_INTERVAL_MS = Number(process.env.PURGE_INTERVAL_MS || 5 * 60 * 1000);
const PURGE_OLDER_THAN_HOURS = Number(process.env.PURGE_OLDER_THAN_HOURS || 24);

// Inactivity lifecycle:
//  - After INACTIVITY_MS of silence, send a push to the member.
//  - After PUSH_EXPIRE_MS with no response, force-delete the member.
const INACTIVITY_MS = Number(process.env.INACTIVITY_MS || 2 * 60 * 60 * 1000);   // 2h
const INACTIVITY_TICK_MS = Number(process.env.INACTIVITY_TICK_MS || 60 * 1000);    // 1m
const PUSH_EXPIRE_MS = Number(process.env.PUSH_EXPIRE_MS || 5 * 60 * 1000);        // 5m
const REPUSH_AFTER_MS = Number(process.env.REPUSH_AFTER_MS || INACTIVITY_MS);      // re-push after another full window

async function main() {
  const app = express();
  const server = http.createServer(app);

  const store = await createStore({
    databaseUrl: DATABASE_URL,
    logger: console,
  });
  console.log(
    `[fria] store=${store.kind} cap=${MESSAGE_CAP} history=${HISTORY_LIMIT} ` +
      `purge=${PURGE_INTERVAL_MS}ms/${PURGE_OLDER_THAN_HOURS}h ` +
      `inactivity=${INACTIVITY_MS}ms expire=${PUSH_EXPIRE_MS}ms tick=${INACTIVITY_TICK_MS}ms`
  );

  const io = new Server(server, {
    cors: { origin: ALLOWED_ORIGIN, methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  // Track live sockets by socketId so the inactivity expirer can force-close
  // them when the user ignores the nudge for PUSH_EXPIRE_MS.
  const liveSockets = new Map(); // socketId -> { socket, roomId, alias }
  const definitiveExits = new Set();
  const purgingRooms = new Set();

  app.use(cors());
  app.use(express.json());

  app.get('/', (req, res) => {
    res.json({ status: 'ok', service: 'FRIA Server', store: store.kind });
  });

  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  function aliasToExistingSet(members) {
    return new Set(members.map((m) => m.alias));
  }

  async function assignCodename(roomId, providedAlias) {
    if (providedAlias) return providedAlias;
    // Use ALL members (online + offline) so a fresh codename never
    // collides with a row that's waiting on inactivity expiration.
    const all = await store.getAllMembers(roomId);
    return generateUniqueCodename(aliasToExistingSet(all));
  }

  io.on('connection', (socket) => {
    console.log(`[+] connected: ${socket.id}`);
    let currentRoom = null;
    let currentAlias = null;
    let isDefinitiveExit = false;

    socket.on('join_room', async ({ roomId, alias, pushToken }) => {
      if (!roomId) return;
      currentRoom = String(roomId);

      // If the member row already exists for this codename (reconnect
      // after a network drop), preserve its pushed_at + activity_at so
      // the inactivity timer doesn't reset on every reconnect.
      const provided = alias || null;
      currentAlias = await assignCodename(currentRoom, provided);

      socket.join(currentRoom);
      const members = await store.addMember(currentRoom, {
        alias: currentAlias,
        socketId: socket.id,
      });

      liveSockets.set(socket.id, { socket, roomId: currentRoom, alias: currentAlias });

      const history = await store.getHistory(currentRoom);
      socket.emit('joined', { alias: currentAlias, roomId: currentRoom });
      socket.emit('history', history);

      io.to(currentRoom).emit('members_update', members);
      console.log(`[room:${currentRoom}] ${currentAlias} joined (${members.length} online)`);

      if (pushToken) {
        await store.setPushToken(currentRoom, socket.id, pushToken);
      }
    });

    socket.on('message', async ({ text, type, color }) => {
      if (!currentRoom || !currentAlias || purgingRooms.has(currentRoom)) return;
      const stored = await store.appendMessage(currentRoom, {
        alias: currentAlias,
        socketId: socket.id,
        text,
        type: type || 'text',
        color: color || null,
        isQuick: false,
      });
      io.to(currentRoom).emit('message', stored);
    });

    socket.on('location_update', async ({ lat, lng }) => {
      if (!currentRoom || !currentAlias || purgingRooms.has(currentRoom)) return;
      const result = await store.updateMemberLocation(
        currentRoom,
        socket.id,
        Number(lat),
        Number(lng)
      );
      if (!result) return;
      socket.to(currentRoom).emit('peer_location', {
        alias: result.alias,
        lat: result.lat,
        lng: result.lng,
        timestamp: Date.now(),
      });
    });

    socket.on('quick_alert', async ({ label, icon, alertType, color }) => {
      if (!currentRoom || !currentAlias || purgingRooms.has(currentRoom)) return;
      const stored = await store.appendMessage(currentRoom, {
        alias: currentAlias,
        socketId: socket.id,
        text: `${icon} ${label}`,
        type: alertType || 'alert',
        color: color || null,
        isQuick: true,
      });
      io.to(currentRoom).emit('message', stored);
      io.to(currentRoom).emit('quick_alert', {
        alias: currentAlias,
        label,
        icon,
        alertType,
        timestamp: stored.timestamp,
      });
    });

    // Definitive exit (triple-tap): deletes the member row entirely.
    socket.on('leave_room', async () => {
      if (!currentRoom) return;
      isDefinitiveExit = true;
      const { remaining, roomGced } = await store.leaveRoom(currentRoom, socket.id);
      liveSockets.delete(socket.id);
      if (remaining.length > 0) {
        io.to(currentRoom).emit('members_update', remaining);
      }
      console.log(`[room:${currentRoom}] ${currentAlias} left definitively (roomGced=${roomGced})`);
      socket.disconnect(true);
    });

    socket.on('purge_room', async () => {
      if (!currentRoom) return;
      const roomId = currentRoom;
      if (purgingRooms.has(roomId)) return;
      purgingRooms.add(roomId);
      try {
        await store.purgeRoom(roomId);
      } catch (err) {
        purgingRooms.delete(roomId);
        console.error(`[room:${roomId}] purge failed:`, err.message);
        return;
      }

      const affected = Array.from(liveSockets.entries()).filter(
        ([, live]) => live.roomId === roomId
      );
      for (const [socketId, live] of affected) {
        definitiveExits.add(socketId);
        liveSockets.delete(socketId);
        live.socket.emit('room_purged');
      }
      for (const [, live] of affected) {
        live.socket.disconnect(true);
      }
      purgingRooms.delete(roomId);
      console.log(`[room:${roomId}] purged globally (${affected.length} sockets)`);
    });

    // Soft disconnect (network blip, app killed, OS reclaimed memory).
    // The member row STAYS so a late reconnect sees the same codename and
    // the inactivity timer keeps ticking. Only the explicit `leave_room`
    // path actually removes the row.
    socket.on('disconnect', async () => {
      liveSockets.delete(socket.id);
      if (!currentRoom) return;
      if (isDefinitiveExit || definitiveExits.delete(socket.id)) return;
      const members = await store.markInactive(currentRoom, socket.id);
      io.to(currentRoom).emit('members_update', members);
      console.log(
        `[-] soft disconnect: ${socket.id} (${currentAlias}) kept in ${currentRoom}`
      );
    });
  });

  // ── periodic jobs ──

  const purgeTimer = setInterval(async () => {
    try {
      const removed = await store.purgeInactiveRooms(PURGE_OLDER_THAN_HOURS);
      if (removed > 0) console.log(`[purge] removed ${removed} inactive rooms`);
    } catch (err) {
      console.error('[purge] error:', err.message);
    }
  }, PURGE_INTERVAL_MS);
  purgeTimer.unref?.();

  // Two-phase inactivity lifecycle:
  //   Phase A (findPushCandidates): member quiet ≥ INACTIVITY_MS, no push
  //   recently → send "actualizá la calculadora" push.
  //   Phase B (findExpiredSessions): pushed ≥ PUSH_EXPIRE_MS ago, no
  //   activity since → force-close the socket and delete the row.
  const inactivityTimer = setInterval(async () => {
    try {
      // Phase B first: force-delete expired members before sending new
      // pushes, so we don't waste an API call on someone about to be gone.
      const expired = await store.findExpiredSessions(PUSH_EXPIRE_MS);
      for (const s of expired) {
        const live = liveSockets.get(s.socketId);
        if (live) {
          try {
            live.socket.emit('kicked', { reason: 'inactivity_timeout' });
            live.socket.disconnect(true);
          } catch {
            // socket may already be gone
          }
        }
        const { remaining, roomGced } = await store.forceDeleteMember(
          s.roomId,
          s.socketId
        );
        liveSockets.delete(s.socketId);
        if (remaining.length > 0) {
          io.to(s.roomId).emit('members_update', remaining);
        }
        console.log(
          `[inactivity] expired ${s.alias} in ${s.roomId} (roomGced=${roomGced})`
        );
      }

      // Phase A: send pushes.
      const candidates = await store.findPushCandidates(INACTIVITY_MS, REPUSH_AFTER_MS);
      if (candidates.length > 0) {
        const tokens = candidates.map((c) => c.pushToken).filter(Boolean);
        const messages = buildUpdateCalculatorPush({
          tokens,
          codename: 'n/a',
          hoursIdle: Math.round(INACTIVITY_MS / (60 * 60 * 1000)),
        });
        try {
          await sendExpoPush(messages, { logger: console });
          for (const c of candidates) {
            await store.markPushSent(c.roomId, c.socketId);
          }
        } catch (err) {
          console.error('[inactivity] push send failed:', err.message);
        }
      }
    } catch (err) {
      console.error('[inactivity] error:', err.message);
    }
  }, INACTIVITY_TICK_MS);
  inactivityTimer.unref?.();

  // ── boot ──

  server.listen(PORT, () => {
    console.log(`FRIA server running on port ${PORT}`);
  });

  const shutdown = async () => {
    console.log('[fria] shutting down');
    clearInterval(purgeTimer);
    clearInterval(inactivityTimer);
    io.close();
    await store.close();
    server.close(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err) => {
  console.error('[fria] fatal:', err);
  process.exit(1);
});
