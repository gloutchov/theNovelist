import { randomUUID } from 'node:crypto';
import { copyFile, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { shell } from 'electron';
import { APP_CONFIG } from '../config/app-config';
import type {
  CreateExternalSourceEdgeInput,
  ExternalSourceEdgeRecord,
  ExternalSourceRecord,
  UpdateExternalSourceInput,
} from '../persistence/types';
import { toProjectStoredFilePath, resolveProjectStoredFilePath } from '../projects/asset-paths';
import type { ProjectSessionManager } from '../projects/session';
import {
  buildExternalSourceSummary,
  extractExternalSourceText,
  isSupportedExternalSourceExtension,
  type ExtractedExternalSource,
} from '../sources/extraction';
import { extractPdfTextWithOpenAi } from '../sources/openai-pdf-ocr';
import { extractSpreadsheetTextWithOpenAi } from '../sources/openai-spreadsheet-analysis';
import { resolveCodexRuntime } from './codex-runtime';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';

export interface ExternalSourcesState {
  sources: ExternalSourceRecord[];
  edges: ExternalSourceEdgeRecord[];
}

export interface ImportExternalSourceInput {
  filePath: string;
  positionX: number;
  positionY: number;
}

export interface ImportExternalSourcesInput {
  files: ImportExternalSourceInput[];
  allowAiPdfOcr?: boolean;
  allowAiAnalysis?: boolean;
}

export interface UpdateExternalSourceServiceInput extends UpdateExternalSourceInput {
  id: string;
}

function sanitizeFileName(fileName: string): string {
  const sanitized = fileName
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();

  return sanitized || 'source';
}

async function copySourceFileToProject(input: {
  projectRootPath: string;
  assetsPath: string;
  sourceFilePath: string;
}): Promise<string> {
  const sourceStats = await stat(input.sourceFilePath);
  if (!sourceStats.isFile()) {
    throw new Error('External source must be a file');
  }
  if (sourceStats.size > APP_CONFIG.externalSources.maxImportBytes) {
    throw new Error('External source file is too large');
  }

  const extension = path.extname(input.sourceFilePath).replace(/^\./, '').toLowerCase();
  if (!isSupportedExternalSourceExtension(extension)) {
    throw new Error(`Unsupported file type: ${extension || 'unknown'}`);
  }

  const sourcesPath = path.join(input.assetsPath, APP_CONFIG.externalSources.dirName);
  await mkdir(sourcesPath, { recursive: true });

  const baseName = sanitizeFileName(path.basename(input.sourceFilePath, path.extname(input.sourceFilePath)));
  const fileName = `${baseName}-${randomUUID().slice(0, 8)}.${extension}`;
  const destinationPath = path.join(sourcesPath, fileName);
  await copyFile(input.sourceFilePath, destinationPath);

  return toProjectStoredFilePath(input.projectRootPath, destinationPath);
}

function shouldTryAiPdfOcr(input: {
  fileType: string;
  extractedText: string;
  allowAiAnalysis: boolean;
}): boolean {
  return (
    input.allowAiAnalysis &&
    input.fileType === 'pdf' &&
    input.extractedText.trim().length < APP_CONFIG.externalSources.pdfOcrMinCharacters
  );
}

function shouldTryAiSpreadsheetAnalysis(input: {
  fileType: string;
  extractedText: string;
  allowAiAnalysis: boolean;
}): boolean {
  const supportedSpreadsheetTypes = ['csv', 'tsv', 'xls', 'xlsx'];
  return (
    input.allowAiAnalysis &&
    supportedSpreadsheetTypes.includes(input.fileType) &&
    input.extractedText.trim().length < APP_CONFIG.externalSources.spreadsheetAiMinCharacters
  );
}

function markPartialExtraction(
  extracted: ExtractedExternalSource,
  message: string,
): ExtractedExternalSource {
  return {
    ...extracted,
    extractionStatus: extracted.text.trim() ? 'partial' : 'failed',
    extractionMessage: message,
  };
}

async function resolveOpenAiExtractionRuntime(input: {
  repository: ReturnType<ProjectSessionManager['getRepository']>;
  projectId: string;
}): Promise<{ apiKey: string; model: string } | { errorMessage: string }> {
  const runtime = await resolveCodexRuntime(input.repository, input.projectId);
  const apiKey = runtime.runtimeApiKey?.trim() || process.env['OPENAI_API_KEY']?.trim() || '';
  if (!runtime.settings.enabled) {
    return { errorMessage: 'externalSources.extractionMessage.aiDisabled' };
  }
  if (!runtime.settings.allowApiCalls) {
    return { errorMessage: 'externalSources.extractionMessage.apiCallsDisabled' };
  }
  if (runtime.settings.provider !== 'openai_api') {
    return { errorMessage: 'externalSources.extractionMessage.openAiProviderRequired' };
  }
  if (!apiKey) {
    return { errorMessage: 'externalSources.extractionMessage.apiKeyMissing' };
  }

  return {
    apiKey,
    model: runtime.settings.apiModel.trim() || APP_CONFIG.ai.defaultApiModel,
  };
}

async function tryPdfAiOcr(input: {
  extracted: ExtractedExternalSource;
  filePath: string;
  repository: ReturnType<ProjectSessionManager['getRepository']>;
  projectId: string;
}): Promise<ExtractedExternalSource> {
  const sourceStats = await stat(input.filePath);
  if (sourceStats.size > APP_CONFIG.externalSources.maxAiOcrBytes) {
    return markPartialExtraction(
      input.extracted,
      'externalSources.extractionMessage.pdfOcrSizeLimit',
    );
  }

  try {
    const runtime = await resolveOpenAiExtractionRuntime({
      repository: input.repository,
      projectId: input.projectId,
    });
    if ('errorMessage' in runtime) {
      return markPartialExtraction(input.extracted, runtime.errorMessage);
    }

    const ocrText = (
      await extractPdfTextWithOpenAi({
        apiKey: runtime.apiKey,
        model: runtime.model,
        filePath: input.filePath,
      })
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, APP_CONFIG.externalSources.maxIndexedCharacters);

    return ocrText
      ? {
          ...input.extracted,
          text: ocrText,
          summary: buildExternalSourceSummary(ocrText, path.basename(input.filePath)),
          extractionMethod: 'ai_ocr',
          extractionStatus: 'indexed',
          extractionMessage: 'externalSources.extractionMessage.aiOcrIndexed',
        }
      : markPartialExtraction(input.extracted, 'externalSources.extractionMessage.aiOcrEmpty');
  } catch (caughtError) {
    return markPartialExtraction(
      input.extracted,
      caughtError instanceof Error
        ? `externalSources.extractionMessage.aiOcrFailed: ${caughtError.message}`
        : 'externalSources.extractionMessage.aiOcrFailed',
    );
  }
}

async function trySpreadsheetAiAnalysis(input: {
  extracted: ExtractedExternalSource;
  filePath: string;
  repository: ReturnType<ProjectSessionManager['getRepository']>;
  projectId: string;
}): Promise<ExtractedExternalSource> {
  try {
    const runtime = await resolveOpenAiExtractionRuntime({
      repository: input.repository,
      projectId: input.projectId,
    });
    if ('errorMessage' in runtime) {
      return markPartialExtraction(input.extracted, runtime.errorMessage);
    }

    const analyzedText = (
      await extractSpreadsheetTextWithOpenAi({
        apiKey: runtime.apiKey,
        model: runtime.model,
        filePath: input.filePath,
      })
    )
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, APP_CONFIG.externalSources.maxIndexedCharacters);

    return analyzedText
      ? {
          ...input.extracted,
          text: analyzedText,
          summary: buildExternalSourceSummary(analyzedText, path.basename(input.filePath)),
          extractionMethod: 'ai_analysis',
          extractionStatus: 'indexed',
          extractionMessage: 'externalSources.extractionMessage.spreadsheetAiIndexed',
        }
      : markPartialExtraction(
          input.extracted,
          'externalSources.extractionMessage.spreadsheetAiEmpty',
        );
  } catch (caughtError) {
    return markPartialExtraction(
      input.extracted,
      caughtError instanceof Error &&
        caughtError.message.startsWith('externalSources.extractionMessage.')
        ? caughtError.message
        : caughtError instanceof Error
          ? `externalSources.extractionMessage.spreadsheetAiFailed: ${caughtError.message}`
          : 'externalSources.extractionMessage.spreadsheetAiFailed',
    );
  }
}

