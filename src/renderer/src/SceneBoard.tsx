import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
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

interface FlattenedTextToken {
  node: RichTextNodeJson;
  start: number;
  end: number;
}

interface FlattenedRichText {
  text: string;
  tokens: FlattenedTextToken[];
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

function formatPlotLabel(plot: StoryPlot | null | undefined, plotNumber: number): string {
  return plot?.label?.trim() || `Trama ${plotNumber}`;
}

function sceneToDraft(scene: SceneCard): SceneDraft {
  return {
    chapterNodeId: scene.chapterNodeId,
    name: scene.name,
    text: scene.text,
    notes: scene.notes,
    plotNumber: scene.plotNumber,
  };
}

function areSceneDraftsEqual(left: SceneDraft, right: SceneDraft): boolean {
  return (
    left.chapterNodeId === right.chapterNodeId &&
    left.name === right.name &&
    left.text === right.text &&
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

function getNodeTextLength(node: RichTextNodeJson): number {
  if (node.type === 'text') {
    return node.text?.length ?? 0;
  }
  if (node.type === 'hardBreak') {
    return 1;
  }
  return (node.content ?? []).reduce((total, child) => total + getNodeTextLength(child), 0);
}

function flattenRichTextNodes(nodes: RichTextNodeJson[]): FlattenedRichText {
  const tokens: FlattenedTextToken[] = [];
  let text = '';

  function visit(node: RichTextNodeJson): void {
    if (node.type === 'text') {
      const nodeText = node.text ?? '';
      const start = text.length;
      text += nodeText;
      tokens.push({ node, start, end: text.length });
      return;
    }

    if (node.type === 'hardBreak') {
      const start = text.length;
      text += '\n';
      tokens.push({ node, start, end: text.length });
      return;
    }

    for (const child of node.content ?? []) {
      visit(child);
    }
  }

  for (const node of nodes) {
    visit(node);
  }

  return { text, tokens };
}

function sliceRichTextNodesByTextRange(
  nodes: RichTextNodeJson[],
  from: number,
  to: number,
): RichTextNodeJson[] {
  const slicedNodes: RichTextNodeJson[] = [];
  let cursor = 0;

  function visit(node: RichTextNodeJson): RichTextNodeJson | null {
    if (node.type === 'referenceMention') {
      return cursor >= from && cursor < to ? cloneRichTextNode(node) : null;
    }

    if (node.type === 'text') {
      const nodeText = node.text ?? '';
      const start = cursor;
      const end = cursor + nodeText.length;
      cursor = end;
      if (end <= from || start >= to) {
        return null;
      }

      return {
        ...node,
        text: nodeText.slice(Math.max(from - start, 0), Math.min(to - start, nodeText.length)),
        attrs: node.attrs ? { ...node.attrs } : undefined,
        marks: cloneMarks(node.marks),
      };
    }

    if (node.type === 'hardBreak') {
      const start = cursor;
      cursor += 1;
      return start >= from && start < to ? cloneRichTextNode(node) : null;
    }

    if (Array.isArray(node.content)) {
      const children: RichTextNodeJson[] = [];
      for (const child of node.content) {
        const nextChild = visit(child);
        if (nextChild) {
          children.push(nextChild);
        }
      }
      if (children.length === 0) {
        return null;
      }
      return {
        ...node,
        attrs: node.attrs ? { ...node.attrs } : undefined,
        marks: cloneMarks(node.marks),
        content: children,
      };
    }

    cursor += getNodeTextLength(node);
    return null;
  }

  for (const node of nodes) {
    const nextNode = visit(node);
    if (nextNode) {
      slicedNodes.push(nextNode);
    }
  }

  return slicedNodes;
}

function findInsertionMarks(
  flattened: FlattenedRichText,
  textIndex: number,
): RichTextNodeJson['marks'] {
  const before = [...flattened.tokens].reverse().find((token) => {
    if (token.node.type !== 'text' || token.start >= textIndex) {
      return false;
    }
    return Boolean((token.node.text ?? '').slice(0, textIndex - token.start).trim());
  });
  if (before) {
    return cloneMarks(before.node.marks);
  }

  const after = flattened.tokens.find((token) => {
    if (token.node.type !== 'text' || token.end <= textIndex) {
      return false;
    }
    return Boolean((token.node.text ?? '').slice(Math.max(textIndex - token.start, 0)).trim());
  });
  return cloneMarks(after?.node.marks);
}

function richTextNodesFromPlainText(
  text: string,
  marks: RichTextNodeJson['marks'],
): RichTextNodeJson[] {
  const nodes: RichTextNodeJson[] = [];
  const lines = text.split(/\n/u);

  lines.forEach((line, index) => {
    if (index > 0) {
      nodes.push({ type: 'hardBreak' });
    }
    if (line) {
      nodes.push({
        type: 'text',
        text: line,
        marks: cloneMarks(marks),
      });
    }
  });

  return nodes;
}

function findTextDiff(
  previousText: string,
  nextText: string,
): { prefixLength: number; previousSuffixStart: number; nextSuffixStart: number } {
  let prefixLength = 0;
  const maxPrefixLength = Math.min(previousText.length, nextText.length);
  while (prefixLength < maxPrefixLength && previousText[prefixLength] === nextText[prefixLength]) {
    prefixLength += 1;
  }

  let suffixLength = 0;
  while (
    suffixLength < previousText.length - prefixLength &&
    suffixLength < nextText.length - prefixLength &&
    previousText[previousText.length - suffixLength - 1] ===
      nextText[nextText.length - suffixLength - 1]
  ) {
    suffixLength += 1;
  }

  return {
    prefixLength,
    previousSuffixStart: previousText.length - suffixLength,
    nextSuffixStart: nextText.length - suffixLength,
  };
}

function trimBoundaryWhitespace(text: string): { leading: number; value: string } {
  const leading = text.match(/^\s*/u)?.[0].length ?? 0;
  const trailing = text.match(/\s*$/u)?.[0].length ?? 0;
  return {
    leading,
    value: text.slice(leading, text.length - trailing),
  };
}

function replaceSceneNodesPreservingFormatting(
  nodes: RichTextNodeJson[],
  nextText: string,
): RichTextNodeJson[] {
  const flattened = flattenRichTextNodes(nodes);
  const trimmed = trimBoundaryWhitespace(flattened.text);
  const diff = findTextDiff(trimmed.value, nextText);
  const replaceStart = trimmed.leading + diff.prefixLength;
  const replaceEnd = trimmed.leading + diff.previousSuffixStart;
  const insertedText = nextText.slice(diff.prefixLength, diff.nextSuffixStart);
  const insertionMarks = findInsertionMarks(flattened, replaceStart);

  return [
    ...sliceRichTextNodesByTextRange(nodes, 0, replaceStart),
    ...richTextNodesFromPlainText(insertedText, insertionMarks),
    ...sliceRichTextNodesByTextRange(nodes, replaceEnd, flattened.text.length),
  ];
}

function getSceneNodesBetweenBoundaries(
  blocks: RichTextNodeJson[],
  start: SceneBoundaryLocation,
  end: SceneBoundaryLocation,
): RichTextNodeJson[] {
  const nodes: RichTextNodeJson[] = [];
  for (let blockIndex = start.blockIndex; blockIndex <= end.blockIndex; blockIndex += 1) {
    const content = blocks[blockIndex]?.content;
    if (!Array.isArray(content)) {
      continue;
    }
    const from = blockIndex === start.blockIndex ? start.inlineIndex + 1 : 0;
    const to = blockIndex === end.blockIndex ? end.inlineIndex : content.length;
    nodes.push(...content.slice(from, to));
    if (blockIndex < end.blockIndex) {
      nodes.push({ type: 'hardBreak' });
    }
  }
  return nodes;
}

function replaceSceneTextInInlineContent(
  content: RichTextNodeJson[] | undefined,
  sceneId: string,
  nextText: string,
): boolean {
  if (!Array.isArray(content)) {
    return false;
  }

  const startIndex = content.findIndex(
    (node) =>
      node.type === 'referenceMention' &&
      node.attrs?.['refType'] === 'scene' &&
      node.attrs?.['refId'] === sceneId &&
      node.attrs?.['boundary'] !== 'end',
  );
  if (startIndex < 0) {
    return false;
  }

  const endIndex = content.findIndex(
    (node, index) =>
      index > startIndex &&
      node.type === 'referenceMention' &&
      node.attrs?.['refType'] === 'scene' &&
      node.attrs?.['refId'] === sceneId &&
      node.attrs?.['boundary'] === 'end',
  );
  if (endIndex < 0) {
    return false;
  }

  const replacementNodes = replaceSceneNodesPreservingFormatting(
    content.slice(startIndex + 1, endIndex),
    nextText,
  );
  content.splice(startIndex + 1, endIndex - startIndex - 1, ...replacementNodes);
  return true;
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

function replaceSceneTextAcrossTopLevelBlocks(
  document: RichTextDocumentJson,
  sceneId: string,
  nextText: string,
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

  if (start.blockIndex === end.blockIndex) {
    return replaceSceneTextInInlineContent(blocks[start.blockIndex]?.content, sceneId, nextText);
  }

  const startBlock = blocks[start.blockIndex];
  const endBlock = blocks[end.blockIndex];
  const startContent = startBlock?.content;
  const endContent = endBlock?.content;
  if (!startBlock || !endBlock || !Array.isArray(startContent) || !Array.isArray(endContent)) {
    return false;
  }

  const sceneNodes = getSceneNodesBetweenBoundaries(blocks, start, end);
  const replacementNodes = replaceSceneNodesPreservingFormatting(sceneNodes, nextText);
  const replacementBlock: RichTextNodeJson = {
    ...startBlock,
    content: [
      ...startContent.slice(0, start.inlineIndex + 1),
      ...replacementNodes,
      ...endContent.slice(end.inlineIndex),
    ],
  };
  blocks.splice(start.blockIndex, end.blockIndex - start.blockIndex + 1, replacementBlock);
  return true;
}

function replaceSceneTextInDocument(
  document: RichTextDocumentJson,
  sceneId: string,
  nextText: string,
): { document: RichTextDocumentJson; replaced: boolean } {
  if (replaceSceneTextAcrossTopLevelBlocks(document, sceneId, nextText)) {
    return { document, replaced: true };
  }

  let replaced = false;

  function visit(node: RichTextNodeJson): void {
    if (replaced) {
      return;
    }
    if (replaceSceneTextInInlineContent(node.content, sceneId, nextText)) {
      replaced = true;
      return;
    }
    for (const child of node.content ?? []) {
      visit(child);
    }
  }

  for (const node of document.content ?? []) {
    visit(node);
  }
  return { document, replaced };
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
  const [storyState, setStoryState] = useState<StoryState | null>(null);
  const [characters, setCharacters] = useState<CharacterCard[]>([]);
  const [locations, setLocations] = useState<LocationCard[]>([]);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [editSceneId, setEditSceneId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<SceneDraft>({
    chapterNodeId: '',
    name: '',
    text: '',
    notes: '',
    plotNumber: 1,
  });
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef<boolean>(false);
  const lastDraftEditAtRef = useRef<number>(0);

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

  const refreshScenes = useCallback(async (): Promise<void> => {
    const [nextScenes, nextStoryState, nextCharacters, nextLocations] = await Promise.all([
      window.novelistApi.listSceneCards(),
      window.novelistApi.getStoryState(),
      window.novelistApi.listCharacterCards(),
      window.novelistApi.listLocationCards(),
    ]);
    const nextChaptersById = new Map(nextStoryState.nodes.map((chapter) => [chapter.id, chapter]));
    const nextPlotsByNumber = new Map(nextStoryState.plots.map((plot) => [plot.number, plot]));
    setScenes(nextScenes);
    setStoryState(nextStoryState);
    setCharacters(nextCharacters);
    setLocations(nextLocations);
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
          notes: draftSnapshot.notes,
          plotNumber: draftSnapshot.plotNumber,
          positionX: sceneSnapshot.positionX,
          positionY: sceneSnapshot.positionY,
        });

        if (draftSnapshot.text !== sceneSnapshot.text) {
          const document = await window.novelistApi.getChapterDocument({
            chapterNodeId: draftSnapshot.chapterNodeId,
          });
          const content = JSON.parse(document.contentJson) as RichTextDocumentJson;
          const { document: nextContent, replaced } = replaceSceneTextInDocument(
            content,
            updated.id,
            updated.text,
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
    setEditSceneId(scene.id);
    setEditDraft(sceneToDraft(scene));
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
          edges={[]}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements
          onNodesChange={onNodesChange}
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
              <textarea
                rows={8}
                value={editDraft.text}
                onChange={(event) =>
                  updateEditDraft((previous) => ({ ...previous, text: event.target.value }))
                }
              />
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
