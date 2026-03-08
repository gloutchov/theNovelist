import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
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

type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type StoryNodeRecord = StoryState['nodes'][number];
type StoryEdgeRecord = StoryState['edges'][number];
type PlotRecord = StoryState['plots'][number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;
type ProjectPathInspection = Awaited<ReturnType<(typeof window.novelistApi)['inspectProjectPath']>>;
type ChapterCanvasNode = Node<ChapterFlowNodeData, 'chapter'>;

type WorkspaceTab = 'story' | 'characters' | 'locations';

const DEFAULT_PROJECT_ROOT = '/tmp/the-novelist-project';
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
      background: '#ffffff',
      boxShadow: '0 10px 22px rgba(15, 23, 42, 0.1)',
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
    markerEnd: { type: MarkerType.ArrowClosed, color: '#374151' },
    style: { stroke: '#374151', strokeWidth: 2 },
  };
}

export default function App() {
  const [status, setStatus] = useState<string>('Nessun progetto aperto');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const [projectRoot, setProjectRoot] = useState<string>(DEFAULT_PROJECT_ROOT);
  const [projectName, setProjectName] = useState<string>(DEFAULT_PROJECT_NAME);
  const [projectPathInspection, setProjectPathInspection] = useState<ProjectPathInspection | null>(null);
  const [projectPathChecking, setProjectPathChecking] = useState<boolean>(false);
  const [currentProject, setCurrentProject] = useState<ProjectRecord>(null);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('story');
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

  const [newNodeTitle, setNewNodeTitle] = useState<string>('Nuovo capitolo');
  const [newNodeDescription, setNewNodeDescription] = useState<string>('');
  const [newNodePlotNumber, setNewNodePlotNumber] = useState<number>(1);
  const [newNodeBlockNumber, setNewNodeBlockNumber] = useState<string>('');

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  const [editNodeId, setEditNodeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editPlotNumber, setEditPlotNumber] = useState<number>(1);
  const [editBlockNumber, setEditBlockNumber] = useState<number>(1);
  const [editorNodeId, setEditorNodeId] = useState<string | null>(null);
  const [editorNodeTitle, setEditorNodeTitle] = useState<string>('');

  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedNode = useMemo(
    () => (selectedNodeId ? nodesById.get(selectedNodeId) ?? null : null),
    [nodesById, selectedNodeId],
  );
  const trimmedProjectRoot = projectRoot.trim();
  const canCreateProject = Boolean(trimmedProjectRoot) && !busy && !projectPathChecking && projectPathInspection?.exists === false;
  const canOpenProject = Boolean(trimmedProjectRoot) && !busy && !projectPathChecking && projectPathInspection?.exists === true;
  const nodeTypes = useMemo(() => ({ chapter: ChapterFlowNode }), []);
  const handleWorkspaceStatus = useCallback((message: string) => {
    setStatus(message);
  }, []);
  const handleCloseChapterEditor = useCallback(() => {
    setEditorNodeId(null);
    setEditorNodeTitle('');
    setEditNodeId(null);
  }, []);

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

  async function handleCreateProject(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const project = await window.novelistApi.createProject({
        rootPath: projectRoot,
        name: projectName,
      });

      setCurrentProject(project);
      setProjectName(project.name);
      setProjectPathInspection({
        exists: true,
        projectName: project.name,
      });
      setStatus(`Progetto creato: ${project.name}`);

      const state = await window.novelistApi.getStoryState();
      setPlots(state.plots);
      setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setEditNodeId(null);
      setEditorNodeId(null);
      setEditorNodeTitle('');
      setNewNodePlotNumber(1);
      setNewPlotNumber(1);
      const settings = await window.novelistApi.codexGetSettings();
      setAiSettings(settings);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in creazione progetto');
    } finally {
      setBusy(false);
    }
  }

  async function handleOpenProject(): Promise<void> {
    setBusy(true);
    setError(null);

    try {
      const project = await window.novelistApi.openProject({
        rootPath: projectRoot,
      });

      setCurrentProject(project);
      setProjectName(project.name);
      setProjectPathInspection({
        exists: true,
        projectName: project.name,
      });
      setStatus(`Progetto aperto: ${project.name}`);

      const state = await window.novelistApi.getStoryState();
      setPlots(state.plots);
      setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      setSelectedNodeId(null);
      setSelectedEdgeId(null);
      setEditNodeId(null);
      setEditorNodeId(null);
      setEditorNodeTitle('');
      const settings = await window.novelistApi.codexGetSettings();
      setAiSettings(settings);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
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

  async function handleBrowseProjectRoot(): Promise<void> {
    setError(null);
    try {
      const selectedPath = await window.novelistApi.selectProjectDirectory();
      if (!selectedPath) {
        return;
      }

      setProjectRoot(selectedPath);
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

    setBusy(true);
    setError(null);

    try {
      await window.novelistApi.createPlot({
        number: newPlotNumber,
        label: newPlotLabel.trim() || undefined,
      });

      await refreshStoryState();
      setStatus(`Trama ${newPlotNumber} creata`);
      setNewNodePlotNumber(newPlotNumber);
      setNewPlotLabel('');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore in creazione trama');
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
      setStatus(`Blocco aggiornato: ${updated.title}`);
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

  async function handleSaveNodeEdit(): Promise<void> {
    if (!editNodeId) {
      return;
    }

    const currentNode = nodes.find((node) => node.id === editNodeId);
    if (!currentNode) {
      return;
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

      setNodes((prev) => prev.map((item) => (item.id === editNodeId ? mapNodeRecordToFlowNode(updated, plots) : item)));
      setStatus(`Blocco modificato: ${updated.title}`);
      setEditNodeId(null);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore nel salvataggio blocco');
    } finally {
      setBusy(false);
    }
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

    await Promise.all(deletedEdges.map((edge) => window.novelistApi.deleteStoryEdge({ id: edge.id })));
    setStatus(`${deletedEdges.length} connessioni eliminate`);
  }, []);

  const onNodesDelete: OnNodesDelete<ChapterCanvasNode> = useCallback(async (deletedNodes) => {
    if (deletedNodes.length === 0) {
      return;
    }

    await Promise.all(deletedNodes.map((node) => window.novelistApi.deleteStoryNode({ id: node.id })));
    setStatus(`${deletedNodes.length} blocchi eliminati`);
  }, []);

  const onSelectionChange = useCallback((selection: OnSelectionChangeParams<ChapterCanvasNode, Edge>) => {
    setSelectedNodeId(selection.nodes[0]?.id ?? null);
    setSelectedEdgeId(selection.edges[0]?.id ?? null);
  }, []);

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
      const existingProject = await window.novelistApi.getCurrentProject();
      if (!existingProject) {
        return;
      }

      setCurrentProject(existingProject);
      setProjectRoot(existingProject.rootPath);
      setProjectName(existingProject.name);
      setProjectPathInspection({
        exists: true,
        projectName: existingProject.name,
      });
      const state = await window.novelistApi.getStoryState();
      setPlots(state.plots);
      setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      const settings = await window.novelistApi.codexGetSettings();
      setAiSettings(settings);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      setStatus(`Sessione ripristinata: ${existingProject.name}`);
    })();
  }, []);

  useEffect(() => {
    if (!trimmedProjectRoot) {
      setProjectPathInspection(null);
      setProjectPathChecking(false);
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(() => {
      setProjectPathChecking(true);
      void (async () => {
        try {
          const inspection = await window.novelistApi.inspectProjectPath({
            rootPath: trimmedProjectRoot,
          });
          if (cancelled) {
            return;
          }
          setProjectPathInspection(inspection);
          if (inspection.exists && inspection.projectName) {
            setProjectName(inspection.projectName);
          }
        } catch {
          if (cancelled) {
            return;
          }
          setProjectPathInspection(null);
        } finally {
          if (!cancelled) {
            setProjectPathChecking(false);
          }
        }
      })();
    }, 180);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [trimmedProjectRoot]);

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
            disabled={!currentProject}
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
              <label>
                Path progetto
                <div className="input-with-button">
                  <input
                    value={projectRoot}
                    onChange={(event) => setProjectRoot(event.target.value)}
                    placeholder="/path/progetto"
                  />
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => void handleBrowseProjectRoot()}
                    disabled={busy}
                  >
                    Sfoglia...
                  </button>
                </div>
              </label>
              <label>
                Nome progetto
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Titolo progetto"
                />
              </label>
              <div className="row-buttons">
                <button type="button" onClick={handleCreateProject} disabled={!canCreateProject}>
                  Crea
                </button>
                <button type="button" onClick={handleOpenProject} disabled={!canOpenProject}>
                  Apri
                </button>
                <button type="button" onClick={() => void handleSaveProject()} disabled={!currentProject || busy}>
                  Salva
                </button>
              </div>
              {projectPathChecking ? <p className="muted">Verifica progetto in corso...</p> : null}
              {!projectPathChecking && projectPathInspection?.exists ? (
                <p className="muted">
                  Progetto rilevato: <strong>{projectPathInspection.projectName ?? '(nome non disponibile)'}</strong>
                </p>
              ) : null}
              {!projectPathChecking && projectPathInspection && !projectPathInspection.exists ? (
                <p className="muted">Nessun progetto trovato: puoi crearne uno nuovo.</p>
              ) : null}
            </div>

            <div className="panel">
              <h2>Trame</h2>
              <label>
                Numero trama
                <input
                  type="number"
                  min={1}
                  value={newPlotNumber}
                  onChange={(event) => setNewPlotNumber(Number(event.target.value))}
                />
              </label>
              <label>
                Etichetta trama
                <input
                  value={newPlotLabel}
                  onChange={(event) => setNewPlotLabel(event.target.value)}
                  placeholder="Trama principale"
                />
              </label>
              <button type="button" onClick={handleCreatePlot} disabled={!currentProject || busy}>
                Crea Trama
              </button>
            </div>

            <div className="panel">
              <h2>Nuovo Capitolo</h2>
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
                  onChange={(event) => setNewNodePlotNumber(Number(event.target.value))}
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
              <button type="button" onClick={handleCreateNode} disabled={!currentProject || busy}>
                Crea Blocco
              </button>
            </div>

            <div className="panel">
              <h2>Selezione</h2>
              <p>
                Nodo: <strong>{selectedNode?.data.title ?? '-'}</strong>
              </p>
              <p>
                Edge: <strong>{selectedEdgeId ?? '-'}</strong>
              </p>
              <div className="row-buttons">
                <button type="button" onClick={handleDeleteSelectedNode} disabled={!selectedNodeId || busy}>
                  Elimina Blocco
                </button>
                <button type="button" onClick={handleDeleteSelectedEdge} disabled={!selectedEdgeId || busy}>
                  Elimina Conn.
                </button>
              </div>
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => selectedNodeId && openEditorForNode(selectedNodeId)}
                  disabled={!selectedNodeId}
                >
                  Apri Editor Capitolo
                </button>
              </div>
            </div>

            <div className="panel">
              <h2>Documento Completo</h2>
              <p className="muted">Ordine capitoli calcolato in base alle connessioni del canvas.</p>
              <div className="row-buttons">
                <button type="button" onClick={() => void handleExportManuscriptDocx()} disabled={!currentProject || busy}>
                  Esporta DOCX
                </button>
                <button type="button" onClick={() => void handleExportManuscriptPdf()} disabled={!currentProject || busy}>
                  Esporta PDF
                </button>
                <button type="button" onClick={() => void handlePrintManuscript()} disabled={!currentProject || busy}>
                  Stampa
                </button>
              </div>
            </div>

            <div className="panel status-panel">
              <p className="status">{status}</p>
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

      {activeTab === 'characters' ? (
        currentProject ? (
          <CharacterBoard
            currentProject={currentProject}
            aiSettings={aiSettings}
            onStatus={handleWorkspaceStatus}
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
            onStatus={handleWorkspaceStatus}
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
            <h3>Impostazioni AI</h3>
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
                Chiave API configurata in: <strong>{getApiKeyStorageLabel(aiSettings.apiKeyStorage)}</strong>.
              </p>
            ) : null}
            {clearStoredApiKey ? <p className="muted">La chiave salvata verrà rimossa al prossimo salvataggio.</p> : null}
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
            <p className="muted">
              Con provider OpenAI API, se la chiave è vuota verrà usata `OPENAI_API_KEY` se disponibile. Con provider
              Ollama, host predefinito `http://127.0.0.1:11434` (override con `OLLAMA_HOST`).
            </p>
            <div className="row-buttons">
              <button type="button" onClick={() => setIsAiSettingsModalOpen(false)} className="button-secondary">
                Chiudi
              </button>
              <button
                type="button"
                onClick={() => void handleSaveAiSettings()}
                disabled={!aiSettings || aiSettingsBusy || !currentProject}
              >
                Salva Impostazioni AI
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
              Numero trama
              <input
                type="number"
                min={1}
                value={editPlotNumber}
                onChange={(event) => setEditPlotNumber(Number(event.target.value))}
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
          onClose={handleCloseChapterEditor}
          onChapterSaved={refreshStoryState}
          onStatus={handleWorkspaceStatus}
        />
      ) : null}
    </main>
  );
}
