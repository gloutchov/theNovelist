import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import { mkdir, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ATOMIC_TEMP_FILE_PATTERN = /^\..+\.\d+\.[0-9a-f-]+\.tmp$/i;

export async function writeTextFileAtomic(filePath: string, content: string): Promise<void> {
  const directory = path.dirname(filePath);
  const temporaryPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`,
  );

  await mkdir(directory, { recursive: true });

  try {
    await writeFile(temporaryPath, content, 'utf8');
    await rename(temporaryPath, filePath);
  } catch (error) {
    await rm(temporaryPath, { force: true });
    throw error;
  }
}

export async function cleanupAtomicTempFiles(rootPath: string): Promise<string[]> {
  const removedPaths: string[] = [];

  async function visit(directoryPath: string): Promise<void> {
    let entries: Dirent<string>[];
    try {
      entries = await readdir(directoryPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const entryPath = path.join(directoryPath, entry.name);
      if (entry.isDirectory()) {
        await visit(entryPath);
        continue;
      }

      if (!entry.isFile() || !ATOMIC_TEMP_FILE_PATTERN.test(entry.name)) {
        continue;
      }

      await rm(entryPath, { force: true });
      removedPaths.push(entryPath);
    }
  }

  await visit(rootPath);
  return removedPaths;
}
