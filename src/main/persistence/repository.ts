import type Database from 'better-sqlite3';
import { CharacterRepository } from './repositories/character-repository';
import { CodexRepository } from './repositories/codex-repository';
import { LocationRepository } from './repositories/location-repository';
import { ProjectRepository } from './repositories/project-repository';
import { RevisionRepository } from './repositories/revision-repository';
import { SceneRepository } from './repositories/scene-repository';
import { StoryRepository } from './repositories/story-repository';
import { TimelineRepository } from './repositories/timeline-repository';
import type {
  CharacterChapterLinkRecord,
  ChapterDocumentRecord,
  StoryEdgeRecord,
  CodexChatMessageRecord,
  CodexSettingsRecord,
  ChapterNodeRecord,
  CharacterCardRecord,
  CharacterImageRecord,
  CreateCodexChatMessageInput,
  CreateCharacterCardInput,
  CreateCharacterImageInput,
  CreateEntityRevisionInput,
  CreateWritingSessionInput,
  CreateStoryEdgeInput,
  CreateChapterNodeInput,
  CreateLocationCardInput,
  CreateLocationImageInput,
  CreateSceneCardInput,
  CreatePlotInput,
  SetCharacterChapterLinksInput,
  SetLocationChapterLinksInput,
  EntityRevisionRecord,
  LocationChapterLinkRecord,
  LocationCardRecord,
  LocationImageRecord,
  PlotRecord,
  ProjectRecord,
  SceneCardRecord,
  TimelineItemRecord,
  TimelineSettingsRecord,
  UpdateChapterNodeInput,
  UpdateCharacterCardInput,
  UpdatePlotInput,
  UpdateLocationCardInput,
  UpdateSceneCardInput,
  UpsertChapterDocumentInput,
  UpsertCodexSettingsInput,
  UpsertTimelineItemInput,
  UpsertTimelineSettingsInput,
  WritingSessionRecord,
} from './types';

export class NovelistRepository {
  private readonly characterRepository: CharacterRepository;
  private readonly codexRepository: CodexRepository;
  private readonly locationRepository: LocationRepository;
  private readonly projectRepository: ProjectRepository;
  private readonly revisionRepository: RevisionRepository;
  private readonly sceneRepository: SceneRepository;
  private readonly storyRepository: StoryRepository;
  private readonly timelineRepository: TimelineRepository;

  constructor(db: Database.Database) {
    this.characterRepository = new CharacterRepository(db);
    this.codexRepository = new CodexRepository(db);
    this.locationRepository = new LocationRepository(db);
    this.projectRepository = new ProjectRepository(db);
    this.revisionRepository = new RevisionRepository(db);
    this.sceneRepository = new SceneRepository(db);
    this.storyRepository = new StoryRepository(db);
    this.timelineRepository = new TimelineRepository(db);
  }

  createProject(params: {
    id?: string;
    name: string;
    rootPath: string;
    targetWordCount?: number | null;
    targetChapterWordCount?: number | null;
    plannedCompletionDate?: string | null;
  }): ProjectRecord {
    return this.projectRepository.createProject(params);
  }

  getProjectById(id: string): ProjectRecord | null {
    return this.projectRepository.getProjectById(id);
  }

  getPrimaryProject(): ProjectRecord | null {
    return this.projectRepository.getPrimaryProject();
  }

  updateProjectName(id: string, name: string): void {
    this.projectRepository.updateProjectName(id, name);
  }

  updateProjectPlanning(
    id: string,
    input: {
      targetWordCount?: number | null;
      targetChapterWordCount?: number | null;
      plannedCompletionDate?: string | null;
    },
  ): ProjectRecord {
    return this.projectRepository.updateProjectPlanning(id, input);
  }

  repairProjectAssetReferences(id: string, rootPath: string): void {
    this.projectRepository.repairProjectAssetReferences(id, rootPath);
  }

  updateProjectRootPathAndAssetReferences(
    id: string,
    previousRootPath: string,
    nextRootPath: string,
  ): void {
    this.projectRepository.updateProjectRootPathAndAssetReferences(
      id,
      previousRootPath,
      nextRootPath,
    );
  }

  createPlot(projectId: string, input: CreatePlotInput): PlotRecord {
    return this.storyRepository.createPlot(projectId, input);
  }

  updatePlot(id: string, input: UpdatePlotInput): PlotRecord {
    return this.storyRepository.updatePlot(id, input);
  }

  deletePlot(id: string): void {
    this.storyRepository.deletePlot(id);
  }

  listPlots(projectId: string): PlotRecord[] {
    return this.storyRepository.listPlots(projectId);
  }

