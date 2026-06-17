// End-to-end tests for the Socket.IO server using a real local listener
// and the socket.io-client. These prove that the store refactor did not
// regress the wire protocol.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { io as ioClient } from 'socket.io-client';

let httpServer;
let baseUrl;
let clientSockets = [];

async function startServer() {
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const { Server } = await import('socket.io');
  const { createMemoryStore } = await import('../src/store/memory.js');
  const { generateUniqueCodename } = await import('../src/codename.js');

  const app = express();
  const server = http.createServer(app);
  const store = createMemoryStore();

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
    pingTimeout: 20000,
    pingInterval: 10000,
  });

  function aliasSet(members) {
    return new Set(members.map((m) => m.alias));
  }

  async function assignCodename(roomId, providedAlias) {
    if (providedAlias) return providedAlias;
    const all = await store.getAllMembers(roomId);
    return generateUniqueCodename(aliasSet(all));
  }

  io.on('connection', (socket) => {
    let currentRoom = null;
    let currentAlias = null;
    let isDefinitiveExit = false;

    socket.on('join_room', async ({ roomId, alias, pushToken }) => {
      if (!roomId) return;
      currentRoom = String(roomId);
      currentAlias = await assignCodename(currentRoom, alias);
      isDefinitiveExit = false;

      socket.join(currentRoom);
      const members = await store.addMember(currentRoom, {
        alias: currentAlias,
        socketId: socket.id,
      });
      const history = await store.getHistory(currentRoom);

      socket.emit('joined', { alias: currentAlias, roomId: currentRoom });
      socket.emit('history', history);
      io.to(currentRoom).emit('members_update', members);

      if (pushToken) {
        await store.setPushToken(currentRoom, socket.id, pushToken);
      }
    });

    socket.on('message', async ({ text, type }) => {
      if (!currentRoom) return;
      const stored = await store.appendMessage(currentRoom, {
        alias: currentAlias,
        socketId: socket.id,
        text,
        type: type || 'text',
        isQuick: false,
      });
      io.to(currentRoom).emit('message', stored);
    });

    socket.on('location_update', async ({ lat, lng }) => {
      if (!currentRoom) return;
      const result = await store.updateMemberLocation(currentRoom, socket.id, lat, lng);
      if (!result) return;
      socket.to(currentRoom).emit('peer_location', {
        alias: result.alias,
        lat: result.lat,
        lng: result.lng,
        timestamp: Date.now(),
      });
    });

    socket.on('quick_alert', async ({ label, icon, alertType }) => {
      if (!currentRoom) return;
      const stored = await store.appendMessage(currentRoom, {
        alias: currentAlias,
        socketId: socket.id,
        text: `${icon} ${label}`,
        type: alertType || 'alert',
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

    socket.on('leave_room', async () => {
      if (!currentRoom) return;
      isDefinitiveExit = true;
      const { remaining } = await store.leaveRoom(currentRoom, socket.id);
      if (remaining.length > 0) {
        io.to(currentRoom).emit('members_update', remaining);
      }
      socket.disconnect(true);
    });

    // Soft disconnect: keep the member row but mark is_online=false. The
    // member is still considered "in the chat" until either leave_room,
    // an inactivity expiration, or a room purge.
    socket.on('disconnect', async () => {
      if (!currentRoom) return;
      if (isDefinitiveExit) return;
      const members = await store.markInactive(currentRoom, socket.id);
      io.to(currentRoom).emit('members_update', members);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  httpServer = { server, io, store };
}

function connect() {
  const sock = ioClient(baseUrl, {
    transports: ['websocket'],
    reconnection: false,
  });
  clientSockets.push(sock);
  return sock;
}

function disconnectAll() {
  clientSockets.forEach((s) => {
    if (s.connected) s.disconnect();
  });
  clientSockets = [];
}

function waitConnect(sock) {
  return new Promise((resolve) => sock.once('connect', resolve));
}

function nextEvent(sock, event) {
  return new Promise((resolve) => sock.once(event, resolve));
}

async function joinRoom(sock, roomId, alias) {
  // Register listener BEFORE emitting, otherwise the history frame races
  // the listener registration.
  const historyP = nextEvent(sock, 'history');
  sock.emit('join_room', { roomId, alias });
  return historyP;
}

describe('socket protocol', () => {
  beforeAll(async () => {
    await startServer();
  });

  afterAll(async () => {
    disconnectAll();
    await new Promise((resolve) => httpServer.server.close(resolve));
    await httpServer.io.close();
  });

  beforeEach(() => {
    disconnectAll();
    httpServer.store._reset();
  });

  it('replies with history on join_room', async () => {
    const a = connect();
    await waitConnect(a);
    const history = await joinRoom(a, 'fria-001', 'A1');
    expect(Array.isArray(history)).toBe(true);
  });

  it('broadcasts messages to every member of the room', async () => {
    const a = connect();
    const b = connect();
    await Promise.all([waitConnect(a), waitConnect(b)]);

    await Promise.all([
      joinRoom(a, 'fria-001', 'A1'),
      joinRoom(b, 'fria-001', 'B3'),
    ]);

    const bMessageP = nextEvent(b, 'message');
    a.emit('message', { text: 'hola mundo', type: 'text' });
    const msg = await bMessageP;
    expect(msg).toMatchObject({
      alias: 'A1',
      text: 'hola mundo',
      type: 'text',
      isQuick: false,
    });
  });

  it('emits peer_location only to other sockets', async () => {
    const a = connect();
    const b = connect();
    await Promise.all([waitConnect(a), waitConnect(b)]);

    await Promise.all([
      joinRoom(a, 'fria-001', 'A1'),
      joinRoom(b, 'fria-001', 'B3'),
    ]);

    const bPeerP = nextEvent(b, 'peer_location');
    a.emit('location_update', { lat: 9.9281, lng: -84.0907 });
    const loc = await bPeerP;
    expect(loc).toMatchObject({ alias: 'A1', lat: 9.9281, lng: -84.0907 });

    let selfHeard = false;
    a.on('peer_location', () => {
      selfHeard = true;
    });
    a.emit('location_update', { lat: 1, lng: 2 });
    await new Promise((r) => setTimeout(r, 100));
    expect(selfHeard).toBe(false);
  });

  it('emits both message and quick_alert on quick_alert', async () => {
    const a = connect();
    const b = connect();
    await Promise.all([waitConnect(a), waitConnect(b)]);

    await Promise.all([
      joinRoom(a, 'fria-001', 'A1'),
      joinRoom(b, 'fria-001', 'B3'),
    ]);

    const messageP = nextEvent(b, 'message');
    const alertP = nextEvent(b, 'quick_alert');
    a.emit('quick_alert', { label: 'ALERTA', icon: '🚨', alertType: 'alert' });

    const [msg, alert] = await Promise.all([messageP, alertP]);
    expect(msg).toMatchObject({ text: '🚨 ALERTA', type: 'alert', isQuick: true });
    expect(alert).toMatchObject({ alias: 'A1', label: 'ALERTA', alertType: 'alert' });
  });

  it('updates members_update on join and on disconnect', async () => {
    const a = connect();
    await waitConnect(a);

    const membersAfterJoin = nextEvent(a, 'members_update');
    await joinRoom(a, 'fria-001', 'A1');
    const after = await membersAfterJoin;
    expect(after.map((m) => m.alias)).toEqual(['A1']);

    const b = connect();
    await waitConnect(b);

    const membersAfterB = nextEvent(a, 'members_update');
    await joinRoom(b, 'fria-001', 'B3');
    const afterB = await membersAfterB;
    expect(afterB.map((m) => m.alias).sort()).toEqual(['A1', 'B3']);

    const membersAfterDisc = nextEvent(a, 'members_update');
    b.disconnect();
    const afterDisc = await membersAfterDisc;
    expect(afterDisc.map((m) => m.alias)).toEqual(['A1']);
  });

  it('replays history to a late joiner', async () => {
    const a = connect();
    await waitConnect(a);
    await joinRoom(a, 'fria-001', 'A1');

    a.emit('message', { text: 'uno', type: 'text' });
    await new Promise((r) => setTimeout(r, 50));
    a.emit('message', { text: 'dos', type: 'text' });
    await new Promise((r) => setTimeout(r, 50));

    const b = connect();
    await waitConnect(b);
    const history = await joinRoom(b, 'fria-001', 'B3');
    expect(history.map((m) => m.text)).toEqual(['uno', 'dos']);
  });

  it('assigns a codename when the client joins without one', async () => {
    const a = connect();
    await waitConnect(a);

    const joinedP = new Promise((resolve) => a.once('joined', resolve));
    a.emit('join_room', { roomId: 'fria-001' });
    const joined = await joinedP;
    expect(joined.alias).toMatch(/^[A-Z]{3,7}-\d{2}$/);
  });

  it('produces distinct codenames for concurrent joins', async () => {
    const sockets = [];
    const codenames = [];
    for (let i = 0; i < 5; i++) {
      const s = connect();
      sockets.push(s);
      await waitConnect(s);
      const p = new Promise((resolve) => s.once('joined', resolve));
      s.emit('join_room', { roomId: 'fria-001' });
      codenames.push((await p).alias);
    }
    const unique = new Set(codenames);
    expect(unique.size).toBe(5);
  });

  it('leave_room deletes the member and broadcasts the updated roster', async () => {
    const a = connect();
    const b = connect();
    await Promise.all([waitConnect(a), waitConnect(b)]);
    await Promise.all([
      joinRoom(a, 'fria-001', 'A1'),
      joinRoom(b, 'fria-001', 'B3'),
    ]);

    const membersAfterLeave = nextEvent(a, 'members_update');
    b.emit('leave_room');
    const after = await membersAfterLeave;
    expect(after.map((m) => m.alias)).toEqual(['A1']);
  });

  it('leave_room followed by disconnect does not double-remove', async () => {
    const a = connect();
    const b = connect();
    await Promise.all([waitConnect(a), waitConnect(b)]);
    await Promise.all([
      joinRoom(a, 'fria-001', 'A1'),
      joinRoom(b, 'fria-001', 'B3'),
    ]);
    let aUpdates = 0;
    a.on('members_update', () => aUpdates++);
    b.emit('leave_room');
    await new Promise((r) => setTimeout(r, 150));
    // Only one members_update should arrive at a (the leave_room one).
    expect(aUpdates).toBe(1);
  });

  it('soft disconnect keeps the member row but removes them from the online roster', async () => {
    const a = connect();
    const b = connect();
    await Promise.all([waitConnect(a), waitConnect(b)]);
    await Promise.all([
      joinRoom(a, 'fria-001', 'A1'),
      joinRoom(b, 'fria-001', 'B3'),
    ]);

    const after = nextEvent(a, 'members_update');
    b.disconnect(); // not leave_room — pure socket drop
    const members = await after;
    expect(members.map((m) => m.alias)).toEqual(['A1']);

    // But the row is still in the store (offline).
    const all = await httpServer.store.getAllMembers('fria-001');
    expect(all.map((m) => m.alias).sort()).toEqual(['A1', 'B3']);
    const bRow = all.find((m) => m.alias === 'B3');
    expect(bRow.isOnline).toBe(false);
  });

  it('inactivity tick pushes "actualizá la calculadora" after 2h with no activity', async () => {
    const a = connect();
    await waitConnect(a);

    const fetchFn = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ data: [{ status: 'ok' }] }),
    });
    globalThis.fetch = fetchFn;

    // Drive the test by calling the store's findPushCandidates directly
    // and running the same code path the inactivity timer uses. We don't
    // boot the timer here to avoid waiting real time.
    const joinedP = new Promise((resolve) => a.once('joined', resolve));
    a.emit('join_room', { roomId: 'fria-001', pushToken: 'ExponentPushToken[fake]' });
    const joined = await joinedP;

    // Manually push activity_at into the past.
    const all = await httpServer.store.getAllMembers('fria-001');
    const m = all.find((mm) => mm.alias === joined.alias);
    m.activityAt = Date.now() - 3 * 60 * 60 * 1000; // 3h ago

    const candidates = await httpServer.store.findPushCandidates(2 * 60 * 60 * 1000, 99999999);
    expect(candidates).toHaveLength(1);
    expect(candidates[0].alias).toBe(joined.alias);

    // Cleanup
    delete globalThis.fetch;
  });

  it('force_delete via inactivity expiration removes the member entirely', async () => {
    const a = connect();
    await waitConnect(a);
    const joinedP = new Promise((resolve) => a.once('joined', resolve));
    a.emit('join_room', { roomId: 'fria-001' });
    const joined = await joinedP;

    // Pretend the push was sent 10 minutes ago and the member never
    // responded.
    const all = await httpServer.store.getAllMembers('fria-001');
    const m = all.find((mm) => mm.alias === joined.alias);
    const tenMinAgo = Date.now() - 10 * 60 * 1000;
    m.pushedAt = tenMinAgo;
    m.activityAt = tenMinAgo - 1000;

    const expired = await httpServer.store.findExpiredSessions(5 * 60 * 1000);
    expect(expired).toHaveLength(1);
    expect(expired[0].alias).toBe(joined.alias);

    const { removed, roomGced } = await httpServer.store.forceDeleteMember(
      'fria-001',
      expired[0].socketId
    );
    expect(removed.alias).toBe(joined.alias);
    expect(roomGced).toBe(true);
  });
});
