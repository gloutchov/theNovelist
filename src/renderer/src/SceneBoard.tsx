import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Node as TiptapNode, mergeAttributes } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import SceneFlowNode, { type SceneFlowNodeData } from './SceneFlowNode';
import { getStatusTone } from './status-tone';

type SceneCard = Awaited<ReturnType<(typeof window.novelistApi)['listSceneCards']>>[number];
type CharacterCard = Awaited<ReturnType<(typeof window.novelistApi)['listCharacterCards']>>[number];
type LocationCard = Awaited<ReturnType<(typeof window.novelistApi)['listLocationCards']>>[number];
type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type StoryChapterNode = StoryState['nodes'][number];
type StoryPlot = StoryState['plots'][number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;
type SceneCanvasNode = Node<SceneFlowNodeData, 'scene'>;
const SCENE_AUTOSAVE_IDLE_MS = 4_000;

interface SceneDraft {
  chapterNodeId: string;
  name: string;
  text: string;
  contentJson: string;
  notes: string;
  plotNumber: number;
}

interface RichTextNodeJson {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNodeJson[];
}

interface RichTextDocumentJson {
  type?: string;
  content?: RichTextNodeJson[];
}

interface SceneBoundaryLocation {
  blockIndex: number;
  inlineIndex: number;
}

interface SceneBoardProps {
  currentProject: ProjectRecord;
  autosaveSettings: AppPreferences | null;
  statusMessage: string;
  workspaceNotice?: string | null;
  onStatus: (message: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterFlush?: (handler: (() => Promise<boolean>) | null) => void;
  onWikiSync?: () => Promise<void>;
}

const SceneReferenceMention = TiptapNode.create({
  name: 'referenceMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      refId: { default: '' },
      refType: { default: 'character' },
      label: { default: '' },
      boundary: { default: 'start' },
    };
  },

  renderHTML({ HTMLAttributes }) {
    const label = typeof HTMLAttributes['label'] === 'string' ? HTMLAttributes['label'] : '';
    const refType =
      typeof HTMLAttributes['refType'] === 'string' ? HTMLAttributes['refType'] : 'character';
    const prefix = refType === 'scene' ? '#' : '@';
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class:
          refType === 'scene' ? 'reference-mention scene-reference-mention' : 'reference-mention',
        contenteditable: 'false',
        'data-reference-mention': '',
        'data-ref-id': HTMLAttributes['refId'] ?? '',
        'data-ref-type': refType,
        'data-label': label,
        'data-boundary': HTMLAttributes['boundary'] ?? 'start',
        'data-reference-prefix': prefix,
      }),
    ];
  },

  renderText() {
    return '';
  },
});

function formatPlotLabel(plot: StoryPlot | null | undefined, plotNumber: number): string {
  return plot?.label?.trim() || `Trama ${plotNumber}`;
}

function createEmptyRichTextDocument(): RichTextDocumentJson {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  };
}

function richTextDocumentFromPlainText(text: string): RichTextDocumentJson {
  const paragraphs = text.split(/\n{2,}/u);
  return {
    type: 'doc',
    content: paragraphs.map((paragraph) => ({
      type: 'paragraph',
      content: paragraph
        .split(/\n/u)
        .flatMap((line, index) =>
          index === 0
            ? line
              ? [{ type: 'text', text: line }]
              : []
            : [{ type: 'hardBreak' }, ...(line ? [{ type: 'text', text: line }] : [])],
        ),
    })),
  };
}

function parseRichTextDocument(
  contentJson: string | null | undefined,
  fallbackText: string,
): RichTextDocumentJson {
  if (contentJson?.trim()) {
    try {
      const parsed = JSON.parse(contentJson) as RichTextDocumentJson;
      if (parsed && typeof parsed === 'object') {
        return parsed;
      }
    } catch {
      return richTextDocumentFromPlainText(fallbackText);
    }
  }
  return fallbackText.trim()
    ? richTextDocumentFromPlainText(fallbackText)
    : createEmptyRichTextDocument();
}

