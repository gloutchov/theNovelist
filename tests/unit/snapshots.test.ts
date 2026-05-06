import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createProjectOnDisk, resolveProjectPaths } from '../../src/main/projects/project-files';
import {
  AutoSaveScheduler,
  createProjectSnapshot,
  listProjectSnapshots,
  recoverLatestSnapshot,
} from '../../src/main/projects/snapshots';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('snapshots', () => {
  it('creates and recovers latest snapshot', async () => {
    const workspacePath = await createTempDir('novelist-snapshots-');
    const created = await createProjectOnDisk({ rootPath: workspacePath, name: 'Snapshots Test' });
    const rootPath = created.rootPath;

    const paths = resolveProjectPaths(rootPath);
    const originalBytes = await readFile(paths.dbPath);

    const snapshot = await createProjectSnapshot({
      rootPath,
      reason: 'manual-test',
    });

    expect(snapshot.fileName.endsWith('.sqlite')).toBe(true);

    await writeFile(paths.dbPath, Buffer.from('corrupted-data'));

    const recovered = await recoverLatestSnapshot(rootPath);
    expect(recovered).not.toBeNull();

    const recoveredBytes = await readFile(paths.dbPath);
    expect(recoveredBytes.equals(originalBytes)).toBe(true);

    const snapshots = await listProjectSnapshots(rootPath);
    expect(snapshots.length).toBeGreaterThanOrEqual(1);
  });

  it('runs autosave callback on interval', async () => {
    const onSave = vi.fn(async () => Promise.resolve());
    const scheduler = new AutoSaveScheduler(5_000, onSave);

    scheduler.start();
    await vi.advanceTimersByTimeAsync(16_000);
    scheduler.stop();

    expect(onSave).toHaveBeenCalledTimes(3);
  });
});
