import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_CONFIG } from '../config/app-config';
import { validateProjectImageFile } from '../images/generation';
import type { WritingSessionRecord } from '../persistence/types';
import { resolveProjectStoredFilePath } from '../projects/asset-paths';
import { openProjectFromDisk, projectExists } from '../projects/project-files';
import type { OpenedProject, ProjectSessionManager } from '../projects/session';
import type { SnapshotRecord } from '../projects/snapshots';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';

export interface ProjectView {
  id: string;
  name: string;
  rootPath: string;
  dbPath: string;
  assetsPath: string;
  snapshotsPath: string;
  targetWordCount: number | null;
  targetChapterWordCount: number | null;
  plannedCompletionDate: string | null;
}

export interface ProjectInspectPathResult {
  exists: boolean;
  projectName: string | null;
}

export interface CreateProjectInput {
  rootPath: string;
  name: string;
  targetWordCount?: number | null;
  targetChapterWordCount?: number | null;
  plannedCompletionDate?: string | null;
}

export interface UpdateProjectPlanningInput {
  targetWordCount: number | null;
  targetChapterWordCount: number | null;
  plannedCompletionDate: string | null;
}

export function toProjectView(input: OpenedProject): ProjectView {
  return {
    id: input.project.id,
    name: input.project.name,
    rootPath: input.rootPath,
    dbPath: input.dbPath,
    assetsPath: input.assetsPath,
    snapshotsPath: input.snapshotsPath,
    targetWordCount: input.project.targetWordCount ?? null,
    targetChapterWordCount: input.project.targetChapterWordCount ?? null,
    plannedCompletionDate: input.project.plannedCompletionDate ?? null,
  };
}

function imageMimeTypeFromPath(filePath: string): string {
  const normalized = filePath.trim().toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  if (normalized.endsWith('.gif')) {
    return 'image/gif';
  }
  if (normalized.endsWith('.bmp')) {
    return 'image/bmp';
  }
  return 'image/png';
}

function isPathInsideDirectory(directoryPath: string, targetPath: string): boolean {
  const relativePath = path.relative(path.resolve(directoryPath), path.resolve(targetPath));
  return (
    relativePath === '' || (relativePath !== '..' && !relativePath.startsWith(`..${path.sep}`))
  );
}

function isAllowedProjectImageFile(filePath: string): boolean {
  const normalized = filePath.trim().toLowerCase();
  return APP_CONFIG.images.importedExtensions.some((extension) =>
    normalized.endsWith(`.${extension}`),
  );
}

export class ProjectService {
  constructor(private readonly sessionManager: ProjectSessionManager) {}

  async createProject(input: CreateProjectInput): Promise<ProjectView> {
    const project = await this.sessionManager.createProject(input);
    return toProjectView(project);
  }

  async updatePlanning(input: UpdateProjectPlanningInput): Promise<ProjectView> {
    const project = this.sessionManager.updateProjectPlanning(input);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return toProjectView(project);
  }

  async openProject(rootPath: string): Promise<ProjectView> {
    const project = await this.sessionManager.openProject({ rootPath });
    return toProjectView(project);
  }

  async closeProject(): Promise<void> {
    await this.sessionManager.closeProjectWithSync();
  }

  async inspectPath(rootPath: string): Promise<ProjectInspectPathResult> {
    const exists = await projectExists(rootPath);
    if (!exists) {
      return {
        exists: false,
        projectName: null,
      };
    }

    try {
      const context = await openProjectFromDisk(rootPath);
      return {
        exists: true,
        projectName: context.project.name,
      };
    } catch {
      return {
        exists: true,
        projectName: null,
      };
    }
  }

  async readImageDataUrl(filePath: string): Promise<string> {
    const openedProject = this.sessionManager.getOpenedProject();
    if (!openedProject) {
      throw new Error('No open project session');
    }

    const resolvedFilePath = resolveProjectStoredFilePath({
      projectRootPath: openedProject.rootPath,
      assetsPath: openedProject.assetsPath,
      filePath,
    });
    if (
      !isPathInsideDirectory(openedProject.assetsPath, resolvedFilePath) ||
      !isAllowedProjectImageFile(resolvedFilePath)
    ) {
      throw new Error('Image file access outside project assets is not allowed');
    }

    await validateProjectImageFile(resolvedFilePath);
    const fileBuffer = await readFile(resolvedFilePath);
    const mimeType = imageMimeTypeFromPath(resolvedFilePath);
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  }

  getCurrentProject(): ProjectView | null {
    const project = this.sessionManager.getOpenedProject();
    return project ? toProjectView(project) : null;
  }

  saveSnapshot(reason?: string): Promise<SnapshotRecord> {
    return this.sessionManager.saveSnapshot(reason);
  }

  listSnapshots(): Promise<SnapshotRecord[]> {
    return this.sessionManager.listSnapshots();
  }

  listWritingSessions(): WritingSessionRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return repository.listWritingSessions(projectId);
  }

  async recoverLatestSnapshot(): Promise<SnapshotRecord | null> {
    return this.sessionManager.recoverLatestSnapshot();
  }
}