function collectPlainTextFromNode(node: RichTextNodeJson | undefined): string {
  if (!node || node.type === 'referenceMention') {
    return '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (typeof node.text === 'string') {
    return node.text;
  }
  return (node.content ?? []).map(collectPlainTextFromNode).join('');
}

function getPlainTextFromDocument(document: RichTextDocumentJson): string {
  return (document.content ?? []).map(collectPlainTextFromNode).join('\n').trim();
}

function sceneToDraft(scene: SceneCard): SceneDraft {
  const contentDocument = parseRichTextDocument(scene.contentJson, scene.text);
  return {
    chapterNodeId: scene.chapterNodeId,
    name: scene.name,
    text: getPlainTextFromDocument(contentDocument),
    contentJson: JSON.stringify(contentDocument),
    notes: scene.notes,
    plotNumber: scene.plotNumber,
  };
}

function areSceneDraftsEqual(left: SceneDraft, right: SceneDraft): boolean {
  return (
    left.chapterNodeId === right.chapterNodeId &&
    left.name === right.name &&
    left.text === right.text &&
    left.contentJson === right.contentJson &&
    left.notes === right.notes &&
    left.plotNumber === right.plotNumber
  );
}

function includesText(source: string, value: string): boolean {
  const normalizedSource = source.toLocaleLowerCase('it');
  const normalizedValue = value.trim().toLocaleLowerCase('it');
  return Boolean(normalizedValue) && normalizedSource.includes(normalizedValue);
}

function getCharacterLabel(card: CharacterCard): string {
  return `${card.firstName} ${card.lastName}`.trim();
}

function cloneMarks(
  marks: RichTextNodeJson['marks'] | undefined,
): RichTextNodeJson['marks'] | undefined {
  return marks?.map((mark) => ({
    type: mark.type,
    attrs: mark.attrs ? { ...mark.attrs } : undefined,
  }));
}

function cloneRichTextNode(node: RichTextNodeJson): RichTextNodeJson {
  return {
    ...node,
    attrs: node.attrs ? { ...node.attrs } : undefined,
    marks: cloneMarks(node.marks),
    content: node.content?.map(cloneRichTextNode),
  };
}

function getSceneContentBlocks(document: RichTextDocumentJson): RichTextNodeJson[] {
  const blocks = document.content?.length
    ? document.content
    : createEmptyRichTextDocument().content;
  return (blocks ?? [{ type: 'paragraph', content: [] }]).map(cloneRichTextNode);
}

function replaceSceneContentAcrossTopLevelBlocks(
  document: RichTextDocumentJson,
  sceneId: string,
  sceneContentDocument: RichTextDocumentJson,
): boolean {
  const blocks = document.content ?? [];
  const start = findTopLevelSceneBoundary(document, sceneId, 'start');
  const end = findTopLevelSceneBoundary(document, sceneId, 'end');
  if (!start || !end) {
    return false;
  }
  if (
    start.blockIndex > end.blockIndex ||
    (start.blockIndex === end.blockIndex && start.inlineIndex >= end.inlineIndex)
  ) {
    return false;
  }

  const startBlock = blocks[start.blockIndex];
  const endBlock = blocks[end.blockIndex];
  const startContent = startBlock?.content;
  const endContent = endBlock?.content;
  if (!startBlock || !endBlock || !Array.isArray(startContent) || !Array.isArray(endContent)) {
    return false;
  }

  const sceneBlocks = getSceneContentBlocks(sceneContentDocument);
  const firstSceneBlock = sceneBlocks[0] ?? { type: 'paragraph', content: [] };
  const lastSceneBlock = sceneBlocks[sceneBlocks.length - 1] ?? firstSceneBlock;
  if (sceneBlocks.length === 1) {
    blocks.splice(start.blockIndex, end.blockIndex - start.blockIndex + 1, {
      ...firstSceneBlock,
      content: [
        ...startContent.slice(0, start.inlineIndex + 1).map(cloneRichTextNode),
        ...(firstSceneBlock.content ?? []).map(cloneRichTextNode),
        ...endContent.slice(end.inlineIndex).map(cloneRichTextNode),
      ],
    });
    return true;
  }

  const replacementBlocks: RichTextNodeJson[] = [
    {
      ...firstSceneBlock,
      content: [
        ...startContent.slice(0, start.inlineIndex + 1).map(cloneRichTextNode),
        ...(firstSceneBlock.content ?? []).map(cloneRichTextNode),
      ],
    },
    ...sceneBlocks.slice(1, -1).map(cloneRichTextNode),
    {
      ...lastSceneBlock,
      content: [
        ...(lastSceneBlock.content ?? []).map(cloneRichTextNode),
        ...endContent.slice(end.inlineIndex).map(cloneRichTextNode),
      ],
    },
  ];
  blocks.splice(start.blockIndex, end.blockIndex - start.blockIndex + 1, ...replacementBlocks);
  return true;
}

