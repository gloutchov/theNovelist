import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import { ExternalSourceService } from '../../services/external-source-service';
import {
  createExternalSourceEdgeRequestSchema,
  deleteExternalSourceEdgeRequestSchema,
  deleteExternalSourceRequestSchema,
  externalSourceEdgeResponseSchema,
  externalSourceResponseSchema,
  externalSourcesStateResponseSchema,
  importExternalSourcesRequestSchema,
  openExternalSourceRequestSchema,
  successResponseSchema,
  updateExternalSourceRequestSchema,
} from '../schemas';

export function registerExternalSourceIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const externalSourceService = new ExternalSourceService(sessionManager);

  ipcMain.handle(IPC_CHANNELS.externalSourcesGetState, () => {
    return externalSourcesStateResponseSchema.parse(externalSourceService.getState());
  });

  ipcMain.handle(IPC_CHANNELS.externalSourcesImport, async (_event, payload: unknown) => {
    const request = importExternalSourcesRequestSchema.parse(payload);
    const sources = await externalSourceService.importSources({
      files: request.files,
      allowAiPdfOcr: request.allowAiPdfOcr,
      allowAiAnalysis: request.allowAiAnalysis,
    });
    return z.array(externalSourceResponseSchema).parse(sources);
  });

  ipcMain.handle(IPC_CHANNELS.externalSourcesUpdate, (_event, payload: unknown) => {
    const request = updateExternalSourceRequestSchema.parse(payload);
    const updated = externalSourceService.updateSource({
      id: request.id,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return externalSourceResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.externalSourcesDelete, async (_event, payload: unknown) => {
    const request = deleteExternalSourceRequestSchema.parse(payload);
    await externalSourceService.deleteSource(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.externalSourcesOpen, async (_event, payload: unknown) => {
    const request = openExternalSourceRequestSchema.parse(payload);
    await externalSourceService.openSource(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.externalSourcesCreateEdge, (_event, payload: unknown) => {
    const request = createExternalSourceEdgeRequestSchema.parse(payload);
    const edge = externalSourceService.createEdge({
      sourceId: request.sourceId,
      targetId: request.targetId,
      sourceHandle: request.sourceHandle,
      targetHandle: request.targetHandle,
      label: request.label ?? null,
    });
    return externalSourceEdgeResponseSchema.parse(edge);
  });

  ipcMain.handle(IPC_CHANNELS.externalSourcesDeleteEdge, (_event, payload: unknown) => {
    const request = deleteExternalSourceEdgeRequestSchema.parse(payload);
    externalSourceService.deleteEdge(request.id);
    return successResponseSchema.parse({ ok: true });
  });
}