  createChapterNode(projectId: string, input: CreateChapterNodeInput): ChapterNodeRecord {
    return this.storyRepository.createChapterNode(projectId, input);
  }

  updateChapterNode(nodeId: string, input: UpdateChapterNodeInput): void {
    this.storyRepository.updateChapterNode(nodeId, input);
  }

  listChapterNodes(projectId: string): ChapterNodeRecord[] {
    return this.storyRepository.listChapterNodes(projectId);
  }

  getChapterNodeById(nodeId: string): ChapterNodeRecord | null {
    return this.storyRepository.getChapterNodeById(nodeId);
  }

  getNextBlockNumberForPlot(projectId: string, plotNumber: number): number {
    return this.storyRepository.getNextBlockNumberForPlot(projectId, plotNumber);
  }

  deleteChapterNode(nodeId: string): void {
    this.storyRepository.deleteChapterNode(nodeId);
  }

  setChapterNodeRichTextDocId(nodeId: string, documentId: string | null): void {
    this.storyRepository.setChapterNodeRichTextDocId(nodeId, documentId);
  }

  createStoryEdge(projectId: string, input: CreateStoryEdgeInput): StoryEdgeRecord {
    return this.storyRepository.createStoryEdge(projectId, input);
  }

  listStoryEdges(projectId: string): StoryEdgeRecord[] {
    return this.storyRepository.listStoryEdges(projectId);
  }

  deleteStoryEdge(edgeId: string): void {
    this.storyRepository.deleteStoryEdge(edgeId);
  }

  isIdInProject(projectId: string, entityId: string): boolean {
    return this.storyRepository.isIdInProject(projectId, entityId);
  }

  upsertChapterDocument(input: UpsertChapterDocumentInput): ChapterDocumentRecord {
    return this.storyRepository.upsertChapterDocument(input);
  }

  getChapterDocumentByNodeId(chapterNodeId: string): ChapterDocumentRecord | null {
    return this.storyRepository.getChapterDocumentByNodeId(chapterNodeId);
  }

  recordWritingSession(projectId: string, input: CreateWritingSessionInput): WritingSessionRecord {
    return this.storyRepository.recordWritingSession(projectId, input);
  }

  listWritingSessions(projectId: string, limit = 12): WritingSessionRecord[] {
    return this.storyRepository.listWritingSessions(projectId, limit);
  }

  getOrCreateCodexSettings(projectId: string): CodexSettingsRecord {
    return this.codexRepository.getOrCreateCodexSettings(projectId);
  }

  upsertCodexSettings(projectId: string, input: UpsertCodexSettingsInput): CodexSettingsRecord {
    return this.codexRepository.upsertCodexSettings(projectId, input);
  }

  appendCodexChatMessage(
    projectId: string,
    input: CreateCodexChatMessageInput,
  ): CodexChatMessageRecord {
    return this.codexRepository.appendCodexChatMessage(projectId, input);
  }

  listCodexChatMessages(
    projectId: string,
    chapterNodeId: string,
    limit = 100,
  ): CodexChatMessageRecord[] {
    return this.codexRepository.listCodexChatMessages(projectId, chapterNodeId, limit);
  }

  listProjectCodexChatMessages(projectId: string): CodexChatMessageRecord[] {
    return this.codexRepository.listProjectCodexChatMessages(projectId);
  }

  createCharacterCard(projectId: string, input: CreateCharacterCardInput): CharacterCardRecord {
    return this.characterRepository.createCharacterCard(projectId, input);
  }

  updateCharacterCard(cardId: string, input: UpdateCharacterCardInput): void {
    this.characterRepository.updateCharacterCard(cardId, input);
  }

  getCharacterCardById(cardId: string): CharacterCardRecord | null {
    return this.characterRepository.getCharacterCardById(cardId);
  }

  listCharacterCards(projectId: string): CharacterCardRecord[] {
    return this.characterRepository.listCharacterCards(projectId);
  }

  deleteCharacterCard(cardId: string): void {
    this.characterRepository.deleteCharacterCard(cardId);
  }

  createCharacterImage(input: CreateCharacterImageInput): CharacterImageRecord {
    return this.characterRepository.createCharacterImage(input);
  }

  listCharacterImages(characterCardId: string): CharacterImageRecord[] {
    return this.characterRepository.listCharacterImages(characterCardId);
  }

  deleteCharacterImage(imageId: string): void {
    this.characterRepository.deleteCharacterImage(imageId);
  }

  listCharacterChapterLinks(characterCardId: string): CharacterChapterLinkRecord[] {
    return this.characterRepository.listCharacterChapterLinks(characterCardId);
  }

