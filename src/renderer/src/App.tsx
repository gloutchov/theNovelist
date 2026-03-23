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
  type Node,
  type NodeMouseHandler,
  type OnNodesDelete,
  type OnEdgesDelete,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import ChapterEditor from './ChapterEditor';
import ChapterFlowNode, { type ChapterFlowNodeData } from './ChapterFlowNode';
import CharacterBoard from './CharacterBoard';
import { getNearbyCanvasPosition } from './canvas-position';
import LocationBoard from './LocationBoard';
import PlotFlowNode, { type PlotFlowNodeData } from './PlotFlowNode';
import { getStatusTone } from './status-tone';

type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type StoryNodeRecord = StoryState['nodes'][number];
type StoryEdgeRecord = StoryState['edges'][number];
type PlotRecord = StoryState['plots'][number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;
type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;
type CreatedChapterNode = Awaited<ReturnType<(typeof window.novelistApi)['createStoryNode']>>;
type ChapterCanvasNode = Node<ChapterFlowNodeData, 'chapter'>;
type PlotCanvasNode = Node<PlotFlowNodeData, 'plot'>;

type WorkspaceTab = 'story' | 'plots' | 'characters' | 'locations';

interface PlotStructureBlock {
  title: string;
  description: string;
}

const DEFAULT_PROJECT_NAME = 'Romanzo senza titolo';

function getApiKeyStorageLabel(storage: CodexSettings['apiKeyStorage']): string {
  if (storage === 'secure_storage') {
    return 'archivio sicuro di sistema';
  }
  if (storage === 'legacy_db') {
    return 'archivio legacy (DB)';
  }
  return 'nessuno';
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

function getPlotColor(plotNumber: number, plots: PlotRecord[]): string {
  return plots.find((plot) => plot.number === plotNumber)?.color ?? colorFromPlotNumber(plotNumber);
}

function hasPendingAiSettingsChanges(
  localSettings: CodexSettings | null,
  persistedSettings: CodexSettings,
  apiKeyInput: string,
  clearStoredApiKey: boolean,
): boolean {
  if (!localSettings) {
    return false;
  }

  return (
    localSettings.enabled !== persistedSettings.enabled ||
    localSettings.provider !== persistedSettings.provider ||
    localSettings.allowApiCalls !== persistedSettings.allowApiCalls ||
    localSettings.autoSummarizeDescriptions !== persistedSettings.autoSummarizeDescriptions ||
    localSettings.apiModel !== persistedSettings.apiModel ||
    Boolean(apiKeyInput.trim()) ||
    clearStoredApiKey
  );
}

function mapNodeRecordToFlowNode(record: StoryNodeRecord, plots: PlotRecord[]): ChapterCanvasNode {
  const color = getPlotColor(record.plotNumber, plots);

  return {
    id: record.id,
    type: 'chapter',
    position: {
      x: record.positionX,
      y: record.positionY,
    },
    data: {
      title: record.title,
      description: record.description,
      plotNumber: record.plotNumber,
      blockNumber: record.blockNumber,
    },
    style: {
      border: `2px solid ${color}`,
      borderRadius: '12px',
      width: 260,
      background: 'var(--surface-primary)',
      boxShadow: 'var(--flow-node-shadow)',
      padding: '10px',
    },
  };
}

function getDefaultPlotPosition(plotNumber: number): { x: number; y: number } {
  const index = Math.max(0, plotNumber - 1);
  const column = index % 2;
  const row = Math.floor(index / 2);

  return {
    x: 120 + column * 340,
    y: 120 + row * 220,
  };
}

function getSafePlotPosition(plot: Pick<PlotRecord, 'number' | 'positionX' | 'positionY'>): {
  x: number;
  y: number;
} {
  if (Number.isFinite(plot.positionX) && Number.isFinite(plot.positionY)) {
    return {
      x: plot.positionX,
      y: plot.positionY,
    };
  }

  return getDefaultPlotPosition(plot.number);
}

function mapPlotRecordToFlowNode(record: PlotRecord, options?: { selected?: boolean }): PlotCanvasNode {
  const position = getSafePlotPosition(record);

  return {
    id: record.id,
    type: 'plot',
    position,
    width: 300,
    height: 126,
    selected: options?.selected,
    data: {
      number: record.number,
      label: record.label,
      summary: record.summary,
      color: record.color,
    },
    style: {
      border: `2px solid ${record.color}`,
      borderRadius: '12px',
      width: 300,
      height: 126,
      background: 'var(--surface-primary)',
      boxShadow: 'var(--flow-node-shadow)',
      padding: '10px',
    },
  };
}

function mapEdgeRecordToFlowEdge(
  record: StoryEdgeRecord,
  handles?: {
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): Edge {
  return {
    id: record.id,
    source: record.sourceNodeId,
    target: record.targetNodeId,
    sourceHandle: handles?.sourceHandle ?? 'handle-right',
    targetHandle: handles?.targetHandle ?? 'handle-left',
    label: record.label ?? '',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color)' },
    style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
  };
}

function normalizeIntervalMinutes(value: number): number {
  return Math.min(120, Math.max(1, Math.round(value || 1)));
}

function normalizePlotLabel(plotNumber: number, label: string): string {
  return label.trim() || `Trama ${plotNumber}`;
}

function sortPlots(records: PlotRecord[]): PlotRecord[] {
  return [...records].sort((left, right) => left.number - right.number);
}

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return raw.slice(arrayStart, arrayEnd + 1).trim();
  }

  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return raw.slice(objectStart, objectEnd + 1).trim();
  }

  return raw.trim();
}

function parsePlotStructureBlocks(raw: string): PlotStructureBlock[] {
  const parsed = JSON.parse(extractJsonPayload(raw)) as unknown;
  const source = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && Array.isArray((parsed as { blocks?: unknown[] }).blocks)
      ? (parsed as { blocks: unknown[] }).blocks
      : [];

  return source
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const rawTitle = record['title'] ?? record['titolo'];
      const rawDescription = record['description'] ?? record['descrizione'] ?? record['summary'];
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
      const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
      if (!title || !description) {
        return null;
      }

      return {
        title,
        description,
      };
    })
    .filter((item): item is PlotStructureBlock => Boolean(item))
    .slice(0, 16);
}

function tryParsePlotStructureBlocks(raw: string): PlotStructureBlock[] {
  try {
    return parsePlotStructureBlocks(raw);
  } catch {
    return [];
  }
}

