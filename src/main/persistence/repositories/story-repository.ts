import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  ChapterDocumentRecord,
  ChapterNodeRecord,
  CreateChapterNodeInput,
  CreatePlotInput,
  CreateStoryEdgeInput,
  CreateWritingSessionInput,
  PlotRecord,
  StoryEdgeRecord,
  UpdateChapterNodeInput,
  UpdatePlotInput,
  UpsertChapterDocumentInput,
  WritingSessionRecord,
} from '../types';
import {
  nowIso,
  toChapterDocumentRecord,
  toChapterNodeRecord,
  toPlotRecord,
  toStoryEdgeRecord,
  toWritingSessionRecord,
} from './shared';

export class StoryRepository {
  constructor(private readonly db: Database.Database) {}

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
}
