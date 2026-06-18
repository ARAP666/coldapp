import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it, vi } from 'vitest';
import { MIGRATION_LOCK_ID, runMigrations } from '../scripts/migrate.js';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoMigration = path.resolve(testDir, '..', '..', 'db', 'migration.sql');
const packagedMigration = path.resolve(
  testDir,
  '..',
  'migrations',
  '001-initial.sql'
);

describe('database migrations', () => {
  it('keeps the packaged Railway migration identical to the source migration', () => {
    expect(fs.readFileSync(packagedMigration, 'utf8')).toBe(
      fs.readFileSync(repoMigration, 'utf8')
    );
  });

  it('skips cleanly when DATABASE_URL is absent', async () => {
    const createPool = vi.fn();
    const result = await runMigrations({
      databaseUrl: null,
      logger: { log() {} },
      createPool,
    });

    expect(result).toEqual({ skipped: true });
    expect(createPool).not.toHaveBeenCalled();
  });

  it('locks, applies, verifies, and closes the database connection', async () => {
    const release = vi.fn();
    const end = vi.fn();
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({
        rows: [
          { relation: 'rooms' },
          { relation: 'members' },
          { relation: 'messages' },
        ],
      })
      .mockResolvedValueOnce({ rows: [] });
    const createPool = vi.fn(() => ({
      connect: vi.fn(async () => ({ query, release })),
      end,
    }));

    await expect(
      runMigrations({
        databaseUrl: 'postgres://example',
        logger: { log() {} },
        createPool,
        readFile: () => 'BEGIN; COMMIT;',
      })
    ).resolves.toEqual({ skipped: false });

    expect(query).toHaveBeenNthCalledWith(1, 'SELECT pg_advisory_lock($1)', [
      MIGRATION_LOCK_ID,
    ]);
    expect(query).toHaveBeenNthCalledWith(2, 'BEGIN; COMMIT;');
    expect(query).toHaveBeenNthCalledWith(4, 'SELECT pg_advisory_unlock($1)', [
      MIGRATION_LOCK_ID,
    ]);
    expect(release).toHaveBeenCalledOnce();
    expect(end).toHaveBeenCalledOnce();
  });
});
