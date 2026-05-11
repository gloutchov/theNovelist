import type {
  CreateSceneCardInput,
  SceneCardRecord,
  UpdateSceneCardInput,
} from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';
import { createAutomaticRevision } from './revision-content';

export interface UpdateSceneCardServiceInput extends UpdateSceneCardInput {
  id: string;
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

    const card = repository.createSceneCard(projectId, {
      chapterNodeId: input.chapterNodeId,
      name: input.name,
      text: input.text,
      contentJson: input.contentJson ?? null,
      notes: input.notes,
      plotNumber: input.plotNumber,
      positionX: input.positionX,
      positionY: input.positionY,
    });
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

    repository.updateSceneCard(input.id, {
      chapterNodeId: input.chapterNodeId,
      name: input.name,
      text: input.text,
      contentJson: input.contentJson ?? null,
      notes: input.notes,
      plotNumber: input.plotNumber,
      positionX: input.positionX,
      positionY: input.positionY,
    });

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
