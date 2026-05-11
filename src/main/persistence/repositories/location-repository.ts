import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  CreateLocationCardInput,
  CreateLocationImageInput,
  LocationCardRecord,
  LocationChapterLinkRecord,
  LocationImageRecord,
  SetLocationChapterLinksInput,
  UpdateLocationCardInput,
} from '../types';
import {
  nowIso,
  toLocationCardRecord,
  toLocationChapterLinkRecord,
  toLocationImageRecord,
} from './shared';

export class LocationRepository {
  constructor(private readonly db: Database.Database) {}

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
}
