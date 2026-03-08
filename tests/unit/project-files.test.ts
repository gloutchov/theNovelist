import { access, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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
});
