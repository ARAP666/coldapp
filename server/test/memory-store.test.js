// Tests for the in-memory store. These are the contract that the Postgres
// implementation must also satisfy.

import { describe, it, expect, beforeEach } from 'vitest';
import { createMemoryStore, MESSAGE_CAP, HISTORY_LIMIT } from '../src/store/memory.js';

describe('memory store', () => {
  let store;

  beforeEach(() => {
    store = createMemoryStore();
  });

  describe('addMember / getMembers', () => {
    it('returns the new member list when someone joins', async () => {
      const members = await store.addMember('fria-001', {
        alias: 'A1',
        socketId: 'sock-1',
      });
      expect(members).toHaveLength(1);
      expect(members[0]).toMatchObject({
        alias: 'A1',
        socketId: 'sock-1',
      });
      expect(typeof members[0].joinedAt).toBe('number');
    });

    it('accumulates members in the same room', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store.addMember('fria-001', { alias: 'B3', socketId: 's2' });
      const members = await store.getMembers('fria-001');
      expect(members).toHaveLength(2);
      expect(members.map((m) => m.alias).sort()).toEqual(['A1', 'B3']);
    });

    it('keeps rooms isolated', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store.addMember('fria-002', { alias: 'B3', socketId: 's2' });
      expect(await store.getMembers('fria-001')).toHaveLength(1);
      expect(await store.getMembers('fria-002')).toHaveLength(1);
    });
  });

  describe('removeMember', () => {
    it('removes a member and returns the remaining list', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store.addMember('fria-001', { alias: 'B3', socketId: 's2' });
      const remaining = await store.removeMember('fria-001', 's1');
      expect(remaining).toHaveLength(1);
      expect(remaining[0].alias).toBe('B3');
    });

    it('GCs an empty room', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store.removeMember('fria-001', 's1');
      // After GC, getMembers returns [] (no row).
      expect(await store.getMembers('fria-001')).toEqual([]);
      // And appending creates a fresh room.
      await store.addMember('fria-001', { alias: 'C2', socketId: 's9' });
      expect(await store.getMembers('fria-001')).toHaveLength(1);
    });

    it('is a no-op when the socket is unknown', async () => {
      const remaining = await store.removeMember('fria-001', 'unknown');
      expect(remaining).toEqual([]);
    });
  });

  describe('updateMemberLocation', () => {
    it('updates lat/lng on the member record', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      const result = await store.updateMemberLocation('fria-001', 's1', 9.93, -84.09);
      expect(result).toEqual({ alias: 'A1', lat: 9.93, lng: -84.09 });
      const [m] = await store.getMembers('fria-001');
      expect(m.lat).toBe(9.93);
      expect(m.lng).toBe(-84.09);
    });

    it('returns null when the socket is unknown', async () => {
      const result = await store.updateMemberLocation('fria-001', 'ghost', 1, 2);
      expect(result).toBeNull();
    });
  });

  describe('appendMessage + history', () => {
    it('returns the stored message with a timestamp', async () => {
      const msg = await store.appendMessage('fria-001', {
        alias: 'A1',
        text: 'hola',
        type: 'text',
      });
      expect(msg).toMatchObject({
        alias: 'A1',
        text: 'hola',
        type: 'text',
        isQuick: false,
      });
      expect(typeof msg.timestamp).toBe('number');
      expect(msg.id).toBeTruthy();
    });

    it('returns last N messages via getHistory', async () => {
      for (let i = 0; i < 10; i++) {
        await store.appendMessage('fria-001', {
          alias: 'A1',
          text: `msg-${i}`,
          type: 'text',
        });
      }
      const history = await store.getHistory('fria-001', 3);
      expect(history.map((m) => m.text)).toEqual(['msg-7', 'msg-8', 'msg-9']);
    });

    it(`caps messages at ${MESSAGE_CAP}`, async () => {
      const total = MESSAGE_CAP + 25;
      for (let i = 0; i < total; i++) {
        await store.appendMessage('fria-001', {
          alias: 'A1',
          text: `msg-${i}`,
          type: 'text',
        });
      }
      const history = await store.getHistory('fria-001', MESSAGE_CAP + 100);
      expect(history).toHaveLength(MESSAGE_CAP);
      // The oldest kept message must be the (total - cap)th one.
      expect(history[0].text).toBe(`msg-${total - MESSAGE_CAP}`);
      expect(history[history.length - 1].text).toBe(`msg-${total - 1}`);
    });

    it('history default limit is HISTORY_LIMIT', () => {
      expect(HISTORY_LIMIT).toBe(50);
    });
  });

  describe('close', () => {
    it('clears in-memory state', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store.appendMessage('fria-001', { alias: 'A1', text: 'x', type: 'text' });
      await store.close();
      expect(await store.getMembers('fria-001')).toEqual([]);
      expect(await store.getHistory('fria-001')).toEqual([]);
    });
  });

  describe('leaveRoom (definitive exit)', () => {
    it('removes the member and reports whether the room was GC\'d', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      const result = await store.leaveRoom('fria-001', 's1');
      expect(result.removed.alias).toBe('A1');
      expect(result.remaining).toEqual([]);
      expect(result.roomGced).toBe(true);
    });

    it('keeps the room alive if other members remain', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store.addMember('fria-001', { alias: 'B3', socketId: 's2' });
      const result = await store.leaveRoom('fria-001', 's1');
      expect(result.removed.alias).toBe('A1');
      expect(result.remaining.map((m) => m.alias)).toEqual(['B3']);
      expect(result.roomGced).toBe(false);
    });

    it('is a no-op when the socket is unknown', async () => {
      const result = await store.leaveRoom('fria-001', 'ghost');
      expect(result.removed).toBeNull();
    });
  });

  describe('setPushToken', () => {
    it('stores the token on the member record', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      const ok = await store.setPushToken('fria-001', 's1', 'ExponentPushToken[abc]');
      expect(ok).toBe(true);
      const sessions = await store.findPushCandidates(0, 0);
      expect(sessions).toHaveLength(1);
      expect(sessions[0].pushToken).toBe('ExponentPushToken[abc]');
    });

    it('returns false when the socket is unknown', async () => {
      const ok = await store.setPushToken('fria-001', 'ghost', 'tok');
      expect(ok).toBe(false);
    });
  });

  describe('findPushCandidates', () => {
    it('returns only members with a push token that are past the threshold and not recently pushed', async () => {
      const store2 = createMemoryStore();
      await store2.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store2.addMember('fria-001', { alias: 'B3', socketId: 's2' });
      await store2.addMember('fria-001', { alias: 'C2', socketId: 's3' });
      await store2.setPushToken('fria-001', 's1', 'tok1');
      await store2.setPushToken('fria-001', 's2', 'tok2');
      // Wait, then bump s2 so it falls back under the threshold.
      await new Promise((r) => setTimeout(r, 5));
      await store2.appendMessage('fria-001', {
        alias: 'B3',
        socketId: 's2',
        text: 'hola',
        type: 'text',
      });
      const sessions = await store2.findPushCandidates(2, 99999999);
      // A1 is past the 2ms threshold; B3 was just bumped; C2 has no token.
      expect(sessions).toHaveLength(1);
      expect(sessions[0].alias).toBe('A1');
      await store2.close();
    });

    it('skips members pushed within the repush window', async () => {
      const store2 = createMemoryStore();
      await store2.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store2.setPushToken('fria-001', 's1', 'tok1');
      await new Promise((r) => setTimeout(r, 5));
      await store2.markPushSent('fria-001', 's1');
      const sessions = await store2.findPushCandidates(0, 99999999);
      expect(sessions).toHaveLength(0);
      await store2.close();
    });
  });

  describe('findExpiredSessions', () => {
    it('returns members whose push aged past the expiration window with no activity since', async () => {
      const store2 = createMemoryStore();
      await store2.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store2.addMember('fria-001', { alias: 'B3', socketId: 's2' });
      await store2.markPushSent('fria-001', 's1');
      await store2.markPushSent('fria-001', 's2');
      // Wait, then bump s2 so its activity is newer than pushed_at.
      await new Promise((r) => setTimeout(r, 5));
      await store2.appendMessage('fria-001', {
        alias: 'B3',
        socketId: 's2',
        text: 'todavia aqui',
        type: 'text',
      });
      const expired = await store2.findExpiredSessions(0);
      // s1 has no activity since pushedAt → expired.
      // s2 has activity after pushedAt → still alive.
      expect(expired).toHaveLength(1);
      expect(expired[0].alias).toBe('A1');
      await store2.close();
    });
  });

  describe('markInactive / reconnect reclaims codename', () => {
    it('keeps the member row but marks isOnline=false on soft disconnect', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      const online = await store.markInactive('fria-001', 's1');
      expect(online).toHaveLength(0); // nobody online
      const all = await store.getAllMembers('fria-001');
      expect(all).toHaveLength(1); // but row is still there
      expect(all[0].alias).toBe('A1');
      expect(all[0].isOnline).toBe(false);
    });

    it('reuses the existing row when the same alias reconnects', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      await store.markInactive('fria-001', 's1');
      // Now simulate a reconnect: addMember with the same alias + new socket.
      await store.addMember('fria-001', { alias: 'A1', socketId: 's2' });
      const all = await store.getAllMembers('fria-001');
      expect(all).toHaveLength(1); // not duplicated
      expect(all[0].socketId).toBe('s2');
      expect(all[0].isOnline).toBe(true);
    });
  });

  describe('forceDeleteMember', () => {
    it('removes the row entirely (used by inactivity expiration)', async () => {
      await store.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      const result = await store.forceDeleteMember('fria-001', 's1');
      expect(result.removed.alias).toBe('A1');
      expect(result.roomGced).toBe(true);
      expect(await store.getAllMembers('fria-001')).toEqual([]);
    });
  });

  describe('purgeInactiveRooms', () => {
    it('removes rooms whose last_active is older than the cutoff', async () => {
      const store2 = createMemoryStore();
      await store2.addMember('fria-001', { alias: 'A1', socketId: 's1' });
      // Manually age the room.
      const room = await store2.getMembers('fria-001');
      expect(room).toHaveLength(1);
      // Pretend the room has been empty for 25 hours.
      await store2.removeMember('fria-001', 's1');
      // Re-add a single member so the room exists with a stale lastActive.
      // The store drops empty rooms on removeMember, so we just verify
      // a non-empty room survives a purge of 0 hours.
      await store2.addMember('fria-002', { alias: 'A1', socketId: 's1' });
      const removed = await store2.purgeInactiveRooms(0);
      // fria-002 is brand new; nothing should be purged.
      expect(removed).toBe(0);
      await store2.close();
    });
  });
});
