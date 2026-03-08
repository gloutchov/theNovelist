import { BrowserWindow, dialog, type IpcMain } from 'electron';
import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import {
  buildChapterPrintHtml,
  buildManuscriptPrintHtml,
  exportManuscriptToDocx,
  exportManuscriptToPdf,
  exportRichTextToDocx,
  exportRichTextToPdf,
  getDefaultExportName,
} from './chapters/exporters';
import {
  createEmptyRichTextDocument,
  extractRichTextBlocks,
  getWordCountFromDocument,
  type RichTextDocument,
} from './chapters/rich-text';
import { CodexCliService, type CodexTransformAction } from './codex/client';
import {
  generateImageWithApi,
  importImageToProject,
  saveGeneratedImageToProject,
  type GeneratedImageSize,
} from './images/generation';
import { openProjectFromDisk, projectExists } from './projects/project-files';
import type { ProjectSessionManager } from './projects/session';
import {
  clearStoredCodexApiKey,
  getStoredCodexApiKey,
  isSecureStorageAvailable,
  setStoredCodexApiKey,
} from './security/secure-settings';

export const IPC_CHANNELS = {
  ping: 'app:ping',
  projectCreate: 'project:create',
  projectOpen: 'project:open',
  projectInspectPath: 'project:inspect-path',
  projectSelectDirectory: 'project:select-directory',
  projectSelectImageFile: 'project:select-image-file',
  projectReadImageDataUrl: 'project:read-image-data-url',
  projectGetCurrent: 'project:get-current',
  projectSaveSnapshot: 'project:save-snapshot',
  projectListSnapshots: 'project:list-snapshots',
  projectRecoverLatestSnapshot: 'project:recover-latest-snapshot',
  storyGetState: 'story:get-state',
  storyCreatePlot: 'story:create-plot',
  storyCreateNode: 'story:create-node',
  storyUpdateNode: 'story:update-node',
  storyDeleteNode: 'story:delete-node',
  storyCreateEdge: 'story:create-edge',
  storyDeleteEdge: 'story:delete-edge',
  chapterGetDocument: 'chapter:get-document',
  chapterSaveDocument: 'chapter:save-document',
  chapterExportDocx: 'chapter:export-docx',
  chapterExportPdf: 'chapter:export-pdf',
  chapterPrint: 'chapter:print',
  manuscriptExportDocx: 'manuscript:export-docx',
  manuscriptExportPdf: 'manuscript:export-pdf',
  manuscriptPrint: 'manuscript:print',
  chapterListCharacters: 'chapter:list-characters',
  chapterListLocations: 'chapter:list-locations',
  characterListCards: 'character:list-cards',
  characterCreateCard: 'character:create-card',
  characterUpdateCard: 'character:update-card',
  characterDeleteCard: 'character:delete-card',
  characterListChapterLinks: 'character:list-chapter-links',
  characterSetChapterLinks: 'character:set-chapter-links',
  characterGenerateImage: 'character:generate-image',
  characterListImages: 'character:list-images',
  characterCreateImage: 'character:create-image',
  characterDeleteImage: 'character:delete-image',
  locationListCards: 'location:list-cards',
  locationCreateCard: 'location:create-card',
  locationUpdateCard: 'location:update-card',
  locationDeleteCard: 'location:delete-card',
  locationListChapterLinks: 'location:list-chapter-links',
  locationSetChapterLinks: 'location:set-chapter-links',
  locationGenerateImage: 'location:generate-image',
  locationListImages: 'location:list-images',
  locationCreateImage: 'location:create-image',
  locationDeleteImage: 'location:delete-image',
  codexStatus: 'codex:status',
  codexGetSettings: 'codex:get-settings',
  codexUpdateSettings: 'codex:update-settings',
  codexAssist: 'codex:assist',
  codexTransformSelection: 'codex:transform-selection',
  codexChat: 'codex:chat',
  codexGetChatHistory: 'codex:get-chat-history',
  codexCancelActiveRequest: 'codex:cancel-active-request',
} as const;

const pingRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

const pingResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

const projectCreateRequestSchema = z.object({
  rootPath: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
});

const projectOpenRequestSchema = z.object({
  rootPath: z.string().trim().min(1),
});

const projectInspectPathResponseSchema = z.object({
  exists: z.boolean(),
  projectName: z.string().nullable(),
});

const readImageDataUrlRequestSchema = z.object({
  filePath: z.string().trim().min(1).max(5_000),
});

const saveSnapshotRequestSchema = z.object({
  reason: z.string().trim().max(80).optional(),
});

const createPlotRequestSchema = z.object({
  number: z.number().int().min(1),
  label: z.string().trim().min(1).max(120).optional(),
  color: z.string().trim().min(3).max(40).optional(),
});

const createNodeRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4_000).default(''),
  plotNumber: z.number().int().min(1),
  blockNumber: z.number().int().min(1).optional(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

const updateNodeRequestSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4_000),
  plotNumber: z.number().int().min(1),
  blockNumber: z.number().int().min(1),
  positionX: z.number(),
  positionY: z.number(),
  richTextDocId: z.string().trim().min(1).nullable().optional(),
});

const deleteNodeRequestSchema = z.object({
  id: z.string().trim().min(1),
});

const createEdgeRequestSchema = z.object({
  sourceNodeId: z.string().trim().min(1),
  targetNodeId: z.string().trim().min(1),
  label: z.string().trim().max(200).optional(),
});

const deleteEdgeRequestSchema = z.object({
  id: z.string().trim().min(1),
});

const chapterGetDocumentRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
});

const chapterSaveDocumentRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
  contentJson: z.string().min(1),
  wordCount: z.number().int().min(0).optional(),
});

const chapterExportRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
});

const chapterReferenceRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
});

const createCharacterCardRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).default(''),
  sex: z.string().trim().max(50).default(''),
  age: z.number().int().min(0).max(130).nullable().optional(),
  sexualOrientation: z.string().trim().max(120).default(''),
  species: z.string().trim().max(120).default(''),
  hairColor: z.string().trim().max(120).default(''),
  bald: z.boolean().default(false),
  beard: z.string().trim().max(120).default(''),
  physique: z.string().trim().max(120).default(''),
  job: z.string().trim().max(160).default(''),
  notes: z.string().trim().max(6_000).default(''),
  plotNumber: z.number().int().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

const updateCharacterCardRequestSchema = createCharacterCardRequestSchema.extend({
  id: z.string().trim().min(1),
});

const deleteCharacterCardRequestSchema = z.object({
  id: z.string().trim().min(1),
});

const listCharacterChapterLinksRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
});

const setCharacterChapterLinksRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
  chapterNodeIds: z.array(z.string().trim().min(1)).max(2_000),
});

const listCharacterImagesRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
});

const createCharacterImageRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  filePath: z.string().trim().min(1),
  prompt: z.string().trim().max(4_000).default(''),
});

const generateCharacterImageRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(4_000),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1024x1024'),
});

const deleteCharacterImageRequestSchema = z.object({
  id: z.string().trim().min(1),
});

const createLocationCardRequestSchema = z.object({
  name: z.string().trim().min(1).max(180),
  locationType: z.string().trim().max(120).default(''),
  description: z.string().trim().max(6_000).default(''),
  notes: z.string().trim().max(6_000).default(''),
  plotNumber: z.number().int().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

const updateLocationCardRequestSchema = createLocationCardRequestSchema.extend({
  id: z.string().trim().min(1),
});

const deleteLocationCardRequestSchema = z.object({
  id: z.string().trim().min(1),
});

const listLocationChapterLinksRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
});

const setLocationChapterLinksRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
  chapterNodeIds: z.array(z.string().trim().min(1)).max(2_000),
});

const listLocationImagesRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
});

const createLocationImageRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  filePath: z.string().trim().min(1),
  prompt: z.string().trim().max(4_000).default(''),
});

const generateLocationImageRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(4_000),
  size: z.enum(['1024x1024', '1536x1024', '1024x1536']).default('1024x1024'),
});

const deleteLocationImageRequestSchema = z.object({
  id: z.string().trim().min(1),
});

const codexTransformRequestSchema = z.object({
  action: z.enum(['correggi', 'riscrivi', 'espandi', 'riduci']),
  selectedText: z.string().trim().min(1),
  chapterTitle: z.string().trim().optional(),
  projectName: z.string().trim().optional(),
  chapterText: z.string().optional(),
});

const codexAssistRequestSchema = z.object({
  message: z.string().trim().min(1),
  context: z.string().trim().max(10_000).optional(),
  projectName: z.string().trim().optional(),
});

const codexChatRequestSchema = z.object({
  message: z.string().trim().min(1),
  chapterNodeId: z.string().trim().min(1),
  chapterTitle: z.string().trim().optional(),
  projectName: z.string().trim().optional(),
  chapterText: z.string().optional(),
});

const codexUpdateSettingsRequestSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['codex_cli', 'openai_api', 'ollama']).optional(),
  allowApiCalls: z.boolean().optional(),
  autoSummarizeDescriptions: z.boolean().optional(),
  apiKey: z.string().max(500).nullable().optional(),
  clearStoredApiKey: z.boolean().optional(),
  apiModel: z.string().trim().max(120).optional(),
});

const codexChatHistoryRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
  limit: z.number().int().min(1).max(500).optional(),
});

const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  dbPath: z.string(),
  assetsPath: z.string(),
  snapshotsPath: z.string(),
});

const snapshotResponseSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  createdAt: z.string(),
  reason: z.string(),
});

const plotResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  number: z.number().int(),
  label: z.string(),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const chapterNodeResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string(),
  plotNumber: z.number().int(),
  blockNumber: z.number().int(),
  positionX: z.number(),
  positionY: z.number(),
  richTextDocId: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const chapterEdgeResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceNodeId: z.string(),
  targetNodeId: z.string(),
  label: z.string().nullable(),
  createdAt: z.string(),
});

const storyStateResponseSchema = z.object({
  plots: z.array(plotResponseSchema),
  nodes: z.array(chapterNodeResponseSchema),
  edges: z.array(chapterEdgeResponseSchema),
});

