import type { IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { CodexCliService } from '../../codex/client';
import type { ProjectSessionManager } from '../../projects/session';
import { CodexApplicationService } from '../../services/codex-service';
import {
  codexAssistRequestSchema,
  codexCancelResponseSchema,
  codexChatHistoryRequestSchema,
  codexChatMessageResponseSchema,
  codexChatRequestSchema,
  codexResultResponseSchema,
  codexStatusResponseSchema,
  codexTransformRequestSchema,
  codexUpdateSettingsRequestSchema,
  wikiSearchResultResponseSchema,
} from '../schemas';

export function registerCodexIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
  codexService: CodexCliService,
): void {
  const codexApplicationService = new CodexApplicationService(sessionManager, codexService);

  ipcMain.handle(IPC_CHANNELS.codexStatus, async () => {
    const status = await codexApplicationService.getStatus();
    return codexStatusResponseSchema.parse(status);
  });

  ipcMain.handle(IPC_CHANNELS.codexGetSettings, async () => {
    const settings = await codexApplicationService.getSettings();
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS.codexUpdateSettings, async (_event, payload: unknown) => {
    const request = codexUpdateSettingsRequestSchema.parse(payload);
    const settings = await codexApplicationService.updateSettings(request);
    return settings;
  });

  ipcMain.handle(IPC_CHANNELS.codexAssist, async (_event, payload: unknown) => {
    const request = codexAssistRequestSchema.parse(payload);
    const result = await codexApplicationService.assist(request);
    return codexResultResponseSchema.parse(result);
  });

  ipcMain.handle(IPC_CHANNELS.codexTransformSelection, async (_event, payload: unknown) => {
    const request = codexTransformRequestSchema.parse(payload);
    const result = await codexApplicationService.transformSelection(request);
    return codexResultResponseSchema.parse(result);
  });

  ipcMain.handle(IPC_CHANNELS.codexChat, async (_event, payload: unknown) => {
    const request = codexChatRequestSchema.parse(payload);
    const result = await codexApplicationService.chat(request);
    return codexResultResponseSchema.parse({
      ...result,
      memorySources: z.array(wikiSearchResultResponseSchema).parse(result.memorySources),
    });
  });

  ipcMain.handle(IPC_CHANNELS.codexGetChatHistory, (_event, payload: unknown) => {
    const request = codexChatHistoryRequestSchema.parse(payload);
    const messages = codexApplicationService.getChatHistory(request);
    return z.array(codexChatMessageResponseSchema).parse(messages);
  });

  ipcMain.handle(IPC_CHANNELS.codexCancelActiveRequest, () => {
    const cancelled = codexApplicationService.cancelActiveRequest();
    return codexCancelResponseSchema.parse({ ok: true, cancelled });
  });
}
