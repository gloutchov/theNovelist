import {
  createEmptyRichTextDocument,
  extractRichTextBlocks,
  getWordCountFromDocument,
  type RichTextDocument,
} from '../chapters/rich-text';
import type { EntityRevisionType } from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import { assertChapterNodeIdsBelongToProject } from './project-context';

type Repository = ReturnType<ProjectSessionManager['getRepository']>;

export interface RevisionSnapshotContent {
  entityType: EntityRevisionType;
  entityId: string;
  title: string;
  subtitle: string;
  updatedAt: string;
  snapshotJson: string;
  textContent: string;
}

function parseRichTextDocument(contentJson: string): RichTextDocument {
  try {
    const parsed = JSON.parse(contentJson) as RichTextDocument;
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyRichTextDocument();
    }
    return parsed;
  } catch {
    return createEmptyRichTextDocument();
  }
}

function richTextToPlainText(document: RichTextDocument, maxLength = 12000): string {
  const text = extractRichTextBlocks(document)
    .map((block) => block.spans.map((s) => s.text).join(''))
    .map((t) => t.trim())
    .filter(Boolean)
    .join('\n');
  return text.slice(0, maxLength).trim();
}

function formatRevisionFields(fields: Array<[string, string | number | null | undefined]>): string {
  return fields
    .map(([label, value]) => {
      const text = value === null || value === undefined ? '' : String(value).trim();
      return text ? `${label}: ${text}` : null;
    })
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function getCharacterDisplayName(
  card: NonNullable<ReturnType<Repository['getCharacterCardById']>>,
): string {
  return `${card.firstName} ${card.lastName}`.trim() || 'Personaggio senza nome';
}

function buildChapterRevisionContent(
  repository: Repository,
  projectId: string,
  chapterNodeId: string,
): RevisionSnapshotContent {
  const node = repository.getChapterNodeById(chapterNodeId);
  if (!node || node.projectId !== projectId) {
    throw new Error('Chapter node not found');
  }

  const existingDocument = repository.getChapterDocumentByNodeId(chapterNodeId);
  const document = existingDocument
    ? parseRichTextDocument(existingDocument.contentJson)
    : createEmptyRichTextDocument();
  const wordCount = getWordCountFromDocument(document);
  const documentRecord = existingDocument
    ? { ...existingDocument, wordCount }
    : {
        id: node.richTextDocId,
        chapterNodeId,
        contentJson: JSON.stringify(document),
        wordCount,
        createdAt: node.createdAt,
        updatedAt: node.updatedAt,
      };
  const snapshot = {
    version: 1,
    entityType: 'chapter' as const,
    node,
    document: documentRecord,
  };

  return {
    entityType: 'chapter',
    entityId: node.id,
    title: node.title,
    subtitle: `Trama ${node.plotNumber} · Capitolo ${node.blockNumber}`,
    updatedAt: existingDocument?.updatedAt ?? node.updatedAt,
    snapshotJson: JSON.stringify(snapshot),
    textContent: richTextToPlainText(document, 80_000) || node.description,
  };
}

function buildCharacterRevisionContent(
  repository: Repository,
  projectId: string,
  characterCardId: string,
): RevisionSnapshotContent {
  const card = repository.getCharacterCardById(characterCardId);
  if (!card || card.projectId !== projectId) {
    throw new Error('Character card not found');
  }
  const chapterNodeIds = repository
    .listCharacterChapterLinks(card.id)
    .map((link) => link.chapterNodeId);
  const snapshot = {
    version: 1,
    entityType: 'character' as const,
    card,
    chapterNodeIds,
  };

  return {
    entityType: 'character',
    entityId: card.id,
    title: getCharacterDisplayName(card),
    subtitle: card.job || `Trama ${card.plotNumber}`,
    updatedAt: card.updatedAt,
    snapshotJson: JSON.stringify(snapshot),
    textContent: formatRevisionFields([
      ['Nome', getCharacterDisplayName(card)],
      ['Ruolo', card.job],
      ['Trama', card.plotNumber],
      ['Sesso', card.sex],
      ['Eta', card.age],
      ['Specie', card.species],
      ['Orientamento', card.sexualOrientation],
      ['Capelli', card.hairColor],
      ['Occhi', card.eyeColor],
      ['Pelle', card.skinColor],
      ['Fisico', card.physique],
      ['Barba', card.beard],
      ['Note', card.notes],
    ]),
  };
}

function buildLocationRevisionContent(
  repository: Repository,
  projectId: string,
  locationCardId: string,
): RevisionSnapshotContent {
  const card = repository.getLocationCardById(locationCardId);
  if (!card || card.projectId !== projectId) {
    throw new Error('Location card not found');
  }
  const chapterNodeIds = repository
    .listLocationChapterLinks(card.id)
    .map((link) => link.chapterNodeId);
  const snapshot = {
    version: 1,
    entityType: 'location' as const,
    card,
    chapterNodeIds,
  };

  return {
    entityType: 'location',
    entityId: card.id,
    title: card.name,
    subtitle: card.locationType || `Trama ${card.plotNumber}`,
    updatedAt: card.updatedAt,
    snapshotJson: JSON.stringify(snapshot),
    textContent: formatRevisionFields([
      ['Nome', card.name],
      ['Tipologia', card.locationType],
      ['Trama', card.plotNumber],
      ['Descrizione', card.description],
      ['Note', card.notes],
    ]),
  };
}

function buildSceneRevisionContent(
  repository: Repository,
  projectId: string,
  sceneCardId: string,
): RevisionSnapshotContent {
  const card = repository.getSceneCardById(sceneCardId);
  if (!card || card.projectId !== projectId) {
    throw new Error('Scene card not found');
  }
  const chapter = repository.getChapterNodeById(card.chapterNodeId);
  const snapshot = {
    version: 1,
    entityType: 'scene' as const,
    card,
  };

  return {
    entityType: 'scene',
    entityId: card.id,
    title: `#${card.name}`,
    subtitle: chapter?.title ?? `Trama ${card.plotNumber}`,
    updatedAt: card.updatedAt,
    snapshotJson: JSON.stringify(snapshot),
    textContent: formatRevisionFields([
      ['Nome scena', card.name],
      ['Capitolo', chapter?.title],
      ['Trama', card.plotNumber],
      ['Testo scena', card.text],
      ['Note', card.notes],
    ]),
  };
}

export function buildRevisionContent(
  repository: Repository,
  projectId: string,
  entityType: EntityRevisionType,
  entityId: string,
): RevisionSnapshotContent {
  if (entityType === 'chapter') {
    return buildChapterRevisionContent(repository, projectId, entityId);
  }
  if (entityType === 'character') {
    return buildCharacterRevisionContent(repository, projectId, entityId);
  }
  if (entityType === 'location') {
    return buildLocationRevisionContent(repository, projectId, entityId);
  }
  return buildSceneRevisionContent(repository, projectId, entityId);
}

export function createAutomaticRevision(
  repository: Repository,
  projectId: string,
  entityType: EntityRevisionType,
  entityId: string,
): void {
  const content = buildRevisionContent(repository, projectId, entityType, entityId);
  repository.createEntityRevisionIfChanged(projectId, {
    entityType,
    entityId,
    label: null,
    reason: 'auto',
    snapshotJson: content.snapshotJson,
    textContent: content.textContent,
  });
}

function readSnapshotRecord(snapshotJson: string): Record<string, unknown> {
  const parsed = JSON.parse(snapshotJson) as unknown;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Revision snapshot is invalid');
  }
  return parsed as Record<string, unknown>;
}

