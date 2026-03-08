import { copyFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import {
  PROJECT_DB_FILENAME,
  PROJECT_SNAPSHOTS_DIRNAME,
  resolveProjectPaths,
} from './project-files';

export interface SnapshotRecord {
  fileName: string;
  filePath: string;
  createdAt: string;
  reason: string;
}

function sanitizeReason(reason: string): string {
  return reason.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 30) || 'manual';
}

function buildTimestamp(date: Date): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

export async function createProjectSnapshot(params: {
  rootPath: string;
  reason?: string;
}): Promise<SnapshotRecord> {
  const paths = resolveProjectPaths(params.rootPath);
  const reason = sanitizeReason(params.reason ?? 'manual');
  const createdAt = new Date().toISOString();
  const fileName = `${buildTimestamp(new Date())}__${reason}.sqlite`;
  const filePath = path.join(paths.snapshotsPath, fileName);

  await copyFile(paths.dbPath, filePath);

  return {
    fileName,
    filePath,
    createdAt,
    reason,
  };
}

export async function listProjectSnapshots(rootPath: string): Promise<SnapshotRecord[]> {
  const snapshotsPath = path.join(rootPath, PROJECT_SNAPSHOTS_DIRNAME);

  let files: string[] = [];
  try {
    files = await readdir(snapshotsPath);
  } catch {
    return [];
  }

  const snapshotRecords = await Promise.all(
    files.filter((file) => file.endsWith('.sqlite')).map(async (fileName) => {
      const [timestamp = '', reasonWithExt = 'manual.sqlite'] = fileName.split('__');
      const reason = reasonWithExt.replace('.sqlite', '');
      const filePath = path.join(snapshotsPath, fileName);
      const fileStats = await stat(filePath);

      return {
        fileName,
        filePath,
        createdAt: fileStats.mtime.toISOString() || timestamp,
        reason,
      };
    }),
  );

  return snapshotRecords.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function recoverLatestSnapshot(rootPath: string): Promise<SnapshotRecord | null> {
  const snapshots = await listProjectSnapshots(rootPath);
  const latest = snapshots[0];

  if (!latest) {
    return null;
  }

  await copyFile(latest.filePath, path.join(rootPath, PROJECT_DB_FILENAME));
  return latest;
}

export class AutoSaveScheduler {
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly intervalMs: number,
    private readonly onSave: () => Promise<void>,
  ) {}

  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      void this.onSave();
    }, this.intervalMs);
  }

  stop(): void {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }
}
