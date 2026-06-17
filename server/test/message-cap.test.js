// Verifies the message-cap behavior at the socket layer (not just at the
// store layer). Uses an artificial cap of 5 to keep the test fast.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient } from 'socket.io-client';

let httpServer;
let baseUrl;
let sock;

async function startServer({ cap }) {
  const express = (await import('express')).default;
  const http = (await import('http')).default;
  const { Server } = await import('socket.io');
  const { createMemoryStore } = await import('../src/store/memory.js');

  const app = express();
  const server = http.createServer(app);
  const store = createMemoryStore();
  store.MESSAGE_CAP = cap;

  const io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.on('connection', (s) => {
    let room = null;
    let alias = null;
    s.on('join_room', async ({ roomId, alias: a }) => {
      room = String(roomId);
      alias = String(a);
      s.join(room);
      await store.addMember(room, { alias, socketId: s.id });
      s.emit('history', await store.getHistory(room));
    });
    s.on('message', async ({ text, type }) => {
      const stored = await store.appendMessage(room, {
        alias,
        text,
        type: type || 'text',
        isQuick: false,
      });
      io.to(room).emit('message', stored);
    });
  });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  httpServer = { server, io };
}

function connect() {
  return ioClient(baseUrl, { transports: ['websocket'], reconnection: false });
}

function wait(sock, ev) {
  return new Promise((resolve) => sock.once(ev, resolve));
}

describe('message cap (socket level)', () => {
  beforeAll(async () => {
    await startServer({ cap: 5 });
    sock = connect();
    await new Promise((r) => sock.on('connect', r));
    const histP = wait(sock, 'history');
    sock.emit('join_room', { roomId: 'fria-001', alias: 'A1' });
    await histP;
  });

  afterAll(async () => {
    if (sock && sock.connected) sock.disconnect();
    await new Promise((r) => httpServer.server.close(r));
    await httpServer.io.close();
  });

  it('keeps only the last N messages in history', async () => {
    const received = [];
    sock.on('message', (m) => received.push(m));

    for (let i = 0; i < 8; i++) {
      sock.emit('message', { text: `m-${i}`, type: 'text' });
    }
    // Wait for all broadcasts.
    await new Promise((r) => setTimeout(r, 200));

    // The socket layer only echoes back what the store accepted. So the
    // client only sees messages it just sent (no late-join replay here).
    expect(received).toHaveLength(8);

    // Now verify the underlying store has the cap.
    const late = connect();
    await new Promise((r) => late.on('connect', r));
    const histP = wait(late, 'history');
    late.emit('join_room', { roomId: 'fria-001', alias: 'B3' });
    const history = await histP;
    expect(history).toHaveLength(5);
    expect(history.map((m) => m.text)).toEqual(['m-3', 'm-4', 'm-5', 'm-6', 'm-7']);
    late.disconnect();
  });
});
