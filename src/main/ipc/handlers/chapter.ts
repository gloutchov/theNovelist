import { BrowserWindow, dialog, type IpcMain } from 'electron';
import { z } from 'zod';
import { IPC_CHANNELS } from '../../../shared/ipc-channels';
import {
  buildChapterPrintHtml,
  buildManuscriptPrintHtml,
  exportManuscriptToDocx,
  exportManuscriptToEpub,
  exportRichTextToDocx,
  getDefaultExportName,
} from '../../chapters/exporters';
import type { CodexCliService } from '../../codex/client';
import type { ProjectSessionManager } from '../../projects/session';
import { ChapterService } from '../../services/chapter-service';
import {
  chapterDocumentResponseSchema,
  chapterExportRequestSchema,
  chapterGetDocumentRequestSchema,
  chapterReferenceRequestSchema,
  chapterSaveDocumentRequestSchema,
  characterCardResponseSchema,
  exportResponseSchema,
  locationCardResponseSchema,
  sceneCardResponseSchema,
  successResponseSchema,
} from '../schemas';

type Repository = ReturnType<ProjectSessionManager['getRepository']>;

interface ChapterCodexRuntime {
  settings: {
    autoSummarizeDescriptions: boolean;
    enabled: boolean;
    provider: 'openai_api' | 'ollama';
    fallbackProvider: 'openai_api' | 'ollama' | 'none';
    allowApiCalls: boolean;
    apiModel: string;
    ollamaModel: string;
  };
  runtimeApiKey: string | null;
}

export interface ChapterIpcDependencies {
  codexService: Pick<CodexCliService, 'chat'>;
  resolveCodexRuntime: (repository: Repository, projectId: string) => Promise<ChapterCodexRuntime>;
}

async function printHtmlContent(html: string): Promise<boolean> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const printed = await new Promise<boolean>((resolve, reject) => {
      printWindow.webContents.print(
        {
          printBackground: true,
          pageSize: 'A4',
        },
        (success, errorType) => {
          if (!success && errorType && !errorType.toLowerCase().includes('cancel')) {
            reject(new Error(`Errore stampa: ${errorType}`));
            return;
          }
          resolve(success);
        },
      );
    });
    return printed;
  } finally {
    printWindow.destroy();
  }
}

