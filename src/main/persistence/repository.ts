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
  CreateStoryEdgeInput,
  CreateChapterNodeInput,
  CreateLocationCardInput,
  CreateLocationImageInput,
  CreatePlotInput,
  SetCharacterChapterLinksInput,
  SetLocationChapterLinksInput,
  LocationChapterLinkRecord,
  LocationCardRecord,
  LocationImageRecord,
  PlotRecord,
  ProjectRecord,
  UpdateChapterNodeInput,
  UpdateCharacterCardInput,
  UpdatePlotInput,
  UpdateLocationCardInput,
  UpsertChapterDocumentInput,
  UpsertCodexSettingsInput,
} from './types';

function nowIso(): string {
  return new Date().toISOString();
}

function toProjectRecord(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    rootPath: String(row.root_path),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
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
  const apiModel = row.api_model;
  const normalizedProvider =
    provider === 'openai_api' || provider === 'ollama' ? provider : 'codex_cli';

  return {
    projectId: String(row.project_id),
    enabled: Number(row.enabled) === 1,
    provider: normalizedProvider,
    allowApiCalls: Number(row.allow_api_calls ?? 0) === 1,
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

  createProject(params: { id?: string; name: string; rootPath: string }): ProjectRecord {
    const id = params.id ?? randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO projects(id, name, root_path, created_at, updated_at)
        VALUES (@id, @name, @rootPath, @createdAt, @updatedAt)
        `,
      )
      .run({
        id,
        name: params.name,
        rootPath: params.rootPath,
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

  updateProjectRootPathAndAssetReferences(id: string, previousRootPath: string, nextRootPath: string): void {
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
    const deletePlotRecord = this.db.prepare('DELETE FROM plots WHERE id = ?');

    this.db.transaction(() => {
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
      .prepare('SELECT * FROM chapter_nodes WHERE project_id = ? ORDER BY plot_number, block_number')
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
    this.db.prepare('DELETE FROM chapter_nodes WHERE id = ?').run(nodeId);
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
          allow_api_calls,
          auto_summarize_descriptions,
          api_key,
          api_model,
          created_at,
          updated_at
        )
        VALUES (?, 0, 'codex_cli', 0, 1, NULL, 'gpt-5-mini', ?, ?)
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
      allowApiCalls: input.allowApiCalls ?? current.allowApiCalls,
      autoSummarizeDescriptions: input.autoSummarizeDescriptions ?? current.autoSummarizeDescriptions,
      apiKey: input.apiKey === undefined ? current.apiKey : input.apiKey,
      apiModel: input.apiModel?.trim() ? input.apiModel.trim() : current.apiModel,
      updatedAt: nowIso(),
    };
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO codex_settings(
          project_id,
          enabled,
          provider,
          allow_api_calls,
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
          @allowApiCalls,
          @autoSummarizeDescriptions,
          @apiKey,
          @apiModel,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(project_id) DO UPDATE SET
          enabled = excluded.enabled,
          provider = excluded.provider,
          allow_api_calls = excluded.allow_api_calls,
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
        allowApiCalls: next.allowApiCalls ? 1 : 0,
        autoSummarizeDescriptions: next.autoSummarizeDescriptions ? 1 : 0,
        apiKey: next.apiKey,
        apiModel: next.apiModel,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    return this.getOrCreateCodexSettings(projectId);
  }

  appendCodexChatMessage(projectId: string, input: CreateCodexChatMessageInput): CodexChatMessageRecord {
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

    const created = this.db
      .prepare('SELECT * FROM codex_chat_messages WHERE id = ?')
      .get(id) as Record<string, unknown> | undefined;

    if (!created) {
      throw new Error('Codex chat message creation failed');
    }

    return toCodexChatMessageRecord(created);
  }

  listCodexChatMessages(projectId: string, chapterNodeId: string, limit = 100): CodexChatMessageRecord[] {
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
      .prepare('SELECT * FROM character_cards WHERE project_id = ? ORDER BY plot_number, last_name, first_name')
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
      .prepare('SELECT * FROM character_images WHERE character_card_id = ? ORDER BY created_at DESC')
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
    const removeLinks = this.db.prepare('DELETE FROM character_chapter_links WHERE character_card_id = ?');
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
    const removeLinks = this.db.prepare('DELETE FROM location_chapter_links WHERE location_card_id = ?');
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
}
