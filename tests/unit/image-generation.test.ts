import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { importImageToProject, saveGeneratedImageToProject } from '../../src/main/images/generation';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('image-generation project storage', () => {
  it('stores imported character images with project-relative paths', async () => {
    const projectRootPath = await createTempDir('novelist-image-project-');
    const externalRootPath = await createTempDir('novelist-image-source-');
    const assetsPath = path.join(projectRootPath, 'assets');
    const sourceFilePath = path.join(externalRootPath, 'portrait.png');

    await mkdir(assetsPath, { recursive: true });
    await writeFile(sourceFilePath, Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const storedFilePath = await importImageToProject({
      assetsPath,
      category: 'characters',
      imageType: 'mezzo-busto',
      sourceFilePath,
    });

    expect(storedFilePath.startsWith(path.join('assets', 'img', 'characters') + path.sep)).toBe(true);
    await access(path.join(projectRootPath, storedFilePath));
  });

  it('stores generated location images with project-relative paths', async () => {
    const projectRootPath = await createTempDir('novelist-image-project-');
    const assetsPath = path.join(projectRootPath, 'assets');

    await mkdir(assetsPath, { recursive: true });

    const storedFilePath = await saveGeneratedImageToProject({
      assetsPath,
      category: 'locations',
      imageType: 'esterno',
      generated: {
        bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        extension: 'png',
      },
    });

    expect(storedFilePath.startsWith(path.join('assets', 'generated-images', 'locations') + path.sep)).toBe(
      true,
    );
    await access(path.join(projectRootPath, storedFilePath));
  });
});
