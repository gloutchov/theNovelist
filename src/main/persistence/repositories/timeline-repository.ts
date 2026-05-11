import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { APP_CONFIG } from '../../config/app-config';
import type {
  TimelineItemRecord,
  TimelineSettingsRecord,
  UpsertTimelineItemInput,
  UpsertTimelineSettingsInput,
} from '../types';
import { nowIso, toTimelineItemRecord, toTimelineSettingsRecord } from './shared';

export class TimelineRepository {
  constructor(private readonly db: Database.Database) {}

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
      updatedAt: APP_CONFIG.timeline.defaultSettingsUpdatedAt,
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
}
