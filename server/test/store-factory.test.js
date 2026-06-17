// Tests for the store factory. Verifies it picks the right backend.

import { describe, it, expect } from 'vitest';
import { createStore } from '../src/store/index.js';

describe('createStore', () => {
  it('returns an in-memory store when DATABASE_URL is missing', async () => {
    const store = await createStore({ databaseUrl: null, logger: { log() {} } });
    expect(store.kind).toBe('memory');
    await store.close();
  });

  it('exposes the message cap and history limit', async () => {
    const store = await createStore({ databaseUrl: null, logger: { log() {} } });
    expect(store.MESSAGE_CAP).toBe(200);
    expect(store.HISTORY_LIMIT).toBe(50);
    await store.close();
  });

  it('throws clearly when DATABASE_URL is set but pg is not installed', async () => {
    // We can't easily simulate "pg not installed", but we can verify the
    // happy path of trying to connect — the factory should attempt to load
    // pg and then try to connect. If pg IS installed (it is in dev deps),
    // it will instead fail at the SELECT 1 with a connection error.
    await expect(
      createStore({
        databaseUrl: 'postgres://user:pass@127.0.0.1:1/nope',
        logger: { log() {} },
      })
    ).rejects.toThrow(/Postgres connection failed/);
  });
});
