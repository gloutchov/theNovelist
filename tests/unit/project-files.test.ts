import { access, mkdtemp, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import Database from 'better-sqlite3';
import {
  PROJECT_ASSETS_DIRNAME,
  PROJECT_DB_FILENAME,
  PROJECT_SNAPSHOTS_DIRNAME,
  createProjectOnDisk,
  openProjectFromDisk,
  projectExists,
} from '../../src/main/projects/project-files';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('project-files', () => {
  it('creates and opens a project with canonical disk layout', async () => {
    const rootPath = await createTempDir('novelist-project-');

    const created = await createProjectOnDisk({
      rootPath,
      name: 'Il mio romanzo',
    });

    await access(path.join(rootPath, PROJECT_DB_FILENAME));
    await access(path.join(rootPath, PROJECT_ASSETS_DIRNAME));
    await access(path.join(rootPath, PROJECT_SNAPSHOTS_DIRNAME));

    expect(created.project.name).toBe('Il mio romanzo');
    expect(await projectExists(rootPath)).toBe(true);

    const opened = await openProjectFromDisk(rootPath);
    expect(opened.project.id).toBe(created.project.id);
    expect(opened.dbPath).toContain(PROJECT_DB_FILENAME);
  });

  it('fails when trying to open a missing project database', async () => {
    const rootPath = await createTempDir('novelist-missing-project-');
    await expect(openProjectFromDisk(rootPath)).rejects.toThrow();
  });

  it('updates stored project root and asset paths when the project folder is moved', async () => {
    const originalRootPath = await createTempDir('novelist-project-move-src-');
    const movedRootPath = await createTempDir('novelist-project-move-dst-');

    const created = await createProjectOnDisk({
      rootPath: originalRootPath,
      name: 'Romanzo spostato',
    });

    const db = new Database(path.join(originalRootPath, PROJECT_DB_FILENAME));
    try {
      db.prepare(
        `
        INSERT INTO character_cards(
          id, project_id, first_name, last_name, sex, age, sexual_orientation, species, hair_color,
          bald, beard, physique, job, notes, plot_number, position_x, position_y, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
      ).run(
        'card-1',
        created.project.id,
        'Anna',
        'Rossi',
        '',
        null,
        '',
        '',
        '',
        0,
        '',
        '',
        '',
        '',
        1,
        0,
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      db.prepare(
        `
        INSERT INTO character_images(id, character_card_id, image_type, file_path, prompt, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        `,
      ).run(
        'img-1',
        'card-1',
        'mezzo-busto',
        path.join(originalRootPath, 'assets', 'img', 'characters', 'hero.png'),
        '',
        new Date().toISOString(),
      );
    } finally {
      db.close();
    }

    await access(path.join(originalRootPath, PROJECT_DB_FILENAME));
    await access(path.join(originalRootPath, PROJECT_ASSETS_DIRNAME));

    // Move the on-disk project by renaming the root folder contents into a new temp dir.
    const sourceEntries = [
      PROJECT_DB_FILENAME,
      PROJECT_ASSETS_DIRNAME,
      PROJECT_SNAPSHOTS_DIRNAME,
    ] as const;
    for (const entry of sourceEntries) {
      const from = path.join(originalRootPath, entry);
      const to = path.join(movedRootPath, entry);
      await rm(to, { recursive: true, force: true });
      await rename(from, to);
    }

    const opened = await openProjectFromDisk(movedRootPath);
    expect(opened.project.id).toBe(created.project.id);
    expect(opened.project.rootPath).toBe(movedRootPath);

    const movedDb = new Database(path.join(movedRootPath, PROJECT_DB_FILENAME), { readonly: true });
    try {
      const row = movedDb
        .prepare('SELECT root_path FROM projects WHERE id = ?')
        .get(created.project.id) as { root_path: string };
      const imageRow = movedDb
        .prepare('SELECT file_path FROM character_images WHERE id = ?')
        .get('img-1') as { file_path: string };

      expect(row.root_path).toBe(movedRootPath);
      expect(imageRow.file_path).toBe(path.join('assets', 'img', 'characters', 'hero.png'));
    } finally {
      movedDb.close();
    }
  });
});
