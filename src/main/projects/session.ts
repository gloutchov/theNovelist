import type Database from 'better-sqlite3';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { APP_CONFIG } from '../config/app-config';
import { closeDatabase, openDatabase } from '../persistence/database';
import { NovelistRepository } from '../persistence/repository';
import type { ProjectRecord } from '../persistence/types';
import { createProjectOnDisk, openProjectFromDisk, type ProjectPaths } from './project-files';
import { exportProjectSources, type WikiSourceExportResult } from '../wiki/source-export';
import { getProjectWikiStatus, type ProjectWikiStatus } from '../wiki/status';
import { searchProjectWiki, type ProjectWikiSearchResult } from '../wiki/search';
import { buildProjectMemoryContext, type ProjectMemoryContext } from '../wiki/chat-context';
import { syncProjectWikiDeterministic, type ProjectWikiSyncResult } from '../wiki/sync';
import { isSafeWikiRelativePath } from '../wiki/path-safety';
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

  async createProject(params: {
    rootPath: string;
    name: string;
    targetWordCount?: number | null;
    targetChapterWordCount?: number | null;
    plannedCompletionDate?: string | null;
  }): Promise<OpenedProject> {
    const created = await createProjectOnDisk(params);
    return this.openProject({ rootPath: created.rootPath });
  }

  async openProject(params: { rootPath: string }): Promise<OpenedProject> {
    const context = await openProjectFromDisk(params.rootPath);

    await this.closeProjectWithSync();

    this.db = openDatabase(context.dbPath);
    this.repository = new NovelistRepository(this.db);
    this.currentProject = context;
    await this.syncProjectWikiSources();

    this.autosave = new AutoSaveScheduler(APP_CONFIG.autosave.intervalMs, async () => {
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

  updateProjectPlanning(input: {
    targetWordCount: number | null;
    targetChapterWordCount: number | null;
    plannedCompletionDate: string | null;
  }): OpenedProject {
    if (!this.currentProject || !this.repository) {
      throw new Error('No open project session');
    }

    const project = this.repository.updateProjectPlanning(this.currentProject.project.id, input);
    this.currentProject = {
      ...this.currentProject,
      project,
    };
    return this.currentProject;
  }

  async syncProjectWikiSources(): Promise<WikiSourceExportResult> {
    if (!this.currentProject || !this.repository) {
      throw new Error('No open project session');
    }

    return exportProjectSources({
      wikiPath: this.currentProject.wikiPath,
      repository: this.repository,
      project: this.currentProject.project,
    });
  }

  async syncProjectWiki(reason = 'manual'): Promise<ProjectWikiSyncResult> {
    if (!this.currentProject || !this.repository) {
      throw new Error('No open project session');
    }

    return syncProjectWikiDeterministic({
      wikiPath: this.currentProject.wikiPath,
      repository: this.repository,
      project: this.currentProject.project,
      reason,
    });
  }

  async getProjectWikiStatus(): Promise<ProjectWikiStatus> {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    return getProjectWikiStatus(this.currentProject.wikiPath);
  }

  async searchProjectWiki(params: {
    query: string;
    limit?: number;
  }): Promise<ProjectWikiSearchResult[]> {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    return searchProjectWiki(this.currentProject.wikiPath, params.query, {
      limit: params.limit,
    });
  }

  async readProjectWikiSource(relativePath: string): Promise<string> {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    if (!isSafeWikiRelativePath(relativePath)) {
      throw new Error('Invalid wiki source path');
    }

    const normalizedPath = relativePath.trim().replace(/\\/g, '/');
    const absolutePath = path.resolve(this.currentProject.wikiPath, normalizedPath);
    const wikiRoot = path.resolve(this.currentProject.wikiPath);
    if (absolutePath !== wikiRoot && !absolutePath.startsWith(`${wikiRoot}${path.sep}`)) {
      throw new Error('Invalid wiki source path');
    }

    const fileStats = await stat(absolutePath);
    if (!fileStats.isFile() || fileStats.size > APP_CONFIG.wiki.maxSourceReadBytes) {
      throw new Error('Wiki source is not readable');
    }

    return readFile(absolutePath, 'utf8');
  }

  async buildProjectMemoryContext(params: {
    query: string;
    limit?: number;
  }): Promise<ProjectMemoryContext> {
    if (!this.currentProject) {
      throw new Error('No open project session');
    }

    return buildProjectMemoryContext({
      wikiPath: this.currentProject.wikiPath,
      query: params.query,
      limit: params.limit,
    });
  }

  async closeProjectWithSync(): Promise<void> {
    if (!this.currentProject) {
      this.closeProject();
      return;
    }

    const syncPromise = this.syncProjectWiki('project close');
    try {
      const completed = await Promise.race([
        syncPromise.then(() => true),
        new Promise<boolean>((resolve) => {
          setTimeout(() => resolve(false), APP_CONFIG.wiki.closeSyncTimeoutMs);
        }),
      ]);

      if (!completed) {
        syncPromise.catch(() => {
          // Best-effort close sync timed out. The wiki is derived and can recover on next open.
        });
      }
    } finally {
      this.closeProject();
    }
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
