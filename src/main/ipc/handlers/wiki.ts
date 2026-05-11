import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import { WikiService } from '../../services/wiki-service';
import {
  wikiReadSourceRequestSchema,
  wikiSearchRequestSchema,
  wikiSearchResultResponseSchema,
  wikiSourceContentResponseSchema,
  wikiStatusResponseSchema,
  wikiSyncResponseSchema,
} from '../schemas';

export function registerWikiIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const wikiService = new WikiService(sessionManager);

  ipcMain.handle(IPC_CHANNELS.wikiGetStatus, async () => {
    const status = await wikiService.getStatus();
    return wikiStatusResponseSchema.parse(status);
  });

  ipcMain.handle(IPC_CHANNELS.wikiSync, async () => {
    const result = await wikiService.sync('manual');
    return wikiSyncResponseSchema.parse(result);
  });

  ipcMain.handle(IPC_CHANNELS.wikiSearch, async (_event, payload: unknown) => {
    const request = wikiSearchRequestSchema.parse(payload);
    const results = await wikiService.search(request);
    return z.array(wikiSearchResultResponseSchema).parse(results);
  });

  ipcMain.handle(IPC_CHANNELS.wikiReadSource, async (_event, payload: unknown) => {
    const request = wikiReadSourceRequestSchema.parse(payload);
    const content = await wikiService.readSource(request.path);
    return wikiSourceContentResponseSchema.parse({
      path: request.path,
      content,
    });
  });
}
