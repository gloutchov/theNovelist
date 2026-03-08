import type Database from 'better-sqlite3';
import { closeDatabase, openDatabase } from '../persistence/database';
import { NovelistRepository } from '../persistence/repository';
import type { ProjectRecord } from '../persistence/types';
import { createProjectOnDisk, openProjectFromDisk, type ProjectPaths } from './project-files';
import {
  AutoSaveScheduler,
  createProjectSnapshot,
  listProjectSnapshots,
  recoverLatestSnapshot,
  type SnapshotRecord,
} from './snapshots';

export interface OpenedProject extends ProjectPaths {
  project: ProjectRecord;
}

export class ProjectSessionManager {
  private db: Database.Database | null = null;
  private repository: NovelistRepository | null = null;
  private currentProject: OpenedProject | null = null;
  private autosave: AutoSaveScheduler | null = null;

  async createProject(params: { rootPath: string; name: string }): Promise<OpenedProject> {
    const created = await createProjectOnDisk(params);
    return this.openProject({ rootPath: created.rootPath });
  }

  async openProject(params: { rootPath: string }): Promise<OpenedProject> {
    const context = await openProjectFromDisk(params.rootPath);

    this.closeProject();

    this.db = openDatabase(context.dbPath);
    this.repository = new NovelistRepository(this.db);
    this.currentProject = context;

    this.autosave = new AutoSaveScheduler(30_000, async () => {
      if (!this.currentProject) {
        return;
      }
      await this.saveSnapshot('autosave');
    });

    this.autosave.start();
    return context;
  }

  getOpenedProject(): OpenedProject | null {
    return this.currentProject;
  }

  getRepository(): NovelistRepository {
    if (!this.repository) {
      throw new Error('No open project session');
    }

    return this.repository;
  }

  getCurrentProjectId(): string {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    return this.currentProject.project.id;
  }

  async saveSnapshot(reason = 'manual'): Promise<SnapshotRecord> {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    if (this.db) {
      this.db.pragma('wal_checkpoint(TRUNCATE)');
    }

    return createProjectSnapshot({ rootPath: this.currentProject.rootPath, reason });
  }

  async listSnapshots(): Promise<SnapshotRecord[]> {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    return listProjectSnapshots(this.currentProject.rootPath);
  }

  async recoverLatestSnapshot(): Promise<SnapshotRecord | null> {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    const rootPath = this.currentProject.rootPath;
    this.closeProject();
    const recovered = await recoverLatestSnapshot(rootPath);
    if (!recovered) {
      return null;
    }

    await this.openProject({ rootPath });
    return recovered;
  }

  closeProject(): void {
    this.autosave?.stop();
    this.autosave = null;
    this.repository = null;
    closeDatabase(this.db ?? undefined);
    this.db = null;
    this.currentProject = null;
  }
}
