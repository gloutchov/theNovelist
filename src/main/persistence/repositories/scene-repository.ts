import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type { CreateSceneCardInput, SceneCardRecord, UpdateSceneCardInput } from '../types';
import { nowIso, toSceneCardRecord } from './shared';

export class SceneRepository {
  constructor(private readonly db: Database.Database) {}

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
}
