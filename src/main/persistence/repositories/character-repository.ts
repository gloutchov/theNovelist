import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import type {
  CharacterCardRecord,
  CharacterChapterLinkRecord,
  CharacterImageRecord,
  CreateCharacterCardInput,
  CreateCharacterImageInput,
  SetCharacterChapterLinksInput,
  UpdateCharacterCardInput,
} from '../types';
import {
  nowIso,
  toCharacterCardRecord,
  toCharacterChapterLinkRecord,
  toCharacterImageRecord,
} from './shared';

export class CharacterRepository {
  constructor(private readonly db: Database.Database) {}

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
}
