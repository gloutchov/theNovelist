import type { IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { getAppPreferences, updateAppPreferences } from '../../app-preferences';
import {
  appPreferencesResponseSchema,
  appPreferencesUpdateRequestSchema,
  pingRequestSchema,
  pingResponseSchema,
  type PingRequest,
  type PingResponse,
} from '../schemas';

export function buildPingResponse(request: PingRequest): PingResponse {
  return {
    message: `Pong: ${request.message}`,
    timestamp: new Date().toISOString(),
  };
}

export function registerAppIpcHandlers(ipcMain: IpcMain): void {
  ipcMain.handle(IPC_CHANNELS.ping, (_event, payload: unknown) => {
    const request = pingRequestSchema.parse(payload);
    const response = buildPingResponse(request);
    return pingResponseSchema.parse(response);
  });

  ipcMain.handle(IPC_CHANNELS.appGetPreferences, async () => {
    const preferences = await getAppPreferences();
    return appPreferencesResponseSchema.parse(preferences);
  });

  ipcMain.handle(IPC_CHANNELS.appUpdatePreferences, async (_event, payload: unknown) => {
    const request = appPreferencesUpdateRequestSchema.parse(payload);
    const preferences = await updateAppPreferences(request);
    return appPreferencesResponseSchema.parse(preferences);
  });
}