const chapterDocumentResponseSchema = z.object({
  id: z.string(),
  chapterNodeId: z.string(),
  contentJson: z.string(),
  wordCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const characterCardResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  sex: z.string(),
  age: z.number().int().nullable(),
  sexualOrientation: z.string(),
  species: z.string(),
  hairColor: z.string(),
  bald: z.boolean(),
  beard: z.string(),
  physique: z.string(),
  job: z.string(),
  notes: z.string(),
  plotNumber: z.number().int(),
  positionX: z.number(),
  positionY: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const characterImageResponseSchema = z.object({
  id: z.string(),
  characterCardId: z.string(),
  imageType: z.string(),
  filePath: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
});

const locationCardResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  locationType: z.string(),
  description: z.string(),
  notes: z.string(),
  plotNumber: z.number().int(),
  positionX: z.number(),
  positionY: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const locationImageResponseSchema = z.object({
  id: z.string(),
  locationCardId: z.string(),
  imageType: z.string(),
  filePath: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
});

const chapterLinkIdsResponseSchema = z.array(z.string());

const exportResponseSchema = z.object({
  filePath: z.string(),
});

const codexStatusResponseSchema = z.object({
  available: z.boolean(),
  command: z.string(),
  mode: z.enum(['cli', 'api', 'fallback']),
  reason: z.string().optional(),
  activeRequest: z.boolean(),
  queuedRequests: z.number().int().min(0),
  provider: z.enum(['codex_cli', 'openai_api', 'ollama']),
  apiCallsEnabled: z.boolean(),
});

const codexResultResponseSchema = z.object({
  output: z.string(),
  mode: z.enum(['cli', 'api', 'fallback']),
  usedCommand: z.string().optional(),
  error: z.string().optional(),
  cancelled: z.boolean().optional(),
});

const codexSettingsResponseSchema = z.object({
  projectId: z.string(),
  enabled: z.boolean(),
  provider: z.enum(['codex_cli', 'openai_api', 'ollama']),
  allowApiCalls: z.boolean(),
  autoSummarizeDescriptions: z.boolean(),
  apiKey: z.string().nullable(),
  hasStoredApiKey: z.boolean(),
  hasRuntimeApiKey: z.boolean(),
  apiKeyStorage: z.enum(['secure_storage', 'legacy_db', 'none']),
  apiModel: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const codexChatMessageResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  chapterNodeId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  mode: z.enum(['cli', 'fallback']).nullable(),
  createdAt: z.string(),
});

const codexCancelResponseSchema = z.object({
  ok: z.literal(true),
  cancelled: z.boolean(),
});

const successResponseSchema = z.object({ ok: z.literal(true) });

export type PingRequest = z.infer<typeof pingRequestSchema>;
export type PingResponse = z.infer<typeof pingResponseSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type ProjectInspectPathResponse = z.infer<typeof projectInspectPathResponseSchema>;
export type SnapshotResponse = z.infer<typeof snapshotResponseSchema>;
export type PlotResponse = z.infer<typeof plotResponseSchema>;
export type ChapterNodeResponse = z.infer<typeof chapterNodeResponseSchema>;
export type ChapterEdgeResponse = z.infer<typeof chapterEdgeResponseSchema>;
export type StoryStateResponse = z.infer<typeof storyStateResponseSchema>;
export type ChapterDocumentResponse = z.infer<typeof chapterDocumentResponseSchema>;
export type CharacterCardResponse = z.infer<typeof characterCardResponseSchema>;
export type CharacterImageResponse = z.infer<typeof characterImageResponseSchema>;
export type LocationCardResponse = z.infer<typeof locationCardResponseSchema>;
export type LocationImageResponse = z.infer<typeof locationImageResponseSchema>;
export type CodexStatusResponse = z.infer<typeof codexStatusResponseSchema>;
export type CodexResultResponse = z.infer<typeof codexResultResponseSchema>;
export type CodexSettingsResponse = z.infer<typeof codexSettingsResponseSchema>;
export type CodexChatMessageResponse = z.infer<typeof codexChatMessageResponseSchema>;

export function buildPingResponse(request: PingRequest): PingResponse {
  return {
    message: `Pong: ${request.message}`,
    timestamp: new Date().toISOString(),
  };
}

function toProjectResponse(input: {
  project: { id: string; name: string };
  rootPath: string;
  dbPath: string;
  assetsPath: string;
  snapshotsPath: string;
}): ProjectResponse {
  return {
    id: input.project.id,
    name: input.project.name,
    rootPath: input.rootPath,
    dbPath: input.dbPath,
    assetsPath: input.assetsPath,
    snapshotsPath: input.snapshotsPath,
  };
}

function colorFromPlotNumber(plotNumber: number): string {
  const palette = [
    '#2563eb',
    '#16a34a',
    '#dc2626',
    '#9333ea',
    '#ea580c',
    '#0d9488',
    '#4f46e5',
    '#ca8a04',
    '#0891b2',
    '#be123c',
  ];

  return palette[(plotNumber - 1) % palette.length] ?? '#6b7280';
}

function getStoryContext(sessionManager: ProjectSessionManager): {
  repository: ReturnType<ProjectSessionManager['getRepository']>;
  projectId: string;
} {
  return {
    repository: sessionManager.getRepository(),
    projectId: sessionManager.getCurrentProjectId(),
  };
}

type Repository = ReturnType<ProjectSessionManager['getRepository']>;
type CodexSettingsRecord = ReturnType<Repository['getOrCreateCodexSettings']>;

interface ResolvedCodexRuntime {
  settings: CodexSettingsRecord;
  runtimeApiKey: string | null;
  apiKeyStorage: 'secure_storage' | 'legacy_db' | 'none';
}

async function resolveCodexRuntime(repository: Repository, projectId: string): Promise<ResolvedCodexRuntime> {
  let settings = repository.getOrCreateCodexSettings(projectId);
  let runtimeApiKey: string | null = null;
  let apiKeyStorage: ResolvedCodexRuntime['apiKeyStorage'] = 'none';

  runtimeApiKey = await getStoredCodexApiKey(projectId);
  if (runtimeApiKey?.trim()) {
    apiKeyStorage = 'secure_storage';
  }

  const legacyApiKey = settings.apiKey?.trim() ?? '';
  if (!runtimeApiKey && legacyApiKey) {
    if (isSecureStorageAvailable()) {
      await setStoredCodexApiKey(projectId, legacyApiKey);
      repository.upsertCodexSettings(projectId, { apiKey: null });
      settings = repository.getOrCreateCodexSettings(projectId);
      runtimeApiKey = legacyApiKey;
      apiKeyStorage = 'secure_storage';
    } else {
      runtimeApiKey = legacyApiKey;
      apiKeyStorage = 'legacy_db';
    }
  }

  return {
    settings,
    runtimeApiKey: runtimeApiKey?.trim() ? runtimeApiKey.trim() : null,
    apiKeyStorage,
  };
}

function toCodexSettingsResponse(resolved: ResolvedCodexRuntime): CodexSettingsResponse {
  return codexSettingsResponseSchema.parse({
    ...resolved.settings,
    apiKey: null,
    hasStoredApiKey: resolved.apiKeyStorage !== 'none',
    hasRuntimeApiKey: Boolean(resolved.runtimeApiKey?.trim() || process.env['OPENAI_API_KEY']?.trim()),
    apiKeyStorage: resolved.apiKeyStorage,
  });
}

function parseRichTextDocument(contentJson: string): RichTextDocument {
  try {
    const parsed = JSON.parse(contentJson) as RichTextDocument;
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyRichTextDocument();
    }
    return parsed;
  } catch {
    return createEmptyRichTextDocument();
  }
}

function buildSummaryPrompt(chapterTitle: string, chapterText: string): string {
  return [
    'Riassumi il capitolo in italiano.',
    `Titolo capitolo: ${chapterTitle}`,
    'Vincoli: una frase sola, massimo 220 caratteri, niente virgolette, niente markdown.',
    'Testo da riassumere:',
    chapterText,
  ].join('\n\n');
}

function normalizeSummaryText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^["'«»\s]+|["'«»\s]+$/g, '')
    .trim();
}

function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const trimmed = text.slice(0, maxLength - 1).trim();
  return `${trimmed}…`;
}

function imageMimeTypeFromPath(filePath: string): string {
  const normalized = filePath.trim().toLowerCase();
  if (normalized.endsWith('.jpg') || normalized.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (normalized.endsWith('.webp')) {
    return 'image/webp';
  }
  if (normalized.endsWith('.gif')) {
    return 'image/gif';
  }
  if (normalized.endsWith('.bmp')) {
    return 'image/bmp';
  }
  if (normalized.endsWith('.svg')) {
    return 'image/svg+xml';
  }
  return 'image/png';
}

function summarizeTextFallback(chapterText: string, maxLength = 220): string {
  const normalized = chapterText.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const sentence = normalized.split(/(?<=[.!?])\s+/).find((part) => part.trim()) ?? normalized;
  return truncateWithEllipsis(sentence.trim(), maxLength);
}

function richTextToPlainText(document: RichTextDocument, maxLength = 12000): string {
  const text = extractRichTextBlocks(document)
    .map((block) => block.text.trim())
    .filter(Boolean)
    .join('\n');
  return text.slice(0, maxLength).trim();
}

function createDocumentFromDescription(description: string): RichTextDocument {
  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    return createEmptyRichTextDocument();
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: trimmedDescription }],
      },
    ],
  };
}