export class ExternalSourceService {
  constructor(private readonly sessionManager: ProjectSessionManager) {}

  getState(): ExternalSourcesState {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return {
      sources: repository.listExternalSources(projectId),
      edges: repository.listExternalSourceEdges(projectId),
    };
  }

  async importSources(input: ImportExternalSourcesInput): Promise<ExternalSourceRecord[]> {
    const completeImport = this.sessionManager.beginExternalSourceImport();
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const project = this.sessionManager.getOpenedProject();
    if (!project) {
      completeImport();
      throw new Error('No open project session');
    }

    try {
      const imported: ExternalSourceRecord[] = [];
      for (const [index, file] of input.files.entries()) {
        const sourceFilePath = path.resolve(file.filePath);
        let extracted = await extractExternalSourceText(sourceFilePath);
        const allowAiAnalysis = Boolean(input.allowAiAnalysis ?? input.allowAiPdfOcr);
        if (
          shouldTryAiPdfOcr({
            fileType: extracted.fileType,
            extractedText: extracted.text,
            allowAiAnalysis,
          })
        ) {
          extracted = await tryPdfAiOcr({
            extracted,
            filePath: sourceFilePath,
            repository,
            projectId,
          });
        } else if (
          shouldTryAiSpreadsheetAnalysis({
            fileType: extracted.fileType,
            extractedText: extracted.text,
            allowAiAnalysis: Boolean(input.allowAiAnalysis),
          })
        ) {
          extracted = await trySpreadsheetAiAnalysis({
            extracted,
            filePath: sourceFilePath,
            repository,
            projectId,
          });
        } else if (extracted.fileType === 'pdf' && !extracted.text.trim() && !allowAiAnalysis) {
          extracted = markPartialExtraction(
            extracted,
            'externalSources.extractionMessage.pdfOcrSkippedNoConsent',
          );
        } else if (
          ['csv', 'tsv', 'xls', 'xlsx'].includes(extracted.fileType) &&
          !extracted.text.trim() &&
          !input.allowAiAnalysis
        ) {
          extracted = markPartialExtraction(
            extracted,
            'externalSources.extractionMessage.spreadsheetAiSkippedNoConsent',
          );
        }
        const storedFilePath = await copySourceFileToProject({
          projectRootPath: project.rootPath,
          assetsPath: project.assetsPath,
          sourceFilePath,
        });

        imported.push(
          repository.createExternalSource(projectId, {
            fileName: path.basename(sourceFilePath),
            fileType: extracted.fileType,
            storedFilePath,
            originalFilePath: sourceFilePath,
            summary: extracted.summary,
            extractedText: extracted.text,
            extractionMethod: extracted.extractionMethod,
            extractionStatus: extracted.extractionStatus,
            extractionMessage: extracted.extractionMessage,
            positionX: file.positionX + (index % 3) * 340,
            positionY: file.positionY + Math.floor(index / 3) * 180,
          }),
        );
      }

      await syncProjectWikiSourcesBestEffort(this.sessionManager);
      return imported;
    } finally {
      completeImport();
    }
  }

