import { contextBridge, ipcRenderer } from 'electron';
import {
  IPC_CHANNELS,
  type ChapterEdgeResponse,
  type ChapterDocumentResponse,
  type ChapterNodeResponse,
  type CharacterCardResponse,
  type CharacterImageResponse,
  type CodexChatMessageResponse,
  type CodexResultResponse,
  type CodexSettingsResponse,
  type CodexStatusResponse,
  type LocationCardResponse,
  type LocationImageResponse,
  type PingRequest,
  type PingResponse,
  type PlotResponse,
  type ProjectInspectPathResponse,
  type ProjectResponse,
  type SnapshotResponse,
  type StoryStateResponse,
} from '../main/ipc';

const novelistApi = {
  ping: (payload: PingRequest): Promise<PingResponse> => ipcRenderer.invoke(IPC_CHANNELS.ping, payload),
  createProject: (payload: { rootPath: string; name: string }): Promise<ProjectResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.projectCreate, payload),
  openProject: (payload: { rootPath: string }): Promise<ProjectResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.projectOpen, payload),
  inspectProjectPath: (payload: { rootPath: string }): Promise<ProjectInspectPathResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.projectInspectPath, payload),
  selectProjectDirectory: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.projectSelectDirectory),
  selectImageFile: (): Promise<string | null> => ipcRenderer.invoke(IPC_CHANNELS.projectSelectImageFile),
  readImageDataUrl: (payload: { filePath: string }): Promise<string> =>
    ipcRenderer.invoke(IPC_CHANNELS.projectReadImageDataUrl, payload),
  getCurrentProject: (): Promise<ProjectResponse | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.projectGetCurrent),
  saveSnapshot: (payload?: { reason?: string }): Promise<SnapshotResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.projectSaveSnapshot, payload ?? {}),
  listSnapshots: (): Promise<SnapshotResponse[]> => ipcRenderer.invoke(IPC_CHANNELS.projectListSnapshots),
  recoverLatestSnapshot: (): Promise<SnapshotResponse | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.projectRecoverLatestSnapshot),
  getStoryState: (): Promise<StoryStateResponse> => ipcRenderer.invoke(IPC_CHANNELS.storyGetState),
  createPlot: (payload: {
    number: number;
    label?: string;
    color?: string;
  }): Promise<PlotResponse> => ipcRenderer.invoke(IPC_CHANNELS.storyCreatePlot, payload),
  createStoryNode: (payload: {
    title: string;
    description?: string;
    plotNumber: number;
    blockNumber?: number;
    positionX: number;
    positionY: number;
  }): Promise<ChapterNodeResponse> => ipcRenderer.invoke(IPC_CHANNELS.storyCreateNode, payload),
  updateStoryNode: (payload: {
    id: string;
    title: string;
    description: string;
    plotNumber: number;
    blockNumber: number;
    positionX: number;
    positionY: number;
    richTextDocId?: string | null;
  }): Promise<ChapterNodeResponse> => ipcRenderer.invoke(IPC_CHANNELS.storyUpdateNode, payload),
  deleteStoryNode: (payload: { id: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.storyDeleteNode, payload),
  createStoryEdge: (payload: {
    sourceNodeId: string;
    targetNodeId: string;
    label?: string;
  }): Promise<ChapterEdgeResponse> => ipcRenderer.invoke(IPC_CHANNELS.storyCreateEdge, payload),
  deleteStoryEdge: (payload: { id: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.storyDeleteEdge, payload),
  getChapterDocument: (payload: { chapterNodeId: string }): Promise<ChapterDocumentResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.chapterGetDocument, payload),
  saveChapterDocument: (payload: {
    chapterNodeId: string;
    contentJson: string;
    wordCount?: number;
  }): Promise<ChapterDocumentResponse> => ipcRenderer.invoke(IPC_CHANNELS.chapterSaveDocument, payload),
  exportChapterDocx: (payload: { chapterNodeId: string }): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chapterExportDocx, payload),
  exportChapterPdf: (payload: { chapterNodeId: string }): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chapterExportPdf, payload),
  printChapter: (payload: { chapterNodeId: string }): Promise<{ ok: true } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.chapterPrint, payload),
  exportManuscriptDocx: (): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.manuscriptExportDocx),
  exportManuscriptPdf: (): Promise<{ filePath: string } | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.manuscriptExportPdf),
  printManuscript: (): Promise<{ ok: true } | null> => ipcRenderer.invoke(IPC_CHANNELS.manuscriptPrint),
  listChapterCharacters: (payload: { chapterNodeId: string }): Promise<CharacterCardResponse[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.chapterListCharacters, payload),
  listChapterLocations: (payload: { chapterNodeId: string }): Promise<LocationCardResponse[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.chapterListLocations, payload),
  listCharacterCards: (): Promise<CharacterCardResponse[]> => ipcRenderer.invoke(IPC_CHANNELS.characterListCards),
  createCharacterCard: (payload: {
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
  }): Promise<CharacterCardResponse> => ipcRenderer.invoke(IPC_CHANNELS.characterCreateCard, payload),
  updateCharacterCard: (payload: {
    id: string;
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
  }): Promise<CharacterCardResponse> => ipcRenderer.invoke(IPC_CHANNELS.characterUpdateCard, payload),
  deleteCharacterCard: (payload: { id: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.characterDeleteCard, payload),
  listCharacterChapterLinks: (payload: { characterCardId: string }): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.characterListChapterLinks, payload),
  setCharacterChapterLinks: (payload: { characterCardId: string; chapterNodeIds: string[] }): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.characterSetChapterLinks, payload),
  listCharacterImages: (payload: { characterCardId: string }): Promise<CharacterImageResponse[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.characterListImages, payload),
  createCharacterImage: (payload: {
    characterCardId: string;
    imageType: string;
    filePath: string;
    prompt: string;
  }): Promise<CharacterImageResponse> => ipcRenderer.invoke(IPC_CHANNELS.characterCreateImage, payload),
  generateCharacterImage: (payload: {
    characterCardId: string;
    imageType: string;
    prompt: string;
    size?: '1024x1024' | '1536x1024' | '1024x1536';
  }): Promise<CharacterImageResponse> => ipcRenderer.invoke(IPC_CHANNELS.characterGenerateImage, payload),
  deleteCharacterImage: (payload: { id: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.characterDeleteImage, payload),
  listLocationCards: (): Promise<LocationCardResponse[]> => ipcRenderer.invoke(IPC_CHANNELS.locationListCards),
  createLocationCard: (payload: {
    name: string;
    locationType: string;
    description: string;
    notes: string;
    plotNumber: number;
    positionX: number;
    positionY: number;
  }): Promise<LocationCardResponse> => ipcRenderer.invoke(IPC_CHANNELS.locationCreateCard, payload),
  updateLocationCard: (payload: {
    id: string;
    name: string;
    locationType: string;
    description: string;
    notes: string;
    plotNumber: number;
    positionX: number;
    positionY: number;
  }): Promise<LocationCardResponse> => ipcRenderer.invoke(IPC_CHANNELS.locationUpdateCard, payload),
  deleteLocationCard: (payload: { id: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.locationDeleteCard, payload),
  listLocationChapterLinks: (payload: { locationCardId: string }): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.locationListChapterLinks, payload),
  setLocationChapterLinks: (payload: { locationCardId: string; chapterNodeIds: string[] }): Promise<string[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.locationSetChapterLinks, payload),
  listLocationImages: (payload: { locationCardId: string }): Promise<LocationImageResponse[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.locationListImages, payload),
  createLocationImage: (payload: {
    locationCardId: string;
    imageType: string;
    filePath: string;
    prompt: string;
  }): Promise<LocationImageResponse> => ipcRenderer.invoke(IPC_CHANNELS.locationCreateImage, payload),
  generateLocationImage: (payload: {
    locationCardId: string;
    imageType: string;
    prompt: string;
    size?: '1024x1024' | '1536x1024' | '1024x1536';
  }): Promise<LocationImageResponse> => ipcRenderer.invoke(IPC_CHANNELS.locationGenerateImage, payload),
  deleteLocationImage: (payload: { id: string }): Promise<{ ok: true }> =>
    ipcRenderer.invoke(IPC_CHANNELS.locationDeleteImage, payload),
  codexStatus: (): Promise<CodexStatusResponse> => ipcRenderer.invoke(IPC_CHANNELS.codexStatus),
  codexGetSettings: (): Promise<CodexSettingsResponse> => ipcRenderer.invoke(IPC_CHANNELS.codexGetSettings),
  codexUpdateSettings: (payload: {
    enabled?: boolean;
    provider?: 'codex_cli' | 'openai_api' | 'ollama';
    allowApiCalls?: boolean;
    autoSummarizeDescriptions?: boolean;
    apiKey?: string | null;
    clearStoredApiKey?: boolean;
    apiModel?: string;
  }): Promise<CodexSettingsResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.codexUpdateSettings, payload),
  codexAssist: (payload: {
    message: string;
    context?: string;
    projectName?: string;
  }): Promise<CodexResultResponse> => ipcRenderer.invoke(IPC_CHANNELS.codexAssist, payload),
  codexTransformSelection: (payload: {
    action: 'correggi' | 'riscrivi' | 'espandi' | 'riduci';
    selectedText: string;
    chapterTitle?: string;
    projectName?: string;
    chapterText?: string;
  }): Promise<CodexResultResponse> => ipcRenderer.invoke(IPC_CHANNELS.codexTransformSelection, payload),
  codexChat: (payload: {
    message: string;
    chapterNodeId: string;
    chapterTitle?: string;
    projectName?: string;
    chapterText?: string;
  }): Promise<CodexResultResponse> => ipcRenderer.invoke(IPC_CHANNELS.codexChat, payload),
  codexGetChatHistory: (payload: { chapterNodeId: string; limit?: number }): Promise<CodexChatMessageResponse[]> =>
    ipcRenderer.invoke(IPC_CHANNELS.codexGetChatHistory, payload),
  codexCancelActiveRequest: (): Promise<{ ok: true; cancelled: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.codexCancelActiveRequest),
};

contextBridge.exposeInMainWorld('novelistApi', novelistApi);

export type NovelistApi = typeof novelistApi;