function getNodeExportDocument(
  repository: Repository,
  chapterNodeId: string,
  fallbackDescription: string,
): RichTextDocument {
  const existing = repository.getChapterDocumentByNodeId(chapterNodeId);
  if (existing) {
    return parseRichTextDocument(existing.contentJson);
  }

  const document = createDocumentFromDescription(fallbackDescription);
  const created = repository.upsertChapterDocument({
    chapterNodeId,
    contentJson: JSON.stringify(document),
    wordCount: getWordCountFromDocument(document),
  });
  repository.setChapterNodeRichTextDocId(chapterNodeId, created.id);
  return document;
}

type ChapterNodeRecord = ReturnType<Repository['listChapterNodes']>[number];
type ChapterEdgeRecord = ReturnType<Repository['listChapterEdges']>[number];

function compareChapterNodes(left: ChapterNodeRecord, right: ChapterNodeRecord): number {
  if (left.plotNumber !== right.plotNumber) {
    return left.plotNumber - right.plotNumber;
  }
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber - right.blockNumber;
  }
  if (left.positionY !== right.positionY) {
    return left.positionY - right.positionY;
  }
  if (left.positionX !== right.positionX) {
    return left.positionX - right.positionX;
  }
  return left.title.localeCompare(right.title, 'it');
}

function orderChapterNodesByConnections(nodes: ChapterNodeRecord[], edges: ChapterEdgeRecord[]): ChapterNodeRecord[] {
  const nodesSorted = [...nodes].sort(compareChapterNodes);
  const nodeById = new Map(nodesSorted.map((node) => [node.id, node]));
  const indegree = new Map<string, number>(nodesSorted.map((node) => [node.id, 0]));
  const outgoing = new Map<string, string[]>(nodesSorted.map((node) => [node.id, []]));

  for (const edge of edges) {
    if (!nodeById.has(edge.sourceNodeId) || !nodeById.has(edge.targetNodeId)) {
      continue;
    }
    outgoing.get(edge.sourceNodeId)?.push(edge.targetNodeId);
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1);
  }

  for (const [nodeId, targetIds] of outgoing) {
    targetIds.sort((leftId, rightId) => compareChapterNodes(nodeById.get(leftId)!, nodeById.get(rightId)!));
    outgoing.set(nodeId, targetIds);
  }

  const queue = nodesSorted.filter((node) => (indegree.get(node.id) ?? 0) === 0);
  const ordered: ChapterNodeRecord[] = [];
  const queued = new Set(queue.map((node) => node.id));

  while (queue.length > 0) {
    queue.sort(compareChapterNodes);
    const node = queue.shift();
    if (!node) {
      break;
    }
    queued.delete(node.id);
    ordered.push(node);

    for (const targetId of outgoing.get(node.id) ?? []) {
      const nextIndegree = (indegree.get(targetId) ?? 0) - 1;
      indegree.set(targetId, nextIndegree);
      if (nextIndegree === 0) {
        const targetNode = nodeById.get(targetId);
        if (targetNode && !queued.has(targetId)) {
          queue.push(targetNode);
          queued.add(targetId);
        }
      }
    }
  }

  if (ordered.length === nodesSorted.length) {
    return ordered;
  }

  const presentIds = new Set(ordered.map((node) => node.id));
  const remaining = nodesSorted.filter((node) => !presentIds.has(node.id));
  return [...ordered, ...remaining];
}

function collectManuscriptChapters(repository: Repository, projectId: string): Array<{ title: string; document: RichTextDocument }> {
  const nodes = repository.listChapterNodes(projectId);
  const edges = repository.listChapterEdges(projectId);
  const orderedNodes = orderChapterNodesByConnections(nodes, edges);

  return orderedNodes.map((node) => ({
    title: node.title,
    document: getNodeExportDocument(repository, node.id, node.description),
  }));
}

function getManuscriptTitle(sessionManager: ProjectSessionManager): string {
  const project = sessionManager.getOpenedProject();
  if (!project) {
    return 'Documento completo';
  }
  return `${project.project.name} - Documento completo`;
}

