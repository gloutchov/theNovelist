import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import { CharacterService } from '../../services/character-service';
import type { ResolveImageApiRuntime } from '../../services/image-runtime';
import {
  characterCardResponseSchema,
  characterImageResponseSchema,
  chapterLinkIdsResponseSchema,
  createCharacterCardRequestSchema,
  createCharacterImageRequestSchema,
  deleteCharacterCardRequestSchema,
  deleteCharacterImageRequestSchema,
  generateCharacterImageRequestSchema,
  listCharacterChapterLinksRequestSchema,
  listCharacterImagesRequestSchema,
  setCharacterChapterLinksRequestSchema,
  successResponseSchema,
  updateCharacterCardRequestSchema,
} from '../schemas';

export function registerCharacterIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
  resolveImageApiRuntime: ResolveImageApiRuntime,
): void {
  const characterService = new CharacterService(sessionManager, resolveImageApiRuntime);

  ipcMain.handle(IPC_CHANNELS.characterListCards, () => {
    const cards = characterService.listCards();
    return z.array(characterCardResponseSchema).parse(cards);
  });

  ipcMain.handle(IPC_CHANNELS.characterCreateCard, async (_event, payload: unknown) => {
    const request = createCharacterCardRequestSchema.parse(payload);
    const card = await characterService.createCard({
      firstName: request.firstName,
      lastName: request.lastName,
      sex: request.sex,
      age: request.age ?? null,
      sexualOrientation: request.sexualOrientation,
      species: request.species,
      hairColor: request.hairColor,
      eyeColor: request.eyeColor,
      skinColor: request.skinColor,
      bald: request.bald,
      beard: request.beard,
      physique: request.physique,
      job: request.job,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return characterCardResponseSchema.parse(card);
  });

  ipcMain.handle(IPC_CHANNELS.characterUpdateCard, async (_event, payload: unknown) => {
    const request = updateCharacterCardRequestSchema.parse(payload);
    const payloadRecord =
      payload && typeof payload === 'object' && !Array.isArray(payload)
        ? (payload as Record<string, unknown>)
        : {};
    const updated = await characterService.updateCard({
      id: request.id,
      firstName: request.firstName,
      lastName: request.lastName,
      sex: request.sex,
      age: request.age ?? null,
      sexualOrientation: request.sexualOrientation,
      species: request.species,
      hairColor: request.hairColor,
      eyeColor: request.eyeColor,
      skinColor: request.skinColor,
      bald: request.bald,
      beard: request.beard,
      physique: request.physique,
      job: request.job,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
      preserveExistingEyeColor: !Object.hasOwn(payloadRecord, 'eyeColor'),
      preserveExistingSkinColor: !Object.hasOwn(payloadRecord, 'skinColor'),
    });
    return characterCardResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.characterDeleteCard, async (_event, payload: unknown) => {
    const request = deleteCharacterCardRequestSchema.parse(payload);
    await characterService.deleteCard(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.characterListChapterLinks, (_event, payload: unknown) => {
    const request = listCharacterChapterLinksRequestSchema.parse(payload);
    const chapterNodeIds = characterService.listChapterLinks(request.characterCardId);
    return chapterLinkIdsResponseSchema.parse(chapterNodeIds);
  });

  ipcMain.handle(IPC_CHANNELS.characterSetChapterLinks, async (_event, payload: unknown) => {
    const request = setCharacterChapterLinksRequestSchema.parse(payload);
    const linkedIds = await characterService.setChapterLinks(
      request.characterCardId,
      request.chapterNodeIds,
    );
    return chapterLinkIdsResponseSchema.parse(linkedIds);
  });

  ipcMain.handle(IPC_CHANNELS.characterListImages, (_event, payload: unknown) => {
    const request = listCharacterImagesRequestSchema.parse(payload);
    const images = characterService.listImages(request.characterCardId);
    return z.array(characterImageResponseSchema).parse(images);
  });

  ipcMain.handle(IPC_CHANNELS.characterCreateImage, async (_event, payload: unknown) => {
    const request = createCharacterImageRequestSchema.parse(payload);
    const image = await characterService.createImage({
      characterCardId: request.characterCardId,
      imageType: request.imageType,
      prompt: request.prompt,
      filePath: request.filePath,
    });
    return characterImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.characterGenerateImage, async (_event, payload: unknown) => {
    const request = generateCharacterImageRequestSchema.parse(payload);
    const image = await characterService.generateImage({
      characterCardId: request.characterCardId,
      imageType: request.imageType,
      prompt: request.prompt,
      size: request.size,
    });
    return characterImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.characterDeleteImage, (_event, payload: unknown) => {
    const request = deleteCharacterImageRequestSchema.parse(payload);
    characterService.deleteImage(request.id);
    return successResponseSchema.parse({ ok: true });
  });
}
