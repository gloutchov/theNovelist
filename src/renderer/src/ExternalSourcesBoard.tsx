import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
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
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnNodeDrag,
  type OnNodesChange,
  type OnNodesDelete,
  type OnSelectionChangeParams,
  type ReactFlowInstance,
} from '@xyflow/react';
import {
  FLOW_MINIMAP_MASK_COLOR,
  getFlowMiniMapNodeColor,
  getFlowMiniMapNodeStrokeColor,
} from './flow-minimap';
import { canvasMultiSelectProps } from './flow-selection';
import ExternalSourceFlowNode, {
  type ExternalSourceFlowNodeData,
} from './ExternalSourceFlowNode';
import {
  beginExternalSourceAiProcessing,
  isExternalSourceAiProcessingActive,
  subscribeExternalSourceAiProcessing,
} from './external-source-processing-state';
import { getStatusTone } from './status-tone';
import type { Translate } from './i18n';

type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type ExternalSource = Awaited<
  ReturnType<(typeof window.novelistApi)['getExternalSourcesState']>
>['sources'][number];
type ExternalSourceNode = Node<ExternalSourceFlowNodeData, 'externalSource'>;

interface ExternalSourcesBoardProps {
  currentProject: ProjectRecord;
  statusMessage: string;
  workspaceNotice?: string | null;
  onStatus: (message: string) => void;
  t: Translate;
}

function mapSourceToNode(
  source: ExternalSource,
  t: Translate,
  options?: { selected?: boolean },
): ExternalSourceNode {
  return {
    id: source.id,
    type: 'externalSource',
    position: {
      x: source.positionX,
      y: source.positionY,
    },
    selected: options?.selected,
    data: {
      fileName: source.fileName,
      fileType: source.fileType,
      summary: source.summary,
      extractionMethod: source.extractionMethod,
      extractionStatus: source.extractionStatus,
      extractionStatusLabel:
        source.extractionMethod === 'ai_ocr'
          ? t('externalSources.extractionMethod.aiOcrShort')
          : source.extractionMethod === 'ai_analysis'
            ? t('externalSources.extractionMethod.aiAnalysisShort')
          : t(`externalSources.extractionStatus.${source.extractionStatus}`),
    },
    style: {
      border: '2px solid #0f766e',
      borderRadius: '12px',
      width: 310,
      background: 'var(--surface-primary)',
      boxShadow: 'var(--flow-node-shadow)',
      padding: '10px',
    },
  };
}

function mapEdgeToFlowEdge(edge: {
  id: string;
  sourceId: string;
  targetId: string;
  sourceHandle: string | null;
  targetHandle: string | null;
  label: string | null;
}): Edge {
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    sourceHandle: edge.sourceHandle ?? 'handle-bottom',
    targetHandle: edge.targetHandle ?? 'handle-top',
    label: edge.label ?? '',
    markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color)' },
    style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
  };
}

function translateExtractionMessage(message: string, t: Translate): string {
  if (!message.startsWith('externalSources.extractionMessage.')) {
    return message;
  }

  const [key, details] = message.split(/:\s(.+)/, 2);
  const translated = t(key ?? message);
  return details ? `${translated}: ${details}` : translated;
}

