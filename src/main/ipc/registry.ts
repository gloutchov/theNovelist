import type { IpcMain } from 'electron';
import { ALL_IPC_CHANNELS_BY_DOMAIN } from './channel-groups';

export function getRegisteredIpcChannelNames(): string[] {
  return [...ALL_IPC_CHANNELS_BY_DOMAIN];
}

export function clearRegisteredIpcHandlers(ipcMain: IpcMain): void {
  for (const channel of ALL_IPC_CHANNELS_BY_DOMAIN) {
    ipcMain.removeHandler(channel);
  }
}
