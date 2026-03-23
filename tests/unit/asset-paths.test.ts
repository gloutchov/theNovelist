import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  repairProjectStoredFilePath,
  resolveProjectStoredFilePath,
  toProjectStoredFilePath,
} from '../../src/main/projects/asset-paths';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('asset-paths', () => {
  it('stores project-local files as project-relative paths', async () => {
    const projectRootPath = await createTempDir('novelist-asset-paths-project-');
    const imagePath = path.join(projectRootPath, 'assets', 'img', 'characters', 'hero.png');

    expect(toProjectStoredFilePath(projectRootPath, imagePath)).toBe(
      path.join('assets', 'img', 'characters', 'hero.png'),
    );
  });

  it('keeps external absolute files unchanged', async () => {
    const projectRootPath = await createTempDir('novelist-asset-paths-project-');
    const externalRootPath = await createTempDir('novelist-asset-paths-external-');
    const imagePath = path.join(externalRootPath, 'hero.png');

    expect(toProjectStoredFilePath(projectRootPath, imagePath)).toBe(path.resolve(imagePath));
  });

  it('resolves legacy relative asset paths against the current project layout', async () => {
    const projectRootPath = await createTempDir('novelist-asset-paths-project-');
    const assetsPath = path.join(projectRootPath, 'assets');
    const legacyImagePath = path.join(assetsPath, 'img', 'characters', 'hero.png');
    const projectRelativeImagePath = path.join(projectRootPath, 'assets', 'img', 'locations', 'dock.png');

    await mkdir(path.dirname(legacyImagePath), { recursive: true });
    await mkdir(path.dirname(projectRelativeImagePath), { recursive: true });
    await writeFile(legacyImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    await writeFile(projectRelativeImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect(
      resolveProjectStoredFilePath({
        projectRootPath,
        assetsPath,
        filePath: path.join('img', 'characters', 'hero.png'),
      }),
    ).toBe(legacyImagePath);

    expect(
      resolveProjectStoredFilePath({
        projectRootPath,
        assetsPath,
        filePath: path.join('assets', 'img', 'locations', 'dock.png'),
      }),
    ).toBe(projectRelativeImagePath);
  });

  it('repairs stale absolute asset paths from a previous project location', async () => {
    const projectRootPath = await createTempDir('novelist-asset-paths-project-');
    const assetsPath = path.join(projectRootPath, 'assets');
    const staleAbsolutePath = path.join(
      path.sep,
      'Users',
      'gloutchov',
      'Desktop',
      'Luna_Nuova',
      'assets',
      'generated-images',
      'characters',
      'hero.png',
    );
    const repairedImagePath = path.join(assetsPath, 'generated-images', 'characters', 'hero.png');

    await mkdir(path.dirname(repairedImagePath), { recursive: true });
    await writeFile(repairedImagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    expect(
      repairProjectStoredFilePath({
        projectRootPath,
        assetsPath,
        filePath: staleAbsolutePath,
      }),
    ).toBe(path.join('assets', 'generated-images', 'characters', 'hero.png'));
  });
});
