import type { IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import { TimelineService } from '../../services/timeline-service';
import {
  timelineItemResponseSchema,
  timelineItemUpdateRequestSchema,
  timelineSettingsResponseSchema,
  timelineSettingsUpdateRequestSchema,
  timelineStateResponseSchema,
} from '../schemas';

export function registerTimelineIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const timelineService = new TimelineService(sessionManager);

  ipcMain.handle(IPC_CHANNELS.timelineGetState, () => {
    return timelineStateResponseSchema.parse(timelineService.getState());
  });

  ipcMain.handle(IPC_CHANNELS.timelineUpdateSettings, (_event, payload: unknown) => {
    const request = timelineSettingsUpdateRequestSchema.parse(payload);
    return timelineSettingsResponseSchema.parse(
      timelineService.updateSettings({
        startLabel: request.startLabel,
        endLabel: request.endLabel,
        timelineEndX: request.timelineEndX,
      }),
    );
  });

  ipcMain.handle(IPC_CHANNELS.timelineUpdateItem, (_event, payload: unknown) => {
    const request = timelineItemUpdateRequestSchema.parse(payload);
    return timelineItemResponseSchema.parse(
      timelineService.updateItem({
        itemType: request.itemType,
        entityId: request.entityId,
        positionX: request.positionX,
        positionY: request.positionY,
        dateLabel: request.dateLabel,
      }),
    );
  });
}
