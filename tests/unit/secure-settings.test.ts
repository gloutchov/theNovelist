import { chmod, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

const secureStorage = vi.hoisted(() => ({
  userData: '',
  decrypt: vi.fn(async (_encrypted: Buffer) => ({ result: 'sk-test', shouldReEncrypt: true })),
  encrypt: vi.fn(async (value: string) => Buffer.from(`rotated:${value}`)),
}));

vi.mock('electron', () => ({
  app: {
    getPath: () => secureStorage.userData,
  },
  safeStorage: {
    isAsyncEncryptionAvailable: async () => true,
    decryptStringAsync: secureStorage.decrypt,
    encryptStringAsync: secureStorage.encrypt,
  },
}));

import { getStoredCodexApiKey } from '../../src/main/security/secure-settings';

const tempDirs: string[] = [];

afterEach(async () => {
  secureStorage.decrypt.mockReset();
  secureStorage.encrypt.mockReset();
  secureStorage.decrypt.mockResolvedValue({ result: 'sk-test', shouldReEncrypt: true });
  secureStorage.encrypt.mockImplementation(async (value: string) =>
    Buffer.from(`rotated:${value}`),
  );
  vi.restoreAllMocks();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function createStoredKey(contents: string): Promise<{ userData: string; filePath: string }> {
  const userData = await mkdtemp(path.join(tmpdir(), 'novelist-secure-settings-'));
  tempDirs.push(userData);
  secureStorage.userData = userData;
  const directory = path.join(userData, 'secure-settings');
  await mkdir(directory);
  const filePath = path.join(directory, 'codex-api-key-proj-1.bin');
  await writeFile(filePath, contents, 'utf8');
  return { userData, filePath };
}

describe('getStoredCodexApiKey rotation', () => {
  it('decrypts, re-encrypts, and replaces the file atomically when shouldReEncrypt is true', async () => {
    const stored = Buffer.from('cipher-text').toString('base64');
    const { userData, filePath } = await createStoredKey(stored);

    const value = await getStoredCodexApiKey('proj-1');

    expect(value).toBe('sk-test');
    expect(secureStorage.decrypt).toHaveBeenCalledTimes(1);
    const decryptedInput = secureStorage.decrypt.mock.calls[0][0];
    expect(Buffer.compare(decryptedInput, Buffer.from(stored, 'base64'))).toBe(0);
    expect(secureStorage.encrypt).toHaveBeenCalledWith('sk-test');
    await expect(readFile(filePath, 'utf8')).resolves.toBe(
      Buffer.from('rotated:sk-test').toString('base64'),
    );
    const leftovers = (await readdir(path.join(userData, 'secure-settings'))).filter((name) =>
      name.endsWith('.tmp'),
    );
    expect(leftovers).toEqual([]);
  });

  it('returns the decrypted key when the atomic rewrite fails', async () => {
    const stored = Buffer.from('cipher-text').toString('base64');
    const { filePath } = await createStoredKey(stored);
    const directory = path.dirname(filePath);
    await chmod(directory, 0o555);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      const value = await getStoredCodexApiKey('proj-1');

      expect(value).toBe('sk-test');
      expect(secureStorage.decrypt).toHaveBeenCalledTimes(1);
      expect(secureStorage.encrypt).toHaveBeenCalledWith('sk-test');
      await expect(readFile(filePath, 'utf8')).resolves.toBe(stored);
      expect(errorLog).toHaveBeenCalledTimes(1);
      expect(String(errorLog.mock.calls[0]?.[0])).not.toContain('sk-test');
      const leftovers = (await readdir(directory)).filter((name) => name.endsWith('.tmp'));
      expect(leftovers).toEqual([]);
    } finally {
      await chmod(directory, 0o755);
    }
  });
});