async function printHtmlContent(html: string): Promise<boolean> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const printed = await new Promise<boolean>((resolve, reject) => {
      printWindow.webContents.print(
        {
          silent: false,
          printBackground: true,
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

function assertChapterNodeIdsBelongToProject(
  repository: ReturnType<ProjectSessionManager['getRepository']>,
  projectId: string,
  chapterNodeIds: string[],
): void {
  for (const chapterNodeId of chapterNodeIds) {
    const node = repository.getChapterNodeById(chapterNodeId);
    if (!node || node.projectId !== projectId) {
      throw new Error(`Chapter node not found: ${chapterNodeId}`);
    }
  }
}

async function resolveImageApiRuntime(
  repository: Repository,
  projectId: string,
): Promise<{ apiKey: string; model: string }> {
  const runtime = await resolveCodexRuntime(repository, projectId);
  const settings = runtime.settings;
  if (!settings.enabled) {
    throw new Error('Consenso AI non abilitato per questo progetto.');
  }
  if (!settings.allowApiCalls) {
    throw new Error('Chiamate API disabilitate nelle Impostazioni AI.');
  }
  if (settings.provider !== 'openai_api') {
    throw new Error('Provider AI non compatibile: imposta OpenAI API nelle Impostazioni AI.');
  }

  const apiKey = runtime.runtimeApiKey?.trim() || process.env['OPENAI_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('API key mancante: configura OPENAI_API_KEY o la chiave in Impostazioni AI.');
  }

  const modelFromEnv = process.env['NOVELIST_IMAGE_MODEL']?.trim();
  const modelFromSettings = settings.apiModel.trim().toLowerCase().includes('image')
    ? settings.apiModel.trim()
    : '';

  return {
    apiKey,
    model: modelFromEnv || modelFromSettings || 'gpt-image-1',
  };
}

const codexService = new CodexCliService();

export function registerIpcHandlers(ipcMain: IpcMain, sessionManager: ProjectSessionManager): void {
  for (const channel of Object.values(IPC_CHANNELS)) {
    ipcMain.removeHandler(channel);
  }

  ipcMain.handle(IPC_CHANNELS.ping, (_event, payload: unknown) => {
    const request = pingRequestSchema.parse(payload);
    const response = buildPingResponse(request);
    return pingResponseSchema.parse(response);
  });

  ipcMain.handle(IPC_CHANNELS.projectCreate, async (_event, payload: unknown) => {
    const request = projectCreateRequestSchema.parse(payload);
    const project = await sessionManager.createProject({
      rootPath: request.rootPath,
      name: request.name,
    });

    return projectResponseSchema.parse(toProjectResponse(project));
  });

  ipcMain.handle(IPC_CHANNELS.projectOpen, async (_event, payload: unknown) => {
    const request = projectOpenRequestSchema.parse(payload);
    const project = await sessionManager.openProject({ rootPath: request.rootPath });

    return projectResponseSchema.parse(toProjectResponse(project));
  });

  ipcMain.handle(IPC_CHANNELS.projectInspectPath, async (_event, payload: unknown) => {
    const request = projectOpenRequestSchema.parse(payload);
    const exists = await projectExists(request.rootPath);
    if (!exists) {
      return projectInspectPathResponseSchema.parse({
        exists: false,
        projectName: null,
      });
    }

    try {
      const context = await openProjectFromDisk(request.rootPath);
      return projectInspectPathResponseSchema.parse({
        exists: true,
        projectName: context.project.name,
      });
    } catch {
      return projectInspectPathResponseSchema.parse({
        exists: true,
        projectName: null,
      });
    }
  });

  ipcMain.handle(IPC_CHANNELS.projectSelectDirectory, async (event) => {
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const openResult = browserWindow
      ? await dialog.showOpenDialog(browserWindow, {
          properties: ['openDirectory', 'createDirectory'],
        })
      : await dialog.showOpenDialog({
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
          properties: ['openFile'],
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
        })
      : await dialog.showOpenDialog({
          properties: ['openFile'],
          filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp'] }],
        });

    if (openResult.canceled) {
      return null;
    }

    const selectedPath = openResult.filePaths[0]?.trim();
    return selectedPath ? selectedPath : null;
  });

  ipcMain.handle(IPC_CHANNELS.projectReadImageDataUrl, async (_event, payload: unknown) => {
    const request = readImageDataUrlRequestSchema.parse(payload);
    const fileBuffer = await readFile(request.filePath);
    const mimeType = imageMimeTypeFromPath(request.filePath);
    return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
  });

  ipcMain.handle(IPC_CHANNELS.projectGetCurrent, () => {
    const project = sessionManager.getOpenedProject();
    if (!project) {
      return null;
    }

    return projectResponseSchema.parse(toProjectResponse(project));
  });

  ipcMain.handle(IPC_CHANNELS.projectSaveSnapshot, async (_event, payload: unknown) => {
    const request = saveSnapshotRequestSchema.parse(payload ?? {});
    const snapshot = await sessionManager.saveSnapshot(request.reason);
    return snapshotResponseSchema.parse(snapshot);
  });

  ipcMain.handle(IPC_CHANNELS.projectListSnapshots, async () => {
    const snapshots = await sessionManager.listSnapshots();
    return z.array(snapshotResponseSchema).parse(snapshots);
  });

  ipcMain.handle(IPC_CHANNELS.projectRecoverLatestSnapshot, async () => {
    const snapshot = await sessionManager.recoverLatestSnapshot();
    if (!snapshot) {
      return null;
    }

    return snapshotResponseSchema.parse(snapshot);
  });

  ipcMain.handle(IPC_CHANNELS.storyGetState, () => {
    const { repository, projectId } = getStoryContext(sessionManager);

    return storyStateResponseSchema.parse({
      plots: repository.listPlots(projectId),
      nodes: repository.listChapterNodes(projectId),
      edges: repository.listChapterEdges(projectId),
    });
  });

  ipcMain.handle(IPC_CHANNELS.storyCreatePlot, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = createPlotRequestSchema.parse(payload);

    const plot = repository.createPlot(projectId, {
      number: request.number,
      label: request.label ?? `Trama ${request.number}`,
      color: request.color ?? colorFromPlotNumber(request.number),
    });

    return plotResponseSchema.parse(plot);
  });

  ipcMain.handle(IPC_CHANNELS.storyCreateNode, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = createNodeRequestSchema.parse(payload);

    const blockNumber = request.blockNumber ?? repository.getNextBlockNumberForPlot(projectId, request.plotNumber);

    const node = repository.createChapterNode(projectId, {
      title: request.title,
      description: request.description,
      plotNumber: request.plotNumber,
      blockNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });

    return chapterNodeResponseSchema.parse(node);
  });

  ipcMain.handle(IPC_CHANNELS.storyUpdateNode, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = updateNodeRequestSchema.parse(payload);

    const existing = repository.getChapterNodeById(request.id);
    if (!existing) {
      throw new Error(`Chapter node not found: ${request.id}`);
    }

    repository.updateChapterNode(request.id, {
      title: request.title,
      description: request.description,
      plotNumber: request.plotNumber,
      blockNumber: request.blockNumber,
      positionX: request.positionX,
      positionY: request.positionY,
      richTextDocId: request.richTextDocId ?? existing.richTextDocId,
    });

    const updated = repository.getChapterNodeById(request.id);
    if (!updated) {
      throw new Error(`Chapter node not found after update: ${request.id}`);
    }

    return chapterNodeResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.storyDeleteNode, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = deleteNodeRequestSchema.parse(payload);

    repository.deleteChapterNode(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.storyCreateEdge, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = createEdgeRequestSchema.parse(payload);

    const edge = repository.createChapterEdge(projectId, {
      sourceNodeId: request.sourceNodeId,
      targetNodeId: request.targetNodeId,
      label: request.label ?? null,
    });

    return chapterEdgeResponseSchema.parse(edge);
  });

  ipcMain.handle(IPC_CHANNELS.storyDeleteEdge, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = deleteEdgeRequestSchema.parse(payload);

    repository.deleteChapterEdge(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.chapterGetDocument, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = chapterGetDocumentRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    const existing = repository.getChapterDocumentByNodeId(request.chapterNodeId);

    if (existing) {
      return chapterDocumentResponseSchema.parse(existing);
    }

    const emptyDocument = createEmptyRichTextDocument();
    const created = repository.upsertChapterDocument({
      chapterNodeId: request.chapterNodeId,
      contentJson: JSON.stringify(emptyDocument),
      wordCount: 0,
    });
    repository.setChapterNodeRichTextDocId(request.chapterNodeId, created.id);

    return chapterDocumentResponseSchema.parse(created);
  });

  ipcMain.handle(IPC_CHANNELS.chapterSaveDocument, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = chapterSaveDocumentRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    const parsedDocument = parseRichTextDocument(request.contentJson);
    const wordCount = request.wordCount ?? getWordCountFromDocument(parsedDocument);

    const saved = repository.upsertChapterDocument({
      chapterNodeId: request.chapterNodeId,
      contentJson: JSON.stringify(parsedDocument),
      wordCount,
    });

    repository.setChapterNodeRichTextDocId(request.chapterNodeId, saved.id);

    const plainText = richTextToPlainText(parsedDocument);
    const codexSettings = repository.getOrCreateCodexSettings(projectId);
    if (plainText && codexSettings.autoSummarizeDescriptions) {
      const workspaceRoot = sessionManager.getOpenedProject()?.rootPath;
      const summaryRequest = buildSummaryPrompt(node.title, plainText);
      let summaryText = '';

      if (codexSettings.enabled) {
        try {
          const summaryResult = await codexService.chat(
            {
              message: summaryRequest,
              chapterTitle: node.title,
              projectName: sessionManager.getOpenedProject()?.project.name,
              chapterText: plainText,
              workspaceRoot,
            },
            {
              provider: 'codex_cli',
              allowApiCalls: false,
              apiKey: null,
              apiModel: codexSettings.apiModel,
            },
          );
          summaryText = normalizeSummaryText(summaryResult.output);
        } catch {
          summaryText = '';
        }
      }

      const nextDescription = truncateWithEllipsis(summaryText || summarizeTextFallback(plainText), 220);
      if (nextDescription && nextDescription !== node.description) {
        repository.updateChapterNode(node.id, {
          title: node.title,
          description: nextDescription,
          plotNumber: node.plotNumber,
          blockNumber: node.blockNumber,
          positionX: node.positionX,
          positionY: node.positionY,
          richTextDocId: saved.id,
        });
      }
    }

    return chapterDocumentResponseSchema.parse(saved);
  });

  ipcMain.handle(IPC_CHANNELS.chapterExportDocx, async (event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = chapterExportRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);

    if (!node) {
      throw new Error('Chapter node not found');
    }

    const document = getNodeExportDocument(repository, request.chapterNodeId, node.description);

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
      document,
      outputPath: saveResult.filePath,
    });

    return exportResponseSchema.parse({ filePath: saveResult.filePath });
  });

  ipcMain.handle(IPC_CHANNELS.chapterExportPdf, async (event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = chapterExportRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);

    if (!node) {
      throw new Error('Chapter node not found');
    }

    const document = getNodeExportDocument(repository, request.chapterNodeId, node.description);

    const project = sessionManager.getOpenedProject();
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const saveDialogOptions = {
      defaultPath: project
        ? `${project.assetsPath}/${getDefaultExportName(node.title, 'pdf')}`
        : getDefaultExportName(node.title, 'pdf'),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    };
    const saveResult = browserWindow
      ? await dialog.showSaveDialog(browserWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);

    if (saveResult.canceled || !saveResult.filePath) {
      return null;
    }

    await exportRichTextToPdf({
      title: node.title,
      document,
      outputPath: saveResult.filePath,
    });

    return exportResponseSchema.parse({ filePath: saveResult.filePath });
  });

  ipcMain.handle(IPC_CHANNELS.chapterPrint, async (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = chapterExportRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    const document = getNodeExportDocument(repository, request.chapterNodeId, node.description);
    const html = buildChapterPrintHtml({
      title: node.title,
      document,
    });
    const printed = await printHtmlContent(html);
    if (!printed) {
      return null;
    }

    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.manuscriptExportDocx, async (event) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const chapters = collectManuscriptChapters(repository, projectId);
    if (chapters.length === 0) {
      throw new Error('Nessun blocco disponibile per esportare il documento completo.');
    }

    const manuscriptTitle = getManuscriptTitle(sessionManager);
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
      chapters,
      outputPath: saveResult.filePath,
    });
    return exportResponseSchema.parse({ filePath: saveResult.filePath });
  });

  ipcMain.handle(IPC_CHANNELS.manuscriptExportPdf, async (event) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const chapters = collectManuscriptChapters(repository, projectId);
    if (chapters.length === 0) {
      throw new Error('Nessun blocco disponibile per esportare il documento completo.');
    }

    const manuscriptTitle = getManuscriptTitle(sessionManager);
    const project = sessionManager.getOpenedProject();
    const browserWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const saveDialogOptions = {
      defaultPath: project
        ? `${project.assetsPath}/${getDefaultExportName(manuscriptTitle, 'pdf')}`
        : getDefaultExportName(manuscriptTitle, 'pdf'),
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    };
    const saveResult = browserWindow
      ? await dialog.showSaveDialog(browserWindow, saveDialogOptions)
      : await dialog.showSaveDialog(saveDialogOptions);
    if (saveResult.canceled || !saveResult.filePath) {
      return null;
    }

    await exportManuscriptToPdf({
      title: manuscriptTitle,
      chapters,
      outputPath: saveResult.filePath,
    });
    return exportResponseSchema.parse({ filePath: saveResult.filePath });
  });

  ipcMain.handle(IPC_CHANNELS.manuscriptPrint, async () => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const chapters = collectManuscriptChapters(repository, projectId);
    if (chapters.length === 0) {
      throw new Error('Nessun blocco disponibile per la stampa del documento completo.');
    }

    const html = buildManuscriptPrintHtml({
      title: getManuscriptTitle(sessionManager),
      chapters,
    });
    const printed = await printHtmlContent(html);
    if (!printed) {
      return null;
    }

    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.chapterListCharacters, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = chapterReferenceRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);
    if (!node || node.projectId !== projectId) {
      throw new Error('Chapter node not found');
    }

    const linkedCharacters = repository.listCharactersForChapter(projectId, request.chapterNodeId);
    return z.array(characterCardResponseSchema).parse(linkedCharacters);
  });

  ipcMain.handle(IPC_CHANNELS.chapterListLocations, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = chapterReferenceRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);
    if (!node || node.projectId !== projectId) {
      throw new Error('Chapter node not found');
    }

    const linkedLocations = repository.listLocationsForChapter(projectId, request.chapterNodeId);
    return z.array(locationCardResponseSchema).parse(linkedLocations);
  });

  ipcMain.handle(IPC_CHANNELS.characterListCards, () => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const cards = repository.listCharacterCards(projectId);
    return z.array(characterCardResponseSchema).parse(cards);
  });

  ipcMain.handle(IPC_CHANNELS.characterCreateCard, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = createCharacterCardRequestSchema.parse(payload);
    const card = repository.createCharacterCard(projectId, {
      firstName: request.firstName,
      lastName: request.lastName,
      sex: request.sex,
      age: request.age ?? null,
      sexualOrientation: request.sexualOrientation,
      species: request.species,
      hairColor: request.hairColor,
      bald: request.bald,
      beard: request.beard,
      physique: request.physique,
      job: request.job,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return characterCardResponseSchema.parse(card);
  });

  ipcMain.handle(IPC_CHANNELS.characterUpdateCard, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = updateCharacterCardRequestSchema.parse(payload);
    const existing = repository.getCharacterCardById(request.id);
    if (!existing) {
      throw new Error('Character card not found');
    }

    repository.updateCharacterCard(request.id, {
      firstName: request.firstName,
      lastName: request.lastName,
      sex: request.sex,
      age: request.age ?? null,
      sexualOrientation: request.sexualOrientation,
      species: request.species,
      hairColor: request.hairColor,
      bald: request.bald,
      beard: request.beard,
      physique: request.physique,
      job: request.job,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });

    const updated = repository.getCharacterCardById(request.id);
    if (!updated) {
      throw new Error('Character card not found after update');
    }

    return characterCardResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.characterDeleteCard, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = deleteCharacterCardRequestSchema.parse(payload);
    repository.deleteCharacterCard(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.characterListChapterLinks, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = listCharacterChapterLinksRequestSchema.parse(payload);
    const card = repository.getCharacterCardById(request.characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
    }

    const chapterNodeIds = repository.listCharacterChapterLinks(card.id).map((link) => link.chapterNodeId);
    return chapterLinkIdsResponseSchema.parse(chapterNodeIds);
  });

  ipcMain.handle(IPC_CHANNELS.characterSetChapterLinks, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = setCharacterChapterLinksRequestSchema.parse(payload);
    const card = repository.getCharacterCardById(request.characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
    }

    const chapterNodeIds = [...new Set(request.chapterNodeIds)];
    assertChapterNodeIdsBelongToProject(repository, projectId, chapterNodeIds);
    repository.setCharacterChapterLinks({
      characterCardId: card.id,
      chapterNodeIds,
    });

    const linkedIds = repository.listCharacterChapterLinks(card.id).map((link) => link.chapterNodeId);
    return chapterLinkIdsResponseSchema.parse(linkedIds);
  });

  ipcMain.handle(IPC_CHANNELS.characterListImages, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = listCharacterImagesRequestSchema.parse(payload);
    const images = repository.listCharacterImages(request.characterCardId);
    return z.array(characterImageResponseSchema).parse(images);
  });

  ipcMain.handle(IPC_CHANNELS.characterCreateImage, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = createCharacterImageRequestSchema.parse(payload);
    const card = repository.getCharacterCardById(request.characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
    }
    const project = sessionManager.getOpenedProject();
    if (!project) {
      throw new Error('No open project session');
    }

    const filePath = await importImageToProject({
      assetsPath: project.assetsPath,
      category: 'characters',
      imageType: request.imageType,
      sourceFilePath: request.filePath,
    });

    const image = repository.createCharacterImage({
      characterCardId: request.characterCardId,
      imageType: request.imageType,
      filePath,
      prompt: request.prompt,
    });
    return characterImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.characterGenerateImage, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = generateCharacterImageRequestSchema.parse(payload);
    const card = repository.getCharacterCardById(request.characterCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Character card not found');
    }

    const project = sessionManager.getOpenedProject();
    if (!project) {
      throw new Error('No open project session');
    }

    const runtime = await resolveImageApiRuntime(repository, projectId);
    const generated = await generateImageWithApi({
      apiKey: runtime.apiKey,
      model: runtime.model,
      prompt: request.prompt,
      size: request.size as GeneratedImageSize,
    });
    const filePath = await saveGeneratedImageToProject({
      assetsPath: project.assetsPath,
      category: 'characters',
      imageType: request.imageType,
      generated,
    });

    const image = repository.createCharacterImage({
      characterCardId: card.id,
      imageType: request.imageType,
      filePath,
      prompt: request.prompt,
    });
    return characterImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.characterDeleteImage, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = deleteCharacterImageRequestSchema.parse(payload);
    repository.deleteCharacterImage(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.locationListCards, () => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const cards = repository.listLocationCards(projectId);
    return z.array(locationCardResponseSchema).parse(cards);
  });

  ipcMain.handle(IPC_CHANNELS.locationCreateCard, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = createLocationCardRequestSchema.parse(payload);
    const card = repository.createLocationCard(projectId, {
      name: request.name,
      locationType: request.locationType,
      description: request.description,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });
    return locationCardResponseSchema.parse(card);
  });

  ipcMain.handle(IPC_CHANNELS.locationUpdateCard, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = updateLocationCardRequestSchema.parse(payload);
    const existing = repository.getLocationCardById(request.id);
    if (!existing) {
      throw new Error('Location card not found');
    }

    repository.updateLocationCard(request.id, {
      name: request.name,
      locationType: request.locationType,
      description: request.description,
      notes: request.notes,
      plotNumber: request.plotNumber,
      positionX: request.positionX,
      positionY: request.positionY,
    });

    const updated = repository.getLocationCardById(request.id);
    if (!updated) {
      throw new Error('Location card not found after update');
    }

    return locationCardResponseSchema.parse(updated);
  });

  ipcMain.handle(IPC_CHANNELS.locationDeleteCard, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = deleteLocationCardRequestSchema.parse(payload);
    repository.deleteLocationCard(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.locationListChapterLinks, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = listLocationChapterLinksRequestSchema.parse(payload);
    const card = repository.getLocationCardById(request.locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    const chapterNodeIds = repository.listLocationChapterLinks(card.id).map((link) => link.chapterNodeId);
    return chapterLinkIdsResponseSchema.parse(chapterNodeIds);
  });

  ipcMain.handle(IPC_CHANNELS.locationSetChapterLinks, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = setLocationChapterLinksRequestSchema.parse(payload);
    const card = repository.getLocationCardById(request.locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    const chapterNodeIds = [...new Set(request.chapterNodeIds)];
    assertChapterNodeIdsBelongToProject(repository, projectId, chapterNodeIds);
    repository.setLocationChapterLinks({
      locationCardId: card.id,
      chapterNodeIds,
    });

    const linkedIds = repository.listLocationChapterLinks(card.id).map((link) => link.chapterNodeId);
    return chapterLinkIdsResponseSchema.parse(linkedIds);
  });

  ipcMain.handle(IPC_CHANNELS.locationListImages, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = listLocationImagesRequestSchema.parse(payload);
    const images = repository.listLocationImages(request.locationCardId);
    return z.array(locationImageResponseSchema).parse(images);
  });

  ipcMain.handle(IPC_CHANNELS.locationCreateImage, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = createLocationImageRequestSchema.parse(payload);
    const card = repository.getLocationCardById(request.locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }
    const project = sessionManager.getOpenedProject();
    if (!project) {
      throw new Error('No open project session');
    }

    const filePath = await importImageToProject({
      assetsPath: project.assetsPath,
      category: 'locations',
      imageType: request.imageType,
      sourceFilePath: request.filePath,
    });

    const image = repository.createLocationImage({
      locationCardId: request.locationCardId,
      imageType: request.imageType,
      filePath,
      prompt: request.prompt,
    });
    return locationImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.locationGenerateImage, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = generateLocationImageRequestSchema.parse(payload);
    const card = repository.getLocationCardById(request.locationCardId);
    if (!card || card.projectId !== projectId) {
      throw new Error('Location card not found');
    }

    const project = sessionManager.getOpenedProject();
    if (!project) {
      throw new Error('No open project session');
    }

    const runtime = await resolveImageApiRuntime(repository, projectId);
    const generated = await generateImageWithApi({
      apiKey: runtime.apiKey,
      model: runtime.model,
      prompt: request.prompt,
      size: request.size as GeneratedImageSize,
    });
    const filePath = await saveGeneratedImageToProject({
      assetsPath: project.assetsPath,
      category: 'locations',
      imageType: request.imageType,
      generated,
    });

    const image = repository.createLocationImage({
      locationCardId: card.id,
      imageType: request.imageType,
      filePath,
      prompt: request.prompt,
    });
    return locationImageResponseSchema.parse(image);
  });

  ipcMain.handle(IPC_CHANNELS.locationDeleteImage, (_event, payload: unknown) => {
    const { repository } = getStoryContext(sessionManager);
    const request = deleteLocationImageRequestSchema.parse(payload);
    repository.deleteLocationImage(request.id);
    return successResponseSchema.parse({ ok: true });
  });

  ipcMain.handle(IPC_CHANNELS.codexStatus, async () => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const workspaceRoot = sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;
    const status = await codexService.getStatus({
      provider: settings.provider,
      allowApiCalls: settings.allowApiCalls,
      apiKey: runtime.runtimeApiKey,
      apiModel: settings.apiModel,
    }, workspaceRoot);
    return codexStatusResponseSchema.parse(status);
  });

  ipcMain.handle(IPC_CHANNELS.codexGetSettings, async () => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const resolved = await resolveCodexRuntime(repository, projectId);
    return toCodexSettingsResponse(resolved);
  });

  ipcMain.handle(IPC_CHANNELS.codexUpdateSettings, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = codexUpdateSettingsRequestSchema.parse(payload);
    const runtime = await resolveCodexRuntime(repository, projectId);
    const shouldClearStoredApiKey = request.clearStoredApiKey === true || request.apiKey === null;
    const nextApiKey = request.apiKey?.trim() ?? '';

    if (request.clearStoredApiKey && nextApiKey) {
      throw new Error('Configurazione API key non valida: non puoi impostare e cancellare la chiave insieme.');
    }

    if (shouldClearStoredApiKey) {
      await clearStoredCodexApiKey(projectId);
    } else if (request.apiKey !== undefined) {
      if (!nextApiKey) {
        await clearStoredCodexApiKey(projectId);
      } else {
        await setStoredCodexApiKey(projectId, nextApiKey);
      }
    }

    const preserveLegacyApiKey =
      runtime.apiKeyStorage === 'legacy_db' && !isSecureStorageAvailable() && !shouldClearStoredApiKey;
    const updated = repository.upsertCodexSettings(projectId, {
      enabled: request.enabled,
      provider: request.provider,
      allowApiCalls: request.allowApiCalls,
      autoSummarizeDescriptions: request.autoSummarizeDescriptions,
      apiKey: preserveLegacyApiKey ? runtime.settings.apiKey : null,
      apiModel: request.apiModel,
    });

    const resolved = await resolveCodexRuntime(repository, projectId);
    return toCodexSettingsResponse({
      ...resolved,
      settings: updated,
    });
  });

  ipcMain.handle(IPC_CHANNELS.codexAssist, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const workspaceRoot = sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;
    if (!settings.enabled) {
      throw new Error('Consenso Codex non abilitato per questo progetto.');
    }

    const request = codexAssistRequestSchema.parse(payload);
    const message = request.context
      ? `${request.message}\n\nContesto:\n${request.context}`
      : request.message;
    const result = await codexService.chat({
      message,
      projectName: request.projectName,
      workspaceRoot,
    }, {
      provider: settings.provider,
      allowApiCalls: settings.allowApiCalls,
      apiKey: runtime.runtimeApiKey,
      apiModel: settings.apiModel,
    });

    return codexResultResponseSchema.parse(result);
  });

  ipcMain.handle(IPC_CHANNELS.codexTransformSelection, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const workspaceRoot = sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;
    if (!settings.enabled) {
      throw new Error('Consenso Codex non abilitato per questo progetto.');
    }

    const request = codexTransformRequestSchema.parse(payload);
    const result = await codexService.transformSelection({
      action: request.action as CodexTransformAction,
      selectedText: request.selectedText,
      chapterTitle: request.chapterTitle,
      projectName: request.projectName,
      chapterText: request.chapterText,
      workspaceRoot,
    }, {
      provider: settings.provider,
      allowApiCalls: settings.allowApiCalls,
      apiKey: runtime.runtimeApiKey,
      apiModel: settings.apiModel,
    });

    return codexResultResponseSchema.parse(result);
  });

  ipcMain.handle(IPC_CHANNELS.codexChat, async (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const workspaceRoot = sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;
    if (!settings.enabled) {
      throw new Error('Consenso Codex non abilitato per questo progetto.');
    }

    const request = codexChatRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    const result = await codexService.chat({
      message: request.message,
      chapterTitle: request.chapterTitle,
      projectName: request.projectName,
      chapterText: request.chapterText,
      workspaceRoot,
    }, {
      provider: settings.provider,
      allowApiCalls: settings.allowApiCalls,
      apiKey: runtime.runtimeApiKey,
      apiModel: settings.apiModel,
    });

    if (!result.cancelled && result.output.trim()) {
      repository.appendCodexChatMessage(projectId, {
        chapterNodeId: request.chapterNodeId,
        role: 'user',
        content: request.message,
      });
      repository.appendCodexChatMessage(projectId, {
        chapterNodeId: request.chapterNodeId,
        role: 'assistant',
        content: result.output,
        mode: result.mode === 'api' ? null : result.mode,
      });
    }

    return codexResultResponseSchema.parse(result);
  });

  ipcMain.handle(IPC_CHANNELS.codexGetChatHistory, (_event, payload: unknown) => {
    const { repository, projectId } = getStoryContext(sessionManager);
    const request = codexChatHistoryRequestSchema.parse(payload);
    const node = repository.getChapterNodeById(request.chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    const messages = repository.listCodexChatMessages(projectId, request.chapterNodeId, request.limit ?? 100);
    return z.array(codexChatMessageResponseSchema).parse(messages);
  });

  ipcMain.handle(IPC_CHANNELS.codexCancelActiveRequest, () => {
    const cancelled = codexService.cancelActiveRequest();
    return codexCancelResponseSchema.parse({ ok: true, cancelled });
  });
}
