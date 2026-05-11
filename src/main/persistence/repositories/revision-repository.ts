import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { CreateEntityRevisionInput, EntityRevisionRecord } from '../types';
import { nowIso, toEntityRevisionRecord } from './shared';

export class RevisionRepository {
  constructor(private readonly db: Database.Database) {}

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
