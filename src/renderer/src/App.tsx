import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type ReactFlowInstance,
  type Connection,
  type Edge,
  type EdgeMouseHandler,
  type NodeMouseHandler,
  type OnNodeDrag,
  type OnNodesDelete,
  type OnEdgesDelete,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import AnalysisBoard from './AnalysisBoard';
import ChapterEditor from './ChapterEditor';
import ChapterFlowNode from './ChapterFlowNode';
import CharacterBoard from './CharacterBoard';
import CharacterFlowNode from './CharacterFlowNode';
import { getNearbyCanvasPosition } from './canvas-position';
import {
  FLOW_MINIMAP_MASK_COLOR,
  getFlowMiniMapNodeColor,
  getFlowMiniMapNodeStrokeColor,
} from './flow-minimap';
import { canvasMultiSelectProps } from './flow-selection';
import LocationBoard from './LocationBoard';
import LocationFlowNode from './LocationFlowNode';
import PlotFlowNode from './PlotFlowNode';
import SceneBoard from './SceneBoard';
import TimelineBoard from './TimelineBoard';
import RevisionBoard from './RevisionBoard';
import {
  hasPendingAiSettingsChanges,
  normalizeCodexSettings,
  useAiSettingsState,
} from './features/ai/ai-settings';
import { DashboardWorkspace } from './features/dashboard/dashboard-workspace';
import {
  buildDashboardGoalMetrics,
  countWords,
  createEmptyDashboardState,
  formatCharacterName,
  formatLocationName,
  formatSceneName,
  type DashboardCharacterCard,
  type DashboardLocationCard,
  type DashboardSceneCard,
  type DashboardState,
} from './features/dashboard/dashboard-state';
import {
  buildOutlineChapterOrder,
  createEmptyOutlineState,
  type OutlineChapter,
  type OutlineState,
} from './features/outline/outline-state';
import { useReadingViewState } from './features/outline/reading-view';
import { ReadingViewOverlay } from './features/outline/reading-view-overlay';
import { MemoryResultModal } from './features/memory/memory-result-modal';
import { MemoryWorkspace } from './features/memory/memory-workspace';
import { useWikiState } from './features/memory/wiki-state';
import { useMemorySummaryState, type MemorySummaryPlot } from './features/memory/memory-summary';
import {
  projectPlanningMatches,
  toOptionalPositiveInteger,
  useProjectSessionState,
  type ProjectRecord,
} from './features/project/project-session';
import {
  CloseProjectConfirmModal,
  CreateProjectModal,
  ProjectTargetsModal,
} from './features/project/project-modals';
import {
  getDefaultPlotPosition,
  getPlotColor,
  mapNodeRecordToFlowNode,
  normalizePlotLabel,
  sortPlots,
  syncPlotFlowNodes,
  type ChapterCanvasNode,
  type PlotCanvasNode,
} from './features/plot/plot-flow';
import { CreatePlotModal, EditPlotModal } from './features/plot/plot-modals';
import { usePlotSessionState } from './features/plot/plot-session';
import { tryParsePlotStructureBlocks } from './features/plot/plot-structure';
import {
  normalizeIntervalMinutes,
  useAppPreferencesState,
} from './features/settings/app-preferences';
import { SettingsModal } from './features/settings/settings-modal';
import { CreateStoryNodeModal, EditStoryNodeModal } from './features/story/story-node-modals';
import {
  createTranslator,
  resolveRendererLanguage,
  type AppLanguage,
  type TranslationKey,
} from './i18n';
import { parseTime } from './shared/formatters';
import { getStatusTone } from './status-tone';

type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type StoryEdgeRecord = StoryState['edges'][number];
type PlotRecord = StoryState['plots'][number];
type CreatedChapterNode = Awaited<ReturnType<(typeof window.novelistApi)['createStoryNode']>>;
type CodexMemorySource = NonNullable<
  Awaited<ReturnType<(typeof window.novelistApi)['codexChat']>>['memorySources']
>[number];

type WorkspaceTab =
  | 'dashboard'
  | 'outline'
  | 'timeline'
  | 'story'
  | 'plots'
  | 'scenes'
  | 'characters'
  | 'locations'
  | 'revisions'
  | 'analysis'
  | 'memory';

function mapEdgeRecordToFlowEdge(
  record: StoryEdgeRecord,
  handles?: {
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): Edge {
  return {
    id: record.id,
    source: record.sourceId,
    target: record.targetId,
    sourceHandle: handles?.sourceHandle ?? record.sourceHandle ?? 'handle-right',
    targetHandle: handles?.targetHandle ?? record.targetHandle ?? 'handle-left',
    label: record.label ?? '',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color)' },
    style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
  };
}

function buildPlotStructurePrompt(language: AppLanguage): string {
  if (language === 'en') {
    return 'Analyze this plot and return only valid JSON in the format {"blocks":[{"title":"...","description":"..."}]}. Generate 4 to 12 narrative blocks, in chronological order, with short titles and concise descriptions in English.';
  }

  return 'Analizza questa trama e restituisci solo JSON valido nel formato {"blocks":[{"title":"...","description":"..."}]}. Genera da 4 a 12 blocchi narrativi, in ordine cronologico, con titoli brevi e descrizioni concise in italiano.';
}

function buildPlotStructureRepairPrompt(language: AppLanguage): string {
  if (language === 'en') {
    return 'Fix the following output and return only valid JSON in the format {"blocks":[{"title":"...","description":"..."}]}. There must be 4 to 12 chronologically ordered narrative blocks, each with a title and description. Do not add text outside the JSON.';
  }

  return 'Correggi il seguente output e restituisci solo JSON valido nel formato {"blocks":[{"title":"...","description":"..."}]}. Devono esserci da 4 a 12 blocchi narrativi ordinati cronologicamente, con titolo e descrizione per ogni blocco. Non aggiungere testo fuori dal JSON.';
}

function getWorkspaceStatusKey(tab: WorkspaceTab, hasProject: boolean): TranslationKey {
  if (!hasProject) {
    switch (tab) {
      case 'dashboard':
        return 'dashboard.project.none';
      case 'outline':
        return 'outline.emptyProject';
      case 'timeline':
        return 'timeline.emptyProject';
      case 'plots':
        return 'plot.emptyProject';
      case 'story':
        return 'story.emptyProject';
      case 'scenes':
        return 'scene.emptyProject';
      case 'characters':
        return 'entity.character.emptyProject';
      case 'locations':
        return 'entity.location.emptyProject';
      case 'revisions':
        return 'revision.emptyProject';
      case 'analysis':
        return 'analysis.emptyProject';
      case 'memory':
        return 'memory.emptyProject';
    }
  }

  switch (tab) {
    case 'dashboard':
      return 'dashboard.status.ready';
    case 'outline':
      return 'outline.status.ready';
    case 'timeline':
      return 'timeline.ready';
    case 'plots':
      return 'plot.status.ready';
    case 'story':
      return 'story.status.ready';
    case 'scenes':
      return 'scene.status.ready';
    case 'characters':
      return 'entity.status.characterCanvasLoaded';
    case 'locations':
      return 'entity.status.locationCanvasLoaded';
    case 'revisions':
      return 'revision.status.ready';
    case 'analysis':
      return 'analysis.status.ready';
    case 'memory':
      return 'memory.status.ready';
  }
}

