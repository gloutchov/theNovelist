import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { app, safeStorage } from 'electron';

const SECURE_SETTINGS_DIR = 'secure-settings';
const CODEX_API_KEY_PREFIX = 'codex-api-key';

function sanitizeProjectId(projectId: string): string {
  const safe = projectId
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return safe || 'project';
}

function getSecureSettingsDirectory(): string {
  return path.join(app.getPath('userData'), SECURE_SETTINGS_DIR);
}

function getCodexApiKeyFilePath(projectId: string): string {
  return path.join(
    getSecureSettingsDirectory(),
    `${CODEX_API_KEY_PREFIX}-${sanitizeProjectId(projectId)}.bin`,
  );
}

async function ensureSecureSettingsDirectory(): Promise<void> {
  await mkdir(getSecureSettingsDirectory(), { recursive: true });
}

export async function isSecureStorageAvailable(): Promise<boolean> {
  try {
    return await safeStorage.isAsyncEncryptionAvailable();
  } catch {
    return false;
  }
}

export async function getStoredCodexApiKey(projectId: string): Promise<string | null> {
  const filePath = getCodexApiKeyFilePath(projectId);
  let encoded = '';
  try {
    encoded = await readFile(filePath, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return null;
    }
    throw error;
  }

  const trimmed = encoded.trim();
  if (!trimmed) {
    return null;
  }

  if (!(await isSecureStorageAvailable())) {
    throw new Error('Archivio sicuro di sistema non disponibile per decifrare la API key.');
  }

  const encrypted = Buffer.from(trimmed, 'base64');
  const decrypted = await safeStorage.decryptStringAsync(encrypted);
  const value = decrypted.result.trim();
  if (decrypted.shouldReEncrypt && value) {
    const rotated = await safeStorage.encryptStringAsync(value);
    await writeFile(filePath, rotated.toString('base64'), 'utf8');
  }
  return value || null;
}

export async function setStoredCodexApiKey(projectId: string, apiKey: string): Promise<void> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    await clearStoredCodexApiKey(projectId);
    return;
  }

  if (!(await isSecureStorageAvailable())) {
    throw new Error(
      'Archivio sicuro di sistema non disponibile. Usa OPENAI_API_KEY oppure abilita il keychain locale.',
    );
  }

  await ensureSecureSettingsDirectory();
  const encrypted = await safeStorage.encryptStringAsync(trimmed);
  await writeFile(getCodexApiKeyFilePath(projectId), encrypted.toString('base64'), 'utf8');
}

export async function clearStoredCodexApiKey(projectId: string): Promise<void> {
  try {
    await rm(getCodexApiKeyFilePath(projectId), { force: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT') {
      throw error;
    }
  }
}
