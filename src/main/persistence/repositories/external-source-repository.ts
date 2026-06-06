import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  CreateExternalSourceEdgeInput,
  CreateExternalSourceInput,
  ExternalSourceEdgeRecord,
  ExternalSourceRecord,
  UpdateExternalSourceInput,
} from '../types';
import { nowIso, toExternalSourceEdgeRecord, toExternalSourceRecord } from './shared';

export class ExternalSourceRepository {
  constructor(private readonly db: Database.Database) {}

  createExternalSource(projectId: string, input: CreateExternalSourceInput): ExternalSourceRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO external_sources(
          id,
          project_id,
          file_name,
          file_type,
          stored_file_path,
          original_file_path,
          summary,
          extracted_text,
          extraction_method,
          extraction_status,
          extraction_message,
          indexed_at,
          position_x,
          position_y,
          created_at,
          updated_at
        )
        VALUES (
          @id,
          @projectId,
          @fileName,
          @fileType,
          @storedFilePath,
          @originalFilePath,
          @summary,
          @extractedText,
          @extractionMethod,
          @extractionStatus,
          @extractionMessage,
          @indexedAt,
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
        fileName: input.fileName,
        fileType: input.fileType,
        storedFilePath: input.storedFilePath,
        originalFilePath: input.originalFilePath,
        summary: input.summary,
        extractedText: input.extractedText,
        extractionMethod: input.extractionMethod,
        extractionStatus: input.extractionStatus,
        extractionMessage: input.extractionMessage,
        indexedAt: timestamp,
        positionX: input.positionX,
        positionY: input.positionY,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const created = this.getExternalSourceById(id);
    if (!created) {
      throw new Error('External source creation failed');
    }

    return created;
  }

  updateExternalSource(sourceId: string, input: UpdateExternalSourceInput): ExternalSourceRecord {
    this.db
      .prepare(
        `
        UPDATE external_sources
        SET position_x = @positionX,
            position_y = @positionY,
            updated_at = @updatedAt
        WHERE id = @sourceId
        `,
      )
      .run({
        sourceId,
        positionX: input.positionX,
        positionY: input.positionY,
        updatedAt: nowIso(),
      });

    const updated = this.getExternalSourceById(sourceId);
    if (!updated) {
      throw new Error('External source update failed');
    }

    return updated;
  }

  getExternalSourceById(sourceId: string): ExternalSourceRecord | null {
    const row = this.db.prepare('SELECT * FROM external_sources WHERE id = ?').get(sourceId) as
      | Record<string, unknown>
      | undefined;
    return row ? toExternalSourceRecord(row) : null;
  }

  listExternalSources(projectId: string): ExternalSourceRecord[] {
    const rows = this.db
      .prepare('SELECT * FROM external_sources WHERE project_id = ? ORDER BY file_name ASC')
      .all(projectId) as Record<string, unknown>[];
    return rows.map(toExternalSourceRecord);
  }

  deleteExternalSource(sourceId: string): void {
    this.db.transaction(() => {
      this.db
        .prepare(
          `
          DELETE FROM external_source_edges
          WHERE source_id = ? OR target_id = ?
          `,
        )
        .run(sourceId, sourceId);
      this.db.prepare('DELETE FROM external_sources WHERE id = ?').run(sourceId);
    })();
  }

  createExternalSourceEdge(
    projectId: string,
    input: CreateExternalSourceEdgeInput,
  ): ExternalSourceEdgeRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO external_source_edges(
          id,
          project_id,
          source_id,
          target_id,
          source_handle,
          target_handle,
          label,
          created_at
        )
        VALUES (
          @id,
          @projectId,
          @sourceId,
          @targetId,
          @sourceHandle,
          @targetHandle,
          @label,
          @createdAt
        )
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

    const row = this.db.prepare('SELECT * FROM external_source_edges WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;
    if (!row) {
      throw new Error('External source edge creation failed');
    }

    return toExternalSourceEdgeRecord(row);
  }

  listExternalSourceEdges(projectId: string): ExternalSourceEdgeRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM external_source_edges
        WHERE project_id = ?
        ORDER BY created_at ASC
        `,
      )
      .all(projectId) as Record<string, unknown>[];
    return rows.map(toExternalSourceEdgeRecord);
  }

  deleteExternalSourceEdge(edgeId: string): void {
    this.db.prepare('DELETE FROM external_source_edges WHERE id = ?').run(edgeId);
  }
}
