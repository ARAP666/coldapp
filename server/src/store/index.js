// Store factory. Picks Postgres when DATABASE_URL is set, in-memory otherwise.
//
// To swap to Postgres in dev: set DATABASE_URL=postgres://... and restart.

const { createMemoryStore, MESSAGE_CAP, HISTORY_LIMIT } = require('./memory');

async function createStore({ databaseUrl, logger = console } = {}) {
  if (!databaseUrl) {
    logger.log('[store] using in-memory store (no DATABASE_URL set)');
    return createMemoryStore();
  }

  logger.log('[store] using Postgres store');
  let pg;
  try {
    pg = require('pg');
  } catch (err) {
    throw new Error(
      "DATABASE_URL is set but the 'pg' package is not installed. " +
        "Run `npm install pg` in the server package."
    );
  }
  const pool = new pg.Pool({ connectionString: databaseUrl });
  // Fail fast if the DB is unreachable at boot.
  try {
    await pool.query('SELECT 1');
  } catch (err) {
    await pool.end().catch(() => {});
    throw new Error(`[store] Postgres connection failed: ${err.message}`);
  }
  const { createPgStore } = require('./pg');
  return createPgStore(pool);
}

module.exports = { createStore, MESSAGE_CAP, HISTORY_LIMIT };
