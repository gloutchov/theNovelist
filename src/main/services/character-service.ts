import type { GeneratedImageSize } from '../config/app-config';
import {
  generateImageWithApi,
  importImageToProject,
  saveGeneratedImageToProject,
} from '../images/generation';
import type {
  CharacterCardRecord,
  CharacterImageRecord,
  CreateCharacterCardInput,
  UpdateCharacterCardInput,
} from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import type { ResolveImageApiRuntime } from './image-runtime';
import { createAutomaticRevision } from './revision-content';
import {
  assertChapterNodeIdsBelongToProject,
  getStoryContext,
  syncProjectWikiSourcesBestEffort,
} from './project-context';

export interface UpdateCharacterCardServiceInput extends UpdateCharacterCardInput {
  id: string;
  preserveExistingEyeColor?: boolean;
  preserveExistingSkinColor?: boolean;
}

export interface CharacterImageInput {
  characterCardId: string;
  imageType: string;
  prompt: string;
}

export interface CreateCharacterImageServiceInput extends CharacterImageInput {
  filePath: string;
}

export interface GenerateCharacterImageServiceInput extends CharacterImageInput {
  size: GeneratedImageSize;
}

export class CharacterService {
  constructor(
    private readonly sessionManager: ProjectSessionManager,
    private readonly resolveImageApiRuntime: ResolveImageApiRuntime,
  ) {}

  listCards(): CharacterCardRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return repository.listCharacterCards(projectId);
  }

  async createCard(input: CreateCharacterCardInput): Promise<CharacterCardRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.createCharacterCard(projectId, input);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return card;
  }

  async updateCard(input: UpdateCharacterCardServiceInput): Promise<CharacterCardRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const existing = repository.getCharacterCardById(input.id);
    if (!existing || existing.projectId !== projectId) {
      throw new Error('Character card not found');
    }

    createAutomaticRevision(repository, projectId, 'character', input.id);

    repository.updateCharacterCard(input.id, {
      firstName: input.firstName,
      lastName: input.lastName,
      sex: input.sex,
      age: input.age,
      sexualOrientation: input.sexualOrientation,
      species: input.species,
      hairColor: input.hairColor,
      eyeColor: input.preserveExistingEyeColor ? existing.eyeColor : input.eyeColor,
      skinColor: input.preserveExistingSkinColor ? existing.skinColor : input.skinColor,
      bald: input.bald,
      beard: input.beard,
      physique: input.physique,
      job: input.job,
      notes: input.notes,
      plotNumber: input.plotNumber,
      positionX: input.positionX,
      positionY: input.positionY,
    });

    const updated = repository.getCharacterCardById(input.id);
    if (!updated) {
      throw new Error('Character card not found after update');
    }

    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return updated;
  }

  async deleteCard(id: string): Promise<void> {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deleteCharacterCard(id);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
  }

  listChapterLinks(characterCardId: string): string[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getCharacterCardById(characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
    }

    return repository.listCharacterChapterLinks(card.id).map((link) => link.chapterNodeId);
  }

  async setChapterLinks(characterCardId: string, chapterNodeIds: string[]): Promise<string[]> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getCharacterCardById(characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
    }

    const deduplicatedChapterNodeIds = [...new Set(chapterNodeIds)];
    assertChapterNodeIdsBelongToProject(repository, projectId, deduplicatedChapterNodeIds);
    repository.setCharacterChapterLinks({
      characterCardId: card.id,
      chapterNodeIds: deduplicatedChapterNodeIds,
    });
    await syncProjectWikiSourcesBestEffort(this.sessionManager);

    return repository.listCharacterChapterLinks(card.id).map((link) => link.chapterNodeId);
  }

  listImages(characterCardId: string): CharacterImageRecord[] {
    const { repository } = getStoryContext(this.sessionManager);
    return repository.listCharacterImages(characterCardId);
  }

  async createImage(input: CreateCharacterImageServiceInput): Promise<CharacterImageRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getCharacterCardById(input.characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
    }

    const project = this.sessionManager.getOpenedProject();
    if (!project) {
      throw new Error('No open project session');
    }

    const filePath = await importImageToProject({
      assetsPath: project.assetsPath,
      category: 'characters',
      imageType: input.imageType,
      sourceFilePath: input.filePath,
    });

    return repository.createCharacterImage({
      characterCardId: input.characterCardId,
      imageType: input.imageType,
      filePath,
      prompt: input.prompt,
    });
  }

  async generateImage(input: GenerateCharacterImageServiceInput): Promise<CharacterImageRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const card = repository.getCharacterCardById(input.characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
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
      category: 'characters',
      imageType: input.imageType,
      generated,
    });

    return repository.createCharacterImage({
      characterCardId: card.id,
      imageType: input.imageType,
      filePath,
      prompt: input.prompt,
    });
  }

  deleteImage(id: string): void {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deleteCharacterImage(id);
  }
}
