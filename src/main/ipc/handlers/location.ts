import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import type { ResolveImageApiRuntime } from '../../services/image-runtime';
import { LocationService } from '../../services/location-service';
import {
  chapterLinkIdsResponseSchema,
  createLocationCardRequestSchema,
  createLocationImageRequestSchema,
  deleteLocationCardRequestSchema,
  deleteLocationImageRequestSchema,
  generateLocationImageRequestSchema,
  listLocationChapterLinksRequestSchema,
  listLocationImagesRequestSchema,
  locationCardResponseSchema,
  locationImageResponseSchema,
  setLocationChapterLinksRequestSchema,
  successResponseSchema,
  updateLocationCardRequestSchema,
} from '../schemas';

export function registerLocationIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
  resolveImageApiRuntime: ResolveImageApiRuntime,
): void {
  const locationService = new LocationService(sessionManager, resolveImageApiRuntime);

  ipcMain.handle(IPC_CHANNELS.locationListCards, () => {
    const cards = locationService.listCards();
    return z.array(locationCardResponseSchema).parse(cards);
  });

  ipcMain.handle(IPC_CHANNELS.locationCreateCard, async (_event, payload: unknown) => {
    const request = createLocationCardRequestSchema.parse(payload);
    const card = await locationService.createCard({
      name: request.name,
      locationType: request.locationType,
      description: request.description,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return locationCardResponseSchema.parse(card);
  });

  ipcMain.handle(IPC_CHANNELS.locationUpdateCard, async (_event, payload: unknown) => {
    const request = updateLocationCardRequestSchema.parse(payload);
    const updated = await locationService.updateCard({
      id: request.id,
      name: request.name,
      locationType: request.locationType,
      description: request.description,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return locationCardResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.locationDeleteCard, async (_event, payload: unknown) => {
    const request = deleteLocationCardRequestSchema.parse(payload);
    await locationService.deleteCard(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.locationListChapterLinks, (_event, payload: unknown) => {
    const request = listLocationChapterLinksRequestSchema.parse(payload);
    const chapterNodeIds = locationService.listChapterLinks(request.locationCardId);
    return chapterLinkIdsResponseSchema.parse(chapterNodeIds);
  });

  ipcMain.handle(IPC_CHANNELS.locationSetChapterLinks, async (_event, payload: unknown) => {
    const request = setLocationChapterLinksRequestSchema.parse(payload);
    const linkedIds = await locationService.setChapterLinks(
      request.locationCardId,
      request.chapterNodeIds,
    );
    return chapterLinkIdsResponseSchema.parse(linkedIds);
  });

  ipcMain.handle(IPC_CHANNELS.locationListImages, (_event, payload: unknown) => {
    const request = listLocationImagesRequestSchema.parse(payload);
    const images = locationService.listImages(request.locationCardId);
    return z.array(locationImageResponseSchema).parse(images);
  });

  ipcMain.handle(IPC_CHANNELS.locationCreateImage, async (_event, payload: unknown) => {
    const request = createLocationImageRequestSchema.parse(payload);
    const image = await locationService.createImage({
      locationCardId: request.locationCardId,
      imageType: request.imageType,
      prompt: request.prompt,
      filePath: request.filePath,
    });
    return locationImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.locationGenerateImage, async (_event, payload: unknown) => {
    const request = generateLocationImageRequestSchema.parse(payload);
    const image = await locationService.generateImage({
      locationCardId: request.locationCardId,
      imageType: request.imageType,
      prompt: request.prompt,
      size: request.size,
    });
    return locationImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.locationDeleteImage, (_event, payload: unknown) => {
    const request = deleteLocationImageRequestSchema.parse(payload);
    locationService.deleteImage(request.id);
    return successResponseSchema.parse({ ok: true });
  });
}