function replaceSceneContentInDocument(
  document: RichTextDocumentJson,
  sceneId: string,
  sceneContentDocument: RichTextDocumentJson,
): { document: RichTextDocumentJson; replaced: boolean } {
  return {
    document,
    replaced: replaceSceneContentAcrossTopLevelBlocks(document, sceneId, sceneContentDocument),
  };
}

function findTopLevelSceneBoundary(
  document: RichTextDocumentJson,
  sceneId: string,
  boundary: 'start' | 'end',
): SceneBoundaryLocation | null {
  const blocks = document.content ?? [];
  for (const [blockIndex, block] of blocks.entries()) {
    const inlineContent = block.content;
    if (!Array.isArray(inlineContent)) {
      continue;
    }

    const inlineIndex = inlineContent.findIndex(
      (node) =>
        node.type === 'referenceMention' &&
        node.attrs?.['refType'] === 'scene' &&
        node.attrs?.['refId'] === sceneId &&
        (boundary === 'end'
          ? node.attrs?.['boundary'] === 'end'
          : node.attrs?.['boundary'] !== 'end'),
    );
    if (inlineIndex >= 0) {
      return { blockIndex, inlineIndex };
    }
  }
  return null;
}

function mapSceneToNode(
  scene: SceneCard,
  chaptersById: Map<string, StoryChapterNode>,
  plotsByNumber: Map<number, StoryPlot>,
  options?: { selected?: boolean },
): SceneCanvasNode {
  const chapter = chaptersById.get(scene.chapterNodeId);
  const plot = plotsByNumber.get(scene.plotNumber);

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
      chapterTitle: chapter?.title ?? 'Capitolo non trovato',
      plotLabel: formatPlotLabel(plot, scene.plotNumber),
      subtitle: scene.text.trim(),
    },
    style: {
      border: '2px solid #0891b2',
      borderRadius: '12px',
      width: 320,
      background: 'var(--surface-primary)',
      boxShadow: 'var(--flow-node-shadow)',
      padding: '10px',
    },
  };
}

