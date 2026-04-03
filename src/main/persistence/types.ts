export interface ProjectRecord {
  id: string;
  name: string;
  rootPath: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlotRecord {
  id: string;
  projectId: string;
  number: number;
  label: string;
  summary: string;
  color: string;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterNodeRecord {
  id: string;
  projectId: string;
  title: string;
  description: string;
  plotNumber: number;
  blockNumber: number;
  positionX: number;
  positionY: number;
  richTextDocId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StoryEdgeRecord {
  id: string;
  projectId: string;
  sourceId: string;
  targetId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
  createdAt: string;
}

export interface ChapterDocumentRecord {
  id: string;
  chapterNodeId: string;
  contentJson: string;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CodexSettingsRecord {
  projectId: string;
  enabled: boolean;
  provider: 'codex_cli' | 'openai_api' | 'ollama';
  allowApiCalls: boolean;
  autoSummarizeDescriptions: boolean;
  apiKey: string | null;
  apiModel: string;
  createdAt: string;
  updatedAt: string;
}

export interface CodexChatMessageRecord {
  id: string;
  projectId: string;
  chapterNodeId: string;
  role: 'user' | 'assistant';
  content: string;
  mode: 'cli' | 'fallback' | null;
  createdAt: string;
}

export interface CharacterCardRecord {
  id: string;
  projectId: string;
  firstName: string;
  lastName: string;
  sex: string;
  age: number | null;
  sexualOrientation: string;
  species: string;
  hairColor: string;
  bald: boolean;
  beard: string;
  physique: string;
  job: string;
  notes: string;
  plotNumber: number;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
}

export interface CharacterImageRecord {
  id: string;
  characterCardId: string;
  imageType: string;
  filePath: string;
  prompt: string;
  createdAt: string;
}

export interface LocationCardRecord {
  id: string;
  projectId: string;
  name: string;
  locationType: string;
  description: string;
  notes: string;
  plotNumber: number;
  positionX: number;
  positionY: number;
  createdAt: string;
  updatedAt: string;
}

export interface LocationImageRecord {
  id: string;
  locationCardId: string;
  imageType: string;
  filePath: string;
  prompt: string;
  createdAt: string;
}

export interface CharacterChapterLinkRecord {
  characterCardId: string;
  chapterNodeId: string;
  createdAt: string;
}

export interface LocationChapterLinkRecord {
  locationCardId: string;
  chapterNodeId: string;
  createdAt: string;
}

export interface CreatePlotInput {
  number: number;
  label: string;
  summary: string;
  color: string;
  positionX: number;
  positionY: number;
}

export interface UpdatePlotInput {
  label: string;
  summary: string;
  color?: string;
  positionX?: number;
  positionY?: number;
}

export interface CreateChapterNodeInput {
  title: string;
  description: string;
  plotNumber: number;
  blockNumber: number;
  positionX: number;
  positionY: number;
}

export interface UpdateChapterNodeInput {
  title: string;
  description: string;
  plotNumber: number;
  blockNumber: number;
  positionX: number;
  positionY: number;
  richTextDocId: string | null;
}

export interface CreateStoryEdgeInput {
  sourceId: string;
  targetId: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  label?: string | null;
}

export interface UpsertChapterDocumentInput {
  id?: string;
  chapterNodeId: string;
  contentJson: string;
  wordCount: number;
}

export interface UpsertCodexSettingsInput {
  enabled?: boolean;
  provider?: 'codex_cli' | 'openai_api' | 'ollama';
  allowApiCalls?: boolean;
  autoSummarizeDescriptions?: boolean;
  apiKey?: string | null;
  apiModel?: string;
}

export interface CreateCodexChatMessageInput {
  chapterNodeId: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'cli' | 'fallback' | null;
}

export interface CreateCharacterCardInput {
  firstName: string;
  lastName: string;
  sex: string;
  age: number | null;
  sexualOrientation: string;
  species: string;
  hairColor: string;
  bald: boolean;
  beard: string;
  physique: string;
  job: string;
  notes: string;
  plotNumber: number;
  positionX: number;
  positionY: number;
}

export type UpdateCharacterCardInput = CreateCharacterCardInput;

export interface CreateCharacterImageInput {
  characterCardId: string;
  imageType: string;
  filePath: string;
  prompt: string;
}

export interface CreateLocationCardInput {
  name: string;
  locationType: string;
  description: string;
  notes: string;
  plotNumber: number;
  positionX: number;
  positionY: number;
}

export type UpdateLocationCardInput = CreateLocationCardInput;

export interface CreateLocationImageInput {
  locationCardId: string;
  imageType: string;
  filePath: string;
  prompt: string;
}

export interface SetCharacterChapterLinksInput {
  characterCardId: string;
  chapterNodeIds: string[];
}

export interface SetLocationChapterLinksInput {
  locationCardId: string;
  chapterNodeIds: string[];
}
