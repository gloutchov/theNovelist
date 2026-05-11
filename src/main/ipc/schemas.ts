import { z } from 'zod';
import { APP_CONFIG } from '../config/app-config';

export const pingRequestSchema = z.object({
  message: z.string().trim().min(1).max(500),
});

export const pingResponseSchema = z.object({
  message: z.string(),
  timestamp: z.string(),
});

export const appPreferencesResponseSchema = z.object({
  autosaveMode: z.enum(['manual', 'interval', 'auto']),
  autosaveIntervalMinutes: z.number().int().min(1).max(120),
  updatedAt: z.string(),
});

export const appPreferencesUpdateRequestSchema = z.object({
  autosaveMode: z.enum(['manual', 'interval', 'auto']).optional(),
  autosaveIntervalMinutes: z.number().int().min(1).max(120).optional(),
});

export const projectCreateRequestSchema = z.object({
  rootPath: z.string().trim().min(1),
  name: z.string().trim().min(1).max(200),
  targetWordCount: z.number().int().min(1).max(10_000_000).nullable().optional(),
  targetChapterWordCount: z.number().int().min(1).max(500_000).nullable().optional(),
  plannedCompletionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const projectPlanningUpdateRequestSchema = z.object({
  targetWordCount: z.number().int().min(1).max(10_000_000).nullable(),
  targetChapterWordCount: z.number().int().min(1).max(500_000).nullable(),
  plannedCompletionDate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable(),
});

export const projectOpenRequestSchema = z.object({
  rootPath: z.string().trim().min(1),
});

export const projectInspectPathResponseSchema = z.object({
  exists: z.boolean(),
  projectName: z.string().nullable(),
});

export const readImageDataUrlRequestSchema = z.object({
  filePath: z.string().trim().min(1).max(5_000),
});

export const saveSnapshotRequestSchema = z.object({
  reason: z.string().trim().max(80).optional(),
});

export const createPlotRequestSchema = z.object({
  number: z.number().int().min(1),
  label: z.string().trim().min(1).max(120).optional(),
  summary: z.string().max(12_000).optional(),
  color: z.string().trim().min(3).max(40).optional(),
  positionX: z.number().default(120),
  positionY: z.number().default(120),
});

export const updatePlotRequestSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1).max(120),
  summary: z.string().max(12_000).default(''),
  color: z.string().trim().min(3).max(40).optional(),
  positionX: z.number().optional(),
  positionY: z.number().optional(),
});

export const deletePlotRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const createNodeRequestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4_000).default(''),
  plotNumber: z.number().int().min(1),
  blockNumber: z.number().int().min(1).optional(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

export const updateNodeRequestSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4_000),
  plotNumber: z.number().int().min(1),
  blockNumber: z.number().int().min(1),
  positionX: z.number(),
  positionY: z.number(),
  richTextDocId: z.string().trim().min(1).nullable().optional(),
});

export const deleteNodeRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const createEdgeRequestSchema = z.object({
  sourceId: z.string().trim().min(1),
  targetId: z.string().trim().min(1),
  sourceHandle: z.string().trim().nullable().optional(),
  targetHandle: z.string().trim().nullable().optional(),
  label: z.string().trim().max(200).optional(),
});

export const deleteEdgeRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const chapterGetDocumentRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
});

export const chapterSaveDocumentRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
  contentJson: z.string().min(1),
  wordCount: z.number().int().min(0).optional(),
});

export const chapterExportRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
});

export const chapterReferenceRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
});

export const createCharacterCardRequestSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).default(''),
  sex: z.string().trim().max(50).default(''),
  age: z.number().int().min(0).max(130).nullable().optional(),
  sexualOrientation: z.string().trim().max(120).default(''),
  species: z.string().trim().max(120).default(''),
  hairColor: z.string().trim().max(120).default(''),
  eyeColor: z.string().trim().max(120).default(''),
  skinColor: z.string().trim().max(120).default(''),
  bald: z.boolean().default(false),
  beard: z.string().trim().max(120).default(''),
  physique: z.string().trim().max(120).default(''),
  job: z.string().trim().max(160).default(''),
  notes: z.string().trim().max(6_000).default(''),
  plotNumber: z.number().int().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

export const updateCharacterCardRequestSchema = createCharacterCardRequestSchema.extend({
  id: z.string().trim().min(1),
});

export const deleteCharacterCardRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const listCharacterChapterLinksRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
});

export const setCharacterChapterLinksRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
  chapterNodeIds: z.array(z.string().trim().min(1)).max(2_000),
});

export const listCharacterImagesRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
});

export const createCharacterImageRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  filePath: z.string().trim().min(1),
  prompt: z.string().trim().max(4_000).default(''),
});