export default function ExternalSourcesBoard({
  currentProject,
  statusMessage,
  workspaceNotice,
  onStatus,
  t,
}: ExternalSourcesBoardProps) {
  const [sources, setSources] = useState<ExternalSource[]>([]);
  const [nodes, setNodes] = useState<ExternalSourceNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState<boolean>(false);
  const [aiProcessing, setAiProcessing] = useState<boolean>(isExternalSourceAiProcessingActive);
  const flowRef = useRef<ReactFlowInstance<ExternalSourceNode, Edge> | null>(null);

  const nodeTypes = useMemo(() => ({ externalSource: ExternalSourceFlowNode }), []);
  const sourcesById = useMemo(() => new Map(sources.map((source) => [source.id, source])), [sources]);
  const selectedSource = selectedSourceId ? sourcesById.get(selectedSourceId) ?? null : null;
  const statusTone = getStatusTone(statusMessage);

  const refreshSources = useCallback(async (): Promise<void> => {
    const state = await window.novelistApi.getExternalSourcesState();
    setSources(state.sources);
    setNodes(
      state.sources.map((source) =>
        mapSourceToNode(source, t, { selected: source.id === selectedSourceId }),
      ),
    );
    setEdges(state.edges.map(mapEdgeToFlowEdge));
  }, [selectedSourceId, t]);

  useEffect(() => {
    if (!currentProject) {
      return;
    }

    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await refreshSources();
        onStatus(t('externalSources.status.loaded'));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
      } finally {
        setBusy(false);
      }
    })();
  }, [currentProject, onStatus, refreshSources, t]);

  useEffect(() => subscribeExternalSourceAiProcessing(setAiProcessing), []);

  const onNodesChange: OnNodesChange<ExternalSourceNode> = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<ExternalSourceNode>) => {
      setSelectedSourceId(selection.nodes[0]?.id ?? null);
    },
    [],
  );

  async function handleConnect(connection: Connection): Promise<void> {
    if (!connection.source || !connection.target || connection.source === connection.target) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const created = await window.novelistApi.createExternalSourceEdge({
        sourceId: connection.source,
        targetId: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });
      setEdges((prev) => [...prev, mapEdgeToFlowEdge(created)]);
      onStatus(t('externalSources.status.connectionCreated'));
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
          deletedEdges.map((edge) => window.novelistApi.deleteExternalSourceEdge({ id: edge.id })),
        );
        onStatus(t('externalSources.status.connectionsDeleted', { count: deletedEdges.length }));
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

  const onNodeDragStop: OnNodeDrag<ExternalSourceNode> = useCallback(
    async (_event, node, draggedNodes) => {
      const nodesToPersist = draggedNodes.length > 0 ? draggedNodes : [node];
      setBusy(true);
      try {
        const updatedSources = await Promise.all(
          nodesToPersist.map((draggedNode) =>
            window.novelistApi.updateExternalSource({
              id: draggedNode.id,
              positionX: draggedNode.position.x,
              positionY: draggedNode.position.y,
            }),
          ),
        );
        const updatedById = new Map(updatedSources.map((source) => [source.id, source]));
        setSources((prev) => prev.map((source) => updatedById.get(source.id) ?? source));
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [t],
  );

  const onNodeDoubleClick: NodeMouseHandler<ExternalSourceNode> = useCallback(
    (_event, node) => {
      void (async () => {
        setBusy(true);
        setError(null);
        try {
          await window.novelistApi.openExternalSource({ id: node.id });
          onStatus(t('externalSources.status.opened'));
        } catch (caughtError) {
          const message =
            caughtError instanceof Error ? caughtError.message : t('common.unknownError');
          setError(message);
        } finally {
          setBusy(false);
        }
      })();
    },
    [onStatus, t],
  );

  const deleteSources = useCallback(
    async (sourceIds: string[]): Promise<void> => {
      if (sourceIds.length === 0) {
        return;
      }

      const confirmed = window.confirm(
        sourceIds.length === 1
          ? t('externalSources.deleteConfirm.single')
          : t('externalSources.deleteConfirm.multiple'),
      );
      if (!confirmed) {
        void refreshSources();
        return;
      }

      setBusy(true);
      setError(null);
      try {
        await Promise.all(sourceIds.map((id) => window.novelistApi.deleteExternalSource({ id })));
        await refreshSources();
        setSelectedSourceId(null);
        onStatus(
          sourceIds.length === 1
            ? t('externalSources.status.deleted')
            : t('externalSources.status.deletedMany', { count: sourceIds.length }),
        );
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [onStatus, refreshSources, sourcesById, t],
  );

  const onNodesDelete: OnNodesDelete<ExternalSourceNode> = useCallback(
    (deletedNodes) => {
      void deleteSources(deletedNodes.map((node) => node.id));
    },
    [deleteSources],
  );

  async function handleDeleteSelected(): Promise<void> {
    const selectedIds = nodes.filter((node) => node.selected).map((node) => node.id);
    const idsToDelete =
      selectedIds.length > 0 ? selectedIds : selectedSourceId ? [selectedSourceId] : [];
    await deleteSources(idsToDelete);
  }

  async function importDroppedFiles(event: DragEvent<HTMLElement>): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);

    const files = Array.from(event.dataTransfer.files);
    const filePaths = window.novelistApi.getDroppedFilePaths(files);
    if (filePaths.length === 0) {
      onStatus(t('externalSources.status.noFiles'));
      return;
    }

    const dropPosition =
      flowRef.current?.screenToFlowPosition({ x: event.clientX, y: event.clientY }) ?? {
        x: 120,
        y: 120,
      };

    const pdfCount = filePaths.filter((filePath) => filePath.toLowerCase().endsWith('.pdf')).length;
    const spreadsheetCount = filePaths.filter((filePath) =>
      ['.csv', '.tsv', '.xls', '.xlsx'].some((extension) =>
        filePath.toLowerCase().endsWith(extension),
      ),
    ).length;
    const allowAiAnalysis =
      pdfCount + spreadsheetCount > 0
        ? window.confirm(t('externalSources.aiAnalysisConfirm'))
        : false;

    setBusy(true);
    setError(null);
    const completeAiProcessing = allowAiAnalysis ? beginExternalSourceAiProcessing() : null;
    if (allowAiAnalysis) {
      onStatus(t('externalSources.status.aiProcessing'));
    }
    try {
      const imported = await window.novelistApi.importExternalSources({
        files: filePaths.map((filePath) => ({
          filePath,
          positionX: dropPosition.x,
          positionY: dropPosition.y,
        })),
        allowAiAnalysis,
      });
      await refreshSources();
      const ocrCount = imported.filter((source) => source.extractionMethod === 'ai_ocr').length;
      const analysisCount = imported.filter(
        (source) => source.extractionMethod === 'ai_analysis',
      ).length;
      const partialCount = imported.filter(
        (source) => source.extractionStatus !== 'indexed',
      ).length;
      if (ocrCount + analysisCount > 0) {
        onStatus(
          t('externalSources.status.importedWithAi', {
            count: filePaths.length,
            aiCount: ocrCount + analysisCount,
          }),
        );
      } else if (partialCount > 0) {
        onStatus(
          t('externalSources.status.importedPartial', {
            count: filePaths.length,
            partialCount,
          }),
        );
      } else {
        onStatus(t('externalSources.status.imported', { count: filePaths.length }));
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      onStatus(t('externalSources.status.importError'));
    } finally {
      completeAiProcessing?.();
      setBusy(false);
    }
  }

  return (
    <section className="workspace">
      <aside className="sidebar">
        <div className="panel">
          <h2>{t('externalSources.title')}</h2>
          <p>{t('externalSources.sidebar.dropHint')}</p>
        </div>

        <div className="panel">
          <h2>{t('entity.common.selection')}</h2>
          <p>
            {t('externalSources.selection')}{' '}
            <strong>{selectedSource?.fileName ?? '-'}</strong>
          </p>
          <p>
            {t('externalSources.fileType')}{' '}
            <strong>{selectedSource?.fileType?.toUpperCase() ?? '-'}</strong>
          </p>
          <p>
            {t('externalSources.extractionMethod')}{' '}
            <strong>
              {selectedSource
                ? t(`externalSources.extractionMethod.${selectedSource.extractionMethod}`)
                : '-'}
            </strong>
          </p>
          <p>
            {t('externalSources.extractionStatus')}{' '}
            <strong>
              {selectedSource
                ? t(`externalSources.extractionStatus.${selectedSource.extractionStatus}`)
                : '-'}
            </strong>
          </p>
          {selectedSource?.extractionMessage ? (
            <p className="external-source-extraction-message">
              {translateExtractionMessage(selectedSource.extractionMessage, t)}
            </p>
          ) : null}
          <div className="selection-action-stack">
            <button
              type="button"
              className="sidebar-action-button danger-action-button"
              onClick={() => void handleDeleteSelected()}
              disabled={!selectedSourceId || busy}
            >
              {t('externalSources.delete')}
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

      <section
        className={`canvas-wrap external-sources-drop-zone${dragActive ? ' drag-active' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDragLeave={(event) => {
          if (event.currentTarget.contains(event.relatedTarget as HTMLElement | null)) {
            return;
          }
          setDragActive(false);
        }}
        onDrop={(event) => void importDroppedFiles(event)}
      >
        <ReactFlow<ExternalSourceNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements
          connectionMode={ConnectionMode.Loose}
          onInit={(instance) => {
            flowRef.current = instance;
          }}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onSelectionChange={onSelectionChange}
          onConnect={(params) => void handleConnect(params)}
          onEdgesDelete={onEdgesDelete}
          onNodesDelete={onNodesDelete}
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

        {aiProcessing ? (
          <div className="external-source-ai-processing floating">
            <span aria-hidden="true" />
            <strong>{t('externalSources.aiProcessing.title')}</strong>
          </div>
        ) : null}

        {dragActive || nodes.length === 0 ? (
          <div className="external-sources-drop-overlay">
            <div>
              <strong>{t('externalSources.dropOverlay.title')}</strong>
              <span>{t('externalSources.dropOverlay.body')}</span>
            </div>
          </div>
        ) : null}
      </section>
    </section>
  );
}