function readObjectField(parent: Record<string, unknown>, field: string): Record<string, unknown> {
  const value = parent[field];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`Revision snapshot missing ${field}`);
  }
  return value as Record<string, unknown>;
}

function restoreChapterRevision(
  repository: Repository,
  projectId: string,
  snapshot: Record<string, unknown>,
): void {
  const node = readObjectField(snapshot, 'node');
  const document = readObjectField(snapshot, 'document');
  const nodeId = String(node.id ?? '');
  const existing = repository.getChapterNodeById(nodeId);
  if (!existing || existing.projectId !== projectId) {
    throw new Error('Chapter node not found');
  }

  const contentJson =
    typeof document.contentJson === 'string'
      ? document.contentJson
      : JSON.stringify(createEmptyRichTextDocument());
  const richTextDocument = parseRichTextDocument(contentJson);
  const savedDocument = repository.upsertChapterDocument({
    chapterNodeId: nodeId,
    contentJson: JSON.stringify(richTextDocument),
    wordCount: getWordCountFromDocument(richTextDocument),
  });

  repository.updateChapterNode(nodeId, {
    title: String(node.title ?? existing.title),
    description: String(node.description ?? existing.description),
    plotNumber: Number(node.plotNumber ?? existing.plotNumber),
    blockNumber: Number(node.blockNumber ?? existing.blockNumber),
    positionX: Number(node.positionX ?? existing.positionX),
    positionY: Number(node.positionY ?? existing.positionY),
    richTextDocId: savedDocument.id,
  });
}

