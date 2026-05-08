import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type Database from 'better-sqlite3';
import { repairProjectStoredFilePath } from '../projects/asset-paths';
import type {
  CharacterChapterLinkRecord,
  ChapterDocumentRecord,
  StoryEdgeRecord,
  CodexChatMessageRecord,
  CodexSettingsRecord,
  ChapterNodeRecord,
  CharacterCardRecord,
  CharacterImageRecord,
  CreateCodexChatMessageInput,
  CreateCharacterCardInput,
  CreateCharacterImageInput,
  CreateEntityRevisionInput,
  CreateWritingSessionInput,
  CreateStoryEdgeInput,
  CreateChapterNodeInput,
  CreateLocationCardInput,
  CreateLocationImageInput,
  CreateSceneCardInput,
  CreatePlotInput,
  SetCharacterChapterLinksInput,
  SetLocationChapterLinksInput,
  EntityRevisionRecord,
  LocationChapterLinkRecord,
  LocationCardRecord,
  LocationImageRecord,
  PlotRecord,
  ProjectRecord,
  SceneCardRecord,
  TimelineItemRecord,
  TimelineItemType,
  TimelineSettingsRecord,
  UpdateChapterNodeInput,
  UpdateCharacterCardInput,
  UpdatePlotInput,
  UpdateLocationCardInput,
  UpdateSceneCardInput,
  UpsertChapterDocumentInput,
  UpsertCodexSettingsInput,
  UpsertTimelineItemInput,
  UpsertTimelineSettingsInput,
  WritingSessionRecord,
} from './types';

function nowIso(): string {
  return new Date().toISOString();
}

function toProjectRecord(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    rootPath: String(row.root_path),
    targetWordCount:
      row.target_word_count === null || row.target_word_count === undefined
        ? null
        : Number(row.target_word_count),
    targetChapterWordCount:
      row.target_chapter_word_count === null || row.target_chapter_word_count === undefined
        ? null
        : Number(row.target_chapter_word_count),
    plannedCompletionDate:
      row.planned_completion_date === null || row.planned_completion_date === undefined
        ? null
        : String(row.planned_completion_date),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toWritingSessionRecord(row: Record<string, unknown>): WritingSessionRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    chapterNodeId: String(row.chapter_node_id),
    wordDelta: Number(row.word_delta),
    wordCount: Number(row.word_count),
    createdAt: String(row.created_at),
  };
}

function toPlotRecord(row: Record<string, unknown>): PlotRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    number: Number(row.number),
    label: String(row.label),
    summary: String(row.summary ?? ''),
    color: String(row.color),
    positionX: Number(row.position_x ?? 120),
    positionY: Number(row.position_y ?? 120),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toChapterNodeRecord(row: Record<string, unknown>): ChapterNodeRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    description: String(row.description),
    plotNumber: Number(row.plot_number),
    blockNumber: Number(row.block_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    richTextDocId: row.rich_text_doc_id ? String(row.rich_text_doc_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toStoryEdgeRecord(row: Record<string, unknown>): StoryEdgeRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sourceId: String(row.source_id),
    targetId: String(row.target_id),
    sourceHandle: row.source_handle ? String(row.source_handle) : null,
    targetHandle: row.target_handle ? String(row.target_handle) : null,
    label: row.label ? String(row.label) : null,
    createdAt: String(row.created_at),
  };
}

