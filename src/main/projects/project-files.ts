import { access, mkdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { openDatabase } from '../persistence/database';
import { NovelistRepository } from '../persistence/repository';
import type { ProjectRecord } from '../persistence/types';
import { ensureProjectWiki } from '../wiki/bootstrap';

export const PROJECT_DB_FILENAME = 'project.db';
export const PROJECT_ASSETS_DIRNAME = 'assets';
export const PROJECT_SNAPSHOTS_DIRNAME = '.snapshots';
export const PROJECT_WIKI_DIRNAME = 'wiki';

export interface ProjectPaths {
  rootPath: string;
  dbPath: string;
  assetsPath: string;
  snapshotsPath: string;
  wikiPath: string;
}

export interface ProjectContext extends ProjectPaths {
  project: ProjectRecord;
}

export function resolveProjectPaths(rootPath: string): ProjectPaths {
  return {
    rootPath,
    dbPath: path.join(rootPath, PROJECT_DB_FILENAME),
    assetsPath: path.join(rootPath, PROJECT_ASSETS_DIRNAME),
    snapshotsPath: path.join(rootPath, PROJECT_SNAPSHOTS_DIRNAME),
    wikiPath: path.join(rootPath, PROJECT_WIKI_DIRNAME),
  };
}

async function ensureProjectDirectories(paths: ProjectPaths): Promise<void> {
  await mkdir(paths.rootPath, { recursive: true });
  await mkdir(paths.assetsPath, { recursive: true });
  await mkdir(paths.snapshotsPath, { recursive: true });
  await mkdir(paths.wikiPath, { recursive: true });
}

export async function createProjectOnDisk(params: {
  rootPath: string;
  name: string;
}): Promise<ProjectContext> {
  const paths = resolveProjectPaths(params.rootPath);
  await ensureProjectDirectories(paths);

  const db = openDatabase(paths.dbPath);
  try {
    const repository = new NovelistRepository(db);
    const existing = repository.getPrimaryProject();

    const project =
      existing ??
      repository.createProject({
        name: params.name,
        rootPath: paths.rootPath,
      });

    if (existing && existing.name !== params.name) {
      repository.updateProjectName(existing.id, params.name);
    }

    const refreshedProject = repository.getPrimaryProject() ?? project;
    await ensureProjectWiki({ wikiPath: paths.wikiPath, project: refreshedProject });

    return {
      ...paths,
      project: refreshedProject,
    };
  } finally {
    db.close();
  }
}

export async function openProjectFromDisk(rootPath: string): Promise<ProjectContext> {
  const paths = resolveProjectPaths(rootPath);
  await access(paths.dbPath);
  await mkdir(paths.assetsPath, { recursive: true });
  await mkdir(paths.snapshotsPath, { recursive: true });
  await mkdir(paths.wikiPath, { recursive: true });

  const db = openDatabase(paths.dbPath);
  try {
    const repository = new NovelistRepository(db);
    const project = repository.getPrimaryProject();

    if (!project) {
      throw new Error(`Project metadata missing in ${paths.dbPath}`);
    }

    if (path.resolve(project.rootPath) !== path.resolve(paths.rootPath)) {
      repository.updateProjectRootPathAndAssetReferences(
        project.id,
        project.rootPath,
        paths.rootPath,
      );
    } else {
      repository.repairProjectAssetReferences(project.id, paths.rootPath);
    }

    const refreshedProject = repository.getPrimaryProject();
    if (!refreshedProject) {
      throw new Error(`Project metadata missing in ${paths.dbPath}`);
    }

    await ensureProjectWiki({ wikiPath: paths.wikiPath, project: refreshedProject });

    return {
      ...paths,
      project: refreshedProject,
    };
  } finally {
    db.close();
  }
}

export async function projectExists(rootPath: string): Promise<boolean> {
  const { dbPath } = resolveProjectPaths(rootPath);

  try {
    const fileStats = await stat(dbPath);
    return fileStats.isFile();
  } catch {
    return false;
  }
}
