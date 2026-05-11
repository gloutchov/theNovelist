import type { GeneratedImageSize } from '../config/app-config';
import {
  generateImageWithApi,
  importImageToProject,
  saveGeneratedImageToProject,
} from '../images/generation';
import type {
  CreateLocationCardInput,
  LocationCardRecord,
  LocationImageRecord,
  UpdateLocationCardInput,
} from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import type { ResolveImageApiRuntime } from './image-runtime';
import { createAutomaticRevision } from './revision-content';
import {
  assertChapterNodeIdsBelongToProject,
  getStoryContext,
  syncProjectWikiSourcesBestEffort,
} from './project-context';

export interface UpdateLocationCardServiceInput extends UpdateLocationCardInput {
  id: string;
}

export interface LocationImageInput {
  locationCardId: string;
  imageType: string;
  prompt: string;
}

export interface CreateLocationImageServiceInput extends LocationImageInput {
  filePath: string;
}

export interface GenerateLocationImageServiceInput extends LocationImageInput {
  size: GeneratedImageSize;
}

export class LocationService {
  constructor(
    private readonly sessionManager: ProjectSessionManager,
    private readonly resolveImageApiRuntime: ResolveImageApiRuntime,
  ) {}

  listCards(): LocationCardRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return repository.listLocationCards(projectId);
  }

  async createCard(input: CreateLocationCardInput): Promise<LocationCardRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.createLocationCard(projectId, input);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return card;
  }

  async updateCard(input: UpdateLocationCardServiceInput): Promise<LocationCardRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const existing = repository.getLocationCardById(input.id);
    if (!existing || existing.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    createAutomaticRevision(repository, projectId, 'location', input.id);

    repository.updateLocationCard(input.id, {
      name: input.name,
      locationType: input.locationType,
      description: input.description,
      notes: input.notes,
      plotNumber: input.plotNumber,
      positionX: input.positionX,
      positionY: input.positionY,
    });

    const updated = repository.getLocationCardById(input.id);
    if (!updated) {
      throw new Error('Location card not found after update');
    }

    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return updated;
  }

  async deleteCard(id: string): Promise<void> {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deleteLocationCard(id);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
  }

  listChapterLinks(locationCardId: string): string[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getLocationCardById(locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    return repository.listLocationChapterLinks(card.id).map((link) => link.chapterNodeId);
  }

  async setChapterLinks(locationCardId: string, chapterNodeIds: string[]): Promise<string[]> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getLocationCardById(locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    const deduplicatedChapterNodeIds = [...new Set(chapterNodeIds)];
    assertChapterNodeIdsBelongToProject(repository, projectId, deduplicatedChapterNodeIds);
    repository.setLocationChapterLinks({
      locationCardId: card.id,
      chapterNodeIds: deduplicatedChapterNodeIds,
    });
    await syncProjectWikiSourcesBestEffort(this.sessionManager);

    return repository.listLocationChapterLinks(card.id).map((link) => link.chapterNodeId);
  }

  listImages(locationCardId: string): LocationImageRecord[] {
    const { repository } = getStoryContext(this.sessionManager);
    return repository.listLocationImages(locationCardId);
  }

  async createImage(input: CreateLocationImageServiceInput): Promise<LocationImageRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getLocationCardById(input.locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    const project = this.sessionManager.getOpenedProject();
    if (!project) {
      throw new Error('No open project session');
    }

    const filePath = await importImageToProject({
      assetsPath: project.assetsPath,
      category: 'locations',
      imageType: input.imageType,
      sourceFilePath: input.filePath,
    });

    return repository.createLocationImage({
      locationCardId: input.locationCardId,
      imageType: input.imageType,
      filePath,
      prompt: input.prompt,
    });
  }

  async generateImage(input: GenerateLocationImageServiceInput): Promise<LocationImageRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getLocationCardById(input.locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    const project = this.sessionManager.getOpenedProject();
    if (!project) {
      throw new Error('No open project session');
    }

    const runtime = await this.resolveImageApiRuntime(repository, projectId);
    const generated = await generateImageWithApi({
      apiKey: runtime.apiKey,
      model: runtime.model,
      prompt: input.prompt,
      size: input.size,
    });
    const filePath = await saveGeneratedImageToProject({
      assetsPath: project.assetsPath,
      category: 'locations',
      imageType: input.imageType,
      generated,
    });

    return repository.createLocationImage({
      locationCardId: card.id,
      imageType: input.imageType,
      filePath,
      prompt: input.prompt,
    });
  }

  deleteImage(id: string): void {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deleteLocationImage(id);
  }
}
