import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { ProjectSessionManager } from '../../src/main/projects/session';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('ProjectSessionManager', () => {
  it('creates, opens and snapshots a project', async () => {
    const rootPath = await createTempDir('novelist-session-');
    const session = new ProjectSessionManager();

    try {
      const project = await session.createProject({ rootPath, name: 'Session Test' });
      expect(project.project.name).toBe('Session Test');
      expect(session.getOpenedProject()?.project.id).toBe(project.project.id);

      const snapshot = await session.saveSnapshot('manual-check');
      expect(snapshot.reason).toBe('manual-check');

      const snapshots = await session.listSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);
    } finally {
      session.closeProject();
    }
  });
});