export const generateCharacterImageRequestSchema = z.object({
  characterCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(4_000),
  size: z.enum(APP_CONFIG.images.generatedSizes).default(APP_CONFIG.images.defaultGeneratedSize),
});

export const deleteCharacterImageRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const createLocationCardRequestSchema = z.object({
  name: z.string().trim().min(1).max(180),
  locationType: z.string().trim().max(120).default(''),
  description: z.string().trim().max(6_000).default(''),
  notes: z.string().trim().max(6_000).default(''),
  plotNumber: z.number().int().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

export const updateLocationCardRequestSchema = createLocationCardRequestSchema.extend({
  id: z.string().trim().min(1),
});

export const createSceneCardRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
  name: z.string().trim().min(1).max(180),
  text: z.string().max(50_000).default(''),
  contentJson: z.string().max(120_000).nullable().optional(),
  notes: z.string().max(8_000).default(''),
  plotNumber: z.number().int().min(1),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
});

export const updateSceneCardRequestSchema = createSceneCardRequestSchema.extend({
  id: z.string().trim().min(1),
});

export const deleteSceneCardRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const timelineSettingsUpdateRequestSchema = z.object({
  startLabel: z.string().trim().max(120),
  endLabel: z.string().trim().max(120),
  timelineEndX: z.number().min(480).max(20_000),
});

export const timelineItemTypeSchema = z.enum(['chapter', 'scene']);

export const timelineItemUpdateRequestSchema = z.object({
  itemType: timelineItemTypeSchema,
  entityId: z.string().trim().min(1),
  positionX: z.number(),
  positionY: z.number(),
  dateLabel: z.string().trim().max(120),
});

export const deleteLocationCardRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const listLocationChapterLinksRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
});

export const setLocationChapterLinksRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
  chapterNodeIds: z.array(z.string().trim().min(1)).max(2_000),
});

export const listLocationImagesRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
});

export const createLocationImageRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  filePath: z.string().trim().min(1),
  prompt: z.string().trim().max(4_000).default(''),
});

export const generateLocationImageRequestSchema = z.object({
  locationCardId: z.string().trim().min(1),
  imageType: z.string().trim().min(1).max(80),
  prompt: z.string().trim().min(1).max(4_000),
  size: z.enum(APP_CONFIG.images.generatedSizes).default(APP_CONFIG.images.defaultGeneratedSize),
});

export const deleteLocationImageRequestSchema = z.object({
  id: z.string().trim().min(1),
});

export const codexTransformRequestSchema = z.object({
  action: z.enum(['correggi', 'riscrivi', 'espandi', 'riduci']),
  selectedText: z.string().trim().min(1),
  chapterTitle: z.string().trim().optional(),
  projectName: z.string().trim().optional(),
  chapterText: z.string().optional(),
});

export const codexAssistRequestSchema = z.object({
  message: z.string().trim().min(1),
  context: z.string().trim().max(10_000).optional(),
  projectName: z.string().trim().optional(),
  timeoutMs: z.number().int().min(1000).max(180_000).optional(),
});

export const codexChatRequestSchema = z.object({
  message: z.string().trim().min(1),
  chapterNodeId: z.string().trim().min(1),
  chapterTitle: z.string().trim().optional(),
  projectName: z.string().trim().optional(),
  chapterText: z.string().optional(),
});

export const codexUpdateSettingsRequestSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(['codex_cli', 'openai_api', 'ollama']).optional(),
  fallbackProvider: z.enum(['codex_cli', 'openai_api', 'ollama', 'none']).optional(),
  allowApiCalls: z.boolean().optional(),
  allowExternalMemorySharing: z.boolean().optional(),
  autoSummarizeDescriptions: z.boolean().optional(),
  apiKey: z.string().max(500).nullable().optional(),
  clearStoredApiKey: z.boolean().optional(),
  apiModel: z.string().trim().max(120).optional(),
  apiImageModel: z.string().trim().max(120).optional(),
  ollamaModel: z.string().trim().max(120).optional(),
});

export const codexChatHistoryRequestSchema = z.object({
  chapterNodeId: z.string().trim().min(1),
  limit: z.number().int().min(1).max(500).optional(),
});

export const wikiSearchRequestSchema = z.object({
  query: z.string().trim().min(1).max(500),
  limit: z.number().int().min(1).max(25).optional(),
});

export const wikiReadSourceRequestSchema = z.object({
  path: z.string().trim().min(1).max(1_000),
});

export const projectResponseSchema = z.object({
  id: z.string(),
  name: z.string(),
  rootPath: z.string(),
  dbPath: z.string(),
  assetsPath: z.string(),
  snapshotsPath: z.string(),
  targetWordCount: z.number().int().positive().nullable(),
  targetChapterWordCount: z.number().int().positive().nullable(),
  plannedCompletionDate: z.string().nullable(),
});