export default function App() {
  const [status, setStatus] = useState<string>('Nessun progetto aperto');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const {
    appPreferences,
    appPreferencesBusy,
    handleSaveAppPreferences,
    refreshAppPreferences,
    setAppPreferences,
  } = useAppPreferencesState({ setError, setStatus });
  const appLanguage = resolveRendererLanguage(appPreferences);
  const t = useMemo(() => createTranslator(appLanguage), [appLanguage]);
  const chapterFlowLabels = useMemo(
    () => ({
      noDescriptionLabel: t('story.flow.noDescription'),
      plotLabel: t('common.plot'),
    }),
    [t],
  );
  const [lastAiMemorySources, setLastAiMemorySources] = useState<CodexMemorySource[]>([]);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardState>(() => createEmptyDashboardState());
  const [outline, setOutline] = useState<OutlineState>(() => createEmptyOutlineState());
  const [draggedOutlineChapterId, setDraggedOutlineChapterId] = useState<string | null>(null);

  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [plotNodes, setPlotNodes] = useState<PlotCanvasNode[]>([]);
  const [nodes, setNodes] = useState<ChapterCanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  useEffect(() => {
    const themeMode = appPreferences?.themeMode ?? 'system';
    if (themeMode === 'light' || themeMode === 'dark') {
      document.documentElement.dataset.theme = themeMode;
    } else {
      delete document.documentElement.dataset.theme;
    }
  }, [appPreferences?.themeMode]);

  const [newNodeTitle, setNewNodeTitle] = useState<string>('Nuovo capitolo');
  const [newNodeDescription, setNewNodeDescription] = useState<string>('');
  const [newNodePlotNumber, setNewNodePlotNumber] = useState<number>(1);
  const [newNodeBlockNumber, setNewNodeBlockNumber] = useState<string>('');
  const [isNewNodeModalOpen, setIsNewNodeModalOpen] = useState<boolean>(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPlotNumber, setEditPlotNumber] = useState<number>(1);
  const [editBlockNumber, setEditBlockNumber] = useState<number>(1);
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const [editorNodeTitle, setEditorNodeTitle] = useState<string>('');
  const [chapterEditorDirty, setChapterEditorDirty] = useState<boolean>(false);
  const [characterBoardDirty, setCharacterBoardDirty] = useState<boolean>(false);
  const [locationBoardDirty, setLocationBoardDirty] = useState<boolean>(false);
  const [sceneBoardDirty, setSceneBoardDirty] = useState<boolean>(false);
  const {
    currentProject,
    setCurrentProject,
    createProjectRoot,
    setCreateProjectRoot,
    createProjectName,
    setCreateProjectName,
    createProjectTargetWords,
    setCreateProjectTargetWords,
    createProjectTargetChapterWords,
    setCreateProjectTargetChapterWords,
    createProjectCompletionDate,
    setCreateProjectCompletionDate,
    isCreateProjectModalOpen,
    editProjectTargetWords,
    setEditProjectTargetWords,
    editProjectTargetChapterWords,
    setEditProjectTargetChapterWords,
    editProjectCompletionDate,
    setEditProjectCompletionDate,
    isProjectTargetsModalOpen,
    setIsProjectTargetsModalOpen,
    isCloseProjectConfirmOpen,
    setIsCloseProjectConfirmOpen,
    canCreateProject,
    canSaveProjectTargets,
    canOpenProject,
    canSaveProject,
    canCloseProject,
    closeCreateProjectModal,
    openCreateProjectModal,
    openProjectTargetsModal,
    resetCreateProjectFormAfterCreate,
    resetProjectSessionState,
  } = useProjectSessionState(busy);
  const plotsById = useMemo(() => new Map(plots.map((plot) => [plot.id, plot])), [plots]);
  const {
    canCreatePlot,
    canCreatePlotStructure,
    currentEditPlot,
    editPlotLabelInput,
    editPlotSummaryInput,
    existingPlotForNewNumber,
    isPlotModalOpen,
    newPlotLabel,
    newPlotNumber,
    newPlotSummary,
    openPlotEditor,
    plotStructureBusy,
    resetPlotDraftAfterCreate,
    resetPlotEditor,
    resetPlotState,
    selectedPlot,
    selectedPlotId,
    setEditPlotLabelInput,
    setEditPlotSummaryInput,
    setIsPlotModalOpen,
    setNewPlotLabel,
    setNewPlotNumber,
    setNewPlotSummary,
    setPlotStructureBusy,
    setSelectedPlotId,
  } = usePlotSessionState({
    busy,
    currentProject,
    plots,
    plotsById,
  });
  const {
    aiSettings,
    setAiSettings,
    aiSettingsBusy,
    aiApiKeyInput,
    setAiApiKeyInput,
    clearStoredApiKey,
    setClearStoredApiKey,
    isAiSettingsModalOpen,
    setIsAiSettingsModalOpen,
    handleSaveAiSettings,
    loadAiSettings,
    resetAiSettings,
  } = useAiSettingsState({ currentProject, setError, setStatus, t });
  const {
    memoryStorySummary,
    memoryStorySummaryBusy,
    memoryStorySummaryFallback,
    refreshMemoryStorySummary,
  } = useMemorySummaryState({
    aiEnabled: Boolean(aiSettings?.enabled),
    currentProject,
    plots: plots as MemorySummaryPlot[],
    t,
  });
  const {
    openChapterReadingView,
    openFullDocumentReadingView,
    readingView,
    readingViewLoading,
    setReadingView,
  } = useReadingViewState({ currentProject, setError, setStatus, t });

  const chapterEditorFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const characterBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const locationBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const sceneBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const workspaceNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyFlowRef = useRef<ReactFlowInstance<ChapterCanvasNode, Edge> | null>(null);
  const plotFlowRef = useRef<ReactFlowInstance<PlotCanvasNode> | null>(null);
  const previousStoryTabRef = useRef<WorkspaceTab>('dashboard');
  const previousStoryNodeCountRef = useRef<number>(0);
  const previousStoryProjectRootRef = useRef<string | null>(null);
  const previousPlotTabRef = useRef<WorkspaceTab>('dashboard');
  const previousPlotCountRef = useRef<number>(0);
  const previousStatusContextRef = useRef<{
    tab: WorkspaceTab | null;
    language: AppLanguage | null;
    hasProject: boolean | null;
  }>({ tab: null, language: null, hasProject: null });
  const storyAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyAutosaveInFlightRef = useRef<boolean>(false);

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = useMemo(
    () => (selectedNodeId ? (nodesById.get(selectedNodeId) ?? null) : null),
    [nodesById, selectedNodeId],
  );
  const dashboardGoalMetrics = useMemo(
    () => (currentProject ? buildDashboardGoalMetrics(currentProject, dashboard, t) : null),
    [currentProject, dashboard, t],
  );
  const editPlotLabel = useMemo(
    () => plots.find((plot) => plot.number === editPlotNumber)?.label?.trim() ?? '',
    [plots, editPlotNumber],
  );
  const currentEditNode = useMemo(
    () => (editNodeId ? (nodesById.get(editNodeId) ?? null) : null),
    [editNodeId, nodesById],
  );
  const outlineChapterTitleById = useMemo(
    () => new Map(outline.chapters.map((chapter) => [chapter.node.id, chapter.node.title])),
    [outline.chapters],
  );
  const isStoryEditDirty = useMemo(() => {
    if (!currentEditNode) {
      return false;
    }

    return (
      editTitle.trim() !== currentEditNode.data.title.trim() ||
      editDescription !== currentEditNode.data.description ||
      editPlotNumber !== currentEditNode.data.plotNumber ||
      editBlockNumber !== currentEditNode.data.blockNumber
    );
  }, [currentEditNode, editBlockNumber, editDescription, editPlotNumber, editTitle]);
  useEffect(() => {
    if (plots.length === 0) {
      return;
    }
    if (!plots.some((plot) => plot.number === newNodePlotNumber)) {
      setNewNodePlotNumber(plots[0]?.number ?? 1);
    }
  }, [newNodePlotNumber, plots]);
  const canOpenStoryCreationTools = Boolean(currentProject) && !busy;
  const hasUnsavedChanges =
    isStoryEditDirty ||
    chapterEditorDirty ||
    characterBoardDirty ||
    locationBoardDirty ||
    sceneBoardDirty;
  const nodeTypes = useMemo(
    () => ({
      chapter: ChapterFlowNode,
      character: CharacterFlowNode,
      location: LocationFlowNode,
    }),
    [],
  );
  const plotNodeTypes = useMemo(() => ({ plot: PlotFlowNode }), []);
  const statusTone = getStatusTone(status);
  const handleWorkspaceStatus = useCallback((message: string) => {
    setStatus(message);
  }, []);

  const showWorkspaceNotice = useCallback((message: string | null, durationMs = 0): void => {
    if (workspaceNoticeTimeoutRef.current) {
      clearTimeout(workspaceNoticeTimeoutRef.current);
      workspaceNoticeTimeoutRef.current = null;
    }

    setWorkspaceNotice(message);

    if (message && durationMs > 0) {
      workspaceNoticeTimeoutRef.current = setTimeout(() => {
        setWorkspaceNotice(null);
        workspaceNoticeTimeoutRef.current = null;
      }, durationMs);
    }
  }, []);

  const {
    handleOpenWikiSearchResult,
    handleWikiSearch,
    handleWikiSync,
    refreshWikiStatus,
    resetWikiSearch,
    resetWikiState,
    selectedWikiSearchResult,
    setSelectedWikiSearchResult,
    setWikiError,
    setWikiSearchQuery,
    setWikiStatus,
    syncProjectWikiAfterWorkspaceChange,
    wikiBusy,
    wikiError,
    wikiSearchQuery,
    wikiSearchResults,
    wikiStatus,
  } = useWikiState({ currentProject, setError, setStatus, showWorkspaceNotice, t });

  const handleCloseChapterEditor = useCallback(async () => {
    const wasDirty = chapterEditorDirty;
    if (chapterEditorFlushRef.current) {
      const ok = await chapterEditorFlushRef.current();
      if (!ok && wasDirty) {
        return;
      }
    }

    setEditorNodeId(null);
    setEditorNodeTitle('');
    setEditNodeId(null);
    void syncProjectWikiAfterWorkspaceChange();
  }, [chapterEditorDirty, syncProjectWikiAfterWorkspaceChange]);

  useEffect(() => {
    setPlotNodes((prev) => syncPlotFlowNodes(plots, prev, selectedPlotId, t('common.plot')));
  }, [plots, selectedPlotId, t]);

  useEffect(() => {
    return () => {
      if (workspaceNoticeTimeoutRef.current) {
        clearTimeout(workspaceNoticeTimeoutRef.current);
        workspaceNoticeTimeoutRef.current = null;
      }
    };
  }, []);

  const resetStoryWorkspace = useCallback(() => {
    setPlots([]);
    setPlotNodes([]);
    setNodes([]);
    setEdges([]);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditNodeId(null);
    setEditTitle('');
    setEditDescription('');
    setEditPlotNumber(1);
    setEditBlockNumber(1);
    setEditorNodeId(null);
    setEditorNodeTitle('');
    resetPlotState();
    setNewNodeTitle('Nuovo capitolo');
    setNewNodeDescription('');
    setNewNodePlotNumber(1);
    setNewNodeBlockNumber('');
    setIsNewNodeModalOpen(false);
    setChapterEditorDirty(false);
    setCharacterBoardDirty(false);
    setLocationBoardDirty(false);
    setSceneBoardDirty(false);
    setIsCloseProjectConfirmOpen(false);
  }, [resetPlotState, setIsCloseProjectConfirmOpen]);

  async function refreshStoryState(): Promise<void> {
    if (!currentProject) {
      return;
    }

    const state = await window.novelistApi.getStoryState();
    setPlots(state.plots);
    setNodes(
      state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots, chapterFlowLabels)),
    );
    setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
  }

  const refreshDashboardData = useCallback(async (): Promise<void> => {
    setDashboard((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    try {
      const listWritingSessions =
        typeof window.novelistApi.listWritingSessions === 'function'
          ? window.novelistApi.listWritingSessions
          : null;
      const [state, characterCards, locationCards, sceneCards, snapshots, writingSessions] =
        await Promise.all([
          window.novelistApi.getStoryState(),
          window.novelistApi.listCharacterCards(),
          window.novelistApi.listLocationCards(),
          window.novelistApi.listSceneCards(),
          window.novelistApi.listSnapshots(),
          listWritingSessions ? listWritingSessions() : Promise.resolve([]),
        ]);

      const [chapterDocuments, characterChapterLinks, locationChapterLinks] = await Promise.all([
        Promise.all(
          state.nodes.map((node) =>
            window.novelistApi.getChapterDocument({ chapterNodeId: node.id }),
          ),
        ),
        Promise.all(
          characterCards.map(async (card) => ({
            card,
            chapterNodeIds: await window.novelistApi.listCharacterChapterLinks({
              characterCardId: card.id,
            }),
          })),
        ),
        Promise.all(
          locationCards.map(async (card) => ({
            card,
            chapterNodeIds: await window.novelistApi.listLocationChapterLinks({
              locationCardId: card.id,
            }),
          })),
        ),
      ]);

      const documentsByNodeId = new Map(
        chapterDocuments.map((document) => [document.chapterNodeId, document]),
      );
      const characterLinkedChapterIds = new Set(
        characterChapterLinks.flatMap((link) => link.chapterNodeIds),
      );
      const locationLinkedChapterIds = new Set(
        locationChapterLinks.flatMap((link) => link.chapterNodeIds),
      );
      const sceneLinkedChapterIds = new Set(sceneCards.map((scene) => scene.chapterNodeId));
      const chapterIds = new Set(state.nodes.map((node) => node.id));
      const chapterTitleById = new Map(state.nodes.map((node) => [node.id, node.title]));
      const sceneIds = new Set(sceneCards.map((scene) => scene.id));
      const connectedSceneIds = new Set<string>();
      const connectedChapterIds = new Set<string>();
      for (const edge of state.edges) {
        connectedChapterIds.add(edge.sourceId);
        connectedChapterIds.add(edge.targetId);
        if (sceneIds.has(edge.sourceId)) {
          connectedSceneIds.add(edge.sourceId);
        }
        if (sceneIds.has(edge.targetId)) {
          connectedSceneIds.add(edge.targetId);
        }
      }

      const chapterMetrics = state.nodes
        .map((node) => {
          const document = documentsByNodeId.get(node.id);
          const documentUpdatedAt = document?.updatedAt ?? null;
          const updatedAt =
            parseTime(documentUpdatedAt) > parseTime(node.updatedAt)
              ? (documentUpdatedAt ?? node.updatedAt)
              : node.updatedAt;
          const wordCount = document?.wordCount ?? 0;
          const hasDescription = Boolean(node.description.trim());

          return {
            id: node.id,
            title: node.title,
            plotNumber: node.plotNumber,
            blockNumber: node.blockNumber,
            wordCount,
            updatedAt,
            hasDescription,
            descriptionStale:
              hasDescription &&
              wordCount > 0 &&
              parseTime(documentUpdatedAt) > parseTime(node.updatedAt),
          };
        })
        .sort((left, right) => {
          if (left.plotNumber !== right.plotNumber) {
            return left.plotNumber - right.plotNumber;
          }

          return left.blockNumber - right.blockNumber;
        });

      const sceneMetrics = sceneCards
        .map((scene) => ({
          id: scene.id,
          name: formatSceneName(scene),
          chapterTitle: chapterTitleById.get(scene.chapterNodeId) ?? 'Capitolo non trovato',
          plotNumber: scene.plotNumber,
          wordCount: countWords(scene.text),
          updatedAt: scene.updatedAt,
          hasText: Boolean(scene.text.trim()),
          hasChapter: chapterIds.has(scene.chapterNodeId),
          connected: connectedSceneIds.has(scene.id),
        }))
        .sort((left, right) => {
          if (left.plotNumber !== right.plotNumber) {
            return left.plotNumber - right.plotNumber;
          }
          return left.name.localeCompare(right.name, 'it');
        });

      const latestSnapshot =
        [...snapshots].sort(
          (left, right) => parseTime(right.createdAt) - parseTime(left.createdAt),
        )[0] ?? null;

      setPlots(state.plots);
      setNodes(
        state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots, chapterFlowLabels)),
      );
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      setDashboard({
        loading: false,
        error: null,
        totalWords: chapterMetrics.reduce((sum, chapter) => sum + chapter.wordCount, 0),
        chapterMetrics,
        lastModifiedChapter:
          [...chapterMetrics].sort(
            (left, right) => parseTime(right.updatedAt) - parseTime(left.updatedAt),
          )[0] ?? null,
        chaptersWithoutDescription: chapterMetrics.filter((chapter) => !chapter.hasDescription),
        chaptersWithStaleDescription: chapterMetrics.filter((chapter) => chapter.descriptionStale),
        chaptersWithoutCharacters: chapterMetrics.filter(
          (chapter) => !characterLinkedChapterIds.has(chapter.id),
        ),
        chaptersWithoutLocations: chapterMetrics.filter(
          (chapter) => !locationLinkedChapterIds.has(chapter.id),
        ),
        chaptersWithoutScenes: chapterMetrics.filter(
          (chapter) => !sceneLinkedChapterIds.has(chapter.id),
        ),
        unusedCharacters: characterChapterLinks
          .filter((link) => link.chapterNodeIds.length === 0)
          .map((link) => formatCharacterName(link.card)),
        unusedLocations: locationChapterLinks
          .filter((link) => link.chapterNodeIds.length === 0)
          .map((link) => formatLocationName(link.card)),
        unusedScenes: sceneCards
          .filter((scene) => !chapterIds.has(scene.chapterNodeId))
          .map(formatSceneName),
        scenesWithoutText: sceneMetrics
          .filter((scene) => !scene.hasText)
          .map((scene) => scene.name),
        disconnectedScenes: sceneMetrics
          .filter((scene) => !scene.connected)
          .map((scene) => scene.name),
        sceneMetrics,
        disconnectedChapters: chapterMetrics.filter(
          (chapter) => !connectedChapterIds.has(chapter.id),
        ),
        latestSnapshot,
        writingSessions,
        characterCount: characterCards.length,
        locationCount: locationCards.length,
        sceneCount: sceneCards.length,
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setDashboard((previous) => ({
        ...previous,
        loading: false,
        error: message,
      }));
      setError(message);
      setStatus(t('dashboard.status.refreshError'));
    }
  }, []);

  const refreshOutlineData = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      setOutline(createEmptyOutlineState());
      return;
    }

    setOutline((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    try {
      const [state, characterCards, locationCards, sceneCards] = await Promise.all([
        window.novelistApi.getStoryState(),
        window.novelistApi.listCharacterCards(),
        window.novelistApi.listLocationCards(),
        window.novelistApi.listSceneCards(),
      ]);
      const [characterChapterLinks, locationChapterLinks] = await Promise.all([
        Promise.all(
          characterCards.map(async (card) => ({
            card,
            chapterNodeIds: await window.novelistApi.listCharacterChapterLinks({
              characterCardId: card.id,
            }),
          })),
        ),
        Promise.all(
          locationCards.map(async (card) => ({
            card,
            chapterNodeIds: await window.novelistApi.listLocationChapterLinks({
              locationCardId: card.id,
            }),
          })),
        ),
      ]);

      const { orderedChapters, incomingById, outgoingById, cycleIds } = buildOutlineChapterOrder(
        state.nodes,
        state.edges,
      );
      const plotsByNumber = new Map(state.plots.map((plot) => [plot.number, plot]));
      const scenesByChapterId = new Map<string, DashboardSceneCard[]>();
      const charactersByChapterId = new Map<string, DashboardCharacterCard[]>();
      const locationsByChapterId = new Map<string, DashboardLocationCard[]>();

      for (const scene of sceneCards) {
        const current = scenesByChapterId.get(scene.chapterNodeId) ?? [];
        current.push(scene);
        scenesByChapterId.set(scene.chapterNodeId, current);
      }
      for (const link of characterChapterLinks) {
        for (const chapterNodeId of link.chapterNodeIds) {
          const current = charactersByChapterId.get(chapterNodeId) ?? [];
          current.push(link.card);
          charactersByChapterId.set(chapterNodeId, current);
        }
      }
      for (const link of locationChapterLinks) {
        for (const chapterNodeId of link.chapterNodeIds) {
          const current = locationsByChapterId.get(chapterNodeId) ?? [];
          current.push(link.card);
          locationsByChapterId.set(chapterNodeId, current);
        }
      }

      const outlineChapters = orderedChapters.map<OutlineChapter>((node) => {
        const incomingIds = incomingById.get(node.id) ?? [];
        const outgoingIds = outgoingById.get(node.id) ?? [];
        const issues: string[] = [];
        if (incomingIds.length === 0 && outgoingIds.length === 0) {
          issues.push('Isolato');
        }
        if (incomingIds.length > 1) {
          issues.push('Entrate multiple');
        }
        if (outgoingIds.length > 1) {
          issues.push('Uscite multiple');
        }
        if (cycleIds.has(node.id)) {
          issues.push('Ciclo');
        }

        return {
          node,
          plot: plotsByNumber.get(node.plotNumber) ?? null,
          scenes: [...(scenesByChapterId.get(node.id) ?? [])].sort((left, right) =>
            formatSceneName(left).localeCompare(formatSceneName(right), 'it'),
          ),
          characters: [...(charactersByChapterId.get(node.id) ?? [])].sort((left, right) =>
            formatCharacterName(left).localeCompare(formatCharacterName(right), 'it'),
          ),
          locations: [...(locationsByChapterId.get(node.id) ?? [])].sort((left, right) =>
            formatLocationName(left).localeCompare(formatLocationName(right), 'it'),
          ),
          incomingIds,
          outgoingIds,
          issues,
        };
      });

      setPlots(state.plots);
      setNodes(
        state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots, chapterFlowLabels)),
      );
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      setOutline({
        loading: false,
        saving: false,
        error: null,
        chapters: outlineChapters,
        isolatedCount: outlineChapters.filter((chapter) => chapter.issues.includes('Isolato'))
          .length,
        ambiguousCount: outlineChapters.filter((chapter) =>
          chapter.issues.some((issue) => issue !== 'Isolato'),
        ).length,
      });
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setOutline((previous) => ({
        ...previous,
        loading: false,
        saving: false,
        error: message,
      }));
      setError(message);
      setStatus(t('outline.status.refreshError'));
    }
  }, [chapterFlowLabels, currentProject, t]);

  const syncOutlineOrder = useCallback(
    async (nextChapters: OutlineChapter[]): Promise<void> => {
      if (!currentProject || nextChapters.length === 0) {
        return;
      }

      setOutline((previous) => ({
        ...previous,
        saving: true,
        error: null,
        chapters: nextChapters,
      }));
      setBusy(true);
      setError(null);

      try {
        const state = await window.novelistApi.getStoryState();
        const chapterIds = new Set(state.nodes.map((node) => node.id));
        const chapterEdges = state.edges.filter(
          (edge) => chapterIds.has(edge.sourceId) && chapterIds.has(edge.targetId),
        );

        await Promise.all(
          chapterEdges.map((edge) => window.novelistApi.deleteStoryEdge({ id: edge.id })),
        );
        for (let index = 1; index < nextChapters.length; index += 1) {
          await window.novelistApi.createStoryEdge({
            sourceId: nextChapters[index - 1]!.node.id,
            targetId: nextChapters[index]!.node.id,
          });
        }

        await refreshOutlineData();
        await syncProjectWikiAfterWorkspaceChange();
        setStatus(t('outline.status.synced'));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setOutline((previous) => ({
          ...previous,
          saving: false,
          error: message,
        }));
        setError(message);
        setStatus(t('outline.status.syncError'));
      } finally {
        setBusy(false);
      }
    },
    [currentProject, refreshOutlineData, syncProjectWikiAfterWorkspaceChange, t],
  );

  function handleOutlineDrop(targetChapterId: string): void {
    if (!draggedOutlineChapterId || draggedOutlineChapterId === targetChapterId || outline.saving) {
      setDraggedOutlineChapterId(null);
      return;
    }

    const draggedIndex = outline.chapters.findIndex(
      (chapter) => chapter.node.id === draggedOutlineChapterId,
    );
    const targetIndex = outline.chapters.findIndex(
      (chapter) => chapter.node.id === targetChapterId,
    );
    if (draggedIndex < 0 || targetIndex < 0) {
      setDraggedOutlineChapterId(null);
      return;
    }

    const nextChapters = [...outline.chapters];
    const [draggedChapter] = nextChapters.splice(draggedIndex, 1);
    if (!draggedChapter) {
      setDraggedOutlineChapterId(null);
      return;
    }
    nextChapters.splice(targetIndex, 0, draggedChapter);
    setDraggedOutlineChapterId(null);
    void syncOutlineOrder(nextChapters);
  }

  useEffect(() => {
    if (!currentProject) {
      setDashboard(createEmptyDashboardState());
      setOutline(createEmptyOutlineState());
      return;
    }

    if (activeTab === 'dashboard') {
      void refreshDashboardData();
    }
    if (activeTab === 'outline') {
      void refreshOutlineData();
    }
  }, [activeTab, currentProject, refreshDashboardData, refreshOutlineData]);

  useEffect(() => {
    if (activeTab !== 'memory') {
      return;
    }
    void refreshMemoryStorySummary();
  }, [activeTab, refreshMemoryStorySummary]);

  useEffect(() => {
    const hasProject = Boolean(currentProject);
    const previousContext = previousStatusContextRef.current;
    previousStatusContextRef.current = { tab: activeTab, language: appLanguage, hasProject };

    const enteringDifferentTab = previousContext.tab !== activeTab;
    const languageChanged = previousContext.language !== appLanguage;
    const projectClosed = previousContext.hasProject === true && !hasProject;
    const initialStatus = previousContext.tab === null;
    if (!enteringDifferentTab && !languageChanged && !projectClosed && !initialStatus) {
      return;
    }

    setStatus(t(getWorkspaceStatusKey(activeTab, hasProject)));
  }, [activeTab, appLanguage, currentProject, t]);

  function openMemoryTab(): void {
    resetWikiSearch();
    setActiveTab('memory');
    void refreshWikiStatus();
    void refreshMemoryStorySummary();
  }

  async function handleSaveProjectTargets(): Promise<void> {
    if (!currentProject) {
      return;
    }

    const targetWordCount = toOptionalPositiveInteger(editProjectTargetWords);
    const targetChapterWordCount = toOptionalPositiveInteger(editProjectTargetChapterWords);
    const plannedCompletionDate = editProjectCompletionDate.trim() || null;
    const updateProjectPlanning = (
      window.novelistApi as typeof window.novelistApi & {
        updateProjectPlanning?: (payload: {
          targetWordCount: number | null;
          targetChapterWordCount: number | null;
          plannedCompletionDate: string | null;
        }) => Promise<NonNullable<ProjectRecord>>;
      }
    ).updateProjectPlanning;

    if (typeof updateProjectPlanning !== 'function') {
      const message = t('project.status.goalsUnavailable');
      setError(message);
      setStatus(t('project.status.goalsUnsaved'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const planningInput = {
        targetWordCount,
        targetChapterWordCount,
        plannedCompletionDate,
      };
      const project = await updateProjectPlanning(planningInput);
      if (!projectPlanningMatches(project, planningInput)) {
        const message = t('project.status.goalsUnavailable');
        setError(message);
        setStatus(t('project.status.goalsUnsaved'));
        return;
      }
      setCurrentProject(project);
      setIsProjectTargetsModalOpen(false);
      setStatus(t('project.status.goalsSaved'));
      void refreshDashboardData();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('project.status.goalsSaveError'));
    } finally {
      setBusy(false);
    }
  }

  const syncOpenedProject = useCallback(
    async (project: NonNullable<ProjectRecord>, statusMessage: string): Promise<void> => {
      const state = await window.novelistApi.getStoryState();
      const settings = normalizeCodexSettings(await window.novelistApi.codexGetSettings());
      const memoryStatus = await window.novelistApi.wikiGetStatus();

      resetStoryWorkspace();
      setCurrentProject(project);
      setPlots(state.plots);
      setNodes(
        state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots, chapterFlowLabels)),
      );
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      setActiveTab('dashboard');
      loadAiSettings(settings);
      setWikiStatus(memoryStatus);
      setWikiError(null);
      resetWikiSearch();
      setLastAiMemorySources([]);
      setStatus(statusMessage);
      void refreshDashboardData();
    },
    [
      chapterFlowLabels,
      loadAiSettings,
      refreshDashboardData,
      resetStoryWorkspace,
      resetWikiSearch,
    ],
  );

  async function handleCreateProject(): Promise<void> {
    const rootPath = createProjectRoot.trim();
    const name = createProjectName.trim();
    const targetWordCount = toOptionalPositiveInteger(createProjectTargetWords);
    const targetChapterWordCount = toOptionalPositiveInteger(createProjectTargetChapterWords);
    const plannedCompletionDate = createProjectCompletionDate.trim() || null;
    if (!rootPath || !name) {
      setStatus(t('project.status.requireDirectoryAndName'));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const planningInput = {
        targetWordCount,
        targetChapterWordCount,
        plannedCompletionDate,
      };
      const project = await window.novelistApi.createProject({
        rootPath,
        name,
        ...planningInput,
      });
      const shouldPersistPlanning =
        targetWordCount !== null ||
        targetChapterWordCount !== null ||
        plannedCompletionDate !== null;
      const planningPersisted = projectPlanningMatches(project, planningInput);
      if (shouldPersistPlanning && !planningPersisted) {
        setError(t('project.status.goalsUnavailable'));
      }
      resetCreateProjectFormAfterCreate(project);
      await syncOpenedProject(
        project,
        shouldPersistPlanning && !planningPersisted
          ? t('project.status.createdWithoutGoals')
          : t('project.status.created', { name: project.name }),
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('project.status.createError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenProject(): Promise<void> {
    const selectedPath = await window.novelistApi.selectProjectDirectory();
    if (!selectedPath) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const project = await window.novelistApi.openProject({
        rootPath: selectedPath,
      });
      await syncOpenedProject(project, t('project.status.opened', { name: project.name }));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('project.status.openError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProject(): Promise<void> {
    if (!currentProject) {
      setStatus(t('project.status.requireOpenProject'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const snapshot = await window.novelistApi.saveSnapshot({ reason: 'manual' });
      setStatus(t('project.status.saved', { name: snapshot.fileName }));
      void refreshDashboardData();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('project.status.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function performCloseProject(): Promise<void> {
    if (!currentProject) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await window.novelistApi.closeProject();
      resetProjectSessionState();
      resetAiSettings();
      resetWikiState();
      setLastAiMemorySources([]);
      setActiveTab('dashboard');
      setDashboard(createEmptyDashboardState());
      resetStoryWorkspace();
      setStatus(t('project.status.closed'));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('project.status.closeError'));
    } finally {
      setBusy(false);
    }
  }

  async function flushPendingChangesBeforeClose(): Promise<boolean> {
    const storySaved = await persistNodeEdit({ closeAfterSave: false, silent: true });
    if (!storySaved && isStoryEditDirty) {
      return false;
    }

    if (chapterEditorFlushRef.current) {
      const ok = await chapterEditorFlushRef.current();
      if (!ok && chapterEditorDirty) {
        return false;
      }
    }

    if (characterBoardFlushRef.current) {
      const ok = await characterBoardFlushRef.current();
      if (!ok && characterBoardDirty) {
        return false;
      }
    }

    if (locationBoardFlushRef.current) {
      const ok = await locationBoardFlushRef.current();
      if (!ok && locationBoardDirty) {
        return false;
      }
    }

    if (sceneBoardFlushRef.current) {
      const ok = await sceneBoardFlushRef.current();
      if (!ok && sceneBoardDirty) {
        return false;
      }
    }

    if (currentProject) {
      setBusy(true);
      setError(null);
      try {
        await window.novelistApi.saveSnapshot({ reason: 'manual' });
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
        setStatus(t('project.status.saveBeforeCloseError'));
        return false;
      } finally {
        setBusy(false);
      }
    }

    return true;
  }

  function requestCloseProject(): void {
    if (!currentProject) {
      return;
    }

    if (hasUnsavedChanges) {
      setIsCloseProjectConfirmOpen(true);
      return;
    }

    void performCloseProject();
  }

  async function handleSelectCreateProjectDirectory(): Promise<void> {
    setError(null);
    try {
      const selectedPath = await window.novelistApi.selectProjectDirectory();
      if (!selectedPath) {
        return;
      }

      setCreateProjectRoot(selectedPath);
      setStatus(t('project.status.directorySelected', { path: selectedPath }));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('project.status.directorySelectError'));
    }
  }

  async function handleCreatePlot(): Promise<void> {
    if (!currentProject) {
      return;
    }
    if (plots.some((plot) => plot.number === newPlotNumber)) {
      setStatus(t('plot.status.alreadyExists', { number: newPlotNumber }));
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const createdPlot = await window.novelistApi.createPlot({
        number: newPlotNumber,
        label: newPlotLabel.trim() || undefined,
        summary: newPlotSummary,
        positionX: getDefaultPlotPosition(newPlotNumber).x,
        positionY: getDefaultPlotPosition(newPlotNumber).y,
      });
      await window.novelistApi.updatePlot({
        id: createdPlot.id,
        label: normalizePlotLabel(createdPlot.number, createdPlot.label, t('common.plot')),
        summary: newPlotSummary,
        color: createdPlot.color,
        positionX: createdPlot.positionX,
        positionY: createdPlot.positionY,
      });

      await refreshStoryState();
      setStatus(
        t('plot.status.created', {
          name: normalizePlotLabel(newPlotNumber, newPlotLabel, t('common.plot')),
        }),
      );
      setNewNodePlotNumber(newPlotNumber);
      resetPlotDraftAfterCreate(newPlotNumber + 1);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('plot.status.createError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePlotStructure(): Promise<void> {
    if (!currentProject) {
      return;
    }
    if (!newPlotSummary.trim()) {
      setStatus(t('plot.status.requireSummaryForStructure'));
      return;
    }
    if (plots.some((plot) => plot.number === newPlotNumber)) {
      setStatus(t('plot.status.alreadyExists', { number: newPlotNumber }));
      return;
    }

    setBusy(true);
    setPlotStructureBusy(true);
    setError(null);

    try {
      const createdPlot = await window.novelistApi.createPlot({
        number: newPlotNumber,
        label: newPlotLabel.trim() || undefined,
        summary: newPlotSummary,
        positionX: getDefaultPlotPosition(newPlotNumber).x,
        positionY: getDefaultPlotPosition(newPlotNumber).y,
      });
      const savedPlot = await window.novelistApi.updatePlot({
        id: createdPlot.id,
        label: normalizePlotLabel(createdPlot.number, createdPlot.label, t('common.plot')),
        summary: newPlotSummary,
        color: createdPlot.color,
        positionX: createdPlot.positionX,
        positionY: createdPlot.positionY,
      });

      const persistedAiSettings = normalizeCodexSettings(
        await window.novelistApi.codexGetSettings(),
      );
      const runtimeAiSettings = hasPendingAiSettingsChanges(
        aiSettings,
        persistedAiSettings,
        aiApiKeyInput,
        clearStoredApiKey,
      )
        ? await window.novelistApi.codexUpdateSettings({
            enabled: aiSettings?.enabled,
            provider: aiSettings?.provider,
            fallbackProvider: aiSettings?.fallbackProvider,
            allowApiCalls: aiSettings?.allowApiCalls,
            allowExternalMemorySharing: aiSettings?.allowExternalMemorySharing,
            autoSummarizeDescriptions: aiSettings?.autoSummarizeDescriptions,
            apiKey: aiApiKeyInput.trim() || undefined,
            clearStoredApiKey: clearStoredApiKey || undefined,
            apiModel: aiSettings?.apiModel,
            apiImageModel: aiSettings
              ? normalizeCodexSettings(aiSettings).apiImageModel
              : undefined,
            ollamaModel: aiSettings ? normalizeCodexSettings(aiSettings).ollamaModel : undefined,
          })
        : persistedAiSettings;

      loadAiSettings(runtimeAiSettings);
      if (!runtimeAiSettings.enabled) {
        await refreshStoryState();
        setStatus(t('plot.status.savedAiConsentRequired'));
        setNewNodePlotNumber(createdPlot.number);
        resetPlotDraftAfterCreate(createdPlot.number + 1);
        return;
      }

      const runtimeAiStatus = await window.novelistApi.codexStatus();
      if (!runtimeAiStatus.available) {
        await refreshStoryState();
        setStatus(
          runtimeAiStatus.reason?.trim()
            ? t('plot.status.structureUnavailableWithReason', { reason: runtimeAiStatus.reason })
            : t('plot.status.structureProviderUnavailable'),
        );
        return;
      }

      setStatus(t('plot.status.structureCreating'));
      const structureRequestMessage = buildPlotStructurePrompt(appLanguage);
      const structureRequestContext =
        appLanguage === 'en'
          ? `Plot number: ${savedPlot.number}\nPlot title: ${savedPlot.label}\nPlot draft:\n${savedPlot.summary}`
          : `Numero trama: ${savedPlot.number}\nTitolo trama: ${savedPlot.label}\nBozza trama:\n${savedPlot.summary}`;
      const response = await window.novelistApi.codexAssist({
        projectName: currentProject.name,
        message: structureRequestMessage,
        context: structureRequestContext,
      });

      if (response.cancelled || !response.output.trim()) {
        await refreshStoryState();
        setStatus(t('entity.status.aiRequestCancelled'));
        return;
      }

      if (response.mode === 'fallback') {
        await refreshStoryState();
        setStatus(
          response.error?.trim()
            ? t('plot.status.structureUnavailableWithReason', { reason: response.error })
            : t('plot.status.structureFallback'),
        );
        return;
      }

      let blocks = tryParsePlotStructureBlocks(response.output);
      if (blocks.length < 4) {
        setStatus(t('plot.status.structureRefining'));
        const repairResponse = await window.novelistApi.codexAssist({
          projectName: currentProject.name,
          message: buildPlotStructureRepairPrompt(appLanguage),
          context: `${structureRequestContext}\n\n${t('plot.status.structureRepairContextLabel')}:\n${response.output}`,
        });

        if (repairResponse.cancelled || !repairResponse.output.trim()) {
          await refreshStoryState();
          setStatus(t('entity.status.aiRequestCancelled'));
          return;
        }

        if (repairResponse.mode === 'fallback') {
          await refreshStoryState();
          setStatus(
            repairResponse.error?.trim()
              ? t('plot.status.structureUnavailableWithReason', { reason: repairResponse.error })
              : t('plot.status.structureFallback'),
          );
          return;
        }

        blocks = tryParsePlotStructureBlocks(repairResponse.output);
      }

      if (blocks.length < 4) {
        await refreshStoryState();
        setStatus(t('plot.status.structureTooShort'));
        return;
      }

      const latestState = await window.novelistApi.getStoryState();
      const basePosition = getNearbyCanvasPosition(
        latestState.nodes.map((node) => ({ x: node.positionX, y: node.positionY })),
        {
          emptyPosition: { x: 120, y: 120 },
          minDistance: 185,
          radiusStep: 135,
        },
      );

      const createdNodes: CreatedChapterNode[] = [];
      for (const [index, block] of blocks.entries()) {
        const createdNode = await window.novelistApi.createStoryNode({
          title: block.title,
          description: block.description,
          plotNumber: savedPlot.number,
          positionX: basePosition.x + (index % 2) * 320,
          positionY: basePosition.y + Math.floor(index / 2) * 190,
        });
        createdNodes.push(createdNode);
      }

      for (let index = 1; index < createdNodes.length; index += 1) {
        await window.novelistApi.createStoryEdge({
          sourceId: createdNodes[index - 1]!.id,
          targetId: createdNodes[index]!.id,
        });
      }

      await refreshStoryState();
      setActiveTab('story');
      setStatus(t('plot.status.structureCreated', { count: createdNodes.length }));
      setNewNodePlotNumber(savedPlot.number);
      resetPlotDraftAfterCreate(savedPlot.number + 1);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('plot.status.structureCreateError'));
    } finally {
      setPlotStructureBusy(false);
      setBusy(false);
    }
  }

  async function handleSavePlotEdit(): Promise<void> {
    if (!currentEditPlot) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const saved = await window.novelistApi.updatePlot({
        id: currentEditPlot.id,
        label: normalizePlotLabel(currentEditPlot.number, editPlotLabelInput, t('common.plot')),
        summary: editPlotSummaryInput,
        color: currentEditPlot.color,
        positionX: currentEditPlot.positionX,
        positionY: currentEditPlot.positionY,
      });
      setPlots((prev) => sortPlots(prev.map((plot) => (plot.id === saved.id ? saved : plot))));
      resetPlotEditor();
      setStatus(t('plot.status.saved', { name: saved.label }));
      void syncProjectWikiAfterWorkspaceChange();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('plot.status.saveError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelectedPlot(): Promise<void> {
    if (!selectedPlot) {
      return;
    }

    const deletePlot = (
      window.novelistApi as typeof window.novelistApi & {
        deletePlot?: (payload: { id: string }) => Promise<{ ok: true }>;
      }
    ).deletePlot;

    if (typeof deletePlot !== 'function') {
      setError(t('plot.status.deleteApiUnavailableDetail'));
      setStatus(t('plot.status.deleteApiUnavailable'));
      return;
    }

    const deletedPlotLabel = normalizePlotLabel(
      selectedPlot.number,
      selectedPlot.label,
      t('common.plot'),
    );

    setBusy(true);
    setError(null);

    try {
      await deletePlot({ id: selectedPlot.id });
      await refreshStoryState();
      setSelectedPlotId(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      resetPlotEditor();
      setStatus(t('plot.status.deleted', { name: deletedPlotLabel }));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('plot.status.deleteError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateNode(): Promise<void> {
    if (!currentProject) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextPosition = getNearbyCanvasPosition(
        nodes.map((node) => node.position),
        {
          emptyPosition: { x: 120, y: 120 },
          minDistance: 185,
          radiusStep: 135,
        },
      );
      const created = await window.novelistApi.createStoryNode({
        title: newNodeTitle,
        description: newNodeDescription,
        plotNumber: newNodePlotNumber,
        blockNumber: newNodeBlockNumber ? Number(newNodeBlockNumber) : undefined,
        positionX: nextPosition.x,
        positionY: nextPosition.y,
      });

      setNodes((prev) => [...prev, mapNodeRecordToFlowNode(created, plots, chapterFlowLabels)]);
      setStatus(t('story.status.blockCreated', { title: created.title }));
      setSelectedNodeId(created.id);
      setNewNodeTitle(t('story.modal.titlePlaceholder'));
      setNewNodeDescription('');
      setNewNodeBlockNumber('');
      setIsNewNodeModalOpen(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('story.status.blockCreateError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleConnect(connection: Connection): Promise<void> {
    if (!connection.source || !connection.target) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await window.novelistApi.createStoryEdge({
        sourceId: connection.source,
        targetId: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });

      setEdges((prev) => [
        ...prev,
        mapEdgeRecordToFlowEdge(created, {
          sourceHandle: connection.sourceHandle,
          targetHandle: connection.targetHandle,
        }),
      ]);
      setStatus(t('story.status.connectionCreated'));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('story.status.connectionCreateError'));
    } finally {
      setBusy(false);
    }
  }

  const handleNodeDragStop: OnNodeDrag<ChapterCanvasNode> = async (_event, node, draggedNodes) => {
    setError(null);

    try {
      const nodesToPersist = (draggedNodes.length > 0 ? draggedNodes : [node]).filter(
        (draggedNode) => draggedNode.type === 'chapter',
      );

      if (nodesToPersist.length > 0) {
        const updatedNodes = await Promise.all(
          nodesToPersist.map((draggedNode) => {
            const data = draggedNode.data;
            return window.novelistApi.updateStoryNode({
              id: draggedNode.id,
              title: data.title,
              description: data.description,
              plotNumber: data.plotNumber,
              blockNumber: data.blockNumber,
              positionX: draggedNode.position.x,
              positionY: draggedNode.position.y,
            });
          }),
        );
        const updatedById = new Map(updatedNodes.map((updated) => [updated.id, updated]));

        setNodes((prev) =>
          prev.map((item) => {
            const updated = updatedById.get(item.id);
            return updated
              ? {
                  ...mapNodeRecordToFlowNode(updated, plots, chapterFlowLabels),
                  selected: item.selected,
                }
              : item;
          }),
        );

        const firstUpdated = updatedNodes[0];
        if (firstUpdated) {
          setStatus(t('story.status.blockPositionSaved', { title: firstUpdated.title }));
        }
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('story.status.blockPositionSaveError'));
    }
  };

  const handleNodeDoubleClick: NodeMouseHandler<ChapterCanvasNode> = (_event, node) => {
    openEditorForNode(node.id);
  };

  function openEditorForNode(nodeId: string): void {
    const node = nodesById.get(nodeId);
    if (!node) {
      return;
    }

    setEditNodeId(null);
    setEditorNodeId(node.id);
    setEditorNodeTitle(node.data.title);
  }

  const persistNodeEdit = useCallback(
    async (options?: {
      closeAfterSave?: boolean;
      silent?: boolean;
      successStatus?: string;
    }): Promise<boolean> => {
      if (!editNodeId) {
        return false;
      }

      const currentNode = nodes.find((node) => node.id === editNodeId);
      if (!currentNode) {
        return false;
      }

      if (!isStoryEditDirty) {
        if (options?.closeAfterSave) {
          setEditNodeId(null);
        }
        return false;
      }

      setBusy(true);
      setError(null);

      try {
        const updated = await window.novelistApi.updateStoryNode({
          id: editNodeId,
          title: editTitle,
          description: editDescription,
          plotNumber: editPlotNumber,
          blockNumber: editBlockNumber,
          positionX: currentNode.position.x,
          positionY: currentNode.position.y,
        });

        setNodes((prev) =>
          prev.map((item) =>
            item.id === editNodeId
              ? mapNodeRecordToFlowNode(updated, plots, chapterFlowLabels)
              : item,
          ),
        );
        setEditTitle(updated.title);
        setEditDescription(updated.description);
        setEditPlotNumber(updated.plotNumber);
        setEditBlockNumber(updated.blockNumber);
        if (!options?.silent) {
          setStatus(options?.successStatus ?? t('story.status.blockSaved', { title: updated.title }));
        }
        if (options?.closeAfterSave) {
          setEditNodeId(null);
        }
        return true;
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
        setStatus(t('story.status.blockSaveError'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [
      editBlockNumber,
      editDescription,
      editNodeId,
      editPlotNumber,
      editTitle,
      isStoryEditDirty,
      nodes,
      plots,
      chapterFlowLabels,
      t,
    ],
  );

  async function handleSaveNodeEdit(): Promise<void> {
    await persistNodeEdit({ closeAfterSave: true });
  }

  async function handleDeleteSelectedNode(): Promise<void> {
    const selectedNodeIds = nodes.filter((node) => node.selected).map((node) => node.id);
    const nodeIdsToDelete = selectedNodeIds.length > 0 ? selectedNodeIds : selectedNodeId ? [selectedNodeId] : [];

    if (nodeIdsToDelete.length === 0) {
      return;
    }

    const nodeIdSet = new Set(nodeIdsToDelete);
    setBusy(true);
    setError(null);

    try {
      await Promise.all(nodeIdsToDelete.map((id) => window.novelistApi.deleteStoryNode({ id })));
      setNodes((prev) => prev.filter((node) => !nodeIdSet.has(node.id)));
      setEdges((prev) =>
        prev.filter((edge) => !nodeIdSet.has(edge.source) && !nodeIdSet.has(edge.target)),
      );
      setSelectedNodeId(null);
      setStatus(
        nodeIdsToDelete.length === 1
          ? t('story.status.blockDeleted')
          : t('story.status.blocksDeleted', { count: nodeIdsToDelete.length }),
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('story.status.blockDeleteError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelectedEdge(): Promise<void> {
    const selectedEdgeIds = edges.filter((edge) => edge.selected).map((edge) => edge.id);
    const edgeIdsToDelete = selectedEdgeIds.length > 0 ? selectedEdgeIds : selectedEdgeId ? [selectedEdgeId] : [];

    if (edgeIdsToDelete.length === 0) {
      return;
    }

    const edgeIdSet = new Set(edgeIdsToDelete);
    setBusy(true);
    setError(null);

    try {
      await Promise.all(edgeIdsToDelete.map((id) => window.novelistApi.deleteStoryEdge({ id })));
      setEdges((prev) => prev.filter((edge) => !edgeIdSet.has(edge.id)));
      setSelectedEdgeId(null);
      setStatus(
        edgeIdsToDelete.length === 1
          ? t('story.status.connectionDeleted')
          : t('story.status.connectionsDeleted', { count: edgeIdsToDelete.length }),
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('story.status.connectionDeleteError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleExportManuscriptDocx(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await window.novelistApi.exportManuscriptDocx();
      if (result) {
        setStatus(t('export.status.manuscriptDocxExported', { filePath: result.filePath }));
      } else {
        setStatus(t('export.status.manuscriptDocxCancelled'));
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus(t('export.status.manuscriptDocxError'));
    } finally {
      setBusy(false);
    }
  }

  async function handleExportManuscriptEpub(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await window.novelistApi.exportManuscriptEpub();
      if (result) {
        setStatus(t('export.status.manuscriptEpubExported', { filePath: result.filePath }));
      } else {
        setStatus(t('export.status.manuscriptEpubCancelled'));
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus(t('export.status.manuscriptEpubError'));
    } finally {
      setBusy(false);
    }
  }

  async function handlePrintManuscript(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await window.novelistApi.printManuscript();
      if (result) {
        setStatus(t('export.status.manuscriptPrintSent'));
      } else {
        setStatus(t('export.status.manuscriptPrintCancelled'));
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus(t('export.status.manuscriptPrintError'));
    } finally {
      setBusy(false);
    }
  }

  const onEdgesDelete: OnEdgesDelete = useCallback(
    async (deletedEdges) => {
      if (deletedEdges.length === 0) {
        return;
      }

      await Promise.all(
        deletedEdges.map((edge) => window.novelistApi.deleteStoryEdge({ id: edge.id })),
      );
      setStatus(t('story.status.connectionsDeleted', { count: deletedEdges.length }));
    },
    [t],
  );

  const onNodesDelete: OnNodesDelete<ChapterCanvasNode> = useCallback(
    async (deletedNodes) => {
      if (deletedNodes.length === 0) {
        return;
      }

      await Promise.all(
        deletedNodes.map((node) => window.novelistApi.deleteStoryNode({ id: node.id })),
      );
      setStatus(t('story.status.blocksDeleted', { count: deletedNodes.length }));
    },
    [t],
  );

  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<ChapterCanvasNode, Edge>) => {
      setSelectedNodeId(selection.nodes[0]?.id ?? null);
      setSelectedEdgeId(selection.edges[0]?.id ?? null);
    },
    [],
  );

  const onPlotSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<PlotCanvasNode>) => {
      setSelectedPlotId(selection.nodes[0]?.id ?? null);
    },
    [],
  );

  const onPlotNodeClick: NodeMouseHandler<PlotCanvasNode> = useCallback(
    (event, node) => {
      setSelectedPlotId(node.id);

      if (event.detail < 2) {
        return;
      }

      const plot = plotsById.get(node.id);
      if (!plot) {
        return;
      }

      openPlotEditor(plot);
    },
    [plotsById, t],
  );

  const onPlotNodesChange: OnNodesChange<PlotCanvasNode> = useCallback((changes) => {
    setPlotNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onPlotNodeDragStop: NodeMouseHandler<PlotCanvasNode> = useCallback(
    async (_event, node) => {
      const plot = plotsById.get(node.id);
      if (!plot) {
        return;
      }

      try {
        const updated = await window.novelistApi.updatePlot({
          id: plot.id,
          label: normalizePlotLabel(plot.number, plot.label, t('common.plot')),
          summary: plot.summary,
          color: plot.color,
          positionX: node.position.x,
          positionY: node.position.y,
        });

        setPlots((prev) =>
          sortPlots(prev.map((item) => (item.id === updated.id ? updated : item))),
        );
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
      }
    },
    [plotsById],
  );

  const onNodesChange: OnNodesChange<ChapterCanvasNode> = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange: OnEdgesChange<Edge> = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const onEdgeClick: EdgeMouseHandler = useCallback((_event, edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await refreshAppPreferences();
      } catch {
        setAppPreferences({
          autosaveMode: 'auto',
          autosaveIntervalMinutes: 5,
          languageMode: 'auto',
          effectiveLanguage: navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en',
          themeMode: 'system',
          updatedAt: new Date().toISOString(),
        });
      }

      const existingProject = await window.novelistApi.getCurrentProject();
      if (!existingProject) {
        return;
      }

      await syncOpenedProject(
        existingProject,
        t('project.status.restored', { name: existingProject.name }),
      );
    })();
  }, [refreshAppPreferences, setAppPreferences]);

  useEffect(() => {
    if (storyAutosaveTimeoutRef.current) {
      clearTimeout(storyAutosaveTimeoutRef.current);
      storyAutosaveTimeoutRef.current = null;
    }

    if (appPreferences?.autosaveMode !== 'auto' || !isStoryEditDirty || !editNodeId) {
      return;
    }

    storyAutosaveTimeoutRef.current = setTimeout(() => {
      if (storyAutosaveInFlightRef.current) {
        return;
      }

      storyAutosaveInFlightRef.current = true;
      void persistNodeEdit({
        closeAfterSave: false,
        successStatus: t('editor.status.autosavedBlock'),
      }).finally(() => {
        storyAutosaveInFlightRef.current = false;
      });
    }, 900);

    return () => {
      if (storyAutosaveTimeoutRef.current) {
        clearTimeout(storyAutosaveTimeoutRef.current);
        storyAutosaveTimeoutRef.current = null;
      }
    };
  }, [appPreferences?.autosaveMode, editNodeId, isStoryEditDirty, persistNodeEdit, t]);

  useEffect(() => {
    if (appPreferences?.autosaveMode !== 'interval' || !editNodeId) {
      return;
    }

    const intervalMs = normalizeIntervalMinutes(appPreferences.autosaveIntervalMinutes) * 60_000;
    const intervalId = setInterval(() => {
      if (!isStoryEditDirty || storyAutosaveInFlightRef.current) {
        return;
      }

      storyAutosaveInFlightRef.current = true;
      void persistNodeEdit({
        closeAfterSave: false,
        successStatus: t('editor.status.autosavedBlock'),
      }).finally(() => {
        storyAutosaveInFlightRef.current = false;
      });
    }, intervalMs);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    appPreferences?.autosaveIntervalMinutes,
    appPreferences?.autosaveMode,
    editNodeId,
    isStoryEditDirty,
    persistNodeEdit,
    t,
  ]);

  useEffect(() => {
    const previousTab = previousStoryTabRef.current;
    const previousNodeCount = previousStoryNodeCountRef.current;
    const previousProjectRoot = previousStoryProjectRootRef.current;
    const currentProjectRoot = currentProject?.rootPath ?? null;

    previousStoryTabRef.current = activeTab;
    previousStoryNodeCountRef.current = nodes.length;
    previousStoryProjectRootRef.current = currentProjectRoot;

    if (activeTab !== 'story' || nodes.length === 0) {
      return;
    }

    const enteringStoryTab = previousTab !== 'story';
    const nodeCountChanged = previousNodeCount !== nodes.length;
    const projectChanged = previousProjectRoot !== currentProjectRoot;
    if (!enteringStoryTab && !nodeCountChanged && !projectChanged) {
      return;
    }

    const timer = window.setTimeout(() => {
      storyFlowRef.current?.fitView({ padding: 0.18 });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeTab, currentProject?.rootPath, nodes.length]);

  useEffect(() => {
    const previousTab = previousPlotTabRef.current;
    const previousPlotCount = previousPlotCountRef.current;

    previousPlotTabRef.current = activeTab;
    previousPlotCountRef.current = plotNodes.length;

    if (activeTab !== 'plots' || plotNodes.length === 0) {
      return;
    }

    const enteringPlotsTab = previousTab !== 'plots';
    const plotCountChanged = previousPlotCount !== plotNodes.length;
    if (!enteringPlotsTab && !plotCountChanged) {
      return;
    }

    const timer = window.setTimeout(() => {
      plotFlowRef.current?.fitView({ padding: 0.18 });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeTab, plotNodes.length]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!currentProject || !hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [currentProject, hasUnsavedChanges]);

  return (
    <main className="layout-root">
      <header className="topbar">
        <h1>The Novelist</h1>
        <p>{t('shell.subtitle')}</p>
        <div className="workspace-tabs">
          <button
            type="button"
            className={activeTab === 'dashboard' ? 'tab-active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            {t('shell.tabs.dashboard')}
          </button>
          <button
            type="button"
            className={activeTab === 'outline' ? 'tab-active' : ''}
            onClick={() => setActiveTab('outline')}
            disabled={!currentProject}
          >
            {t('shell.tabs.outline')}
          </button>
          <button
            type="button"
            className={activeTab === 'timeline' ? 'tab-active' : ''}
            onClick={() => setActiveTab('timeline')}
            disabled={!currentProject}
          >
            {t('shell.tabs.timeline')}
          </button>
          <button
            type="button"
            className={activeTab === 'plots' ? 'tab-active' : ''}
            onClick={() => setActiveTab('plots')}
            disabled={!currentProject}
          >
            {t('shell.tabs.plots')}
          </button>
          <button
            type="button"
            className={activeTab === 'story' ? 'tab-active' : ''}
            onClick={() => setActiveTab('story')}
            disabled={!currentProject}
          >
            {t('shell.tabs.chapters')}
          </button>
          <button
            type="button"
            className={activeTab === 'scenes' ? 'tab-active' : ''}
            onClick={() => setActiveTab('scenes')}
            disabled={!currentProject}
          >
            {t('shell.tabs.scenes')}
          </button>
          <button
            type="button"
            className={activeTab === 'characters' ? 'tab-active' : ''}
            onClick={() => setActiveTab('characters')}
            disabled={!currentProject}
          >
            {t('shell.tabs.characters')}
          </button>
          <button
            type="button"
            className={activeTab === 'locations' ? 'tab-active' : ''}
            onClick={() => setActiveTab('locations')}
            disabled={!currentProject}
          >
            {t('shell.tabs.locations')}
          </button>
          <button
            type="button"
            className={activeTab === 'revisions' ? 'tab-active' : ''}
            onClick={() => setActiveTab('revisions')}
            disabled={!currentProject}
          >
            {t('shell.tabs.revisions')}
          </button>
          <button
            type="button"
            className={activeTab === 'analysis' ? 'tab-active' : ''}
            onClick={() => setActiveTab('analysis')}
            disabled={!currentProject}
          >
            {t('shell.tabs.analysis')}
          </button>
          <button
            type="button"
            className={activeTab === 'memory' ? 'tab-active' : ''}
            onClick={openMemoryTab}
            disabled={!currentProject}
          >
            {t('shell.tabs.memory')}
          </button>
          <button
            type="button"
            className={isAiSettingsModalOpen ? 'tab-active' : ''}
            onClick={() => setIsAiSettingsModalOpen(true)}
          >
            {t('shell.tabs.settings')}
          </button>
        </div>
      </header>

      {activeTab === 'dashboard' ? (
        <DashboardWorkspace
          aiSettings={aiSettings}
          appPreferences={appPreferences}
          busy={busy}
          canCloseProject={canCloseProject}
          canOpenProject={canOpenProject}
          canSaveProject={canSaveProject}
          currentProject={currentProject}
          dashboard={dashboard}
          dashboardGoalMetrics={dashboardGoalMetrics}
          error={error}
          hasUnsavedChanges={hasUnsavedChanges}
          onCloseProject={requestCloseProject}
          onCreateProject={openCreateProjectModal}
          onExportDocx={() => void handleExportManuscriptDocx()}
          onExportEpub={() => void handleExportManuscriptEpub()}
          onOpenProject={() => void handleOpenProject()}
          onOpenProjectTargets={openProjectTargetsModal}
          onPrintManuscript={() => void handlePrintManuscript()}
          onRefreshDashboard={() => void refreshDashboardData()}
          onSaveProject={() => void handleSaveProject()}
          onWikiSync={() => void handleWikiSync()}
          plotsCount={plots.length}
          status={status}
          statusTone={statusTone}
          wikiBusy={wikiBusy}
          wikiStatus={wikiStatus}
          workspaceNotice={workspaceNotice}
        />
      ) : null}

      {activeTab === 'outline' ? (
        currentProject ? (
          <section className="outline-workspace">
            <section className="panel outline-header-panel">
              <div>
                <h2>{t('outline.title')}</h2>
                <p className="muted">{t('outline.subtitle')}</p>
              </div>
              <div className="outline-header-actions">
                <span className="outline-summary-pill">
                  {outline.chapters.length} {t('outline.summary.chapters')}
                </span>
                <span className="outline-summary-pill warning">
                  {outline.isolatedCount} {t('outline.summary.isolated')}
                </span>
                <span className="outline-summary-pill warning">
                  {outline.ambiguousCount} {t('outline.summary.ambiguous')}
                </span>
                <button
                  type="button"
                  onClick={() => void refreshOutlineData()}
                  disabled={outline.loading || outline.saving || readingViewLoading || busy}
                >
                  {outline.loading ? t('outline.actions.refreshing') : t('outline.actions.refresh')}
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void openFullDocumentReadingView()}
                  disabled={
                    outline.loading ||
                    outline.saving ||
                    readingViewLoading ||
                    busy ||
                    outline.chapters.length === 0
                  }
                >
                  {readingViewLoading
                    ? t('outline.actions.opening')
                    : t('outline.actions.openFullDocument')}
                </button>
              </div>
            </section>

            <section className="outline-layout">
              <div className="outline-list">
                {outline.chapters.length > 0 ? (
                  outline.chapters.map((chapter, index) => {
                    const plotColor = getPlotColor(chapter.node.plotNumber, plots);
                    const incomingTitles = chapter.incomingIds
                      .map((id) => outlineChapterTitleById.get(id))
                      .filter(Boolean);
                    const outgoingTitles = chapter.outgoingIds
                      .map((id) => outlineChapterTitleById.get(id))
                      .filter(Boolean);

                    return (
                      <article
                        key={chapter.node.id}
                        className={
                          draggedOutlineChapterId === chapter.node.id
                            ? 'panel outline-chapter-card is-dragging'
                            : 'panel outline-chapter-card'
                        }
                        style={{ borderLeftColor: plotColor }}
                        draggable={!outline.saving && !busy}
                        onDragStart={() => setDraggedOutlineChapterId(chapter.node.id)}
                        onDragEnd={() => setDraggedOutlineChapterId(null)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => handleOutlineDrop(chapter.node.id)}
                      >
                        <div className="outline-chapter-marker">{index + 1}</div>
                        <div className="outline-chapter-body">
                          <header className="outline-chapter-header">
                            <div>
                              <p className="outline-plot-label" style={{ color: plotColor }}>
                                {chapter.plot
                                  ? normalizePlotLabel(
                                      chapter.plot.number,
                                      chapter.plot.label,
                                      t('common.plot'),
                                    )
                                  : `${t('common.plot')} ${chapter.node.plotNumber}`}
                              </p>
                              <h3>{chapter.node.title}</h3>
                            </div>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => void openChapterReadingView(chapter)}
                              disabled={outline.saving || readingViewLoading || busy}
                            >
                              {t('common.open')}
                            </button>
                          </header>

                          <p className="outline-description">
                            {chapter.node.description.trim() || t('outline.emptySummary')}
                          </p>

                          <div className="outline-connection-row">
                            <span>
                              {t('outline.from')}{' '}
                              <strong>
                                {incomingTitles.length > 0 ? incomingTitles.join(', ') : '-'}
                              </strong>
                            </span>
                            <span>
                              {t('outline.to')}{' '}
                              <strong>
                                {outgoingTitles.length > 0 ? outgoingTitles.join(', ') : '-'}
                              </strong>
                            </span>
                          </div>

                          <div className="outline-reference-grid">
                            <div>
                              <span>{t('shell.tabs.scenes')}</span>
                              <div className="outline-chip-list">
                                {chapter.scenes.length > 0 ? (
                                  chapter.scenes.map((scene) => (
                                    <span key={scene.id} className="outline-chip">
                                      #{formatSceneName(scene)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="muted">-</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span>{t('shell.tabs.characters')}</span>
                              <div className="outline-chip-list">
                                {chapter.characters.length > 0 ? (
                                  chapter.characters.map((character) => (
                                    <span key={character.id} className="outline-chip">
                                      @{formatCharacterName(character)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="muted">-</span>
                                )}
                              </div>
                            </div>
                            <div>
                              <span>{t('shell.tabs.locations')}</span>
                              <div className="outline-chip-list">
                                {chapter.locations.length > 0 ? (
                                  chapter.locations.map((location) => (
                                    <span key={location.id} className="outline-chip">
                                      @{formatLocationName(location)}
                                    </span>
                                  ))
                                ) : (
                                  <span className="muted">-</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {chapter.issues.length > 0 ? (
                            <div className="outline-issue-list">
                              {chapter.issues.map((issue) => (
                                <span key={issue}>{issue}</span>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </article>
                    );
                  })
                ) : (
                  <section className="panel">
                    <p className="muted">{t('outline.empty')}</p>
                  </section>
                )}
              </div>

              <aside className="panel outline-side-panel">
                <h2>{t('shell.tabs.plots')}</h2>
                <div className="outline-plot-list">
                  {plots.map((plot) => (
                    <div key={plot.id}>
                      <span
                        className="outline-plot-swatch"
                        style={{ backgroundColor: getPlotColor(plot.number, plots) }}
                      />
                      <strong>
                        {normalizePlotLabel(plot.number, plot.label, t('common.plot'))}
                      </strong>
                    </div>
                  ))}
                </div>
                <h2>{t('outline.issues')}</h2>
                {outline.chapters.some((chapter) => chapter.issues.length > 0) ? (
                  <ul className="dashboard-check-list">
                    {outline.chapters
                      .filter((chapter) => chapter.issues.length > 0)
                      .map((chapter) => (
                        <li key={chapter.node.id}>
                          <strong>{chapter.node.title}</strong>: {chapter.issues.join(', ')}
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="muted">{t('outline.noIssues')}</p>
                )}
                {outline.error ? <p className="error">{outline.error}</p> : null}
              </aside>
            </section>

            <section className="panel status-panel">
              <p className={`status status-${statusTone}`}>
                <span>{outline.saving ? t('outline.syncing') : status}</span>
                {workspaceNotice ? (
                  <span className="status-inline-notice">{workspaceNotice}</span>
                ) : null}
              </p>
              {error ? <p className="error">{error}</p> : null}
            </section>
          </section>
        ) : (
          <section className="panel">
            <p>{t('outline.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'timeline' ? (
        currentProject ? (
          <TimelineBoard onStatus={setStatus} t={t} />
        ) : (
          <section className="workspace empty-workspace">
            <p>{t('timeline.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'story' ? (
        <section className="workspace">
          <aside className="sidebar">
            <div className="sidebar-action-group">
              <button
                type="button"
                className="sidebar-action-button"
                onClick={() => setIsNewNodeModalOpen(true)}
                disabled={!canOpenStoryCreationTools}
              >
                {t('story.newChapter')}
              </button>
            </div>

            <div className="panel">
              <h2>{t('story.selection')}</h2>
              <p>
                {t('story.node')} <strong>{selectedNode?.data.title ?? '-'}</strong>
              </p>
              <p>
                {t('story.edge')} <strong>{selectedEdgeId ?? '-'}</strong>
              </p>
              <div className="selection-action-stack">
                <button
                  type="button"
                  className="sidebar-action-button danger-action-button"
                  onClick={handleDeleteSelectedNode}
                  disabled={!selectedNodeId || busy}
                >
                  {t('story.deleteBlock')}
                </button>
                <button
                  type="button"
                  className="sidebar-action-button danger-action-button"
                  onClick={handleDeleteSelectedEdge}
                  disabled={!selectedEdgeId || busy}
                >
                  {t('story.deleteConnection')}
                </button>
              </div>
            </div>

            <div className="panel status-panel">
              <p className={`status status-${statusTone}`}>
                <span>{status}</span>
                {workspaceNotice ? (
                  <span className="status-inline-notice">{workspaceNotice}</span>
                ) : null}
              </p>
              {error ? <p className="error">{error}</p> : null}
            </div>
          </aside>

          <section className="canvas-wrap">
            <ReactFlow<ChapterCanvasNode, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onInit={(instance) => {
                storyFlowRef.current = instance;
              }}
              connectionMode={ConnectionMode.Loose}
              onlyRenderVisibleElements
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onNodesDelete={onNodesDelete}
              onEdgesDelete={onEdgesDelete}
              onNodeDragStop={handleNodeDragStop}
              onNodeDoubleClick={handleNodeDoubleClick}
              onConnect={(connection) => void handleConnect(connection)}
              onSelectionChange={onSelectionChange}
              onEdgeClick={onEdgeClick}
              {...canvasMultiSelectProps}
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <MiniMap
                zoomable
                pannable
                nodeColor={getFlowMiniMapNodeColor}
                nodeStrokeColor={getFlowMiniMapNodeStrokeColor}
                maskColor={FLOW_MINIMAP_MASK_COLOR}
              />
              <Controls />
              <Background gap={18} size={1} color="#d1d5db" />
            </ReactFlow>
          </section>
        </section>
      ) : null}

      {activeTab === 'plots' ? (
        currentProject ? (
          <section className="workspace">
            <aside className="sidebar">
              <div className="sidebar-action-group">
                <button
                  type="button"
                  className="sidebar-action-button"
                  onClick={() => setIsPlotModalOpen(true)}
                  disabled={!canOpenStoryCreationTools}
                >
                  {t('plot.new')}
                </button>
              </div>

              <div className="panel">
                <h2>{t('story.selection')}</h2>
                <p>
                  {t('plot.selection')}{' '}
                  <strong>
                    {selectedPlot
                      ? normalizePlotLabel(
                          selectedPlot.number,
                          selectedPlot.label,
                          t('common.plot'),
                        )
                      : '-'}
                  </strong>
                </p>
                <p>
                  {t('plot.number')} <strong>{selectedPlot?.number ?? '-'}</strong>
                </p>
                <p className="selection-summary">
                  {t('plot.summary')} <strong>{selectedPlot?.summary.trim() || '-'}</strong>
                </p>
                <div className="selection-action-stack">
                  <button
                    type="button"
                    className="sidebar-action-button danger-action-button"
                    onClick={() => void handleDeleteSelectedPlot()}
                    disabled={!selectedPlotId || busy}
                  >
                    {t('plot.delete')}
                  </button>
                </div>
              </div>

              <div className="panel status-panel">
                <p className={`status status-${statusTone}`}>
                  <span>{status}</span>
                  {workspaceNotice ? (
                    <span className="status-inline-notice">{workspaceNotice}</span>
                  ) : null}
                </p>
                {error ? <p className="error">{error}</p> : null}
              </div>
            </aside>

            <section className="canvas-wrap">
              <ReactFlow<PlotCanvasNode>
                nodes={plotNodes}
                edges={[]}
                nodeTypes={plotNodeTypes}
                onInit={(instance) => {
                  plotFlowRef.current = instance;
                }}
                onNodesChange={onPlotNodesChange}
                onNodeDragStop={onPlotNodeDragStop}
                onNodeClick={onPlotNodeClick}
                onSelectionChange={onPlotSelectionChange}
                nodesConnectable={false}
                elementsSelectable
                elevateNodesOnSelect
                fitView
                deleteKeyCode={null}
                zoomOnDoubleClick={false}
              >
                <MiniMap
                  zoomable
                  pannable
                  nodeColor={getFlowMiniMapNodeColor}
                  nodeStrokeColor={getFlowMiniMapNodeStrokeColor}
                  maskColor={FLOW_MINIMAP_MASK_COLOR}
                />
                <Controls />
                <Background gap={18} size={1} color="#d1d5db" />
              </ReactFlow>
            </section>
          </section>
        ) : (
          <section className="panel">
            <p>{t('plot.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'scenes' ? (
        currentProject ? (
          <SceneBoard
            currentProject={currentProject}
            autosaveSettings={appPreferences}
            statusMessage={status}
            workspaceNotice={workspaceNotice}
            onStatus={handleWorkspaceStatus}
            onDirtyChange={setSceneBoardDirty}
            onRegisterFlush={(handler) => {
              sceneBoardFlushRef.current = handler;
            }}
            onWikiSync={syncProjectWikiAfterWorkspaceChange}
            t={t}
          />
        ) : (
          <section className="panel">
            <p>{t('scene.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'characters' ? (
        currentProject ? (
          <CharacterBoard
            currentProject={currentProject}
            aiSettings={aiSettings}
            autosaveSettings={appPreferences}
            statusMessage={status}
            workspaceNotice={workspaceNotice}
            onStatus={handleWorkspaceStatus}
            onDirtyChange={setCharacterBoardDirty}
            onRegisterFlush={(handler) => {
              characterBoardFlushRef.current = handler;
            }}
            onWikiSync={syncProjectWikiAfterWorkspaceChange}
            t={t}
          />
        ) : (
          <section className="panel">
            <p>{t('entity.character.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'locations' ? (
        currentProject ? (
          <LocationBoard
            currentProject={currentProject}
            aiSettings={aiSettings}
            autosaveSettings={appPreferences}
            statusMessage={status}
            workspaceNotice={workspaceNotice}
            onStatus={handleWorkspaceStatus}
            onDirtyChange={setLocationBoardDirty}
            onRegisterFlush={(handler) => {
              locationBoardFlushRef.current = handler;
            }}
            onWikiSync={syncProjectWikiAfterWorkspaceChange}
            t={t}
          />
        ) : (
          <section className="panel">
            <p>{t('entity.location.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'revisions' ? (
        currentProject ? (
          <RevisionBoard
            currentProject={currentProject}
            statusMessage={status}
            workspaceNotice={workspaceNotice}
            onStatus={handleWorkspaceStatus}
            t={t}
          />
        ) : (
          <section className="panel">
            <p>{t('revision.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'analysis' ? (
        currentProject ? (
          <AnalysisBoard
            currentProject={currentProject}
            language={appLanguage}
            onStatus={handleWorkspaceStatus}
            t={t}
          />
        ) : (
          <section className="panel">
            <p>{t('analysis.emptyProject')}</p>
          </section>
        )
      ) : null}

      {activeTab === 'memory' ? (
        <MemoryWorkspace
          currentProjectOpen={Boolean(currentProject)}
          lastAiMemorySources={lastAiMemorySources}
          memoryStorySummary={memoryStorySummary}
          memoryStorySummaryBusy={memoryStorySummaryBusy}
          memoryStorySummaryFallback={memoryStorySummaryFallback}
          onOpenWikiSearchResult={(result) => void handleOpenWikiSearchResult(result)}
          onRefreshWikiStatus={() => void refreshWikiStatus()}
          onWikiSearch={() => void handleWikiSearch()}
          onWikiSync={() => void handleWikiSync()}
          setWikiSearchQuery={setWikiSearchQuery}
          wikiBusy={wikiBusy}
          wikiError={wikiError}
          wikiSearchQuery={wikiSearchQuery}
          wikiSearchResults={wikiSearchResults}
          wikiStatus={wikiStatus}
          t={t}
        />
      ) : null}

      {selectedWikiSearchResult ? (
        <MemoryResultModal
          result={selectedWikiSearchResult}
          onClose={() => setSelectedWikiSearchResult(null)}
          t={t}
        />
      ) : null}

      {isAiSettingsModalOpen ? (
        <SettingsModal
          aiApiKeyInput={aiApiKeyInput}
          aiSettings={aiSettings}
          aiSettingsBusy={aiSettingsBusy}
          appPreferences={appPreferences}
          appPreferencesBusy={appPreferencesBusy}
          clearStoredApiKey={clearStoredApiKey}
          currentProjectOpen={Boolean(currentProject)}
          onClose={() => setIsAiSettingsModalOpen(false)}
          onSaveAiSettings={() => void handleSaveAiSettings()}
          onSaveAppPreferences={() => void handleSaveAppPreferences()}
          setAiApiKeyInput={setAiApiKeyInput}
          setAiSettings={setAiSettings}
          setAppPreferences={setAppPreferences}
          setClearStoredApiKey={setClearStoredApiKey}
        />
      ) : null}

      {isCloseProjectConfirmOpen ? (
        <CloseProjectConfirmModal
          busy={busy}
          onCancel={() => setIsCloseProjectConfirmOpen(false)}
          onCloseWithoutSaving={() => {
            setIsCloseProjectConfirmOpen(false);
            void performCloseProject();
          }}
          onSaveAndClose={() => {
            void (async () => {
              const flushed = await flushPendingChangesBeforeClose();
              if (!flushed) {
                return;
              }
              setIsCloseProjectConfirmOpen(false);
              await performCloseProject();
            })();
          }}
          t={t}
        />
      ) : null}

      {activeTab === 'dashboard' && isCreateProjectModalOpen ? (
        <CreateProjectModal
          busy={busy}
          canCreateProject={canCreateProject}
          createProjectCompletionDate={createProjectCompletionDate}
          createProjectName={createProjectName}
          createProjectRoot={createProjectRoot}
          createProjectTargetChapterWords={createProjectTargetChapterWords}
          createProjectTargetWords={createProjectTargetWords}
          onCancel={closeCreateProjectModal}
          onCreateProject={() => void handleCreateProject()}
          onSelectDirectory={() => void handleSelectCreateProjectDirectory()}
          setCreateProjectCompletionDate={setCreateProjectCompletionDate}
          setCreateProjectName={setCreateProjectName}
          setCreateProjectTargetChapterWords={setCreateProjectTargetChapterWords}
          setCreateProjectTargetWords={setCreateProjectTargetWords}
          t={t}
        />
      ) : null}

      {activeTab === 'dashboard' && isProjectTargetsModalOpen ? (
        <ProjectTargetsModal
          busy={busy}
          canSaveProjectTargets={canSaveProjectTargets}
          editProjectCompletionDate={editProjectCompletionDate}
          editProjectTargetChapterWords={editProjectTargetChapterWords}
          editProjectTargetWords={editProjectTargetWords}
          onCancel={() => setIsProjectTargetsModalOpen(false)}
          onSaveProjectTargets={() => void handleSaveProjectTargets()}
          setEditProjectCompletionDate={setEditProjectCompletionDate}
          setEditProjectTargetChapterWords={setEditProjectTargetChapterWords}
          setEditProjectTargetWords={setEditProjectTargetWords}
          t={t}
        />
      ) : null}

      {(activeTab === 'story' || activeTab === 'plots') && isPlotModalOpen ? (
        <CreatePlotModal
          busy={busy}
          canCreatePlot={canCreatePlot}
          canCreatePlotStructure={canCreatePlotStructure}
          existingPlotForNewNumber={existingPlotForNewNumber}
          newPlotLabel={newPlotLabel}
          newPlotNumber={newPlotNumber}
          newPlotSummary={newPlotSummary}
          onCancel={() => setIsPlotModalOpen(false)}
          onCreatePlot={() => void handleCreatePlot()}
          onCreatePlotStructure={() => void handleCreatePlotStructure()}
          plotStructureBusy={plotStructureBusy}
          setNewPlotLabel={setNewPlotLabel}
          setNewPlotNumber={setNewPlotNumber}
          setNewPlotSummary={setNewPlotSummary}
          t={t}
        />
      ) : null}

      {activeTab === 'plots' && currentEditPlot ? (
        <EditPlotModal
          busy={busy}
          currentEditPlot={currentEditPlot}
          editPlotLabelInput={editPlotLabelInput}
          editPlotSummaryInput={editPlotSummaryInput}
          onCancel={resetPlotEditor}
          onSavePlotEdit={() => void handleSavePlotEdit()}
          setEditPlotLabelInput={setEditPlotLabelInput}
          setEditPlotSummaryInput={setEditPlotSummaryInput}
          t={t}
        />
      ) : null}

      {activeTab === 'story' && isNewNodeModalOpen ? (
        <CreateStoryNodeModal
          busy={busy}
          canCreateNode={Boolean(currentProject) && !busy}
          newNodeBlockNumber={newNodeBlockNumber}
          newNodeDescription={newNodeDescription}
          newNodePlotNumber={newNodePlotNumber}
          newNodeTitle={newNodeTitle}
          onCancel={() => setIsNewNodeModalOpen(false)}
          onCreateNode={() => void handleCreateNode()}
          plots={plots}
          setNewNodeBlockNumber={setNewNodeBlockNumber}
          setNewNodeDescription={setNewNodeDescription}
          setNewNodePlotNumber={setNewNodePlotNumber}
          setNewNodeTitle={setNewNodeTitle}
          t={t}
        />
      ) : null}

      {activeTab === 'story' && editNodeId ? (
        <EditStoryNodeModal
          busy={busy}
          editBlockNumber={editBlockNumber}
          editDescription={editDescription}
          editNodeId={editNodeId}
          editPlotLabel={editPlotLabel}
          editPlotNumber={editPlotNumber}
          editTitle={editTitle}
          onCancel={() => setEditNodeId(null)}
          onOpenChapterEditor={openEditorForNode}
          onSaveNodeEdit={() => void handleSaveNodeEdit()}
          setEditBlockNumber={setEditBlockNumber}
          setEditDescription={setEditDescription}
          setEditPlotNumber={setEditPlotNumber}
          setEditTitle={setEditTitle}
          t={t}
        />
      ) : null}

      {activeTab === 'story' && editorNodeId ? (
        <ChapterEditor
          chapterNodeId={editorNodeId}
          chapterTitle={editorNodeTitle}
          projectName={currentProject?.name}
          autosaveSettings={appPreferences}
          onClose={handleCloseChapterEditor}
          onChapterSaved={refreshStoryState}
          onStatus={handleWorkspaceStatus}
          onDirtyChange={setChapterEditorDirty}
          onRegisterFlush={(handler) => {
            chapterEditorFlushRef.current = handler;
          }}
          onMemorySources={setLastAiMemorySources}
        />
      ) : null}

      {readingView ? (
        <ReadingViewOverlay readingView={readingView} onClose={() => setReadingView(null)} t={t} />
      ) : null}
    </main>
  );
}
