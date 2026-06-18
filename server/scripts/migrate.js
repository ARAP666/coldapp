const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const MIGRATION_FILE = path.join(__dirname, '..', 'migrations', '001-initial.sql');
const MIGRATION_LOCK_ID = 727104001;
const REQUIRED_RELATIONS = ['rooms', 'members', 'messages'];

async function runMigrations({
  databaseUrl = process.env.DATABASE_URL,
  logger = console,
  createPool = (config) => new Pool(config),
  readFile = fs.readFileSync,
} = {}) {
  if (!databaseUrl) {
    logger.log('[migrate] skipped (no DATABASE_URL set)');
    return { skipped: true };
  }

  const sql = readFile(MIGRATION_FILE, 'utf8');
  const pool = createPool({ connectionString: databaseUrl });
  const client = await pool.connect();

  try {
    await client.query('SELECT pg_advisory_lock($1)', [MIGRATION_LOCK_ID]);
    logger.log('[migrate] applying 001-initial.sql');
    await client.query(sql);

    const { rows } = await client.query(
      `SELECT to_regclass('public.' || relation_name) AS relation
         FROM unnest($1::text[]) AS relation_name`,
      [REQUIRED_RELATIONS]
    );
    const missing = REQUIRED_RELATIONS.filter((_, index) => !rows[index]?.relation);
    if (missing.length > 0) {
      throw new Error(`required relations missing after migration: ${missing.join(', ')}`);
    }

    logger.log('[migrate] schema ready');
    return { skipped: false };
  } finally {
    await client
      .query('SELECT pg_advisory_unlock($1)', [MIGRATION_LOCK_ID])
      .catch(() => {});
    client.release();
    await pool.end();
  }
}

if (require.main === module) {
  require('dotenv').config();
  runMigrations().catch((err) => {
    console.error('[migrate] fatal:', err.message);
    process.exitCode = 1;
  });
}

module.exports = {
  MIGRATION_FILE,
  MIGRATION_LOCK_ID,
  REQUIRED_RELATIONS,
  runMigrations,
};