function restoreCharacterRevision(
  repository: Repository,
  projectId: string,
  snapshot: Record<string, unknown>,
): void {
  const card = readObjectField(snapshot, 'card');
  const cardId = String(card.id ?? '');
  const existing = repository.getCharacterCardById(cardId);
  if (!existing || existing.projectId !== projectId) {
    throw new Error('Character card not found');
  }

  repository.updateCharacterCard(cardId, {
    firstName: String(card.firstName ?? existing.firstName),
    lastName: String(card.lastName ?? existing.lastName),
    sex: String(card.sex ?? existing.sex),
    age: card.age === null || card.age === undefined ? null : Number(card.age),
    sexualOrientation: String(card.sexualOrientation ?? existing.sexualOrientation),
    species: String(card.species ?? existing.species),
    hairColor: String(card.hairColor ?? existing.hairColor),
    eyeColor: String(card.eyeColor ?? existing.eyeColor),
    skinColor: String(card.skinColor ?? existing.skinColor),
    bald: Boolean(card.bald ?? existing.bald),
    beard: String(card.beard ?? existing.beard),
    physique: String(card.physique ?? existing.physique),
    job: String(card.job ?? existing.job),
    notes: String(card.notes ?? existing.notes),
    plotNumber: Number(card.plotNumber ?? existing.plotNumber),
    positionX: Number(card.positionX ?? existing.positionX),
    positionY: Number(card.positionY ?? existing.positionY),
  });

  const chapterNodeIds = Array.isArray(snapshot.chapterNodeIds)
    ? snapshot.chapterNodeIds.map(String)
    : [];
  assertChapterNodeIdsBelongToProject(repository, projectId, chapterNodeIds);
  repository.setCharacterChapterLinks({ characterCardId: cardId, chapterNodeIds });
}

function restoreLocationRevision(
  repository: Repository,
  projectId: string,
  snapshot: Record<string, unknown>,
): void {
  const card = readObjectField(snapshot, 'card');
  const cardId = String(card.id ?? '');
  const existing = repository.getLocationCardById(cardId);
  if (!existing || existing.projectId !== projectId) {
    throw new Error('Location card not found');
  }

  repository.updateLocationCard(cardId, {
    name: String(card.name ?? existing.name),
    locationType: String(card.locationType ?? existing.locationType),
    description: String(card.description ?? existing.description),
    notes: String(card.notes ?? existing.notes),
    plotNumber: Number(card.plotNumber ?? existing.plotNumber),
    positionX: Number(card.positionX ?? existing.positionX),
    positionY: Number(card.positionY ?? existing.positionY),
  });

  const chapterNodeIds = Array.isArray(snapshot.chapterNodeIds)
    ? snapshot.chapterNodeIds.map(String)
    : [];
  assertChapterNodeIdsBelongToProject(repository, projectId, chapterNodeIds);
  repository.setLocationChapterLinks({ locationCardId: cardId, chapterNodeIds });
}

function restoreSceneRevision(
  repository: Repository,
  projectId: string,
  snapshot: Record<string, unknown>,
): void {
  const card = readObjectField(snapshot, 'card');
  const cardId = String(card.id ?? '');
  const existing = repository.getSceneCardById(cardId);
  if (!existing || existing.projectId !== projectId) {
    throw new Error('Scene card not found');
  }
  const chapterNodeId = String(card.chapterNodeId ?? existing.chapterNodeId);
  const chapter = repository.getChapterNodeById(chapterNodeId);
  if (!chapter || chapter.projectId !== projectId) {
    throw new Error('Chapter node not found');
  }

  repository.updateSceneCard(cardId, {
    chapterNodeId,
    name: String(card.name ?? existing.name),
    text: String(card.text ?? existing.text),
    contentJson: typeof card.contentJson === 'string' ? card.contentJson : null,
    notes: String(card.notes ?? existing.notes),
    plotNumber: Number(card.plotNumber ?? existing.plotNumber),
    positionX: Number(card.positionX ?? existing.positionX),
    positionY: Number(card.positionY ?? existing.positionY),
  });
}

export function restoreRevisionSnapshot(
  repository: Repository,
  projectId: string,
  revision: NonNullable<ReturnType<Repository['getEntityRevisionById']>>,
): void {
  const snapshot = readSnapshotRecord(revision.snapshotJson);
  createAutomaticRevision(repository, projectId, revision.entityType, revision.entityId);

  if (revision.entityType === 'chapter') {
    restoreChapterRevision(repository, projectId, snapshot);
  } else if (revision.entityType === 'character') {
    restoreCharacterRevision(repository, projectId, snapshot);
  } else if (revision.entityType === 'location') {
    restoreLocationRevision(repository, projectId, snapshot);
  } else {
    restoreSceneRevision(repository, projectId, snapshot);
  }
}