export function registerChapterIpcHandlers(
  ipcMain: IpcMain,
  sessionManager: ProjectSessionManager,
  dependencies: ChapterIpcDependencies,
): void {
  const chapterService = new ChapterService(sessionManager, dependencies);

  ipcMain.handle(IPC_CHANNELS.chapterGetDocument, (_event, payload: unknown) => {
    const request = chapterGetDocumentRequestSchema.parse(payload);
    const document = chapterService.getDocument(request.chapterNodeId);
    return chapterDocumentResponseSchema.parse(document);
  });

  ipcMain.handle(IPC_CHANNELS.chapterSaveDocument, async (_event, payload: unknown) => {
    const request = chapterSaveDocumentRequestSchema.parse(payload);
    const saved = await chapterService.saveDocument({
      chapterNodeId: request.chapterNodeId,
      contentJson: request.contentJson,
    });
    return chapterDocumentResponseSchema.parse(saved);
  });

  ipcMain.handle(IPC_CHANNELS.chapterExportDocx, async (event, payload: unknown) => {
    const request = chapterExportRequestSchema.parse(payload);
    const node = chapterService.getChapterNode(request.chapterNodeId);
    const document = chapterService.getChapterExportDocument(
      request.chapterNodeId,
      node.description,
    );
    const project = sessionManager.getOpenedProject();
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const saveDialogOptions = {
      defaultPath: project
        ? `${project.assetsPath}/${getDefaultExportName(node.title, 'docx')}`
        : getDefaultExportName(node.title, 'docx'),
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    };
    const saveResult = browserWindow
      ? await dialog.showSaveDialog(browserWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);
    if (saveResult.canceled || !saveResult.filePath) {
      return null;
    }

    await exportRichTextToDocx({
      title: node.title,
      projectTitle: chapterService.getProjectPrintTitle(),
      document,
      outputPath: saveResult.filePath,
    });

    return exportResponseSchema.parse({ filePath: saveResult.filePath });
  });

  ipcMain.handle(IPC_CHANNELS.chapterPrint, async (_event, payload: unknown) => {
    const request = chapterExportRequestSchema.parse(payload);
    const node = chapterService.getChapterNode(request.chapterNodeId);
    const document = chapterService.getChapterExportDocument(
      request.chapterNodeId,
      node.description,
    );
    const html = buildChapterPrintHtml({
      title: node.title,
      projectTitle: chapterService.getProjectPrintTitle(),
      document,
    });
    const printed = await printHtmlContent(html);
    return printed ? successResponseSchema.parse({ ok: true }) : null;
  });

  ipcMain.handle(IPC_CHANNELS.manuscriptExportEpub, async (event) => {
    const chapters = chapterService.getManuscriptChapters();
    if (chapters.length === 0) {
      throw new Error('Nessun blocco disponibile per esportare il documento completo.');
    }

    const manuscriptTitle = chapterService.getManuscriptTitle();
    const project = sessionManager.getOpenedProject();
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const saveDialogOptions = {
      defaultPath: project
        ? `${project.assetsPath}/${getDefaultExportName(manuscriptTitle, 'epub')}`
        : getDefaultExportName(manuscriptTitle, 'epub'),
      filters: [{ name: 'EPUB', extensions: ['epub'] }],
    };
    const saveResult = browserWindow
      ? await dialog.showSaveDialog(browserWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);
    if (saveResult.canceled || !saveResult.filePath) {
      return null;
    }

    await exportManuscriptToEpub({
      title: manuscriptTitle,
      chapters,
      outputPath: saveResult.filePath,
    });
    return exportResponseSchema.parse({ filePath: saveResult.filePath });
  });

  ipcMain.handle(IPC_CHANNELS.manuscriptExportDocx, async (event) => {
    const chapters = chapterService.getManuscriptChapters();
    if (chapters.length === 0) {
      throw new Error('Nessun blocco disponibile per esportare il documento completo.');
    }

    const manuscriptTitle = chapterService.getManuscriptTitle();
    const project = sessionManager.getOpenedProject();
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const saveDialogOptions = {
      defaultPath: project
        ? `${project.assetsPath}/${getDefaultExportName(manuscriptTitle, 'docx')}`
        : getDefaultExportName(manuscriptTitle, 'docx'),
      filters: [{ name: 'Word Document', extensions: ['docx'] }],
    };
    const saveResult = browserWindow
      ? await dialog.showSaveDialog(browserWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);
    if (saveResult.canceled || !saveResult.filePath) {
      return null;
    }

    await exportManuscriptToDocx({
      title: manuscriptTitle,
      projectTitle: chapterService.getProjectPrintTitle(),
      chapters,
      outputPath: saveResult.filePath,
    });
    return exportResponseSchema.parse({ filePath: saveResult.filePath });
  });

  ipcMain.handle(IPC_CHANNELS.manuscriptPrint, async () => {
    const chapters = chapterService.getManuscriptChapters();
    if (chapters.length === 0) {
      throw new Error('Nessun blocco disponibile per la stampa del documento completo.');
    }

    const html = buildManuscriptPrintHtml({
      title: chapterService.getManuscriptTitle(),
      projectTitle: chapterService.getProjectPrintTitle(),
      chapters,
    });
    const printed = await printHtmlContent(html);
    return printed ? successResponseSchema.parse({ ok: true }) : null;
  });

  ipcMain.handle(IPC_CHANNELS.chapterListCharacters, (_event, payload: unknown) => {
    const request = chapterReferenceRequestSchema.parse(payload);
    const linkedCharacters = chapterService.listCharacters(request.chapterNodeId);
    return z.array(characterCardResponseSchema).parse(linkedCharacters);
  });

  ipcMain.handle(IPC_CHANNELS.chapterListLocations, (_event, payload: unknown) => {
    const request = chapterReferenceRequestSchema.parse(payload);
    const linkedLocations = chapterService.listLocations(request.chapterNodeId);
    return z.array(locationCardResponseSchema).parse(linkedLocations);
  });

  ipcMain.handle(IPC_CHANNELS.chapterListScenes, (_event, payload: unknown) => {
    const request = chapterReferenceRequestSchema.parse(payload);
    const scenes = chapterService.listScenes(request.chapterNodeId);
    return z.array(sceneCardResponseSchema).parse(scenes);
  });
}
