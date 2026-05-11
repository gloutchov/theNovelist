import { access, mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  importImageToProject,
  saveGeneratedImageToProject,
  validateProjectImageFile,
} from '../../src/main/images/generation';

const tempDirs: string[] = [];
const imageSignatures = {
  png: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  jpg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  jpeg: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  webp: Buffer.from('RIFF0000WEBP', 'ascii'),
  gif: Buffer.from('GIF89a', 'ascii'),
  bmp: Buffer.from('BM', 'ascii'),
} as const;

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
    await writeFile(sourceFilePath, imageSignatures.png);

    const storedFilePath = await importImageToProject({
      assetsPath,
      category: 'characters',
      imageType: 'mezzo-busto',
      sourceFilePath,
    });

    expect(storedFilePath.startsWith(path.join('assets', 'img', 'characters') + path.sep)).toBe(
      true,
    );
    await access(path.join(projectRootPath, storedFilePath));
  });

  it.each([
    ['png', 'png'],
    ['jpg', 'jpg'],
    ['jpeg', 'jpg'],
    ['webp', 'webp'],
    ['gif', 'gif'],
    ['bmp', 'bmp'],
  ] as const)(
    'accepts imported %s images with matching signatures',
    async (extension, storedExtension) => {
      const projectRootPath = await createTempDir('novelist-image-project-');
      const externalRootPath = await createTempDir('novelist-image-source-');
      const assetsPath = path.join(projectRootPath, 'assets');
      const sourceFilePath = path.join(externalRootPath, `portrait.${extension}`);

      await mkdir(assetsPath, { recursive: true });
      await writeFile(sourceFilePath, imageSignatures[extension]);

      const storedFilePath = await importImageToProject({
        assetsPath,
        category: 'characters',
        imageType: 'ritratto',
        sourceFilePath,
      });

      expect(storedFilePath.endsWith(`.${storedExtension}`)).toBe(true);
      await access(path.join(projectRootPath, storedFilePath));
    },
  );

  it('rejects imported images with unsupported extensions', async () => {
    const projectRootPath = await createTempDir('novelist-image-project-');
    const externalRootPath = await createTempDir('novelist-image-source-');
    const assetsPath = path.join(projectRootPath, 'assets');
    const sourceFilePath = path.join(externalRootPath, 'portrait.svg');

    await mkdir(assetsPath, { recursive: true });
    await writeFile(sourceFilePath, '<svg />');

    await expect(
      importImageToProject({
        assetsPath,
        category: 'characters',
        imageType: 'ritratto',
        sourceFilePath,
      }),
    ).rejects.toThrow('Formato immagine non supportato');
  });

  it('rejects imported images when the extension does not match the signature', async () => {
    const projectRootPath = await createTempDir('novelist-image-project-');
    const externalRootPath = await createTempDir('novelist-image-source-');
    const assetsPath = path.join(projectRootPath, 'assets');
    const sourceFilePath = path.join(externalRootPath, 'portrait.jpg');

    await mkdir(assetsPath, { recursive: true });
    await writeFile(sourceFilePath, imageSignatures.png);

    await expect(
      importImageToProject({
        assetsPath,
        category: 'characters',
        imageType: 'ritratto',
        sourceFilePath,
      }),
    ).rejects.toThrow('non corrisponde al formato immagine dichiarato');
  });

  it('rejects imported files with image extensions but non-image content', async () => {
    const projectRootPath = await createTempDir('novelist-image-project-');
    const externalRootPath = await createTempDir('novelist-image-source-');
    const assetsPath = path.join(projectRootPath, 'assets');
    const sourceFilePath = path.join(externalRootPath, 'portrait.png');

    await mkdir(assetsPath, { recursive: true });
    await writeFile(sourceFilePath, 'not an image');

    await expect(
      importImageToProject({
        assetsPath,
        category: 'characters',
        imageType: 'ritratto',
        sourceFilePath,
      }),
    ).rejects.toThrow('non corrisponde al formato immagine dichiarato');
  });

  it('rejects images above the configured size budget before import', async () => {
    const externalRootPath = await createTempDir('novelist-image-source-');
    const sourceFilePath = path.join(externalRootPath, 'portrait.png');

    await writeFile(sourceFilePath, Buffer.concat([imageSignatures.png, Buffer.alloc(16)]));

    await expect(validateProjectImageFile(sourceFilePath, { maxBytes: 8 })).rejects.toThrow(
      'Immagine troppo grande',
    );
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

    expect(
      storedFilePath.startsWith(path.join('assets', 'generated-images', 'locations') + path.sep),
    ).toBe(true);
    await access(path.join(projectRootPath, storedFilePath));
  });
});
