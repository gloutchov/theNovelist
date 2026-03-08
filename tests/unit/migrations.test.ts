import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { afterEach, describe, expect, it } from 'vitest';
import { applyMigrations, getLatestSchemaVersion } from '../../src/main/persistence/migrations';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('database migrations', () => {
  it('applies latest schema version and creates core tables', async () => {
    const dir = await createTempDir('novelist-migrations-');
    const dbPath = path.join(dir, 'project.db');
    const db = new Database(dbPath);

    try {
      applyMigrations(db);

      const version = db.pragma('user_version', { simple: true }) as number;
      expect(version).toBe(getLatestSchemaVersion());

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
        .all() as Array<{ name: string }>;

      expect(tables.map((row) => row.name)).toEqual(
        expect.arrayContaining([
          'projects',
          'plots',
          'chapter_nodes',
          'chapter_edges',
          'chapter_documents',
          'codex_settings',
          'codex_chat_messages',
          'character_cards',
          'character_images',
          'character_chapter_links',
          'location_cards',
          'location_images',
          'location_chapter_links',
        ]),
      );
    } finally {
      db.close();
    }
  });
});
