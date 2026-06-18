import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const testDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(testDir, '..');
const repoRoot = path.resolve(serverRoot, '..');

describe('deployment startup', () => {
  it('uses npm start in Railway so migrations run before the server', () => {
    const railway = JSON.parse(
      fs.readFileSync(path.join(serverRoot, 'railway.json'), 'utf8')
    );

    expect(railway.deploy.startCommand).toBe('npm start');
  });

  it('uses npm start in Nixpacks so migrations are not bypassed', () => {
    const nixpacks = fs.readFileSync(
      path.join(repoRoot, 'nixpacks.toml'),
      'utf8'
    );

    expect(nixpacks).toMatch(/\[start\]\s+cmd = "npm start"/);
  });

  it('starts the server package through npm from the root Procfile', () => {
    const procfile = fs.readFileSync(path.join(repoRoot, 'Procfile'), 'utf8');

    expect(procfile.trim()).toBe('web: npm --prefix server start');
  });
});
