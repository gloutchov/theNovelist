import { BrowserWindow, dialog, type IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import { APP_CONFIG } from '../../config/app-config';
import { translateMain } from '../../i18n';
import type { ProjectSessionManager } from '../../projects/session';
import { ProjectService } from '../../services/project-service';
import {
  projectCreateRequestSchema,
  projectInspectPathResponseSchema,
  projectOpenRequestSchema,
  projectPlanningUpdateRequestSchema,
  projectResponseSchema,
  readImageDataUrlRequestSchema,
  saveSnapshotRequestSchema,
  snapshotResponseSchema,
  successResponseSchema,
  writingSessionResponseSchema,
} from '../schemas';

export function registerProjectIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
): void {
  const projectService = new ProjectService(sessionManager);

  ipcMain.handle(IPC_CHANNELS.projectCreate, async (_event, payload: unknown) => {
    const request = projectCreateRequestSchema.parse(payload);
    const project = await projectService.createProject({
      rootPath: request.rootPath,
      name: request.name,
      targetWordCount: request.targetWordCount ?? null,
      targetChapterWordCount: request.targetChapterWordCount ?? null,
      plannedCompletionDate: request.plannedCompletionDate ?? null,
    });

    return projectResponseSchema.parse(project);
  });

  ipcMain.handle(IPC_CHANNELS.projectUpdatePlanning, async (_event, payload: unknown) => {
    const request = projectPlanningUpdateRequestSchema.parse(payload);
    const project = await projectService.updatePlanning({
      targetWordCount: request.targetWordCount,
      targetChapterWordCount: request.targetChapterWordCount,
      plannedCompletionDate: request.plannedCompletionDate,
    });
    return projectResponseSchema.parse(project);
  });

  ipcMain.handle(IPC_CHANNELS.projectOpen, async (_event, payload: unknown) => {
    const request = projectOpenRequestSchema.parse(payload);
    const project = await projectService.openProject(request.rootPath);
    return projectResponseSchema.parse(project);
  });

  ipcMain.handle(IPC_CHANNELS.projectClose, async () => {
    await projectService.closeProject();
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.projectInspectPath, async (_event, payload: unknown) => {
    const request = projectOpenRequestSchema.parse(payload);
    const result = await projectService.inspectPath(request.rootPath);
    return projectInspectPathResponseSchema.parse(result);
  });

  ipcMain.handle(IPC_CHANNELS.projectSelectDirectory, async (event) => {
    const forcedProjectDirectory = process.env['NOVELIST_TEST_PROJECT_DIRECTORY']?.trim();
    if (forcedProjectDirectory) {
      return forcedProjectDirectory;
    }

    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const openResult = browserWindow
      ? await dialog.showOpenDialog(browserWindow, {
          title: translateMain('dialog.directory.title'),
          buttonLabel: translateMain('dialog.directory.button'),
          properties: ['openDirectory', 'createDirectory'],
        })
      : await dialog.showOpenDialog({
          title: translateMain('dialog.directory.title'),
          buttonLabel: translateMain('dialog.directory.button'),
          properties: ['openDirectory', 'createDirectory'],
        });

    if (openResult.canceled) {
      return null;
    }

    const selectedPath = openResult.filePaths[0]?.trim();
    return selectedPath ? selectedPath : null;
  });

  ipcMain.handle(IPC_CHANNELS.projectSelectImageFile, async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const openResult = browserWindow
      ? await dialog.showOpenDialog(browserWindow, {
          title: translateMain('dialog.imageFile.title'),
          buttonLabel: translateMain('dialog.imageFile.button'),
          properties: ['openFile'],
          filters: [
            {
              name: translateMain('dialog.filter.images'),
              extensions: [...APP_CONFIG.images.importedExtensions],
            },
          ],
        })
      : await dialog.showOpenDialog({
          title: translateMain('dialog.imageFile.title'),
          buttonLabel: translateMain('dialog.imageFile.button'),
          properties: ['openFile'],
          filters: [
            {
              name: translateMain('dialog.filter.images'),
              extensions: [...APP_CONFIG.images.importedExtensions],
            },
          ],
        });

    if (openResult.canceled) {
      return null;
    }

    const selectedPath = openResult.filePaths[0]?.trim();
    return selectedPath ? selectedPath : null;
  });

  ipcMain.handle(IPC_CHANNELS.projectReadImageDataUrl, async (_event, payload: unknown) => {
    const request = readImageDataUrlRequestSchema.parse(payload);
    return projectService.readImageDataUrl(request.filePath);
  });

  ipcMain.handle(IPC_CHANNELS.projectGetCurrent, () => {
    const project = projectService.getCurrentProject();
    if (!project) {
      return null;
    }

    return projectResponseSchema.parse(project);
  });

  ipcMain.handle(IPC_CHANNELS.projectSaveSnapshot, async (_event, payload: unknown) => {
    const request = saveSnapshotRequestSchema.parse(payload ?? {});
    const snapshot = await projectService.saveSnapshot(request.reason);
    return snapshotResponseSchema.parse(snapshot);
  });

  ipcMain.handle(IPC_CHANNELS.projectListSnapshots, async () => {
    const snapshots = await projectService.listSnapshots();
    return z.array(snapshotResponseSchema).parse(snapshots);
  });

  ipcMain.handle(IPC_CHANNELS.projectListWritingSessions, () => {
    return z.array(writingSessionResponseSchema).parse(projectService.listWritingSessions());
  });

  ipcMain.handle(IPC_CHANNELS.projectRecoverLatestSnapshot, async () => {
    const snapshot = await projectService.recoverLatestSnapshot();
    if (!snapshot) {
      return null;
    }

    return snapshotResponseSchema.parse(snapshot);
  });
}
