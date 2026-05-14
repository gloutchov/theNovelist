import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import {
  isBlockedProductionShortcut,
  isDevToolsEnabled,
} from '../../src/main/security/debug-policy';

const execFileAsync = promisify(execFile);

describe('production Electron security policy', () => {
  it('enables DevTools only for dev server or explicit flag', () => {
    expect(isDevToolsEnabled({ env: {}, rendererUrl: undefined })).toBe(false);
    expect(isDevToolsEnabled({ env: {}, rendererUrl: 'http://127.0.0.1:5173' })).toBe(true);
    expect(isDevToolsEnabled({ env: { NOVELIST_ENABLE_DEVTOOLS: '1' } })).toBe(true);
    expect(isDevToolsEnabled({ env: { NOVELIST_ENABLE_DEVTOOLS: 'true' } })).toBe(true);
    expect(isDevToolsEnabled({ env: { NOVELIST_ENABLE_DEVTOOLS: '0' } })).toBe(false);
  });

  it('blocks reload and DevTools accelerators in production', () => {
    expect(isBlockedProductionShortcut({ key: 'F5' })).toBe(true);
    expect(isBlockedProductionShortcut({ key: 'r', control: true })).toBe(true);
    expect(isBlockedProductionShortcut({ key: 'R', meta: true, shift: true })).toBe(true);
    expect(isBlockedProductionShortcut({ key: 'F12' })).toBe(true);
    expect(isBlockedProductionShortcut({ key: 'I', control: true, shift: true })).toBe(true);
    expect(isBlockedProductionShortcut({ key: 's', control: true })).toBe(false);
  });
});

describe('renderer CSP', () => {
  it('does not allow remote image sources', async () => {
    const html = await readFile(path.resolve(process.cwd(), 'src/renderer/index.html'), 'utf8');
    const csp = html.match(/Content-Security-Policy"\s+content="([^"]+)"/)?.[1] ?? '';
    const imgSrc = csp
      .split(';')
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith('img-src '));

    expect(imgSrc).toBe("img-src 'self' data: blob: file:");
    expect(imgSrc).not.toContain('http:');
    expect(imgSrc).not.toContain('https:');
  });
});

describe('release checksum generation', () => {
  it('writes SHA-256 sums for release artifacts only', async () => {
    const releaseDir = await mkdtemp(path.join(tmpdir(), 'novelist-checksums-'));
    try {
      await writeFile(path.join(releaseDir, 'The Novelist Setup 4.5.0.exe'), 'installer');
      await writeFile(path.join(releaseDir, 'The Novelist 4.5.0.zip'), 'zip');
      await writeFile(path.join(releaseDir, 'The Novelist Setup 4.0.0.exe'), 'old installer');
      await writeFile(path.join(releaseDir, 'latest.yml'), 'metadata');
      await writeFile(path.join(releaseDir, 'builder-debug.yml'), 'internal');
      await writeFile(path.join(releaseDir, 'notes.txt'), 'ignored');
      await mkdir(path.join(releaseDir, 'win-unpacked'), { recursive: true });
      await writeFile(path.join(releaseDir, 'win-unpacked', 'The Novelist.exe'), 'unpacked');

      await execFileAsync(process.execPath, [
        path.resolve(process.cwd(), 'scripts/generate-checksums.mjs'),
        '--release-dir',
        releaseDir,
        '--version',
        '4.5.0',
      ]);
      const checksumFile = await readFile(path.join(releaseDir, 'SHA256SUMS.txt'), 'utf8');

      expect(checksumFile).toContain('The Novelist Setup 4.5.0.exe');
      expect(checksumFile).toContain('The Novelist 4.5.0.zip');
      expect(checksumFile).toContain('latest.yml');
      expect(checksumFile).not.toContain('The Novelist Setup 4.0.0.exe');
      expect(checksumFile).not.toContain('builder-debug.yml');
      expect(checksumFile).not.toContain('notes.txt');
      expect(checksumFile).not.toContain('win-unpacked');
      expect(checksumFile.trim().split('\n')).toHaveLength(3);
      expect(checksumFile.trim().split('\n')[0]).toMatch(/^[a-f0-9]{64}  /);
    } finally {
      await rm(releaseDir, { recursive: true, force: true });
    }
  });
});
