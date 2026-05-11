import type { IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import type { ProjectSessionManager } from '../../projects/session';
import { StoryService } from '../../services/story-service';
import {
  chapterNodeResponseSchema,
  createEdgeRequestSchema,
  createNodeRequestSchema,
  createPlotRequestSchema,
  deleteEdgeRequestSchema,
  deleteNodeRequestSchema,
  deletePlotRequestSchema,
  plotResponseSchema,
  storyEdgeResponseSchema,
  storyStateResponseSchema,
  successResponseSchema,
  updateNodeRequestSchema,
  updatePlotRequestSchema,
} from '../schemas';

export function registerStoryIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const storyService = new StoryService(sessionManager);

  ipcMain.handle(IPC_CHANNELS.storyGetState, () => {
    return storyStateResponseSchema.parse(storyService.getState());
  });

  ipcMain.handle(IPC_CHANNELS.storyCreatePlot, async (_event, payload: unknown) => {
    const request = createPlotRequestSchema.parse(payload);
    const plot = await storyService.createPlot({
      number: request.number,
      label: request.label,
      summary: request.summary,
      color: request.color,
      positionX: request.positionX,
      positionY: request.positionY,
    });

    return plotResponseSchema.parse(plot);
  });

  ipcMain.handle(IPC_CHANNELS.storyUpdatePlot, async (_event, payload: unknown) => {
    const request = updatePlotRequestSchema.parse(payload);
    const plot = await storyService.updatePlot(request.id, {
      label: request.label,
      summary: request.summary,
      color: request.color,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return plotResponseSchema.parse(plot);
  });

  ipcMain.handle(IPC_CHANNELS.storyDeletePlot, async (_event, payload: unknown) => {
    const request = deletePlotRequestSchema.parse(payload);
    await storyService.deletePlot(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.storyCreateNode, async (_event, payload: unknown) => {
    const request = createNodeRequestSchema.parse(payload);
    const node = await storyService.createNode({
      title: request.title,
      description: request.description,
      plotNumber: request.plotNumber,
      blockNumber: request.blockNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });

    return chapterNodeResponseSchema.parse(node);
  });

  ipcMain.handle(IPC_CHANNELS.storyUpdateNode, async (_event, payload: unknown) => {
    const request = updateNodeRequestSchema.parse(payload);
    const updated = await storyService.updateNode({
      id: request.id,
      title: request.title,
      description: request.description,
      plotNumber: request.plotNumber,
      blockNumber: request.blockNumber,
      positionX: request.positionX,
      positionY: request.positionY,
      richTextDocId: request.richTextDocId,
    });
    return chapterNodeResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.storyDeleteNode, async (_event, payload: unknown) => {
    const request = deleteNodeRequestSchema.parse(payload);
    await storyService.deleteNode(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.storyCreateEdge, (_event, payload: unknown) => {
    const request = createEdgeRequestSchema.parse(payload);
    const edge = storyService.createEdge({
      sourceId: request.sourceId,
      targetId: request.targetId,
      sourceHandle: request.sourceHandle,
      targetHandle: request.targetHandle,
      label: request.label ?? null,
    });

    return storyEdgeResponseSchema.parse(edge);
  });

  ipcMain.handle(IPC_CHANNELS.storyDeleteEdge, (_event, payload: unknown) => {
    const request = deleteEdgeRequestSchema.parse(payload);
    storyService.deleteEdge(request.id);
    return successResponseSchema.parse({ ok: true });
  });
}
