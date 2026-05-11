import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import { SceneService } from '../../services/scene-service';
import {
  createSceneCardRequestSchema,
  deleteSceneCardRequestSchema,
  sceneCardResponseSchema,
  successResponseSchema,
  updateSceneCardRequestSchema,
} from '../schemas';

export function registerSceneIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const sceneService = new SceneService(sessionManager);

  ipcMain.handle(IPC_CHANNELS.sceneListCards, () => {
    const cards = sceneService.listCards();
    return z.array(sceneCardResponseSchema).parse(cards);
  });

  ipcMain.handle(IPC_CHANNELS.sceneCreateCard, async (_event, payload: unknown) => {
    const request = createSceneCardRequestSchema.parse(payload);
    const card = await sceneService.createCard({
      chapterNodeId: request.chapterNodeId,
      name: request.name,
      text: request.text,
      contentJson: request.contentJson ?? null,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return sceneCardResponseSchema.parse(card);
  });

  ipcMain.handle(IPC_CHANNELS.sceneUpdateCard, async (_event, payload: unknown) => {
    const request = updateSceneCardRequestSchema.parse(payload);
    const updated = await sceneService.updateCard({
      id: request.id,
      chapterNodeId: request.chapterNodeId,
      name: request.name,
      text: request.text,
      contentJson: request.contentJson ?? null,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return sceneCardResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.sceneDeleteCard, async (_event, payload: unknown) => {
    const request = deleteSceneCardRequestSchema.parse(payload);
    await sceneService.deleteCard(request.id);
    return successResponseSchema.parse({ ok: true });
  });
}