export default function SceneBoard({
  autosaveSettings,
  statusMessage,
  workspaceNotice,
  onStatus,
  onDirtyChange,
  onRegisterFlush,
  onWikiSync,
}: SceneBoardProps) {
  const [scenes, setScenes] = useState<SceneCard[]>([]);
  const [nodes, setNodes] = useState<SceneCanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [locations, setLocations] = useState<LocationCard[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SceneDraft>({
    chapterNodeId: '',
    name: '',
    text: '',
    contentJson: JSON.stringify(createEmptyRichTextDocument()),
    notes: '',
    plotNumber: 1,
  });
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef<boolean>(false);
  const lastDraftEditAtRef = useRef<number>(0);
  const loadedEditorSceneIdRef = useRef<string | null>(null);
  const applyingSceneEditorContentRef = useRef<boolean>(false);

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
  const editDirty = currentEditScene
    ? !areSceneDraftsEqual(editDraft, sceneToDraft(currentEditScene))
    : false;
  const citedCharacters = useMemo(
    () => characters.filter((card) => includesText(editDraft.text, getCharacterLabel(card))),
    [characters, editDraft.text],
  );
  const citedLocations = useMemo(
    () => locations.filter((card) => includesText(editDraft.text, card.name)),
    [locations, editDraft.text],
  );
  const statusTone = getStatusTone(statusMessage);
  const sceneEditor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      TextStyle,
      FontFamily,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      SceneReferenceMention,
    ],
    content: createEmptyRichTextDocument(),
    onUpdate({ editor: activeEditor }) {
      if (applyingSceneEditorContentRef.current) {
        return;
      }

      const document = activeEditor.getJSON() as RichTextDocumentJson;
      const contentJson = JSON.stringify(document);
      updateEditDraft((previous) => ({
        ...previous,
        text: getPlainTextFromDocument(document),
        contentJson,
      }));
    },
  });

  const refreshScenes = useCallback(async (): Promise<void> => {
    const [nextScenes, nextStoryState, nextCharacters, nextLocations] = await Promise.all([
      window.novelistApi.listSceneCards(),
      window.novelistApi.getStoryState(),
      window.novelistApi.listCharacterCards(),
      window.novelistApi.listLocationCards(),
    ]);
    const nextChaptersById = new Map(nextStoryState.nodes.map((chapter) => [chapter.id, chapter]));
    const nextPlotsByNumber = new Map(nextStoryState.plots.map((plot) => [plot.number, plot]));
    const sceneIds = new Set(nextScenes.map((scene) => scene.id));
    setScenes(nextScenes);
    setStoryState(nextStoryState);
    setCharacters(nextCharacters);
    setLocations(nextLocations);
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
        return mapSceneToNode(scene, nextChaptersById, nextPlotsByNumber, {
          selected: previousNode?.selected,
        });
      }),
    );
  }, []);

  useEffect(() => {
    void refreshScenes();
  }, [refreshScenes]);

  useEffect(() => {
    if (!editSceneId) {
      loadedEditorSceneIdRef.current = null;
      return;
    }
    if (!sceneEditor || loadedEditorSceneIdRef.current === editSceneId) {
      return;
    }

    applyingSceneEditorContentRef.current = true;
    sceneEditor.commands.setContent(parseRichTextDocument(editDraft.contentJson, editDraft.text));
    applyingSceneEditorContentRef.current = false;
    loadedEditorSceneIdRef.current = editSceneId;
  }, [editDraft.contentJson, editDraft.text, editSceneId, sceneEditor]);

  useEffect(() => {
    onDirtyChange?.(editDirty);
    return () => onDirtyChange?.(false);
  }, [editDirty, onDirtyChange]);

  const persistEdit = useCallback(
    async (options?: { closeAfterSave?: boolean; silent?: boolean }): Promise<boolean> => {
      if (!editSceneId || !currentEditScene) {
        return false;
      }
      if (!editDirty) {
        if (options?.closeAfterSave) {
          setEditSceneId(null);
        }
        return false;
      }

      setBusy(true);
      setError(null);
      const draftSnapshot = editDraft;
      const sceneSnapshot = currentEditScene;
      try {
        let chapterTextReplaced = true;
        const updated = await window.novelistApi.updateSceneCard({
          id: editSceneId,
          chapterNodeId: draftSnapshot.chapterNodeId,
          name: draftSnapshot.name.trim(),
          text: draftSnapshot.text,
          contentJson: draftSnapshot.contentJson,
          notes: draftSnapshot.notes,
          plotNumber: draftSnapshot.plotNumber,
          positionX: sceneSnapshot.positionX,
          positionY: sceneSnapshot.positionY,
        });

        if (
          draftSnapshot.text !== sceneSnapshot.text ||
          draftSnapshot.contentJson !== sceneSnapshot.contentJson
        ) {
          const document = await window.novelistApi.getChapterDocument({
            chapterNodeId: draftSnapshot.chapterNodeId,
          });
          const content = JSON.parse(document.contentJson) as RichTextDocumentJson;
          const { document: nextContent, replaced } = replaceSceneContentInDocument(
            content,
            updated.id,
            parseRichTextDocument(updated.contentJson, updated.text),
          );
          await window.novelistApi.saveChapterDocument({
            chapterNodeId: draftSnapshot.chapterNodeId,
            contentJson: JSON.stringify(nextContent),
          });
          chapterTextReplaced = replaced;
        }

        setScenes((previous) =>
          previous.map((scene) => (scene.id === updated.id ? updated : scene)),
        );
        setEditDraft((currentDraft) =>
          areSceneDraftsEqual(currentDraft, draftSnapshot) ? sceneToDraft(updated) : currentDraft,
        );
        await refreshScenes();
        void onWikiSync?.();
        if (!options?.silent) {
          onStatus(
            chapterTextReplaced
              ? `Scena salvata: ${updated.name}`
              : 'Scena salvata, ma i badge nel capitolo non sono stati trovati.',
          );
        }
        if (options?.closeAfterSave) {
          setEditSceneId(null);
        }
        return true;
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
        onStatus('Errore salvataggio scena');
        return false;
      } finally {
        setBusy(false);
      }
    },
    [currentEditScene, editDirty, editDraft, editSceneId, onStatus, onWikiSync, refreshScenes],
  );

  useEffect(() => {
    onRegisterFlush?.(() => persistEdit({ silent: true }));
    return () => onRegisterFlush?.(null);
  }, [onRegisterFlush, persistEdit]);

  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }
    if (autosaveSettings?.autosaveMode !== 'auto' || !editDirty || busy) {
      return;
    }
    autosaveTimeoutRef.current = setTimeout(() => {
      if (autosaveInFlightRef.current) {
        return;
      }
      autosaveInFlightRef.current = true;
      void persistEdit({ silent: true }).finally(() => {
        autosaveInFlightRef.current = false;
      });
    }, SCENE_AUTOSAVE_IDLE_MS);
  }, [autosaveSettings?.autosaveMode, busy, editDirty, persistEdit]);

  useEffect(() => {
    if (autosaveSettings?.autosaveMode !== 'interval') {
      return;
    }
    const intervalId = setInterval(() => {
      const hasRecentTyping = Date.now() - lastDraftEditAtRef.current < SCENE_AUTOSAVE_IDLE_MS;
      if (!editDirty || busy || autosaveInFlightRef.current || hasRecentTyping) {
        return;
      }
      autosaveInFlightRef.current = true;
      void persistEdit({ silent: true }).finally(() => {
        autosaveInFlightRef.current = false;
      });
    }, autosaveSettings.autosaveIntervalMinutes * 60_000);
    return () => clearInterval(intervalId);
  }, [
    autosaveSettings?.autosaveIntervalMinutes,
    autosaveSettings?.autosaveMode,
    busy,
    editDirty,
    persistEdit,
  ]);

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
      onStatus('Connessione creata');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
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
        onStatus(`${deletedEdges.length} connessioni eliminate`);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [onStatus],
  );

  const onNodeClick: NodeMouseHandler<SceneCanvasNode> = useCallback((_event, node) => {
    setSelectedSceneId(node.id);
  }, []);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    const selectedNode = params.nodes[0];
    setSelectedSceneId(selectedNode?.id ?? null);
  }, []);

  async function handleNodeDragStop(_event: unknown, node: SceneCanvasNode): Promise<void> {
    const scene = scenesById.get(node.id);
    if (!scene) {
      return;
    }
    try {
      await window.novelistApi.updateSceneCard({
        id: scene.id,
        chapterNodeId: scene.chapterNodeId,
        name: scene.name,
        text: scene.text,
        contentJson: scene.contentJson,
        notes: scene.notes,
        plotNumber: scene.plotNumber,
        positionX: node.position.x,
        positionY: node.position.y,
      });
      await refreshScenes();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    }
  }

  function openEditScene(scene: SceneCard): void {
    const draft = sceneToDraft(scene);
    setEditDraft(draft);
    loadedEditorSceneIdRef.current = null;
    setEditSceneId(scene.id);
  }

  async function handleDeleteSelectedScene(): Promise<void> {
    if (!selectedSceneId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await window.novelistApi.deleteSceneCard({ id: selectedSceneId });
      setSelectedSceneId(null);
      await refreshScenes();
      void onWikiSync?.();
      onStatus('Scena eliminata');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function updateEditDraft(updater: (previous: SceneDraft) => SceneDraft): void {
    lastDraftEditAtRef.current = Date.now();
    setEditDraft(updater);
  }

  function handleChapterChange(chapterNodeId: string): void {
    const chapter = chaptersById.get(chapterNodeId);
    updateEditDraft((previous) => ({
      ...previous,
      chapterNodeId,
      plotNumber: chapter?.plotNumber ?? previous.plotNumber,
    }));
  }

  return (
    <section className="workspace">
      <aside className="sidebar">
        <div className="panel">
          <h2>Selezione</h2>
          <p>
            Scena: <strong>{selectedScene ? `#${selectedScene.name}` : '-'}</strong>
          </p>
          <p>
            Capitolo: <strong>{selectedChapter?.title ?? '-'}</strong>
          </p>
          <p>
            Trama:{' '}
            <strong>
              {selectedScene ? formatPlotLabel(selectedPlot, selectedScene.plotNumber) : '-'}
            </strong>
          </p>
          <div className="selection-action-stack">
            <button
              type="button"
              className="sidebar-action-button danger-action-button"
              onClick={() => void handleDeleteSelectedScene()}
              disabled={!selectedSceneId || busy}
            >
              Elimina Scena
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
          onNodeClick={onNodeClick}
          onNodeDragStop={(event, node) => void handleNodeDragStop(event, node)}
          onNodeDoubleClick={(_event, node) => {
            const scene = scenesById.get(node.id);
            if (scene) {
              openEditScene(scene);
            }
          }}
          onSelectionChange={onSelectionChange}
          elevateNodesOnSelect
          fitView
          deleteKeyCode={null}
        >
          <MiniMap zoomable pannable />
          <Controls />
          <Background gap={18} size={1} color="#d1d5db" />
        </ReactFlow>
      </section>

      {editSceneId ? (
        <div className="modal-overlay">
          <div className="modal-card large-modal-card">
            <h3>Modifica Scena</h3>
            <div className="grid-two">
              <label>
                Nome Scena
                <input
                  value={editDraft.name}
                  onChange={(event) =>
                    updateEditDraft((previous) => ({ ...previous, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Nome Capitolo
                <select
                  value={editDraft.chapterNodeId}
                  onChange={(event) => handleChapterChange(event.target.value)}
                >
                  {(storyState?.nodes ?? []).map((chapter) => (
                    <option key={chapter.id} value={chapter.id}>
                      {chapter.title}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Nome Trama
                <input
                  value={formatPlotLabel(
                    plotsByNumber.get(editDraft.plotNumber),
                    editDraft.plotNumber,
                  )}
                  readOnly
                />
              </label>
            </div>
            <label>
              Testo Scena
              <div className="scene-rich-editor-shell">
                <EditorContent editor={sceneEditor} className="novelist-editor-content" />
              </div>
            </label>
            <label>
              Note
              <textarea
                rows={4}
                value={editDraft.notes}
                onChange={(event) =>
                  updateEditDraft((previous) => ({ ...previous, notes: event.target.value }))
                }
              />
            </label>

            <div className="panel panel-subsection">
              <h4>Personaggi e Location citate</h4>
              <div className="dashboard-unused-grid">
                <div>
                  <h3>Personaggi</h3>
                  {citedCharacters.length > 0 ? (
                    <ul>
                      {citedCharacters.map((card) => (
                        <li key={card.id}>{getCharacterLabel(card)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nessun personaggio riconosciuto nel testo.</p>
                  )}
                </div>
                <div>
                  <h3>Location</h3>
                  {citedLocations.length > 0 ? (
                    <ul>
                      {citedLocations.map((card) => (
                        <li key={card.id}>{card.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nessuna location riconosciuta nel testo.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="row-buttons">
              <button type="button" onClick={() => void persistEdit({ closeAfterSave: true })}>
                Salva Scheda
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={() => setEditSceneId(null)}
                disabled={busy}
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