  setCharacterChapterLinks(input: SetCharacterChapterLinksInput): void {
    this.characterRepository.setCharacterChapterLinks(input);
  }

  listCharactersForChapter(projectId: string, chapterNodeId: string): CharacterCardRecord[] {
    return this.characterRepository.listCharactersForChapter(projectId, chapterNodeId);
  }

  createLocationCard(projectId: string, input: CreateLocationCardInput): LocationCardRecord {
    return this.locationRepository.createLocationCard(projectId, input);
  }

  updateLocationCard(cardId: string, input: UpdateLocationCardInput): void {
    this.locationRepository.updateLocationCard(cardId, input);
  }

  getLocationCardById(cardId: string): LocationCardRecord | null {
    return this.locationRepository.getLocationCardById(cardId);
  }

  listLocationCards(projectId: string): LocationCardRecord[] {
    return this.locationRepository.listLocationCards(projectId);
  }

  deleteLocationCard(cardId: string): void {
    this.locationRepository.deleteLocationCard(cardId);
  }

  createLocationImage(input: CreateLocationImageInput): LocationImageRecord {
    return this.locationRepository.createLocationImage(input);
  }

  listLocationImages(locationCardId: string): LocationImageRecord[] {
    return this.locationRepository.listLocationImages(locationCardId);
  }

  deleteLocationImage(imageId: string): void {
    this.locationRepository.deleteLocationImage(imageId);
  }

  listLocationChapterLinks(locationCardId: string): LocationChapterLinkRecord[] {
    return this.locationRepository.listLocationChapterLinks(locationCardId);
  }

  setLocationChapterLinks(input: SetLocationChapterLinksInput): void {
    this.locationRepository.setLocationChapterLinks(input);
  }

  listLocationsForChapter(projectId: string, chapterNodeId: string): LocationCardRecord[] {
    return this.locationRepository.listLocationsForChapter(projectId, chapterNodeId);
  }

  createSceneCard(projectId: string, input: CreateSceneCardInput): SceneCardRecord {
    return this.sceneRepository.createSceneCard(projectId, input);
  }

  updateSceneCard(sceneId: string, input: UpdateSceneCardInput): void {
    this.sceneRepository.updateSceneCard(sceneId, input);
  }

  getSceneCardById(sceneId: string): SceneCardRecord | null {
    return this.sceneRepository.getSceneCardById(sceneId);
  }

  listSceneCards(projectId: string): SceneCardRecord[] {
    return this.sceneRepository.listSceneCards(projectId);
  }

  listScenesForChapter(projectId: string, chapterNodeId: string): SceneCardRecord[] {
    return this.sceneRepository.listScenesForChapter(projectId, chapterNodeId);
  }

  deleteSceneCard(sceneId: string): void {
    this.sceneRepository.deleteSceneCard(sceneId);
  }

  getTimelineSettings(projectId: string): TimelineSettingsRecord {
    return this.timelineRepository.getTimelineSettings(projectId);
  }

  upsertTimelineSettings(
    projectId: string,
    input: UpsertTimelineSettingsInput,
  ): TimelineSettingsRecord {
    return this.timelineRepository.upsertTimelineSettings(projectId, input);
  }

  listTimelineItems(projectId: string): TimelineItemRecord[] {
    return this.timelineRepository.listTimelineItems(projectId);
  }

  upsertTimelineItem(projectId: string, input: UpsertTimelineItemInput): TimelineItemRecord {
    return this.timelineRepository.upsertTimelineItem(projectId, input);
  }

  createEntityRevision(projectId: string, input: CreateEntityRevisionInput): EntityRevisionRecord {
    return this.revisionRepository.createEntityRevision(projectId, input);
  }

  createEntityRevisionIfChanged(
    projectId: string,
    input: CreateEntityRevisionInput,
  ): EntityRevisionRecord | null {
    return this.revisionRepository.createEntityRevisionIfChanged(projectId, input);
  }

  listEntityRevisions(
    projectId: string,
    entityType: CreateEntityRevisionInput['entityType'],
    entityId: string,
  ): EntityRevisionRecord[] {
    return this.revisionRepository.listEntityRevisions(projectId, entityType, entityId);
  }

  getLatestEntityRevision(
    projectId: string,
    entityType: CreateEntityRevisionInput['entityType'],
    entityId: string,
  ): EntityRevisionRecord | null {
    return this.revisionRepository.getLatestEntityRevision(projectId, entityType, entityId);
  }

  getEntityRevisionById(revisionId: string): EntityRevisionRecord | null {
    return this.revisionRepository.getEntityRevisionById(revisionId);
  }
}