  updateSource(input: UpdateExternalSourceServiceInput): ExternalSourceRecord {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const existing = repository.getExternalSourceById(input.id);
    if (!existing || existing.projectId !== projectId) {
      throw new Error('External source not found');
    }

    return repository.updateExternalSource(input.id, {
      positionX: input.positionX,
      positionY: input.positionY,
    });
  }

  async deleteSource(id: string): Promise<void> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const project = this.sessionManager.getOpenedProject();
    const existing = repository.getExternalSourceById(id);
    if (!existing || existing.projectId !== projectId || !project) {
      throw new Error('External source not found');
    }

    repository.deleteExternalSource(id);
    const absolutePath = resolveProjectStoredFilePath({
      projectRootPath: project.rootPath,
      assetsPath: project.assetsPath,
      filePath: existing.storedFilePath,
    });
    await rm(absolutePath, { force: true });
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
  }

  async openSource(id: string): Promise<void> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const project = this.sessionManager.getOpenedProject();
    const existing = repository.getExternalSourceById(id);
    if (!existing || existing.projectId !== projectId || !project) {
      throw new Error('External source not found');
    }

    const absolutePath = resolveProjectStoredFilePath({
      projectRootPath: project.rootPath,
      assetsPath: project.assetsPath,
      filePath: existing.storedFilePath,
    });
    const openError = await shell.openPath(absolutePath);
    if (openError) {
      throw new Error(openError);
    }
  }

  createEdge(input: CreateExternalSourceEdgeInput): ExternalSourceEdgeRecord {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const source = repository.getExternalSourceById(input.sourceId);
    const target = repository.getExternalSourceById(input.targetId);
    if (!source || source.projectId !== projectId) {
      throw new Error('External source not found');
    }
    if (!target || target.projectId !== projectId) {
      throw new Error('External target source not found');
    }

    const edge = repository.createExternalSourceEdge(projectId, input);
    void syncProjectWikiSourcesBestEffort(this.sessionManager);
    return edge;
  }

  deleteEdge(id: string): void {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deleteExternalSourceEdge(id);
    void syncProjectWikiSourcesBestEffort(this.sessionManager);
  }
}
