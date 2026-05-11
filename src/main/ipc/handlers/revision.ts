import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import { RevisionService } from '../../services/revision-service';
import {
  entityRevisionCurrentResponseSchema,
  entityRevisionResponseSchema,
  revisionCreateRequestSchema,
  revisionGetCurrentRequestSchema,
  revisionListRequestSchema,
  revisionRestoreRequestSchema,
} from '../schemas';

export function registerRevisionIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const revisionService = new RevisionService(sessionManager);

  ipcMain.handle(IPC_CHANNELS.revisionGetCurrent, (_event, payload: unknown) => {
    const request = revisionGetCurrentRequestSchema.parse(payload);
    const content = revisionService.getCurrent(request);
    return entityRevisionCurrentResponseSchema.parse(content);
  });

  ipcMain.handle(IPC_CHANNELS.revisionCreate, (_event, payload: unknown) => {
    const request = revisionCreateRequestSchema.parse(payload);
    const revision = revisionService.create(request);
    return entityRevisionResponseSchema.parse(revision);
  });

  ipcMain.handle(IPC_CHANNELS.revisionList, (_event, payload: unknown) => {
    const request = revisionListRequestSchema.parse(payload);
    const revisions = revisionService.list(request);
    return z.array(entityRevisionResponseSchema).parse(revisions);
  });

  ipcMain.handle(IPC_CHANNELS.revisionRestore, async (_event, payload: unknown) => {
    const request = revisionRestoreRequestSchema.parse(payload);
    const current = await revisionService.restore(request.revisionId);
    return entityRevisionCurrentResponseSchema.parse(current);
  });
}
