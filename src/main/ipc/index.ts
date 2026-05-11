import type { IpcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/ipc-channels';
import { CodexCliService } from '../codex/client';
import type { ProjectSessionManager } from '../projects/session';
import { resolveCodexRuntime, resolveImageApiRuntime } from '../services/codex-runtime';
import { registerAppIpcHandlers } from './handlers/app';
import { registerChapterIpcHandlers } from './handlers/chapter';
import { registerCharacterIpcHandlers } from './handlers/character';
import { registerCodexIpcHandlers } from './handlers/codex';
import { registerLocationIpcHandlers } from './handlers/location';
import { registerProjectIpcHandlers } from './handlers/project';
import { registerRevisionIpcHandlers } from './handlers/revision';
import { registerSceneIpcHandlers } from './handlers/scene';
import { registerStoryIpcHandlers } from './handlers/story';
import { registerTimelineIpcHandlers } from './handlers/timeline';
import { registerWikiIpcHandlers } from './handlers/wiki';
import { clearRegisteredIpcHandlers } from './registry';

export { IPC_CHANNELS };
export { shouldAttachProjectMemoryForSettings } from '../services/codex-runtime';
export { collectManuscriptChapters } from '../services/chapter-service';
export { buildPingResponse } from './handlers/app';

export type {
  PingRequest,
  PingResponse,
  AppPreferencesResponse,
  ProjectResponse,
  ProjectInspectPathResponse,
  SnapshotResponse,
  WritingSessionResponse,
  PlotResponse,
  ChapterNodeResponse,
  StoryEdgeResponse,
  StoryStateResponse,
  ChapterDocumentResponse,
  CharacterCardResponse,
  CharacterImageResponse,
  LocationCardResponse,
  LocationImageResponse,
  SceneCardResponse,
  TimelineStateResponse,
  TimelineSettingsResponse,
  TimelineItemResponse,
  EntityRevisionResponse,
  EntityRevisionCurrentResponse,
  CodexStatusResponse,
  CodexResultResponse,
  CodexSettingsResponse,
  CodexChatMessageResponse,
  WikiStatusResponse,
  WikiSyncResponse,
  WikiSearchResultResponse,
  WikiSourceContentResponse,
  RevisionEntityType,
} from './schemas';

const codexService = new CodexCliService();

export function registerIpcHandlers(ipcMain: IpcMain, sessionManager: ProjectSessionManager): void {
  clearRegisteredIpcHandlers(ipcMain);

  registerAppIpcHandlers(ipcMain);
  registerWikiIpcHandlers(ipcMain, sessionManager);
  registerTimelineIpcHandlers(ipcMain, sessionManager);
  registerStoryIpcHandlers(ipcMain, sessionManager);
  registerSceneIpcHandlers(ipcMain, sessionManager);
  registerRevisionIpcHandlers(ipcMain, sessionManager);
  registerCharacterIpcHandlers(ipcMain, sessionManager, resolveImageApiRuntime);
  registerLocationIpcHandlers(ipcMain, sessionManager, resolveImageApiRuntime);
  registerProjectIpcHandlers(ipcMain, sessionManager);
  registerChapterIpcHandlers(ipcMain, sessionManager, {
    codexService,
    resolveCodexRuntime,
  });
  registerCodexIpcHandlers(ipcMain, sessionManager, codexService);
}