function toChapterDocumentRecord(row: Record<string, unknown>): ChapterDocumentRecord {
  return {
    id: String(row.id),
    chapterNodeId: String(row.chapter_node_id),
    contentJson: String(row.content_json),
    wordCount: Number(row.word_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toCodexSettingsRecord(row: Record<string, unknown>): CodexSettingsRecord {
  const provider = row.provider;
  const fallbackProvider = row.fallback_provider;
  const apiModel = row.api_model;
  const normalizedProvider =
    provider === 'openai_api' || provider === 'ollama' ? provider : 'codex_cli';
  const normalizedFallbackProvider =
    fallbackProvider === 'codex_cli' ||
    fallbackProvider === 'openai_api' ||
    fallbackProvider === 'ollama'
      ? fallbackProvider
      : 'none';

  return {
    projectId: String(row.project_id),
    enabled: Number(row.enabled) === 1,
    provider: normalizedProvider,
    fallbackProvider:
      normalizedFallbackProvider === normalizedProvider ? 'none' : normalizedFallbackProvider,
    allowApiCalls: Number(row.allow_api_calls ?? 0) === 1,
    allowExternalMemorySharing: Number(row.allow_external_memory_sharing ?? 1) === 1,
    autoSummarizeDescriptions: Number(row.auto_summarize_descriptions ?? 1) === 1,
    apiKey: row.api_key === null || row.api_key === undefined ? null : String(row.api_key),
    apiModel: typeof apiModel === 'string' && apiModel.trim() ? apiModel : 'gpt-5-mini',
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toCodexChatMessageRecord(row: Record<string, unknown>): CodexChatMessageRecord {
  const mode = row.mode;

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    chapterNodeId: String(row.chapter_node_id),
    role: String(row.role) as CodexChatMessageRecord['role'],
    content: String(row.content),
    mode: mode === null ? null : (String(mode) as CodexChatMessageRecord['mode']),
    createdAt: String(row.created_at),
  };
}

function toCharacterCardRecord(row: Record<string, unknown>): CharacterCardRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    sex: String(row.sex),
    age: row.age === null ? null : Number(row.age),
    sexualOrientation: String(row.sexual_orientation),
    species: String(row.species),
    hairColor: String(row.hair_color),
    eyeColor: String(row.eye_color ?? ''),
    skinColor: String(row.skin_color ?? ''),
    bald: Number(row.bald) === 1,
    beard: String(row.beard),
    physique: String(row.physique),
    job: String(row.job),
    notes: String(row.notes),
    plotNumber: Number(row.plot_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toCharacterImageRecord(row: Record<string, unknown>): CharacterImageRecord {
  return {
    id: String(row.id),
    characterCardId: String(row.character_card_id),
    imageType: String(row.image_type),
    filePath: String(row.file_path),
    prompt: String(row.prompt),
    createdAt: String(row.created_at),
  };
}

function toLocationCardRecord(row: Record<string, unknown>): LocationCardRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    locationType: String(row.location_type),
    description: String(row.description),
    notes: String(row.notes),
    plotNumber: Number(row.plot_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toLocationImageRecord(row: Record<string, unknown>): LocationImageRecord {
  return {
    id: String(row.id),
    locationCardId: String(row.location_card_id),
    imageType: String(row.image_type),
    filePath: String(row.file_path),
    prompt: String(row.prompt),
    createdAt: String(row.created_at),
  };
}

function toSceneCardRecord(row: Record<string, unknown>): SceneCardRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    chapterNodeId: String(row.chapter_node_id),
    name: String(row.name),
    text: String(row.text),
    contentJson: typeof row.content_json === 'string' ? row.content_json : null,
    notes: String(row.notes),
    plotNumber: Number(row.plot_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toTimelineSettingsRecord(row: Record<string, unknown>): TimelineSettingsRecord {
  return {
    projectId: String(row.project_id),
    startLabel: String(row.start_label ?? ''),
    endLabel: String(row.end_label ?? ''),
    timelineEndX: Number(row.timeline_end_x ?? 1148),
    updatedAt: String(row.updated_at),
  };
}

function toTimelineItemRecord(row: Record<string, unknown>): TimelineItemRecord {
  const itemType = String(row.item_type);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    itemType: (itemType === 'scene' ? 'scene' : 'chapter') as TimelineItemType,
    entityId: String(row.entity_id),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    dateLabel: String(row.date_label ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function toEntityRevisionRecord(row: Record<string, unknown>): EntityRevisionRecord {
  const entityType = String(row.entity_type);
  const reason = String(row.reason);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    entityType:
      entityType === 'scene' || entityType === 'character' || entityType === 'location'
        ? entityType
        : 'chapter',
    entityId: String(row.entity_id),
    label: row.label === null || row.label === undefined ? null : String(row.label),
    reason: reason === 'manual' || reason === 'restore' ? reason : 'auto',
    snapshotJson: String(row.snapshot_json),
    textContent: String(row.text_content),
    createdAt: String(row.created_at),
  };
}

function toCharacterChapterLinkRecord(row: Record<string, unknown>): CharacterChapterLinkRecord {
  return {
    characterCardId: String(row.character_card_id),
    chapterNodeId: String(row.chapter_node_id),
    createdAt: String(row.created_at),
  };
}

function toLocationChapterLinkRecord(row: Record<string, unknown>): LocationChapterLinkRecord {
  return {
    locationCardId: String(row.location_card_id),
    chapterNodeId: String(row.chapter_node_id),
    createdAt: String(row.created_at),
  };
}

export class NovelistRepository {
  constructor(private readonly db: Database.Database) {}

  createProject(params: {
    id?: string;
    name: string;
    rootPath: string;
    targetWordCount?: number | null;
    targetChapterWordCount?: number | null;
    plannedCompletionDate?: string | null;
  }): ProjectRecord {
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

  updateProjectPlanning(
    id: string,
    input: {
      targetWordCount?: number | null;
      targetChapterWordCount?: number | null;
      plannedCompletionDate?: string | null;
    },
  ): ProjectRecord {
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
    const normalizedAssetsRoot = path.join(normalizedRoot, 'assets');
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

  createPlot(projectId: string, input: CreatePlotInput): PlotRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO plots(
          id,
          project_id,
          number,
          label,
          summary,
          color,
          position_x,
          position_y,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @projectId,
          @number,
          @label,
          @summary,
          @color,
          @positionX,
          @positionY,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run({
        id,
        projectId,
        number: input.number,
        label: input.label,
        summary: input.summary,
        color: input.color,
        positionX: input.positionX,
        positionY: input.positionY,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM plots WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      throw new Error('Plot creation failed');
    }

    return toPlotRecord(row);
  }

  updatePlot(id: string, input: UpdatePlotInput): PlotRecord {
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        UPDATE plots
        SET label = @label,
            summary = @summary,
            color = COALESCE(@color, color),
            position_x = COALESCE(@positionX, position_x),
            position_y = COALESCE(@positionY, position_y),
            updated_at = @updatedAt
        WHERE id = @id
        `,
      )
      .run({
        id,
        label: input.label,
        summary: input.summary,
        color: input.color ?? null,
        positionX: input.positionX ?? null,
        positionY: input.positionY ?? null,
        updatedAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM plots WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      throw new Error('Plot update failed');
    }

    return toPlotRecord(row);
  }

  deletePlot(id: string): void {
    const row = this.db.prepare('SELECT * FROM plots WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      throw new Error('Plot not found');
    }

    const plot = toPlotRecord(row);
    const deleteChapterNodes = this.db.prepare(
      'DELETE FROM chapter_nodes WHERE project_id = ? AND plot_number = ?',
    );
    const deleteCharacterCards = this.db.prepare(
      'DELETE FROM character_cards WHERE project_id = ? AND plot_number = ?',
    );
    const deleteLocationCards = this.db.prepare(
      'DELETE FROM location_cards WHERE project_id = ? AND plot_number = ?',
    );
    const deleteTimelineItems = this.db.prepare(
      `
      DELETE FROM timeline_items
      WHERE project_id = ?
      AND (
        (item_type = 'chapter' AND entity_id IN (
          SELECT id FROM chapter_nodes WHERE project_id = ? AND plot_number = ?
        ))
        OR
        (item_type = 'scene' AND entity_id IN (
          SELECT id FROM scene_cards WHERE project_id = ? AND plot_number = ?
        ))
      )
      `,
    );
    const deletePlotRecord = this.db.prepare('DELETE FROM plots WHERE id = ?');

    this.db.transaction(() => {
      deleteTimelineItems.run(
        plot.projectId,
        plot.projectId,
        plot.number,
        plot.projectId,
        plot.number,
      );
      deleteChapterNodes.run(plot.projectId, plot.number);
      deleteCharacterCards.run(plot.projectId, plot.number);
      deleteLocationCards.run(plot.projectId, plot.number);
      deletePlotRecord.run(id);
    })();
  }

  listPlots(projectId: string): PlotRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM plots WHERE project_id = ? ORDER BY number ASC')
      .all(projectId) as Record<string, unknown>[];

    return rows.map(toPlotRecord);
  }

  createChapterNode(projectId: string, input: CreateChapterNodeInput): ChapterNodeRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO chapter_nodes(
          id,
          project_id,
          title,
          description,
          plot_number,
          block_number,
          position_x,
          position_y,
          rich_text_doc_id,
          created_at,
          updated_at
        )
        VALUES (@id, @projectId, @title, @description, @plotNumber, @blockNumber, @positionX, @positionY, NULL, @createdAt, @updatedAt)
        `,
      )
      .run({
        id,
        projectId,
        title: input.title,
        description: input.description,
        plotNumber: input.plotNumber,
        blockNumber: input.blockNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM chapter_nodes WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      throw new Error('Chapter node creation failed');
    }

    return toChapterNodeRecord(row);
  }

  updateChapterNode(nodeId: string, input: UpdateChapterNodeInput): void {
    this.db
      .prepare(
        `
        UPDATE chapter_nodes
        SET
          title = @title,
          description = @description,
          plot_number = @plotNumber,
          block_number = @blockNumber,
          position_x = @positionX,
          position_y = @positionY,
          rich_text_doc_id = @richTextDocId,
          updated_at = @updatedAt
        WHERE id = @nodeId
        `,
      )
      .run({
        nodeId,
        title: input.title,
        description: input.description,
        plotNumber: input.plotNumber,
        blockNumber: input.blockNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        richTextDocId: input.richTextDocId,
        updatedAt: nowIso(),
      });
  }

  listChapterNodes(projectId: string): ChapterNodeRecord[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM chapter_nodes WHERE project_id = ? ORDER BY plot_number, block_number',
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(toChapterNodeRecord);
  }

  getChapterNodeById(nodeId: string): ChapterNodeRecord | null {
    const row = this.db.prepare('SELECT * FROM chapter_nodes WHERE id = ?').get(nodeId) as
      | Record<string, unknown>
      | undefined;

    return row ? toChapterNodeRecord(row) : null;
  }

  getNextBlockNumberForPlot(projectId: string, plotNumber: number): number {
    const row = this.db
      .prepare(
        `
        SELECT MAX(block_number) AS max_block_number
        FROM chapter_nodes
        WHERE project_id = ? AND plot_number = ?
        `,
      )
      .get(projectId, plotNumber) as { max_block_number: number | null } | undefined;

    const maxBlockNumber = row?.max_block_number ?? null;
    return maxBlockNumber ? maxBlockNumber + 1 : 1;
  }

  deleteChapterNode(nodeId: string): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `
          DELETE FROM timeline_items
          WHERE
            (item_type = 'chapter' AND entity_id = ?)
            OR
            (item_type = 'scene' AND entity_id IN (
              SELECT id FROM scene_cards WHERE chapter_node_id = ?
            ))
          `,
        )
        .run(nodeId, nodeId);
      this.db.prepare('DELETE FROM chapter_nodes WHERE id = ?').run(nodeId);
    })();
  }

  setChapterNodeRichTextDocId(nodeId: string, documentId: string | null): void {
    this.db
      .prepare(
        `
        UPDATE chapter_nodes
        SET rich_text_doc_id = ?, updated_at = ?
        WHERE id = ?
        `,
      )
      .run(documentId, nowIso(), nodeId);
  }

  createStoryEdge(projectId: string, input: CreateStoryEdgeInput): StoryEdgeRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO story_edges(id, project_id, source_id, target_id, source_handle, target_handle, label, created_at)
        VALUES (@id, @projectId, @sourceId, @targetId, @sourceHandle, @targetHandle, @label, @createdAt)
        `,
      )
      .run({
        id,
        projectId,
        sourceId: input.sourceId,
        targetId: input.targetId,
        sourceHandle: input.sourceHandle ?? null,
        targetHandle: input.targetHandle ?? null,
        label: input.label ?? null,
        createdAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM story_edges WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!row) {
      throw new Error('Story edge creation failed');
    }

    return toStoryEdgeRecord(row);
  }

  listStoryEdges(projectId: string): StoryEdgeRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM story_edges WHERE project_id = ? ORDER BY created_at ASC')
      .all(projectId) as Record<string, unknown>[];

    return rows.map(toStoryEdgeRecord);
  }

  deleteStoryEdge(edgeId: string): void {
    this.db.prepare('DELETE FROM story_edges WHERE id = ?').run(edgeId);
  }

  isIdInProject(projectId: string, entityId: string): boolean {
    const chapterExists = this.db
      .prepare('SELECT 1 FROM chapter_nodes WHERE project_id = ? AND id = ?')
      .get(projectId, entityId);
    if (chapterExists) return true;

    const characterExists = this.db
      .prepare('SELECT 1 FROM character_cards WHERE project_id = ? AND id = ?')
      .get(projectId, entityId);
    if (characterExists) return true;

    const locationExists = this.db
      .prepare('SELECT 1 FROM location_cards WHERE project_id = ? AND id = ?')
      .get(projectId, entityId);
    if (locationExists) return true;

    const sceneExists = this.db
      .prepare('SELECT 1 FROM scene_cards WHERE project_id = ? AND id = ?')
      .get(projectId, entityId);
    if (sceneExists) return true;

    return false;
  }

  upsertChapterDocument(input: UpsertChapterDocumentInput): ChapterDocumentRecord {
    const existing = this.db
      .prepare('SELECT * FROM chapter_documents WHERE chapter_node_id = ?')
      .get(input.chapterNodeId) as Record<string, unknown> | undefined;

    if (existing) {
      this.db
        .prepare(
          `
          UPDATE chapter_documents
          SET content_json = @contentJson,
              word_count = @wordCount,
              updated_at = @updatedAt
          WHERE chapter_node_id = @chapterNodeId
          `,
        )
        .run({
          chapterNodeId: input.chapterNodeId,
          contentJson: input.contentJson,
          wordCount: input.wordCount,
          updatedAt: nowIso(),
        });

      const updated = this.getChapterDocumentByNodeId(input.chapterNodeId);
      if (!updated) {
        throw new Error('Chapter document update failed');
      }

      return updated;
    }

    const id = input.id ?? randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO chapter_documents(id, chapter_node_id, content_json, word_count, created_at, updated_at)
        VALUES (@id, @chapterNodeId, @contentJson, @wordCount, @createdAt, @updatedAt)
        `,
      )
      .run({
        id,
        chapterNodeId: input.chapterNodeId,
        contentJson: input.contentJson,
        wordCount: input.wordCount,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const created = this.getChapterDocumentByNodeId(input.chapterNodeId);
    if (!created) {
      throw new Error('Chapter document creation failed');
    }

    return created;
  }

  getChapterDocumentByNodeId(chapterNodeId: string): ChapterDocumentRecord | null {
    const row = this.db
      .prepare('SELECT * FROM chapter_documents WHERE chapter_node_id = ?')
      .get(chapterNodeId) as Record<string, unknown> | undefined;

    return row ? toChapterDocumentRecord(row) : null;
  }

  recordWritingSession(projectId: string, input: CreateWritingSessionInput): WritingSessionRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO writing_sessions(
          id,
          project_id,
          chapter_node_id,
          word_delta,
          word_count,
          created_at
        )
        VALUES (
          @id,
          @projectId,
          @chapterNodeId,
          @wordDelta,
          @wordCount,
          @createdAt
        )
        `,
      )
      .run({
        id,
        projectId,
        chapterNodeId: input.chapterNodeId,
        wordDelta: input.wordDelta,
        wordCount: input.wordCount,
        createdAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM writing_sessions WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error('Writing session creation failed');
    }
    return toWritingSessionRecord(row);
  }

  listWritingSessions(projectId: string, limit = 12): WritingSessionRecord[] {
    const normalizedLimit = Math.max(1, Math.min(100, Math.trunc(limit)));
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM writing_sessions
        WHERE project_id = ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT ?
        `,
      )
      .all(projectId, normalizedLimit) as Record<string, unknown>[];

    return rows.map(toWritingSessionRecord).reverse();
  }

  getOrCreateCodexSettings(projectId: string): CodexSettingsRecord {
    const existing = this.db
      .prepare('SELECT * FROM codex_settings WHERE project_id = ?')
      .get(projectId) as Record<string, unknown> | undefined;

    if (existing) {
      return toCodexSettingsRecord(existing);
    }

    const timestamp = nowIso();
    this.db
      .prepare(
        `
        INSERT INTO codex_settings(
          project_id,
          enabled,
          provider,
          fallback_provider,
          allow_api_calls,
          allow_external_memory_sharing,
          auto_summarize_descriptions,
          api_key,
          api_model,
          created_at,
          updated_at
        )
        VALUES (?, 0, 'codex_cli', 'none', 0, 1, 1, NULL, 'gpt-5-mini', ?, ?)
        `,
      )
      .run(projectId, timestamp, timestamp);

    const created = this.db
      .prepare('SELECT * FROM codex_settings WHERE project_id = ?')
      .get(projectId) as Record<string, unknown> | undefined;

    if (!created) {
      throw new Error('Codex settings creation failed');
    }

    return toCodexSettingsRecord(created);
  }

  upsertCodexSettings(projectId: string, input: UpsertCodexSettingsInput): CodexSettingsRecord {
    const current = this.getOrCreateCodexSettings(projectId);
    const next: CodexSettingsRecord = {
      ...current,
      enabled: input.enabled ?? current.enabled,
      provider: input.provider ?? current.provider,
      fallbackProvider: input.fallbackProvider ?? current.fallbackProvider,
      allowApiCalls: input.allowApiCalls ?? current.allowApiCalls,
      allowExternalMemorySharing:
        input.allowExternalMemorySharing ?? current.allowExternalMemorySharing,
      autoSummarizeDescriptions:
        input.autoSummarizeDescriptions ?? current.autoSummarizeDescriptions,
      apiKey: input.apiKey === undefined ? current.apiKey : input.apiKey,
      apiModel: input.apiModel?.trim() ? input.apiModel.trim() : current.apiModel,
      updatedAt: nowIso(),
    };
    if (next.fallbackProvider === next.provider) {
      next.fallbackProvider = 'none';
    }
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO codex_settings(
          project_id,
          enabled,
          provider,
          fallback_provider,
          allow_api_calls,
          allow_external_memory_sharing,
          auto_summarize_descriptions,
          api_key,
          api_model,
          created_at,
          updated_at
        )
        VALUES (
          @projectId,
          @enabled,
          @provider,
          @fallbackProvider,
          @allowApiCalls,
          @allowExternalMemorySharing,
          @autoSummarizeDescriptions,
          @apiKey,
          @apiModel,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(project_id) DO UPDATE SET
          enabled = excluded.enabled,
          provider = excluded.provider,
          fallback_provider = excluded.fallback_provider,
          allow_api_calls = excluded.allow_api_calls,
          allow_external_memory_sharing = excluded.allow_external_memory_sharing,
          auto_summarize_descriptions = excluded.auto_summarize_descriptions,
          api_key = excluded.api_key,
          api_model = excluded.api_model,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        projectId,
        enabled: next.enabled ? 1 : 0,
        provider: next.provider,
        fallbackProvider: next.fallbackProvider,
        allowApiCalls: next.allowApiCalls ? 1 : 0,
        allowExternalMemorySharing: next.allowExternalMemorySharing ? 1 : 0,
        autoSummarizeDescriptions: next.autoSummarizeDescriptions ? 1 : 0,
        apiKey: next.apiKey,
        apiModel: next.apiModel,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    return this.getOrCreateCodexSettings(projectId);
  }

  appendCodexChatMessage(
    projectId: string,
    input: CreateCodexChatMessageInput,
  ): CodexChatMessageRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO codex_chat_messages(id, project_id, chapter_node_id, role, content, mode, created_at)
        VALUES (@id, @projectId, @chapterNodeId, @role, @content, @mode, @createdAt)
        `,
      )
      .run({
        id,
        projectId,
        chapterNodeId: input.chapterNodeId,
        role: input.role,
        content: input.content,
        mode: input.mode ?? null,
        createdAt: timestamp,
      });

    const created = this.db.prepare('SELECT * FROM codex_chat_messages WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!created) {
      throw new Error('Codex chat message creation failed');
    }

    return toCodexChatMessageRecord(created);
  }

  listCodexChatMessages(
    projectId: string,
    chapterNodeId: string,
    limit = 100,
  ): CodexChatMessageRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM codex_chat_messages
        WHERE project_id = ? AND chapter_node_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        `,
      )
      .all(projectId, chapterNodeId, safeLimit) as Record<string, unknown>[];

    return rows.reverse().map(toCodexChatMessageRecord);
  }

  listProjectCodexChatMessages(projectId: string): CodexChatMessageRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM codex_chat_messages
        WHERE project_id = ?
        ORDER BY created_at ASC, rowid ASC
        `,
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(toCodexChatMessageRecord);
  }

  createCharacterCard(projectId: string, input: CreateCharacterCardInput): CharacterCardRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO character_cards(
          id,
          project_id,
          first_name,
          last_name,
          sex,
          age,
          sexual_orientation,
          species,
          hair_color,
          eye_color,
          skin_color,
          bald,
          beard,
          physique,
          job,
          notes,
          plot_number,
          position_x,
          position_y,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @projectId,
          @firstName,
          @lastName,
          @sex,
          @age,
          @sexualOrientation,
          @species,
          @hairColor,
          @eyeColor,
          @skinColor,
          @bald,
          @beard,
          @physique,
          @job,
          @notes,
          @plotNumber,
          @positionX,
          @positionY,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run({
        id,
        projectId,
        firstName: input.firstName,
        lastName: input.lastName,
        sex: input.sex,
        age: input.age,
        sexualOrientation: input.sexualOrientation,
        species: input.species,
        hairColor: input.hairColor,
        eyeColor: input.eyeColor,
        skinColor: input.skinColor,
        bald: input.bald ? 1 : 0,
        beard: input.beard,
        physique: input.physique,
        job: input.job,
        notes: input.notes,
        plotNumber: input.plotNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM character_cards WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error('Character card creation failed');
    }
    return toCharacterCardRecord(row);
  }

  updateCharacterCard(cardId: string, input: UpdateCharacterCardInput): void {
    this.db
      .prepare(
        `
        UPDATE character_cards
        SET
          first_name = @firstName,
          last_name = @lastName,
          sex = @sex,
          age = @age,
          sexual_orientation = @sexualOrientation,
          species = @species,
          hair_color = @hairColor,
          eye_color = @eyeColor,
          skin_color = @skinColor,
          bald = @bald,
          beard = @beard,
          physique = @physique,
          job = @job,
          notes = @notes,
          plot_number = @plotNumber,
          position_x = @positionX,
          position_y = @positionY,
          updated_at = @updatedAt
        WHERE id = @cardId
        `,
      )
      .run({
        cardId,
        firstName: input.firstName,
        lastName: input.lastName,
        sex: input.sex,
        age: input.age,
        sexualOrientation: input.sexualOrientation,
        species: input.species,
        hairColor: input.hairColor,
        eyeColor: input.eyeColor,
        skinColor: input.skinColor,
        bald: input.bald ? 1 : 0,
        beard: input.beard,
        physique: input.physique,
        job: input.job,
        notes: input.notes,
        plotNumber: input.plotNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        updatedAt: nowIso(),
      });
  }

  getCharacterCardById(cardId: string): CharacterCardRecord | null {
    const row = this.db.prepare('SELECT * FROM character_cards WHERE id = ?').get(cardId) as
      | Record<string, unknown>
      | undefined;
    return row ? toCharacterCardRecord(row) : null;
  }

  listCharacterCards(projectId: string): CharacterCardRecord[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM character_cards WHERE project_id = ? ORDER BY plot_number, last_name, first_name',
      )
      .all(projectId) as Record<string, unknown>[];
    return rows.map(toCharacterCardRecord);
  }

  deleteCharacterCard(cardId: string): void {
    this.db.prepare('DELETE FROM character_cards WHERE id = ?').run(cardId);
  }

  createCharacterImage(input: CreateCharacterImageInput): CharacterImageRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO character_images(id, character_card_id, image_type, file_path, prompt, created_at)
        VALUES (@id, @characterCardId, @imageType, @filePath, @prompt, @createdAt)
        `,
      )
      .run({
        id,
        characterCardId: input.characterCardId,
        imageType: input.imageType,
        filePath: input.filePath,
        prompt: input.prompt,
        createdAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM character_images WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error('Character image creation failed');
    }
    return toCharacterImageRecord(row);
  }

  listCharacterImages(characterCardId: string): CharacterImageRecord[] {
    const rows = this.db
      .prepare(
        'SELECT * FROM character_images WHERE character_card_id = ? ORDER BY created_at DESC',
      )
      .all(characterCardId) as Record<string, unknown>[];
    return rows.map(toCharacterImageRecord);
  }

  deleteCharacterImage(imageId: string): void {
    this.db.prepare('DELETE FROM character_images WHERE id = ?').run(imageId);
  }

  listCharacterChapterLinks(characterCardId: string): CharacterChapterLinkRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM character_chapter_links
        WHERE character_card_id = ?
        ORDER BY chapter_node_id ASC
        `,
      )
      .all(characterCardId) as Record<string, unknown>[];
    return rows.map(toCharacterChapterLinkRecord);
  }

  setCharacterChapterLinks(input: SetCharacterChapterLinksInput): void {
    const uniqueChapterNodeIds = [...new Set(input.chapterNodeIds)];
    const removeLinks = this.db.prepare(
      'DELETE FROM character_chapter_links WHERE character_card_id = ?',
    );
    const insertLink = this.db.prepare(
      `
      INSERT INTO character_chapter_links(character_card_id, chapter_node_id, created_at)
      VALUES (?, ?, ?)
      `,
    );

    this.db.transaction(() => {
      removeLinks.run(input.characterCardId);
      const createdAt = nowIso();
      for (const chapterNodeId of uniqueChapterNodeIds) {
        insertLink.run(input.characterCardId, chapterNodeId, createdAt);
      }
    })();
  }

  listCharactersForChapter(projectId: string, chapterNodeId: string): CharacterCardRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT c.*
        FROM character_cards c
        INNER JOIN character_chapter_links l
          ON l.character_card_id = c.id
        WHERE c.project_id = ? AND l.chapter_node_id = ?
        ORDER BY c.plot_number ASC, c.last_name ASC, c.first_name ASC
        `,
      )
      .all(projectId, chapterNodeId) as Record<string, unknown>[];

    return rows.map(toCharacterCardRecord);
  }

  createLocationCard(projectId: string, input: CreateLocationCardInput): LocationCardRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO location_cards(
          id,
          project_id,
          name,
          location_type,
          description,
          notes,
          plot_number,
          position_x,
          position_y,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @projectId,
          @name,
          @locationType,
          @description,
          @notes,
          @plotNumber,
          @positionX,
          @positionY,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run({
        id,
        projectId,
        name: input.name,
        locationType: input.locationType,
        description: input.description,
        notes: input.notes,
        plotNumber: input.plotNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM location_cards WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error('Location card creation failed');
    }
    return toLocationCardRecord(row);
  }

  updateLocationCard(cardId: string, input: UpdateLocationCardInput): void {
    this.db
      .prepare(
        `
        UPDATE location_cards
        SET
          name = @name,
          location_type = @locationType,
          description = @description,
          notes = @notes,
          plot_number = @plotNumber,
          position_x = @positionX,
          position_y = @positionY,
          updated_at = @updatedAt
        WHERE id = @cardId
        `,
      )
      .run({
        cardId,
        name: input.name,
        locationType: input.locationType,
        description: input.description,
        notes: input.notes,
        plotNumber: input.plotNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        updatedAt: nowIso(),
      });
  }

  getLocationCardById(cardId: string): LocationCardRecord | null {
    const row = this.db.prepare('SELECT * FROM location_cards WHERE id = ?').get(cardId) as
      | Record<string, unknown>
      | undefined;
    return row ? toLocationCardRecord(row) : null;
  }

  listLocationCards(projectId: string): LocationCardRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM location_cards WHERE project_id = ? ORDER BY plot_number, name')
      .all(projectId) as Record<string, unknown>[];
    return rows.map(toLocationCardRecord);
  }

  deleteLocationCard(cardId: string): void {
    this.db.prepare('DELETE FROM location_cards WHERE id = ?').run(cardId);
  }

  createLocationImage(input: CreateLocationImageInput): LocationImageRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO location_images(id, location_card_id, image_type, file_path, prompt, created_at)
        VALUES (@id, @locationCardId, @imageType, @filePath, @prompt, @createdAt)
        `,
      )
      .run({
        id,
        locationCardId: input.locationCardId,
        imageType: input.imageType,
        filePath: input.filePath,
        prompt: input.prompt,
        createdAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM location_images WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error('Location image creation failed');
    }
    return toLocationImageRecord(row);
  }

  listLocationImages(locationCardId: string): LocationImageRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM location_images WHERE location_card_id = ? ORDER BY created_at DESC')
      .all(locationCardId) as Record<string, unknown>[];
    return rows.map(toLocationImageRecord);
  }

  deleteLocationImage(imageId: string): void {
    this.db.prepare('DELETE FROM location_images WHERE id = ?').run(imageId);
  }

  listLocationChapterLinks(locationCardId: string): LocationChapterLinkRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM location_chapter_links
        WHERE location_card_id = ?
        ORDER BY chapter_node_id ASC
        `,
      )
      .all(locationCardId) as Record<string, unknown>[];
    return rows.map(toLocationChapterLinkRecord);
  }

  setLocationChapterLinks(input: SetLocationChapterLinksInput): void {
    const uniqueChapterNodeIds = [...new Set(input.chapterNodeIds)];
    const removeLinks = this.db.prepare(
      'DELETE FROM location_chapter_links WHERE location_card_id = ?',
    );
    const insertLink = this.db.prepare(
      `
      INSERT INTO location_chapter_links(location_card_id, chapter_node_id, created_at)
      VALUES (?, ?, ?)
      `,
    );

    this.db.transaction(() => {
      removeLinks.run(input.locationCardId);
      const createdAt = nowIso();
      for (const chapterNodeId of uniqueChapterNodeIds) {
        insertLink.run(input.locationCardId, chapterNodeId, createdAt);
      }
    })();
  }

  listLocationsForChapter(projectId: string, chapterNodeId: string): LocationCardRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT l.*
        FROM location_cards l
        INNER JOIN location_chapter_links links
          ON links.location_card_id = l.id
        WHERE l.project_id = ? AND links.chapter_node_id = ?
        ORDER BY l.plot_number ASC, l.name ASC
        `,
      )
      .all(projectId, chapterNodeId) as Record<string, unknown>[];

    return rows.map(toLocationCardRecord);
  }

  createSceneCard(projectId: string, input: CreateSceneCardInput): SceneCardRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO scene_cards(
          id,
          project_id,
          chapter_node_id,
          name,
          text,
          content_json,
          notes,
          plot_number,
          position_x,
          position_y,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @projectId,
          @chapterNodeId,
          @name,
          @text,
          @contentJson,
          @notes,
          @plotNumber,
          @positionX,
          @positionY,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run({
        id,
        projectId,
        chapterNodeId: input.chapterNodeId,
        name: input.name,
        text: input.text,
        contentJson: input.contentJson ?? null,
        notes: input.notes,
        plotNumber: input.plotNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const scene = this.getSceneCardById(id);
    if (!scene) {
      throw new Error('Scene card creation failed');
    }
    return scene;
  }

  updateSceneCard(sceneId: string, input: UpdateSceneCardInput): void {
    this.db
      .prepare(
        `
        UPDATE scene_cards
        SET
          chapter_node_id = @chapterNodeId,
          name = @name,
          text = @text,
          content_json = @contentJson,
          notes = @notes,
          plot_number = @plotNumber,
          position_x = @positionX,
          position_y = @positionY,
          updated_at = @updatedAt
        WHERE id = @sceneId
        `,
      )
      .run({
        sceneId,
        chapterNodeId: input.chapterNodeId,
        name: input.name,
        text: input.text,
        contentJson: input.contentJson ?? null,
        notes: input.notes,
        plotNumber: input.plotNumber,
        positionX: input.positionX,
        positionY: input.positionY,
        updatedAt: nowIso(),
      });
  }

  getSceneCardById(sceneId: string): SceneCardRecord | null {
    const row = this.db.prepare('SELECT * FROM scene_cards WHERE id = ?').get(sceneId) as
      | Record<string, unknown>
      | undefined;
    return row ? toSceneCardRecord(row) : null;
  }

  listSceneCards(projectId: string): SceneCardRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM scene_cards
        WHERE project_id = ?
        ORDER BY plot_number ASC, updated_at DESC, name ASC
        `,
      )
      .all(projectId) as Record<string, unknown>[];
    return rows.map(toSceneCardRecord);
  }

  listScenesForChapter(projectId: string, chapterNodeId: string): SceneCardRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM scene_cards
        WHERE project_id = ? AND chapter_node_id = ?
        ORDER BY created_at ASC
        `,
      )
      .all(projectId, chapterNodeId) as Record<string, unknown>[];
    return rows.map(toSceneCardRecord);
  }

  deleteSceneCard(sceneId: string): void {
    this.db.transaction(() => {
      this.db
        .prepare("DELETE FROM timeline_items WHERE item_type = 'scene' AND entity_id = ?")
        .run(sceneId);
      this.db.prepare('DELETE FROM scene_cards WHERE id = ?').run(sceneId);
    })();
  }

  getTimelineSettings(projectId: string): TimelineSettingsRecord {
    const row = this.db
      .prepare('SELECT * FROM timeline_settings WHERE project_id = ?')
      .get(projectId) as Record<string, unknown> | undefined;

    if (row) {
      return toTimelineSettingsRecord(row);
    }

    return {
      projectId,
      startLabel: '',
      endLabel: '',
      timelineEndX: 1148,
      updatedAt: nowIso(),
    };
  }

  upsertTimelineSettings(
    projectId: string,
    input: UpsertTimelineSettingsInput,
  ): TimelineSettingsRecord {
    const timestamp = nowIso();
    this.db
      .prepare(
        `
        INSERT INTO timeline_settings(project_id, start_label, end_label, timeline_end_x, updated_at)
        VALUES (@projectId, @startLabel, @endLabel, @timelineEndX, @updatedAt)
        ON CONFLICT(project_id) DO UPDATE SET
          start_label = excluded.start_label,
          end_label = excluded.end_label,
          timeline_end_x = excluded.timeline_end_x,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        projectId,
        startLabel: input.startLabel,
        endLabel: input.endLabel,
        timelineEndX: input.timelineEndX,
        updatedAt: timestamp,
      });

    return this.getTimelineSettings(projectId);
  }

  listTimelineItems(projectId: string): TimelineItemRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM timeline_items
        WHERE project_id = ?
        ORDER BY position_x ASC, position_y ASC, created_at ASC
        `,
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(toTimelineItemRecord);
  }

  upsertTimelineItem(projectId: string, input: UpsertTimelineItemInput): TimelineItemRecord {
    const existing = this.db
      .prepare(
        `
        SELECT id, created_at
        FROM timeline_items
        WHERE project_id = ? AND item_type = ? AND entity_id = ?
        `,
      )
      .get(projectId, input.itemType, input.entityId) as
      | { id: string; created_at: string }
      | undefined;
    const timestamp = nowIso();
    const id = existing?.id ?? randomUUID();
    const createdAt = existing?.created_at ?? timestamp;

    this.db
      .prepare(
        `
        INSERT INTO timeline_items(
          id,
          project_id,
          item_type,
          entity_id,
          position_x,
          position_y,
          date_label,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @projectId,
          @itemType,
          @entityId,
          @positionX,
          @positionY,
          @dateLabel,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(project_id, item_type, entity_id) DO UPDATE SET
          position_x = excluded.position_x,
          position_y = excluded.position_y,
          date_label = excluded.date_label,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        id,
        projectId,
        itemType: input.itemType,
        entityId: input.entityId,
        positionX: input.positionX,
        positionY: input.positionY,
        dateLabel: input.dateLabel,
        createdAt,
        updatedAt: timestamp,
      });

    const row = this.db.prepare('SELECT * FROM timeline_items WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error('Timeline item upsert failed');
    }
    return toTimelineItemRecord(row);
  }

  createEntityRevision(projectId: string, input: CreateEntityRevisionInput): EntityRevisionRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO entity_revisions(
          id,
          project_id,
          entity_type,
          entity_id,
          label,
          reason,
          snapshot_json,
          text_content,
          created_at
        )
        VALUES (
          @id,
          @projectId,
          @entityType,
          @entityId,
          @label,
          @reason,
          @snapshotJson,
          @textContent,
          @createdAt
        )
        `,
      )
      .run({
        id,
        projectId,
        entityType: input.entityType,
        entityId: input.entityId,
        label: input.label?.trim() ? input.label.trim() : null,
        reason: input.reason,
        snapshotJson: input.snapshotJson,
        textContent: input.textContent,
        createdAt: timestamp,
      });

    const created = this.getEntityRevisionById(id);
    if (!created) {
      throw new Error('Entity revision creation failed');
    }
    return created;
  }

  createEntityRevisionIfChanged(
    projectId: string,
    input: CreateEntityRevisionInput,
  ): EntityRevisionRecord | null {
    const latest = this.getLatestEntityRevision(projectId, input.entityType, input.entityId);
    if (latest?.snapshotJson === input.snapshotJson) {
      return null;
    }
    return this.createEntityRevision(projectId, input);
  }

  listEntityRevisions(
    projectId: string,
    entityType: CreateEntityRevisionInput['entityType'],
    entityId: string,
  ): EntityRevisionRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM entity_revisions
        WHERE project_id = ? AND entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC, rowid DESC
        `,
      )
      .all(projectId, entityType, entityId) as Record<string, unknown>[];
    return rows.map(toEntityRevisionRecord);
  }

  getLatestEntityRevision(
    projectId: string,
    entityType: CreateEntityRevisionInput['entityType'],
    entityId: string,
  ): EntityRevisionRecord | null {
    const row = this.db
      .prepare(
        `
        SELECT *
        FROM entity_revisions
        WHERE project_id = ? AND entity_type = ? AND entity_id = ?
        ORDER BY created_at DESC, rowid DESC
        LIMIT 1
        `,
      )
      .get(projectId, entityType, entityId) as Record<string, unknown> | undefined;
    return row ? toEntityRevisionRecord(row) : null;
  }

  getEntityRevisionById(revisionId: string): EntityRevisionRecord | null {
    const row = this.db.prepare('SELECT * FROM entity_revisions WHERE id = ?').get(revisionId) as
      | Record<string, unknown>
      | undefined;
    return row ? toEntityRevisionRecord(row) : null;
  }
}
