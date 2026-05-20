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
  type Connection,
  type Edge,
  type Node,
  type OnNodeDrag,
  type OnEdgesChange,
  type OnNodesChange,
  type OnNodesDelete,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { getNearbyCanvasPosition } from './canvas-position';
import ChapterEditor from './ChapterEditor';
import {
  FLOW_MINIMAP_MASK_COLOR,
  getFlowMiniMapNodeColor,
  getFlowMiniMapNodeStrokeColor,
} from './flow-minimap';
import { canvasMultiSelectProps } from './flow-selection';
import { normalizePlotLabel } from './features/plot/plot-flow';
import SceneFlowNode, { type SceneFlowNodeData } from './SceneFlowNode';
import type { Translate } from './i18n';
import { getStatusTone } from './status-tone';

type SceneCard = Awaited<ReturnType<(typeof window.novelistApi)['listSceneCards']>>[number];
type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type StoryChapterNode = StoryState['nodes'][number];
type StoryPlot = StoryState['plots'][number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;
type SceneCanvasNode = Node<SceneFlowNodeData, 'scene'>;

interface SceneBoardProps {
  currentProject: ProjectRecord;
  autosaveSettings: AppPreferences | null;
  statusMessage: string;
  workspaceNotice?: string | null;
  onStatus: (message: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterFlush?: (handler: (() => Promise<boolean>) | null) => void;
  onWikiSync?: () => Promise<void>;
  t: Translate;
}

function formatPlotLabel(
  plot: StoryPlot | null | undefined,
  plotNumber: number,
  t: Translate,
): string {
  return normalizePlotLabel(plotNumber, plot?.label ?? '', t('common.plot'));
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

function getPlotColor(plot: StoryPlot | null | undefined, plotNumber: number): string {
  return plot?.color ?? colorFromPlotNumber(plotNumber);
}

function createEmptyRichTextDocumentJson(): string {
  return JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  });
}

function mapSceneToNode(
  scene: SceneCard,
  chaptersById: Map<string, StoryChapterNode>,
  plotsByNumber: Map<number, StoryPlot>,
  t: Translate,
  options?: { selected?: boolean },
): SceneCanvasNode {
  const chapter = chaptersById.get(scene.chapterNodeId);
  const plot = plotsByNumber.get(scene.plotNumber);
  const plotColor = getPlotColor(plot, scene.plotNumber);

  return {
    id: scene.id,
    type: 'scene',
    selected: options?.selected,
    position: {
      x: scene.positionX,
      y: scene.positionY,
    },
    data: {
      label: scene.name,
      chapterTitle: chapter?.title ?? t('scene.missingChapter'),
      plotLabel: formatPlotLabel(plot, scene.plotNumber, t),
      subtitle: scene.text.trim(),
    },
    style: {
      border: `2px solid ${plotColor}`,
      borderRadius: '12px',
      width: 320,
      background: 'var(--surface-primary)',
      boxShadow: 'var(--flow-node-shadow)',
      padding: '10px',
    },
  };
}

export default function SceneBoard({
  currentProject,
  autosaveSettings,
  statusMessage,
  workspaceNotice,
  onStatus,
  onDirtyChange,
  onRegisterFlush,
  onWikiSync,
  t,
}: SceneBoardProps) {
  const [scenes, setScenes] = useState<SceneCard[]>([]);
  const [nodes, setNodes] = useState<SceneCanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [isCreateSceneModalOpen, setIsCreateSceneModalOpen] = useState<boolean>(false);
  const [newSceneTitle, setNewSceneTitle] = useState<string>(t('scene.new'));
  const [newScenePlotNumber, setNewScenePlotNumber] = useState<number>(1);
  const [sceneEditorDirty, setSceneEditorDirty] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const sceneEditorFlushRef = useRef<(() => Promise<boolean>) | null>(null);

  const nodeTypes = useMemo(() => ({ scene: SceneFlowNode }), []);
  const scenesById = useMemo(() => new Map(scenes.map((scene) => [scene.id, scene])), [scenes]);
  const chaptersById = useMemo(
    () => new Map((storyState?.nodes ?? []).map((chapter) => [chapter.id, chapter])),
    [storyState],
  );
  const plotsByNumber = useMemo(
    () => new Map((storyState?.plots ?? []).map((plot) => [plot.number, plot])),
    [storyState],
  );
  const selectedScene = selectedSceneId ? (scenesById.get(selectedSceneId) ?? null) : null;
  const selectedChapter = selectedScene ? chaptersById.get(selectedScene.chapterNodeId) : null;
  const selectedPlot = selectedScene ? plotsByNumber.get(selectedScene.plotNumber) : null;
  const currentEditScene = editSceneId ? (scenesById.get(editSceneId) ?? null) : null;
  const statusTone = getStatusTone(statusMessage);
  const chaptersForNewScenePlot = useMemo(
    () => (storyState?.nodes ?? []).filter((chapter) => chapter.plotNumber === newScenePlotNumber),
    [newScenePlotNumber, storyState?.nodes],
  );

  const refreshScenes = useCallback(async (): Promise<void> => {
    const [nextScenes, nextStoryState] = await Promise.all([
      window.novelistApi.listSceneCards(),
      window.novelistApi.getStoryState(),
    ]);
    const nextChaptersById = new Map(nextStoryState.nodes.map((chapter) => [chapter.id, chapter]));
    const nextPlotsByNumber = new Map(nextStoryState.plots.map((plot) => [plot.number, plot]));
    const sceneIds = new Set(nextScenes.map((scene) => scene.id));
    setScenes(nextScenes);
    setStoryState(nextStoryState);
    setEdges(
      nextStoryState.edges
        .filter((edge) => sceneIds.has(edge.sourceId) && sceneIds.has(edge.targetId))
        .map((edge) => ({
          id: edge.id,
          source: edge.sourceId,
          target: edge.targetId,
          sourceHandle: edge.sourceHandle ?? 'handle-bottom',
          targetHandle: edge.targetHandle ?? 'handle-top',
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color)' },
          style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
        })),
    );
    setNodes((previous) =>
      nextScenes.map((scene) => {
        const previousNode = previous.find((node) => node.id === scene.id);
        return mapSceneToNode(scene, nextChaptersById, nextPlotsByNumber, t, {
          selected: previousNode?.selected,
        });
      }),
    );
  }, [t]);

  useEffect(() => {
    void refreshScenes();
  }, [refreshScenes]);

  useEffect(() => {
    if (!storyState || storyState.plots.length === 0) {
      return;
    }
    if (!storyState.plots.some((plot) => plot.number === newScenePlotNumber)) {
      setNewScenePlotNumber(storyState.plots[0]?.number ?? 1);
    }
  }, [newScenePlotNumber, storyState]);

  useEffect(() => {
    if (editSceneId) {
      return;
    }
    setSceneEditorDirty(false);
    sceneEditorFlushRef.current = null;
    onDirtyChange?.(false);
    onRegisterFlush?.(null);
  }, [editSceneId, onDirtyChange, onRegisterFlush]);

  const handleSceneEditorDirtyChange = useCallback(
    (dirty: boolean): void => {
      setSceneEditorDirty(dirty);
      onDirtyChange?.(dirty);
    },
    [onDirtyChange],
  );

  const handleRegisterSceneEditorFlush = useCallback(
    (handler: (() => Promise<boolean>) | null): void => {
      sceneEditorFlushRef.current = handler;
      onRegisterFlush?.(handler);
    },
    [onRegisterFlush],
  );

  const handleCloseSceneEditor = useCallback(async (): Promise<void> => {
    const wasDirty = sceneEditorDirty;
    if (sceneEditorFlushRef.current) {
      const ok = await sceneEditorFlushRef.current();
      if (!ok && wasDirty) {
        return;
      }
    }
    setEditSceneId(null);
    await refreshScenes();
  }, [refreshScenes, sceneEditorDirty]);

  const onNodesChange: OnNodesChange<SceneCanvasNode> = useCallback(
    (changes) => setNodes((currentNodes) => applyNodeChanges(changes, currentNodes)),
    [],
  );

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((currentEdges) => applyEdgeChanges(changes, currentEdges));
  }, []);

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
      setEdges((previous) => [
        ...previous,
        {
          id: created.id,
          source: created.sourceId,
          target: created.targetId,
          sourceHandle: created.sourceHandle ?? 'handle-bottom',
          targetHandle: created.targetHandle ?? 'handle-top',
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color)' },
          style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
        },
      ]);
      onStatus(t('story.status.connectionCreated'));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      if (deletedEdges.length === 0) {
        return;
      }

      setBusy(true);
      try {
        await Promise.all(
          deletedEdges.map((edge) => window.novelistApi.deleteStoryEdge({ id: edge.id })),
        );
        onStatus(t('story.status.connectionsDeleted', { count: deletedEdges.length }));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [onStatus, t],
  );

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const selectedNode = params.nodes[0];
    setSelectedSceneId(selectedNode?.id ?? null);
  }, []);

  const handleNodeDragStop: OnNodeDrag<SceneCanvasNode> = useCallback(
    async (_event, node, draggedNodes): Promise<void> => {
      const nodesToPersist = draggedNodes.length > 0 ? draggedNodes : [node];
      const scenesToPersist = nodesToPersist
        .map((draggedNode) => ({ node: draggedNode, scene: scenesById.get(draggedNode.id) }))
        .filter((item): item is { node: SceneCanvasNode; scene: SceneCard } =>
          Boolean(item.scene),
        );

      if (scenesToPersist.length === 0) {
        return;
      }

      try {
        await Promise.all(
          scenesToPersist.map(({ node: draggedNode, scene }) =>
            window.novelistApi.updateSceneCard({
              id: scene.id,
              chapterNodeId: scene.chapterNodeId,
              name: scene.name,
              text: scene.text,
              contentJson: scene.contentJson,
              notes: scene.notes,
              plotNumber: scene.plotNumber,
              positionX: draggedNode.position.x,
              positionY: draggedNode.position.y,
            }),
          ),
        );
        await refreshScenes();
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
      }
    },
    [refreshScenes, scenesById, t],
  );

  const deleteScenes = useCallback(
    async (sceneIds: string[]): Promise<void> => {
      if (sceneIds.length === 0) {
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await Promise.all(sceneIds.map((id) => window.novelistApi.deleteSceneCard({ id })));
        setSelectedSceneId(null);
        await refreshScenes();
        void onWikiSync?.();
        onStatus(
          sceneIds.length === 1
            ? t('scene.status.deleted')
            : t('scene.status.deletedMultiple', { count: sceneIds.length }),
        );
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [onStatus, onWikiSync, refreshScenes, t],
  );

  const onNodesDelete: OnNodesDelete<SceneCanvasNode> = useCallback(
    (deletedNodes) => {
      void deleteScenes(deletedNodes.map((node) => node.id));
    },
    [deleteScenes],
  );

  async function handleDeleteSelectedScene(): Promise<void> {
    const selectedSceneIds = nodes.filter((node) => node.selected).map((node) => node.id);
    const sceneIdsToDelete =
      selectedSceneIds.length > 0 ? selectedSceneIds : selectedSceneId ? [selectedSceneId] : [];

    if (sceneIdsToDelete.length === 0) {
      return;
    }

    await deleteScenes(sceneIdsToDelete);
  }

  function openEditScene(scene: SceneCard): void {
    setEditSceneId(scene.id);
  }

  function openCreateSceneModal(): void {
    setNewSceneTitle(t('scene.new'));
    setNewScenePlotNumber(selectedScene?.plotNumber ?? storyState?.plots[0]?.number ?? 1);
    setIsCreateSceneModalOpen(true);
  }

  async function handleCreateScene(): Promise<void> {
    if (!storyState) {
      return;
    }

    const title = newSceneTitle.trim();
    if (!title) {
      onStatus(t('scene.requireTitle'));
      return;
    }

    const chapter = chaptersForNewScenePlot[0];
    if (!chapter) {
      onStatus(t('scene.missingChapterForCreate'));
      setError(t('scene.missingChapterForCreateDetail'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const nextPosition = getNearbyCanvasPosition(
        scenes.map((scene) => ({
          x: scene.positionX,
          y: scene.positionY,
        })),
        {
          emptyPosition: { x: 120, y: 120 },
          minDistance: 225,
          radiusStep: 155,
        },
      );
      const created = await window.novelistApi.createSceneCard({
        chapterNodeId: chapter.id,
        name: title,
        text: '',
        contentJson: createEmptyRichTextDocumentJson(),
        notes: '',
        plotNumber: newScenePlotNumber,
        positionX: nextPosition.x,
        positionY: nextPosition.y,
      });

      setSelectedSceneId(created.id);
      setIsCreateSceneModalOpen(false);
      setNewSceneTitle(t('scene.new'));
      await refreshScenes();
      await onWikiSync?.();
      onStatus(t('scene.status.created', { name: created.name }));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      onStatus(t('scene.status.createError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="workspace">
      <aside className="sidebar">
        <div className="sidebar-action-group">
          <button
            type="button"
            className="sidebar-action-button"
            onClick={openCreateSceneModal}
            disabled={!storyState || busy}
          >
            {t('scene.create')}
          </button>
        </div>

        <div className="panel">
          <h2>{t('story.selection')}</h2>
          <p>
            {t('scene.selection')} <strong>{selectedScene ? selectedScene.name : '-'}</strong>
          </p>
          <p>
            {t('scene.chapter')} <strong>{selectedChapter?.title ?? '-'}</strong>
          </p>
          <p>
            {t('plot.selection')}{' '}
            <strong>
              {selectedScene ? formatPlotLabel(selectedPlot, selectedScene.plotNumber, t) : '-'}
            </strong>
          </p>
          <div className="selection-action-stack">
            <button
              type="button"
              className="sidebar-action-button danger-action-button"
              onClick={() => void handleDeleteSelectedScene()}
              disabled={!selectedSceneId || busy}
            >
              {t('scene.delete')}
            </button>
          </div>
        </div>

        <div className="panel status-panel">
          <p className={`status status-${statusTone}`}>
            <span>{statusMessage}</span>
            {workspaceNotice ? (
              <span className="status-inline-notice">{workspaceNotice}</span>
            ) : null}
          </p>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </aside>

      <section className="canvas-wrap">
        <ReactFlow<SceneCanvasNode>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onEdgesDelete={onEdgesDelete}
          onConnect={(connection) => void handleConnect(connection)}
          onNodesDelete={onNodesDelete}
          onNodeDragStop={handleNodeDragStop}
          onNodeDoubleClick={(_event, node) => {
            const scene = scenesById.get(node.id);
            if (scene) {
              openEditScene(scene);
            }
          }}
          onSelectionChange={onSelectionChange}
          connectionMode={ConnectionMode.Loose}
          elevateNodesOnSelect
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

      {isCreateSceneModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>{t('scene.create')}</h3>
            <label>
              {t('story.modal.title')}
              <input
                value={newSceneTitle}
                onChange={(event) => setNewSceneTitle(event.target.value)}
                placeholder={t('scene.field.titlePlaceholder')}
              />
            </label>
            <label>
              {t('story.modal.plot')}
              <select
                value={newScenePlotNumber}
                onChange={(event) =>
                  setNewScenePlotNumber(Math.max(1, Number(event.target.value) || 1))
                }
              >
                {(storyState?.plots ?? []).length > 0 ? (
                  (storyState?.plots ?? []).map((plot) => (
                    <option key={plot.id} value={plot.number}>
                      {formatPlotLabel(plot, plot.number, t)}
                    </option>
                  ))
                ) : (
                  <option
                    value={newScenePlotNumber}
                  >{`${t('common.plot')} ${newScenePlotNumber}`}</option>
                )}
              </select>
            </label>
            {chaptersForNewScenePlot.length === 0 ? (
              <p className="error">{t('scene.emptyChaptersForPlot')}</p>
            ) : null}
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsCreateSceneModalOpen(false)}
                disabled={busy}
              >
                {t('common.cancel')}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateScene()}
                disabled={busy || !newSceneTitle.trim() || chaptersForNewScenePlot.length === 0}
              >
                {t('scene.create')}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {currentEditScene ? (
        <ChapterEditor
          chapterNodeId={currentEditScene.chapterNodeId}
          chapterTitle={
            chaptersById.get(currentEditScene.chapterNodeId)?.title ?? currentEditScene.name
          }
          sceneCard={currentEditScene}
          projectName={currentProject?.name}
          autosaveSettings={autosaveSettings}
          onClose={handleCloseSceneEditor}
          onStatus={onStatus}
          onSceneSaved={async () => {
            await refreshScenes();
            await onWikiSync?.();
          }}
          onDirtyChange={handleSceneEditorDirtyChange}
          onRegisterFlush={handleRegisterSceneEditorFlush}
        />
      ) : null}
    </section>
  );
}
