import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { APP_CONFIG } from '../../config/app-config';
import { repairProjectStoredFilePath } from '../../projects/asset-paths';
import type { ProjectRecord } from '../types';
import { nowIso, toProjectRecord } from './shared';

export interface CreateProjectParams {
  id?: string;
  name: string;
  rootPath: string;
  targetWordCount?: number | null;
  targetChapterWordCount?: number | null;
  plannedCompletionDate?: string | null;
}

export interface UpdateProjectPlanningInput {
  targetWordCount?: number | null;
  targetChapterWordCount?: number | null;
  plannedCompletionDate?: string | null;
}

export class ProjectRepository {
  constructor(private readonly db: Database.Database) {}

  createProject(params: CreateProjectParams): ProjectRecord {
    const id = params.id ?? randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO projects(
          id,
          name,
          root_path,
          target_word_count,
          target_chapter_word_count,
          planned_completion_date,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @name,
          @rootPath,
          @targetWordCount,
          @targetChapterWordCount,
          @plannedCompletionDate,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run({
        id,
        name: params.name,
        rootPath: params.rootPath,
        targetWordCount: params.targetWordCount ?? null,
        targetChapterWordCount: params.targetChapterWordCount ?? null,
        plannedCompletionDate: params.plannedCompletionDate ?? null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const project = this.getProjectById(id);
    if (!project) {
      throw new Error('Project creation failed');
    }

    return project;
  }

  getProjectById(id: string): ProjectRecord | null {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    return row ? toProjectRecord(row) : null;
  }

  getPrimaryProject(): ProjectRecord | null {
    const row = this.db.prepare('SELECT * FROM projects ORDER BY created_at ASC LIMIT 1').get() as
      | Record<string, unknown>
      | undefined;

    return row ? toProjectRecord(row) : null;
  }

  updateProjectName(id: string, name: string): void {
    this.db
      .prepare('UPDATE projects SET name = ?, updated_at = ? WHERE id = ?')
      .run(name, nowIso(), id);
  }

  updateProjectPlanning(id: string, input: UpdateProjectPlanningInput): ProjectRecord {
    this.db
      .prepare(
        `
        UPDATE projects
        SET
          target_word_count = @targetWordCount,
          target_chapter_word_count = @targetChapterWordCount,
          planned_completion_date = @plannedCompletionDate,
          updated_at = @updatedAt
        WHERE id = @id
        `,
      )
      .run({
        id,
        targetWordCount: input.targetWordCount ?? null,
        targetChapterWordCount: input.targetChapterWordCount ?? null,
        plannedCompletionDate: input.plannedCompletionDate ?? null,
        updatedAt: nowIso(),
      });

    const project = this.getProjectById(id);
    if (!project) {
      throw new Error('Project planning update failed');
    }
    return project;
  }

  repairProjectAssetReferences(id: string, rootPath: string): void {
    const normalizedRoot = path.resolve(rootPath.trim());
    const normalizedAssetsRoot = path.join(normalizedRoot, APP_CONFIG.project.assetsDirName);
    const timestamp = nowIso();

    this.db.transaction(() => {
      this.db
        .prepare('UPDATE projects SET root_path = ?, updated_at = ? WHERE id = ?')
        .run(normalizedRoot, timestamp, id);

      const rewriteCharacterImages = this.db.prepare(
        'UPDATE character_images SET file_path = @filePath WHERE id = @id',
      );
      const characterImageRows = this.db
        .prepare('SELECT id, file_path FROM character_images')
        .all() as Array<Record<string, unknown>>;
      for (const row of characterImageRows) {
        const currentPath = typeof row.file_path === 'string' ? row.file_path : '';
        const nextPath = repairProjectStoredFilePath({
          projectRootPath: normalizedRoot,
          assetsPath: normalizedAssetsRoot,
          filePath: currentPath,
        });
        if (nextPath && nextPath !== currentPath) {
          rewriteCharacterImages.run({
            id: String(row.id),
            filePath: nextPath,
          });
        }
      }

      const rewriteLocationImages = this.db.prepare(
        'UPDATE location_images SET file_path = @filePath WHERE id = @id',
      );
      const locationImageRows = this.db
        .prepare('SELECT id, file_path FROM location_images')
        .all() as Array<Record<string, unknown>>;
      for (const row of locationImageRows) {
        const currentPath = typeof row.file_path === 'string' ? row.file_path : '';
        const nextPath = repairProjectStoredFilePath({
          projectRootPath: normalizedRoot,
          assetsPath: normalizedAssetsRoot,
          filePath: currentPath,
        });
        if (nextPath && nextPath !== currentPath) {
          rewriteLocationImages.run({
            id: String(row.id),
            filePath: nextPath,
          });
        }
      }
    })();
  }

  updateProjectRootPathAndAssetReferences(
    id: string,
    previousRootPath: string,
    nextRootPath: string,
  ): void {
    void previousRootPath;
    this.repairProjectAssetReferences(id, nextRootPath);
  }
}
