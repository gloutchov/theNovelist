import type {
  CreateSceneCardInput,
  SceneCardRecord,
  UpdateSceneCardInput,
} from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';
import { createAutomaticRevision } from './revision-content';
import {
  autoLinkEntityReferences,
  extractEntityReferenceMentionIds,
  type RichTextAutolinkDocument,
} from '../../shared/reference-autolink';
import { parseRichTextDocument } from './chapter-service';

type Repository = ReturnType<ProjectSessionManager['getRepository']>;

export interface UpdateSceneCardServiceInput extends UpdateSceneCardInput {
  id: string;
}

function autoLinkSceneContentJson(
  repository: Repository,
  projectId: string,
  contentJson: string | null | undefined,
): { contentJson: string | null; document: RichTextAutolinkDocument | null } {
  if (!contentJson?.trim()) {
    return { contentJson: contentJson ?? null, document: null };
  }

  const document = parseRichTextDocument(contentJson);
  const autoLinked = autoLinkEntityReferences(
    document,
    repository.listCharacterCards(projectId),
    repository.listLocationCards(projectId),
  ).document;

  return {
    contentJson: JSON.stringify(autoLinked),
    document: autoLinked,
  };
}

function syncSceneEntityLinksToParentChapter(
  repository: Repository,
  projectId: string,
  chapterNodeId: string,
  document: RichTextAutolinkDocument | null,
): void {
  if (!document) {
    return;
  }

  const references = extractEntityReferenceMentionIds(document);
  for (const characterId of references.characterIds) {
    const character = repository.getCharacterCardById(characterId);
    if (!character || character.projectId !== projectId) {
      continue;
    }
    const currentLinks = repository
      .listCharacterChapterLinks(characterId)
      .map((link) => link.chapterNodeId);
    if (!currentLinks.includes(chapterNodeId)) {
      repository.setCharacterChapterLinks({
        characterCardId: characterId,
        chapterNodeIds: [...currentLinks, chapterNodeId],
      });
    }
  }

  for (const locationId of references.locationIds) {
    const location = repository.getLocationCardById(locationId);
    if (!location || location.projectId !== projectId) {
      continue;
    }
    const currentLinks = repository
      .listLocationChapterLinks(locationId)
      .map((link) => link.chapterNodeId);
    if (!currentLinks.includes(chapterNodeId)) {
      repository.setLocationChapterLinks({
        locationCardId: locationId,
        chapterNodeIds: [...currentLinks, chapterNodeId],
      });
    }
  }
}

export class SceneService {
  constructor(private readonly sessionManager: ProjectSessionManager) {}

  listCards(): SceneCardRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return repository.listSceneCards(projectId);
  }

  async createCard(input: CreateSceneCardInput): Promise<SceneCardRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const chapter = repository.getChapterNodeById(input.chapterNodeId);
    if (!chapter || chapter.projectId !== projectId) {
      throw new Error('Chapter node not found');
    }

    const autoLinkedContent = autoLinkSceneContentJson(repository, projectId, input.contentJson);
    const card = repository.createSceneCard(projectId, {
      chapterNodeId: input.chapterNodeId,
      name: input.name,
      text: input.text,
      contentJson: autoLinkedContent.contentJson,
      notes: input.notes,
      plotNumber: input.plotNumber,
      positionX: input.positionX,
      positionY: input.positionY,
    });
    syncSceneEntityLinksToParentChapter(
      repository,
      projectId,
      input.chapterNodeId,
      autoLinkedContent.document,
    );
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return card;
  }

  async updateCard(input: UpdateSceneCardServiceInput): Promise<SceneCardRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const existing = repository.getSceneCardById(input.id);
    if (!existing || existing.projectId !== projectId) {
      throw new Error('Scene card not found');
    }
    const chapter = repository.getChapterNodeById(input.chapterNodeId);
    if (!chapter || chapter.projectId !== projectId) {
      throw new Error('Chapter node not found');
    }

    createAutomaticRevision(repository, projectId, 'scene', input.id);

    const autoLinkedContent = autoLinkSceneContentJson(repository, projectId, input.contentJson);
    repository.updateSceneCard(input.id, {
      chapterNodeId: input.chapterNodeId,
      name: input.name,
      text: input.text,
      contentJson: autoLinkedContent.contentJson,
      notes: input.notes,
      plotNumber: input.plotNumber,
      positionX: input.positionX,
      positionY: input.positionY,
    });
    syncSceneEntityLinksToParentChapter(
      repository,
      projectId,
      input.chapterNodeId,
      autoLinkedContent.document,
    );

    const updated = repository.getSceneCardById(input.id);
    if (!updated) {
      throw new Error('Scene card not found after update');
    }
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return updated;
  }

  async deleteCard(id: string): Promise<void> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const existing = repository.getSceneCardById(id);
    if (!existing || existing.projectId !== projectId) {
      throw new Error('Scene card not found');
    }
    repository.deleteSceneCard(id);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
  }
}