export default function App() {
  const [status, setStatus] = useState<string>('Nessun progetto aperto');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const [currentProject, setCurrentProject] = useState<ProjectRecord>(null);
  const [createProjectRoot, setCreateProjectRoot] = useState<string>('');
  const [createProjectName, setCreateProjectName] = useState<string>(DEFAULT_PROJECT_NAME);
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('story');
  const [appPreferences, setAppPreferences] = useState<AppPreferences | null>(null);
  const [appPreferencesBusy, setAppPreferencesBusy] = useState<boolean>(false);
  const [aiSettings, setAiSettings] = useState<CodexSettings | null>(null);
  const [aiSettingsBusy, setAiSettingsBusy] = useState<boolean>(false);
  const [aiApiKeyInput, setAiApiKeyInput] = useState<string>('');
  const [clearStoredApiKey, setClearStoredApiKey] = useState<boolean>(false);
  const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState<boolean>(false);

  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [nodes, setNodes] = useState<ChapterCanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);

  const [newPlotNumber, setNewPlotNumber] = useState<number>(1);
  const [newPlotLabel, setNewPlotLabel] = useState<string>('');
  const [newPlotSummary, setNewPlotSummary] = useState<string>('');
  const [plotStructureBusy, setPlotStructureBusy] = useState<boolean>(false);
  const [isPlotModalOpen, setIsPlotModalOpen] = useState<boolean>(false);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [editPlotId, setEditPlotId] = useState<string | null>(null);
  const [editPlotLabelInput, setEditPlotLabelInput] = useState<string>('');
  const [editPlotSummaryInput, setEditPlotSummaryInput] = useState<string>('');

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
  const [isCloseProjectConfirmOpen, setIsCloseProjectConfirmOpen] = useState<boolean>(false);

  const chapterEditorFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const characterBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const locationBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const plotFlowRef = useRef<ReactFlowInstance<PlotCanvasNode> | null>(null);
  const previousPlotTabRef = useRef<WorkspaceTab>('story');
  const previousPlotCountRef = useRef<number>(0);
  const storyAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyAutosaveInFlightRef = useRef<boolean>(false);

  const plotsById = useMemo(() => new Map(plots.map((plot) => [plot.id, plot])), [plots]);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const plotNodes = useMemo(
    () =>
      sortPlots(plots).map((plot) =>
        mapPlotRecordToFlowNode(plot, { selected: plot.id === selectedPlotId }),
      ),
    [plots, selectedPlotId],
  );
  const selectedPlot = useMemo(
    () => (selectedPlotId ? (plotsById.get(selectedPlotId) ?? null) : null),
    [plotsById, selectedPlotId],
  );
  const selectedNode = useMemo(
    () => (selectedNodeId ? (nodesById.get(selectedNodeId) ?? null) : null),
    [nodesById, selectedNodeId],
  );
  const existingPlotForNewNumber = useMemo(
    () => plots.find((plot) => plot.number === newPlotNumber) ?? null,
    [plots, newPlotNumber],
  );
  const editPlotLabel = useMemo(
    () => plots.find((plot) => plot.number === editPlotNumber)?.label?.trim() ?? '',
    [plots, editPlotNumber],
  );
  const currentEditNode = useMemo(
    () => (editNodeId ? (nodesById.get(editNodeId) ?? null) : null),
    [editNodeId, nodesById],
  );
  const currentEditPlot = useMemo(
    () => (editPlotId ? (plotsById.get(editPlotId) ?? null) : null),
    [editPlotId, plotsById],
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
  const canCreateProject =
    !currentProject && !busy && Boolean(createProjectRoot.trim()) && Boolean(createProjectName.trim());
  const canOpenProject = !currentProject && !busy;
  const canSaveProject = Boolean(currentProject) && !busy;
  const canCloseProject = Boolean(currentProject) && !busy;
  const canCreatePlot =
    Boolean(currentProject) && !busy && newPlotNumber >= 1 && !existingPlotForNewNumber;
  const canCreatePlotStructure = canCreatePlot && Boolean(newPlotSummary.trim());
  const canOpenStoryCreationTools = Boolean(currentProject) && !busy;
  const hasUnsavedChanges =
    isStoryEditDirty || chapterEditorDirty || characterBoardDirty || locationBoardDirty;
  const nodeTypes = useMemo(() => ({ chapter: ChapterFlowNode }), []);
  const plotNodeTypes = useMemo(() => ({ plot: PlotFlowNode }), []);
  const statusTone = getStatusTone(status);
  const handleWorkspaceStatus = useCallback((message: string) => {
    setStatus(message);
  }, []);
  const handleCloseChapterEditor = useCallback(() => {
    setEditorNodeId(null);
    setEditorNodeTitle('');
    setEditNodeId(null);
  }, []);

  const resetStoryWorkspace = useCallback(() => {
    setPlots([]);
    setNodes([]);
    setEdges([]);
    setSelectedPlotId(null);
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setEditNodeId(null);
    setEditTitle('');
    setEditDescription('');
    setEditPlotNumber(1);
    setEditBlockNumber(1);
    setEditorNodeId(null);
    setEditorNodeTitle('');
    setNewPlotNumber(1);
    setNewPlotLabel('');
    setNewPlotSummary('');
    setPlotStructureBusy(false);
    setIsPlotModalOpen(false);
    setEditPlotId(null);
    setEditPlotLabelInput('');
    setEditPlotSummaryInput('');
    setNewNodeTitle('Nuovo capitolo');
    setNewNodeDescription('');
    setNewNodePlotNumber(1);
    setNewNodeBlockNumber('');
    setIsNewNodeModalOpen(false);
    setChapterEditorDirty(false);
    setCharacterBoardDirty(false);
    setLocationBoardDirty(false);
    setIsCloseProjectConfirmOpen(false);
  }, []);

  async function refreshAppPreferences(): Promise<AppPreferences> {
    const preferences = await window.novelistApi.getAppPreferences();
    setAppPreferences(preferences);
    return preferences;
  }

  async function handleSaveAppPreferences(): Promise<void> {
    if (!appPreferences) {
      return;
    }

    setAppPreferencesBusy(true);
    setError(null);
    try {
      const saved = await window.novelistApi.updateAppPreferences({
        autosaveMode: appPreferences.autosaveMode,
        autosaveIntervalMinutes: normalizeIntervalMinutes(appPreferences.autosaveIntervalMinutes),
      });
      setAppPreferences(saved);
      setStatus('Preferenze utente salvate');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore salvataggio preferenze utente');
    } finally {
      setAppPreferencesBusy(false);
    }
  }

  async function handleSaveAiSettings(): Promise<void> {
    if (!aiSettings || !currentProject) {
      return;
    }

    const apiKeyInput = aiApiKeyInput.trim();
    const shouldClearStoredApiKey = clearStoredApiKey && !apiKeyInput;

    setAiSettingsBusy(true);
    setError(null);
    try {
      const saved = await window.novelistApi.codexUpdateSettings({
        enabled: aiSettings.enabled,
        provider: aiSettings.provider,
        allowApiCalls: aiSettings.allowApiCalls,
        autoSummarizeDescriptions: aiSettings.autoSummarizeDescriptions,
        apiKey: apiKeyInput || undefined,
        clearStoredApiKey: shouldClearStoredApiKey || undefined,
        apiModel: aiSettings.apiModel,
      });
      setAiSettings(saved);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      setStatus('Impostazioni AI salvate');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore salvataggio impostazioni AI');
    } finally {
      setAiSettingsBusy(false);
    }
  }

  async function refreshStoryState(): Promise<void> {
    if (!currentProject) {
      return;
    }

    const state = await window.novelistApi.getStoryState();
    setPlots(state.plots);
    setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
    setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
  }

  const syncOpenedProject = useCallback(
    async (project: NonNullable<ProjectRecord>, statusMessage: string): Promise<void> => {
      const state = await window.novelistApi.getStoryState();
      const settings = await window.novelistApi.codexGetSettings();

      resetStoryWorkspace();
      setCurrentProject(project);
      setPlots(state.plots);
      setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      setActiveTab('story');
      setAiSettings(settings);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      setStatus(statusMessage);
    },
    [resetStoryWorkspace],
  );

  async function handleCreateProject(): Promise<void> {
    const rootPath = createProjectRoot.trim();
    const name = createProjectName.trim();
    if (!rootPath || !name) {
      setStatus('Seleziona una cartella e inserisci un nome progetto.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const project = await window.novelistApi.createProject({
        rootPath,
        name,
      });
      setCreateProjectRoot(project.rootPath);
      setCreateProjectName(project.name);
      setIsCreateProjectModalOpen(false);
      await syncOpenedProject(project, `Progetto creato: ${project.name}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in creazione progetto');
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
      await syncOpenedProject(project, `Progetto aperto: ${project.name}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in apertura progetto');
    } finally {
      setBusy(false);
    }
  }

  async function handleSaveProject(): Promise<void> {
    if (!currentProject) {
      setStatus('Apri o crea prima un progetto');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const snapshot = await window.novelistApi.saveSnapshot({ reason: 'manual' });
      setStatus(`Progetto salvato: ${snapshot.fileName}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore salvataggio progetto');
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
      setCurrentProject(null);
      setCreateProjectRoot('');
      setCreateProjectName(DEFAULT_PROJECT_NAME);
      setIsCreateProjectModalOpen(false);
      setAiSettings(null);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      setIsAiSettingsModalOpen(false);
      setActiveTab('story');
      resetStoryWorkspace();
      setStatus('Progetto chiuso');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore chiusura progetto');
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

    if (currentProject) {
      setBusy(true);
      setError(null);
      try {
        await window.novelistApi.saveSnapshot({ reason: 'manual' });
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
        setStatus('Errore salvataggio progetto prima della chiusura');
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
      setStatus(`Path progetto selezionato: ${selectedPath}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore selezione cartella progetto');
    }
  }

  async function handleCreatePlot(): Promise<void> {
    if (!currentProject) {
      return;
    }
    if (plots.some((plot) => plot.number === newPlotNumber)) {
      setStatus(`La trama ${newPlotNumber} esiste gia.`);
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
        label: normalizePlotLabel(createdPlot.number, createdPlot.label),
        summary: newPlotSummary,
        color: createdPlot.color,
        positionX: createdPlot.positionX,
        positionY: createdPlot.positionY,
      });

      await refreshStoryState();
      setStatus(`Trama creata: ${normalizePlotLabel(newPlotNumber, newPlotLabel)}`);
      setNewNodePlotNumber(newPlotNumber);
      setNewPlotNumber(newPlotNumber + 1);
      setNewPlotLabel('');
      setNewPlotSummary('');
      setIsPlotModalOpen(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in creazione trama');
    } finally {
      setBusy(false);
    }
  }

  async function handleCreatePlotStructure(): Promise<void> {
    if (!currentProject) {
      return;
    }
    if (!newPlotSummary.trim()) {
      setStatus('Inserisci prima una bozza trama per creare la struttura.');
      return;
    }
    if (plots.some((plot) => plot.number === newPlotNumber)) {
      setStatus(`La trama ${newPlotNumber} esiste gia.`);
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
        label: normalizePlotLabel(createdPlot.number, createdPlot.label),
        summary: newPlotSummary,
        color: createdPlot.color,
        positionX: createdPlot.positionX,
        positionY: createdPlot.positionY,
      });

      const persistedAiSettings = await window.novelistApi.codexGetSettings();
      const runtimeAiSettings = hasPendingAiSettingsChanges(
        aiSettings,
        persistedAiSettings,
        aiApiKeyInput,
        clearStoredApiKey,
      )
        ? await window.novelistApi.codexUpdateSettings({
            enabled: aiSettings?.enabled,
            provider: aiSettings?.provider,
            allowApiCalls: aiSettings?.allowApiCalls,
            autoSummarizeDescriptions: aiSettings?.autoSummarizeDescriptions,
            apiKey: aiApiKeyInput.trim() || undefined,
            clearStoredApiKey: clearStoredApiKey || undefined,
            apiModel: aiSettings?.apiModel,
          })
        : persistedAiSettings;

      setAiSettings(runtimeAiSettings);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      if (!runtimeAiSettings.enabled) {
        await refreshStoryState();
        setStatus(
          'Trama salvata. Abilita prima il consenso Codex nelle Impostazioni AI per creare la struttura.',
        );
        setNewNodePlotNumber(createdPlot.number);
        setNewPlotNumber(createdPlot.number + 1);
        setNewPlotLabel('');
        setNewPlotSummary('');
        setIsPlotModalOpen(false);
        return;
      }

      const runtimeAiStatus = await window.novelistApi.codexStatus();
      if (!runtimeAiStatus.available) {
        await refreshStoryState();
        setStatus(
          runtimeAiStatus.reason?.trim()
            ? `Struttura trama non disponibile: ${runtimeAiStatus.reason}`
            : 'Struttura trama non disponibile: provider AI non raggiungibile.',
        );
        return;
      }

      setStatus('Codex sta creando la struttura della trama...');
      const structureRequestMessage =
        'Analizza questa trama e restituisci solo JSON valido nel formato {"blocks":[{"title":"...","description":"..."}]}. Genera da 4 a 12 blocchi narrativi, in ordine cronologico, con titoli brevi e descrizioni concise in italiano.';
      const structureRequestContext = `Numero trama: ${savedPlot.number}\nTitolo trama: ${savedPlot.label}\nBozza trama:\n${savedPlot.summary}`;
      const response = await window.novelistApi.codexAssist({
        projectName: currentProject.name,
        message: structureRequestMessage,
        context: structureRequestContext,
      });

      if (response.cancelled || !response.output.trim()) {
        await refreshStoryState();
        setStatus('Richiesta Codex annullata');
        return;
      }

      if (response.mode === 'fallback') {
        await refreshStoryState();
        setStatus(
          response.error?.trim()
            ? `Struttura trama non disponibile: ${response.error}`
            : 'Struttura trama non disponibile: il provider AI e andato in fallback.',
        );
        return;
      }

      let blocks = tryParsePlotStructureBlocks(response.output);
      if (blocks.length < 4) {
        setStatus('Codex sta raffinando la struttura della trama...');
        const repairResponse = await window.novelistApi.codexAssist({
          projectName: currentProject.name,
          message:
            'Correggi il seguente output e restituisci solo JSON valido nel formato {"blocks":[{"title":"...","description":"..."}]}. Devono esserci da 4 a 12 blocchi narrativi ordinati cronologicamente, con titolo e descrizione per ogni blocco. Non aggiungere testo fuori dal JSON.',
          context: `${structureRequestContext}\n\nOutput precedente da correggere:\n${response.output}`,
        });

        if (repairResponse.cancelled || !repairResponse.output.trim()) {
          await refreshStoryState();
          setStatus('Richiesta Codex annullata');
          return;
        }

        if (repairResponse.mode === 'fallback') {
          await refreshStoryState();
          setStatus(
            repairResponse.error?.trim()
              ? `Struttura trama non disponibile: ${repairResponse.error}`
              : 'Struttura trama non disponibile: il provider AI e andato in fallback.',
          );
          return;
        }

        blocks = tryParsePlotStructureBlocks(repairResponse.output);
      }

      if (blocks.length < 4) {
        await refreshStoryState();
        setStatus('La AI non ha restituito una struttura trama sufficientemente articolata.');
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
          sourceNodeId: createdNodes[index - 1]!.id,
          targetNodeId: createdNodes[index]!.id,
        });
      }

      await refreshStoryState();
      setActiveTab('story');
      setStatus(`Struttura trama creata: ${createdNodes.length} blocchi`);
      setNewNodePlotNumber(savedPlot.number);
      setNewPlotNumber(savedPlot.number + 1);
      setNewPlotLabel('');
      setNewPlotSummary('');
      setIsPlotModalOpen(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore creazione struttura trama');
    } finally {
      setPlotStructureBusy(false);
      setBusy(false);
    }
  }

  function openPlotEditor(plot: PlotRecord): void {
    setSelectedPlotId(plot.id);
    setEditPlotId(plot.id);
    setEditPlotLabelInput(plot.label);
    setEditPlotSummaryInput(plot.summary);
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
        label: normalizePlotLabel(currentEditPlot.number, editPlotLabelInput),
        summary: editPlotSummaryInput,
        color: currentEditPlot.color,
        positionX: currentEditPlot.positionX,
        positionY: currentEditPlot.positionY,
      });
      setPlots((prev) => sortPlots(prev.map((plot) => (plot.id === saved.id ? saved : plot))));
      setEditPlotId(null);
      setEditPlotLabelInput('');
      setEditPlotSummaryInput('');
      setStatus(`Trama salvata: ${saved.label}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore salvataggio trama');
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
      setError(
        "Questa sessione dell'app non ha ancora caricato la nuova API di eliminazione trama. Riavvia l'app e riprova.",
      );
      setStatus('Riavvia l’app per completare l’aggiornamento della funzione Elimina Trama');
      return;
    }

    const deletedPlotLabel = normalizePlotLabel(selectedPlot.number, selectedPlot.label);

    setBusy(true);
    setError(null);

    try {
      await deletePlot({ id: selectedPlot.id });
      await refreshStoryState();
      setSelectedPlotId(null);
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setEditPlotId(null);
      setEditPlotLabelInput('');
      setEditPlotSummaryInput('');
      setStatus(`Trama eliminata: ${deletedPlotLabel}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in eliminazione trama');
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

      setNodes((prev) => [...prev, mapNodeRecordToFlowNode(created, plots)]);
      setStatus(`Blocco creato: ${created.title}`);
      setSelectedNodeId(created.id);
      setNewNodeTitle('Nuovo capitolo');
      setNewNodeDescription('');
      setNewNodeBlockNumber('');
      setIsNewNodeModalOpen(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in creazione blocco');
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
        sourceNodeId: connection.source,
        targetNodeId: connection.target,
      });

      setEdges((prev) => [
        ...prev,
        mapEdgeRecordToFlowEdge(created, {
          sourceHandle: connection.sourceHandle ?? 'handle-right',
          targetHandle: connection.targetHandle ?? 'handle-left',
        }),
      ]);
      setStatus('Connessione creata');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in creazione connessione');
    } finally {
      setBusy(false);
    }
  }

  const handleNodeDragStop: NodeMouseHandler<ChapterCanvasNode> = async (_event, node) => {
    setError(null);

    try {
      const data = node.data;
      const updated = await window.novelistApi.updateStoryNode({
        id: node.id,
        title: data.title,
        description: data.description,
        plotNumber: data.plotNumber,
        blockNumber: data.blockNumber,
        positionX: node.position.x,
        positionY: node.position.y,
      });

      setNodes((prev) =>
        prev.map((item) =>
          item.id === node.id
            ? {
                ...mapNodeRecordToFlowNode(updated, plots),
                selected: item.selected,
              }
            : item,
        ),
      );
      setStatus(`Posizione blocco salvata: ${updated.title}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore nel salvataggio posizione blocco');
    }
  };

  const handleNodeDoubleClick: NodeMouseHandler<ChapterCanvasNode> = (_event, node) => {
    setEditNodeId(node.id);
    setEditTitle(node.data.title);
    setEditDescription(node.data.description);
    setEditPlotNumber(node.data.plotNumber);
    setEditBlockNumber(node.data.blockNumber);
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
            item.id === editNodeId ? mapNodeRecordToFlowNode(updated, plots) : item,
          ),
        );
        setEditTitle(updated.title);
        setEditDescription(updated.description);
        setEditPlotNumber(updated.plotNumber);
        setEditBlockNumber(updated.blockNumber);
        if (!options?.silent) {
          setStatus(options?.successStatus ?? `Blocco salvato: ${updated.title}`);
        }
        if (options?.closeAfterSave) {
          setEditNodeId(null);
        }
        return true;
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
        setStatus('Errore nel salvataggio blocco');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [editBlockNumber, editDescription, editNodeId, editPlotNumber, editTitle, isStoryEditDirty, nodes, plots],
  );

  async function handleSaveNodeEdit(): Promise<void> {
    await persistNodeEdit({ closeAfterSave: true });
  }

  async function handleDeleteSelectedNode(): Promise<void> {
    if (!selectedNodeId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await window.novelistApi.deleteStoryNode({ id: selectedNodeId });
      setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
      setEdges((prev) =>
        prev.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
      );
      setSelectedNodeId(null);
      setStatus('Blocco eliminato');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in eliminazione blocco');
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelectedEdge(): Promise<void> {
    if (!selectedEdgeId) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      await window.novelistApi.deleteStoryEdge({ id: selectedEdgeId });
      setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId));
      setSelectedEdgeId(null);
      setStatus('Connessione eliminata');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in eliminazione connessione');
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
        setStatus(`Documento completo DOCX esportato: ${result.filePath}`);
      } else {
        setStatus('Esportazione DOCX documento completo annullata');
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore export DOCX documento completo');
    } finally {
      setBusy(false);
    }
  }

  async function handleExportManuscriptPdf(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      const result = await window.novelistApi.exportManuscriptPdf();
      if (result) {
        setStatus(`Documento completo PDF esportato: ${result.filePath}`);
      } else {
        setStatus('Esportazione PDF documento completo annullata');
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore export PDF documento completo');
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
        setStatus('Stampa documento completo inviata');
      } else {
        setStatus('Stampa documento completo annullata');
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore stampa documento completo');
    } finally {
      setBusy(false);
    }
  }

  const onEdgesDelete: OnEdgesDelete = useCallback(async (deletedEdges) => {
    if (deletedEdges.length === 0) {
      return;
    }

    await Promise.all(
      deletedEdges.map((edge) => window.novelistApi.deleteStoryEdge({ id: edge.id })),
    );
    setStatus(`${deletedEdges.length} connessioni eliminate`);
  }, []);

  const onNodesDelete: OnNodesDelete<ChapterCanvasNode> = useCallback(async (deletedNodes) => {
    if (deletedNodes.length === 0) {
      return;
    }

    await Promise.all(
      deletedNodes.map((node) => window.novelistApi.deleteStoryNode({ id: node.id })),
    );
    setStatus(`${deletedNodes.length} blocchi eliminati`);
  }, []);

  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<ChapterCanvasNode, Edge>) => {
      setSelectedNodeId(selection.nodes[0]?.id ?? null);
      setSelectedEdgeId(selection.edges[0]?.id ?? null);
    },
    [],
  );

  const onPlotSelectionChange = useCallback((selection: OnSelectionChangeParams<PlotCanvasNode>) => {
    setSelectedPlotId(selection.nodes[0]?.id ?? null);
  }, []);

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
    [plotsById],
  );

  const onPlotNodesChange: OnNodesChange<PlotCanvasNode> = useCallback((changes) => {
    setPlots((prev) => {
      const currentNodes = sortPlots(prev).map((plot) =>
        mapPlotRecordToFlowNode(plot, { selected: plot.id === selectedPlotId }),
      );
      const nextNodes = applyNodeChanges(changes, currentNodes);
      const nextPositions = new Map(nextNodes.map((node) => [node.id, node.position]));

      return sortPlots(prev).map((plot) => {
        const position = nextPositions.get(plot.id);
        if (!position) {
          return plot;
        }

        return {
          ...plot,
          positionX: position.x,
          positionY: position.y,
        };
      });
    });
  }, [selectedPlotId]);

  const onPlotNodeDragStop: NodeMouseHandler<PlotCanvasNode> = useCallback(
    async (_event, node) => {
      const plot = plotsById.get(node.id);
      if (!plot) {
        return;
      }

      try {
        const updated = await window.novelistApi.updatePlot({
          id: plot.id,
          label: normalizePlotLabel(plot.number, plot.label),
          summary: plot.summary,
          color: plot.color,
          positionX: node.position.x,
          positionY: node.position.y,
        });

        setPlots((prev) => sortPlots(prev.map((item) => (item.id === updated.id ? updated : item))));
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
          updatedAt: new Date().toISOString(),
        });
      }

      const existingProject = await window.novelistApi.getCurrentProject();
      if (!existingProject) {
        return;
      }

      await syncOpenedProject(existingProject, `Sessione ripristinata: ${existingProject.name}`);
    })();
  }, [syncOpenedProject]);

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
        successStatus: 'Blocco salvato automaticamente',
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
  }, [appPreferences?.autosaveMode, editNodeId, isStoryEditDirty, persistNodeEdit]);

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
        successStatus: 'Blocco salvato automaticamente',
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
  ]);

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
        <p>Scrivi la tua storia da professionista</p>
        <div className="workspace-tabs">
          <button
            type="button"
            className={activeTab === 'story' ? 'tab-active' : ''}
            onClick={() => setActiveTab('story')}
          >
            Struttura Storia
          </button>
          <button
            type="button"
            className={activeTab === 'plots' ? 'tab-active' : ''}
            onClick={() => setActiveTab('plots')}
            disabled={!currentProject}
          >
            Trame
          </button>
          <button
            type="button"
            className={activeTab === 'characters' ? 'tab-active' : ''}
            onClick={() => setActiveTab('characters')}
            disabled={!currentProject}
          >
            Personaggi
          </button>
          <button
            type="button"
            className={activeTab === 'locations' ? 'tab-active' : ''}
            onClick={() => setActiveTab('locations')}
            disabled={!currentProject}
          >
            Location
          </button>
          <button
            type="button"
            className={isAiSettingsModalOpen ? 'tab-active' : ''}
            onClick={() => setIsAiSettingsModalOpen(true)}
          >
            Impostazioni
          </button>
        </div>
      </header>

      {activeTab === 'story' ? (
        <section className="workspace">
          <aside className="sidebar">
            <div className="panel">
              <h2>Progetto</h2>
              <p className="muted project-summary">
                {currentProject ? (
                  <>
                    Progetto aperto: <strong>{currentProject.name}</strong>
                  </>
                ) : (
                  'Nessun progetto aperto.'
                )}
              </p>
              <div className="project-action-stack">
                <button
                  type="button"
                  className="sidebar-action-button"
                  onClick={() => {
                    setCreateProjectRoot('');
                    setCreateProjectName(DEFAULT_PROJECT_NAME);
                    setIsCreateProjectModalOpen(true);
                  }}
                  disabled={Boolean(currentProject) || busy}
                >
                  Crea
                </button>
                <button
                  type="button"
                  className="sidebar-action-button"
                  onClick={() => void handleOpenProject()}
                  disabled={!canOpenProject}
                >
                  Apri
                </button>
                <button
                  type="button"
                  className="sidebar-action-button"
                  onClick={() => void handleSaveProject()}
                  disabled={!canSaveProject}
                >
                  Salva
                </button>
                <button
                  type="button"
                  className="sidebar-action-button"
                  onClick={requestCloseProject}
                  disabled={!canCloseProject}
                >
                  Chiudi
                </button>
              </div>
            </div>

            <div className="sidebar-action-group">
              <button
                type="button"
                className="sidebar-action-button"
                onClick={() => setIsPlotModalOpen(true)}
                disabled={!canOpenStoryCreationTools}
              >
                Nuove Trame
              </button>
              <button
                type="button"
                className="sidebar-action-button"
                onClick={() => setIsNewNodeModalOpen(true)}
                disabled={!canOpenStoryCreationTools}
              >
                Nuovo Capitolo
              </button>
              <div className="sidebar-export-actions">
                <button
                  type="button"
                  className="export-action-button"
                  onClick={() => void handleExportManuscriptDocx()}
                  disabled={!currentProject || busy}
                >
                  Esporta DOCX
                </button>
                <button
                  type="button"
                  className="export-action-button"
                  onClick={() => void handleExportManuscriptPdf()}
                  disabled={!currentProject || busy}
                >
                  Esporta PDF
                </button>
                <button
                  type="button"
                  className="export-action-button"
                  onClick={() => void handlePrintManuscript()}
                  disabled={!currentProject || busy}
                >
                  Stampa
                </button>
              </div>
            </div>

            <div className="panel">
              <h2>Selezione</h2>
              <p>
                Nodo: <strong>{selectedNode?.data.title ?? '-'}</strong>
              </p>
              <p>
                Edge: <strong>{selectedEdgeId ?? '-'}</strong>
              </p>
              <div className="selection-action-stack">
                <button
                  type="button"
                  className="sidebar-action-button danger-action-button"
                  onClick={handleDeleteSelectedNode}
                  disabled={!selectedNodeId || busy}
                >
                  Elimina Blocco
                </button>
                <button
                  type="button"
                  className="sidebar-action-button danger-action-button"
                  onClick={handleDeleteSelectedEdge}
                  disabled={!selectedEdgeId || busy}
                >
                  Elimina Conn.
                </button>
              </div>
            </div>

            <div className="panel status-panel">
              <p className={`status status-${statusTone}`}>{status}</p>
              {error ? <p className="error">{error}</p> : null}
            </div>
          </aside>

          <section className="canvas-wrap">
            <ReactFlow<ChapterCanvasNode, Edge>
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
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
              fitView
              deleteKeyCode={['Backspace', 'Delete']}
            >
              <MiniMap zoomable pannable />
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
              <div className="panel">
                <h2>Nuova Trama</h2>
                <label>
                  Numero trama
                  <input
                    type="number"
                    min={1}
                    value={newPlotNumber}
                    onChange={(event) =>
                      setNewPlotNumber(Math.max(1, Number(event.target.value) || 1))
                    }
                  />
                </label>
                <label>
                  Titolo trama
                  <input
                    value={existingPlotForNewNumber ? existingPlotForNewNumber.label : newPlotLabel}
                    onChange={(event) => setNewPlotLabel(event.target.value)}
                    placeholder="Trama principale"
                    disabled={Boolean(existingPlotForNewNumber)}
                  />
                </label>
                <label>
                  Bozza trama / struttura
                  <textarea
                    rows={7}
                    value={existingPlotForNewNumber ? existingPlotForNewNumber.summary : newPlotSummary}
                    onChange={(event) => setNewPlotSummary(event.target.value)}
                    placeholder="Riassunto, struttura grezza, scene chiave, conflitti..."
                    disabled={Boolean(existingPlotForNewNumber)}
                  />
                </label>
                {existingPlotForNewNumber ? (
                  <p className="muted">
                    Trama esistente: <strong>{existingPlotForNewNumber.label}</strong>. Modificala
                    con doppio click nel canvas.
                  </p>
                ) : null}
                <div className="plot-structure-actions">
                  <button type="button" onClick={() => void handleCreatePlot()} disabled={!canCreatePlot}>
                    Crea Trama
                  </button>
                  <button
                    type="button"
                    className={plotStructureBusy ? 'ai-working' : undefined}
                    onClick={() => void handleCreatePlotStructure()}
                    disabled={!canCreatePlotStructure}
                  >
                    {plotStructureBusy ? 'In Creazione...' : 'Crea Struttura'}
                  </button>
                </div>
              </div>

              <div className="panel">
                <h2>Selezione</h2>
                <p>
                  Trama:{' '}
                  <strong>
                    {selectedPlot ? normalizePlotLabel(selectedPlot.number, selectedPlot.label) : '-'}
                  </strong>
                </p>
                <p>
                  Numero: <strong>{selectedPlot?.number ?? '-'}</strong>
                </p>
                <div className="selection-action-stack">
                  <button
                    type="button"
                    className="sidebar-action-button danger-action-button"
                    onClick={() => void handleDeleteSelectedPlot()}
                    disabled={!selectedPlotId || busy}
                  >
                    Elimina Trama
                  </button>
                </div>
              </div>

              <div className="panel status-panel">
                <p className={`status status-${statusTone}`}>{status}</p>
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
                <MiniMap zoomable pannable />
                <Controls />
                <Background gap={18} size={1} color="#d1d5db" />
              </ReactFlow>
            </section>
          </section>
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto nella scheda "Struttura Storia" per gestire le trame.</p>
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
            onStatus={handleWorkspaceStatus}
            onDirtyChange={setCharacterBoardDirty}
            onRegisterFlush={(handler) => {
              characterBoardFlushRef.current = handler;
            }}
          />
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto nella scheda "Struttura Storia" per gestire i personaggi.</p>
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
            onStatus={handleWorkspaceStatus}
            onDirtyChange={setLocationBoardDirty}
            onRegisterFlush={(handler) => {
              locationBoardFlushRef.current = handler;
            }}
          />
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto nella scheda "Struttura Storia" per gestire le location.</p>
          </section>
        )
      ) : null}

      {isAiSettingsModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Impostazioni</h3>
            <div className="panel panel-subsection">
              <h4>Salvataggio Automatico</h4>
              <label>
                Modalità autosave
                <select
                  value={appPreferences?.autosaveMode ?? 'auto'}
                  onChange={(event) =>
                    setAppPreferences((prev) =>
                      prev
                        ? {
                            ...prev,
                            autosaveMode: event.target.value as 'manual' | 'interval' | 'auto',
                          }
                        : prev,
                    )
                  }
                  disabled={!appPreferences}
                >
                  <option value="manual">Manuale</option>
                  <option value="interval">Ogni N minuti</option>
                  <option value="auto">Auto (a ogni modifica)</option>
                </select>
              </label>
              <label>
                Intervallo minuti
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={appPreferences?.autosaveIntervalMinutes ?? 5}
                  onChange={(event) =>
                    setAppPreferences((prev) =>
                      prev
                        ? {
                            ...prev,
                            autosaveIntervalMinutes: normalizeIntervalMinutes(
                              Number(event.target.value) || 1,
                            ),
                          }
                        : prev,
                    )
                  }
                  disabled={!appPreferences || appPreferences.autosaveMode !== 'interval'}
                />
              </label>
              <p className="muted">
                In modalità auto le modifiche persistenti vengono salvate con debounce. Le bozze di
                creazione restano manuali.
              </p>
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => void handleSaveAppPreferences()}
                  disabled={!appPreferences || appPreferencesBusy}
                >
                  Salva Preferenze Utente
                </button>
              </div>
            </div>

            <div className="panel panel-subsection">
              <h4>Impostazioni AI</h4>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={Boolean(aiSettings?.enabled)}
                  disabled={!aiSettings}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            enabled: event.target.checked,
                          }
                        : prev,
                    )
                  }
                />
                <span>Consenso invio testo a strumenti AI</span>
              </label>
              <label>
                Provider
                <select
                  value={aiSettings?.provider ?? 'codex_cli'}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            provider: event.target.value as 'codex_cli' | 'openai_api' | 'ollama',
                          }
                        : prev,
                    )
                  }
                  disabled={!aiSettings}
                >
                  <option value="codex_cli">Codex CLI (locale)</option>
                  <option value="openai_api">OpenAI API (opzionale)</option>
                  <option value="ollama">Ollama (locale)</option>
                </select>
              </label>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={Boolean(aiSettings?.allowApiCalls)}
                  disabled={!aiSettings}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            allowApiCalls: event.target.checked,
                          }
                        : prev,
                    )
                  }
                />
                <span>Abilita chiamate API esterne</span>
              </label>
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={Boolean(aiSettings?.autoSummarizeDescriptions)}
                  disabled={!aiSettings}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            autoSummarizeDescriptions: event.target.checked,
                          }
                        : prev,
                    )
                  }
                />
                <span>Auto-riassunto descrizione blocco al salvataggio</span>
              </label>
              <label>
                Modello API
                <input
                  value={aiSettings?.apiModel ?? 'gpt-5-mini'}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            apiModel: event.target.value,
                          }
                        : prev,
                    )
                  }
                  placeholder="gpt-5-mini"
                  disabled={!aiSettings}
                />
              </label>
              <label>
                API Key (opzionale)
                <input
                  type="password"
                  value={aiApiKeyInput}
                  onChange={(event) => {
                    setAiApiKeyInput(event.target.value);
                    if (event.target.value.trim()) {
                      setClearStoredApiKey(false);
                    }
                  }}
                  placeholder="sk-..."
                  disabled={!aiSettings}
                />
              </label>
              {aiSettings?.hasStoredApiKey && !clearStoredApiKey ? (
                <p className="muted">
                  Chiave API configurata in:{' '}
                  <strong>{getApiKeyStorageLabel(aiSettings.apiKeyStorage)}</strong>.
                </p>
              ) : null}
              {clearStoredApiKey ? (
                <p className="muted">La chiave salvata verrà rimossa al prossimo salvataggio.</p>
              ) : null}
              {!currentProject ? (
                <p className="muted">
                  Le impostazioni AI restano legate al progetto aperto e sono disabilitate finché
                  non ne apri uno.
                </p>
              ) : null}
              <div className="row-buttons">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => {
                    setAiApiKeyInput('');
                    setClearStoredApiKey(true);
                  }}
                  disabled={!aiSettings?.hasStoredApiKey || aiSettingsBusy || !currentProject}
                >
                  Rimuovi API key salvata
                </button>
              </div>
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => void handleSaveAiSettings()}
                  disabled={!aiSettings || aiSettingsBusy || !currentProject}
                >
                  Salva Impostazioni AI
                </button>
              </div>
            </div>
            <div className="row-buttons">
              <button
                type="button"
                onClick={() => setIsAiSettingsModalOpen(false)}
                className="button-secondary"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {isCloseProjectConfirmOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Chiudere il progetto?</h3>
            <p className="muted">
              Sono presenti modifiche non ancora persistite. Puoi salvarle prima di chiudere oppure
              uscire senza salvare.
            </p>
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsCloseProjectConfirmOpen(false)}
                disabled={busy}
              >
                Annulla
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setIsCloseProjectConfirmOpen(false);
                  void performCloseProject();
                }}
                disabled={busy}
              >
                Chiudi senza salvare
              </button>
              <button
                type="button"
                onClick={() => {
                  void (async () => {
                    const flushed = await flushPendingChangesBeforeClose();
                    if (!flushed) {
                      return;
                    }
                    setIsCloseProjectConfirmOpen(false);
                    await performCloseProject();
                  })();
                }}
                disabled={busy}
              >
                Salva e chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'story' && isCreateProjectModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Crea Progetto</h3>
            <label>
              Cartella progetto
              <div className="input-with-button">
                <input
                  value={createProjectRoot}
                  placeholder="Seleziona la cartella del progetto"
                  readOnly
                />
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => void handleSelectCreateProjectDirectory()}
                  disabled={busy}
                >
                  Sfoglia...
                </button>
              </div>
            </label>
            <label>
              Nome progetto
              <input
                value={createProjectName}
                onChange={(event) => setCreateProjectName(event.target.value)}
                placeholder="Titolo progetto"
              />
            </label>
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsCreateProjectModalOpen(false)}
                disabled={busy}
              >
                Annulla
              </button>
              <button type="button" onClick={() => void handleCreateProject()} disabled={!canCreateProject}>
                Crea e Apri
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'story' && isPlotModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Nuove Trame</h3>
            <label>
              Numero trama
              <input
                type="number"
                min={1}
                value={newPlotNumber}
                onChange={(event) => setNewPlotNumber(Math.max(1, Number(event.target.value) || 1))}
              />
            </label>
            <label>
              Etichetta trama
              <input
                value={existingPlotForNewNumber ? existingPlotForNewNumber.label : newPlotLabel}
                onChange={(event) => setNewPlotLabel(event.target.value)}
                placeholder="Trama principale"
                disabled={Boolean(existingPlotForNewNumber)}
              />
            </label>
            <label>
              Bozza trama / struttura
              <textarea
                rows={7}
                value={existingPlotForNewNumber ? existingPlotForNewNumber.summary : newPlotSummary}
                onChange={(event) => setNewPlotSummary(event.target.value)}
                placeholder="Riassunto, struttura grezza, scene chiave, conflitti..."
                disabled={Boolean(existingPlotForNewNumber)}
              />
            </label>
            {existingPlotForNewNumber ? (
              <p className="muted">
                Trama esistente: <strong>{existingPlotForNewNumber.label || '(senza etichetta)'}</strong>.
                Modificala dal tab Trame con doppio click sul blocco.
              </p>
            ) : null}
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsPlotModalOpen(false)}
                disabled={busy}
              >
                Annulla
              </button>
              <button type="button" onClick={() => void handleCreatePlot()} disabled={!canCreatePlot}>
                Crea Trama
              </button>
              <button
                type="button"
                className={plotStructureBusy ? 'ai-working' : undefined}
                onClick={() => void handleCreatePlotStructure()}
                disabled={!canCreatePlotStructure}
              >
                {plotStructureBusy ? 'In Creazione...' : 'Crea Struttura'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'plots' && currentEditPlot ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Modifica Trama</h3>
            <label>
              Numero trama
              <input value={String(currentEditPlot.number)} readOnly />
            </label>
            <label>
              Titolo trama
              <input
                value={editPlotLabelInput}
                onChange={(event) => setEditPlotLabelInput(event.target.value)}
                placeholder={`Trama ${currentEditPlot.number}`}
              />
            </label>
            <label>
              Bozza trama / struttura
              <textarea
                rows={8}
                value={editPlotSummaryInput}
                onChange={(event) => setEditPlotSummaryInput(event.target.value)}
              />
            </label>
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => {
                  setEditPlotId(null);
                  setEditPlotLabelInput('');
                  setEditPlotSummaryInput('');
                }}
                disabled={busy}
              >
                Annulla
              </button>
              <button type="button" onClick={() => void handleSavePlotEdit()} disabled={busy}>
                Salva Trama
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'story' && isNewNodeModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Nuovo Capitolo</h3>
            <label>
              Titolo
              <input
                value={newNodeTitle}
                onChange={(event) => setNewNodeTitle(event.target.value)}
                placeholder="Titolo capitolo"
              />
            </label>
            <label>
              Descrizione
              <textarea
                value={newNodeDescription}
                onChange={(event) => setNewNodeDescription(event.target.value)}
                placeholder="Descrizione capitolo"
                rows={3}
              />
            </label>
            <label>
              Numero trama
              <input
                type="number"
                min={1}
                value={newNodePlotNumber}
                onChange={(event) =>
                  setNewNodePlotNumber(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>
            <label>
              Numero blocco (opzionale)
              <input
                type="number"
                min={1}
                value={newNodeBlockNumber}
                onChange={(event) => setNewNodeBlockNumber(event.target.value)}
                placeholder="Auto"
              />
            </label>
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsNewNodeModalOpen(false)}
                disabled={busy}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void handleCreateNode()}
                disabled={!currentProject || busy}
              >
                Crea Blocco
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'story' && editNodeId ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Modifica Blocco</h3>
            <label>
              Titolo blocco
              <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
            </label>
            <label>
              Descrizione
              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                rows={4}
              />
            </label>
            <label>
              Numero trama{editPlotLabel ? ` (${editPlotLabel})` : ''}
              <input
                type="number"
                min={1}
                value={editPlotNumber}
                onChange={(event) =>
                  setEditPlotNumber(Math.max(1, Number(event.target.value) || 1))
                }
              />
            </label>
            <label>
              Numero blocco
              <input
                type="number"
                min={1}
                value={editBlockNumber}
                onChange={(event) => setEditBlockNumber(Number(event.target.value))}
              />
            </label>
            <div className="row-buttons">
              <button
                type="button"
                onClick={() => {
                  if (!editNodeId) {
                    return;
                  }
                  openEditorForNode(editNodeId);
                }}
              >
                Apri editor capitolo
              </button>
              <button type="button" onClick={() => setEditNodeId(null)}>
                Annulla
              </button>
              <button type="button" onClick={() => void handleSaveNodeEdit()} disabled={busy}>
                Salva
              </button>
            </div>
          </div>
        </div>
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
        />
      ) : null}
    </main>
  );
}