export const snapshotResponseSchema = z.object({
  fileName: z.string(),
  filePath: z.string(),
  createdAt: z.string(),
  reason: z.string(),
});

export const writingSessionResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  chapterNodeId: z.string(),
  wordDelta: z.number().int(),
  wordCount: z.number().int().min(0),
  createdAt: z.string(),
});

export const plotResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  number: z.number().int(),
  label: z.string(),
  summary: z.string(),
  color: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const chapterNodeResponseSchema = z.object({
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

export const storyEdgeResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  sourceHandle: z.string().nullable(),
  targetHandle: z.string().nullable(),
  label: z.string().nullable(),
  createdAt: z.string(),
});

export const storyStateResponseSchema = z.object({
  plots: z.array(plotResponseSchema),
  nodes: z.array(chapterNodeResponseSchema),
  edges: z.array(storyEdgeResponseSchema),
});

export const chapterDocumentResponseSchema = z.object({
  id: z.string(),
  chapterNodeId: z.string(),
  contentJson: z.string(),
  wordCount: z.number().int().min(0),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const characterCardResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  sex: z.string(),
  age: z.number().int().nullable(),
  sexualOrientation: z.string(),
  species: z.string(),
  hairColor: z.string(),
  eyeColor: z.string(),
  skinColor: z.string(),
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

export const characterImageResponseSchema = z.object({
  id: z.string(),
  characterCardId: z.string(),
  imageType: z.string(),
  filePath: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
});

export const locationCardResponseSchema = z.object({
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

export const locationImageResponseSchema = z.object({
  id: z.string(),
  locationCardId: z.string(),
  imageType: z.string(),
  filePath: z.string(),
  prompt: z.string(),
  createdAt: z.string(),
});

export const sceneCardResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  chapterNodeId: z.string(),
  name: z.string(),
  text: z.string(),
  contentJson: z.string().nullable(),
  notes: z.string(),
  plotNumber: z.number().int(),
  positionX: z.number(),
  positionY: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const timelineSettingsResponseSchema = z.object({
  projectId: z.string(),
  startLabel: z.string(),
  endLabel: z.string(),
  timelineEndX: z.number(),
  updatedAt: z.string(),
});

export const timelineItemResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  itemType: timelineItemTypeSchema,
  entityId: z.string(),
  positionX: z.number(),
  positionY: z.number(),
  dateLabel: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const timelineStateResponseSchema = z.object({
  settings: timelineSettingsResponseSchema,
  items: z.array(timelineItemResponseSchema),
});

export const revisionEntityTypeSchema = z.enum(['chapter', 'scene', 'character', 'location']);

export const revisionGetCurrentRequestSchema = z.object({
  entityType: revisionEntityTypeSchema,
  entityId: z.string().trim().min(1),
});

export const revisionCreateRequestSchema = revisionGetCurrentRequestSchema.extend({
  label: z.string().trim().max(160).optional(),
});

export const revisionListRequestSchema = revisionGetCurrentRequestSchema;

export const revisionRestoreRequestSchema = z.object({
  revisionId: z.string().trim().min(1),
});

export const entityRevisionResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  entityType: revisionEntityTypeSchema,
  entityId: z.string(),
  label: z.string().nullable(),
  reason: z.enum(['manual', 'auto', 'restore']),
  snapshotJson: z.string(),
  textContent: z.string(),
  createdAt: z.string(),
});

export const entityRevisionCurrentResponseSchema = z.object({
  entityType: revisionEntityTypeSchema,
  entityId: z.string(),
  title: z.string(),
  subtitle: z.string(),
  updatedAt: z.string(),
  snapshotJson: z.string(),
  textContent: z.string(),
});

export const chapterLinkIdsResponseSchema = z.array(z.string());

export const exportResponseSchema = z.object({
  filePath: z.string(),
});

export const codexStatusResponseSchema = z.object({
  available: z.boolean(),
  command: z.string(),
  mode: z.enum(['cli', 'api', 'fallback']),
  reason: z.string().optional(),
  activeRequest: z.boolean(),
  queuedRequests: z.number().int().min(0),
  provider: z.enum(['codex_cli', 'openai_api', 'ollama']),
  fallbackProvider: z.enum(['codex_cli', 'openai_api', 'ollama', 'none']),
  apiCallsEnabled: z.boolean(),
});

export const codexResultResponseSchema = z.object({
  output: z.string(),
  mode: z.enum(['cli', 'api', 'fallback']),
  usedCommand: z.string().optional(),
  error: z.string().optional(),
  cancelled: z.boolean().optional(),
  memorySources: z
    .array(
      z.object({
        path: z.string(),
        title: z.string(),
        category: z.enum(['index', 'source', 'wiki']),
        score: z.number(),
        snippet: z.string(),
      }),
    )
    .optional(),
});

export const codexSettingsResponseSchema = z.object({
  projectId: z.string(),
  enabled: z.boolean(),
  provider: z.enum(['codex_cli', 'openai_api', 'ollama']),
  fallbackProvider: z.enum(['codex_cli', 'openai_api', 'ollama', 'none']),
  allowApiCalls: z.boolean(),
  allowExternalMemorySharing: z.boolean(),
  autoSummarizeDescriptions: z.boolean(),
  apiKey: z.string().nullable(),
  hasStoredApiKey: z.boolean(),
  hasRuntimeApiKey: z.boolean(),
  apiKeyStorage: z.enum(['secure_storage', 'legacy_db', 'none']),
  apiModel: z.string(),
  apiImageModel: z.string(),
  ollamaModel: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const codexChatMessageResponseSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  chapterNodeId: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  mode: z.enum(['cli', 'fallback']).nullable(),
  createdAt: z.string(),
});

export const codexCancelResponseSchema = z.object({
  ok: z.literal(true),
  cancelled: z.boolean(),
});

export const wikiStatusResponseSchema = z.object({
  initialized: z.boolean(),
  derivedPending: z.boolean(),
  updatedAt: z.string().nullable(),
  sourceCount: z.number().int().min(0),
});

export const wikiSyncResponseSchema = z.object({
  changed: z.boolean(),
  changedSources: z.array(z.string()),
  sourceCount: z.number().int().min(0),
  derivedPending: z.boolean(),
  indexUpdated: z.boolean().optional(),
  logUpdated: z.boolean().optional(),
});

export const wikiSearchResultResponseSchema = z.object({
  path: z.string(),
  title: z.string(),
  category: z.enum(['index', 'source', 'wiki']),
  score: z.number(),
  snippet: z.string(),
  content: z.string().optional(),
});

export const wikiSourceContentResponseSchema = z.object({
  path: z.string(),
  content: z.string(),
});

export const successResponseSchema = z.object({ ok: z.literal(true) });

export type PingRequest = z.infer<typeof pingRequestSchema>;
export type PingResponse = z.infer<typeof pingResponseSchema>;
export type AppPreferencesResponse = z.infer<typeof appPreferencesResponseSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type ProjectInspectPathResponse = z.infer<typeof projectInspectPathResponseSchema>;
export type SnapshotResponse = z.infer<typeof snapshotResponseSchema>;
export type WritingSessionResponse = z.infer<typeof writingSessionResponseSchema>;
export type PlotResponse = z.infer<typeof plotResponseSchema>;
export type ChapterNodeResponse = z.infer<typeof chapterNodeResponseSchema>;
export type StoryEdgeResponse = z.infer<typeof storyEdgeResponseSchema>;
export type StoryStateResponse = z.infer<typeof storyStateResponseSchema>;
export type ChapterDocumentResponse = z.infer<typeof chapterDocumentResponseSchema>;
export type CharacterCardResponse = z.infer<typeof characterCardResponseSchema>;
export type CharacterImageResponse = z.infer<typeof characterImageResponseSchema>;
export type LocationCardResponse = z.infer<typeof locationCardResponseSchema>;
export type LocationImageResponse = z.infer<typeof locationImageResponseSchema>;
export type SceneCardResponse = z.infer<typeof sceneCardResponseSchema>;
export type TimelineStateResponse = z.infer<typeof timelineStateResponseSchema>;
export type TimelineSettingsResponse = z.infer<typeof timelineSettingsResponseSchema>;
export type TimelineItemResponse = z.infer<typeof timelineItemResponseSchema>;
export type EntityRevisionResponse = z.infer<typeof entityRevisionResponseSchema>;
export type EntityRevisionCurrentResponse = z.infer<typeof entityRevisionCurrentResponseSchema>;
export type CodexStatusResponse = z.infer<typeof codexStatusResponseSchema>;
export type CodexResultResponse = z.infer<typeof codexResultResponseSchema>;
export type CodexSettingsResponse = z.infer<typeof codexSettingsResponseSchema>;
export type CodexChatMessageResponse = z.infer<typeof codexChatMessageResponseSchema>;
export type WikiStatusResponse = z.infer<typeof wikiStatusResponseSchema>;
export type WikiSyncResponse = z.infer<typeof wikiSyncResponseSchema>;
export type WikiSearchResultResponse = z.infer<typeof wikiSearchResultResponseSchema>;
export type WikiSourceContentResponse = z.infer<typeof wikiSourceContentResponseSchema>;
export type RevisionEntityType = z.infer<typeof revisionEntityTypeSchema>;
