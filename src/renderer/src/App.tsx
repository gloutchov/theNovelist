import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
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
import AnalysisBoard from './AnalysisBoard';
import ChapterEditor from './ChapterEditor';
import ChapterFlowNode, { type ChapterFlowNodeData } from './ChapterFlowNode';
import CharacterBoard from './CharacterBoard';
import CharacterFlowNode from './CharacterFlowNode';
import { getNearbyCanvasPosition } from './canvas-position';
import {
  FLOW_MINIMAP_MASK_COLOR,
  getFlowMiniMapNodeColor,
  getFlowMiniMapNodeStrokeColor,
} from './flow-minimap';
import LocationBoard from './LocationBoard';
import LocationFlowNode from './LocationFlowNode';
import PlotFlowNode, { type PlotFlowNodeData } from './PlotFlowNode';
import SceneBoard from './SceneBoard';
import TimelineBoard from './TimelineBoard';
import RevisionBoard from './RevisionBoard';
import { getStatusTone } from './status-tone';

type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type StoryNodeRecord = StoryState['nodes'][number];
type StoryEdgeRecord = StoryState['edges'][number];
type PlotRecord = StoryState['plots'][number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;
type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;
type CreatedChapterNode = Awaited<ReturnType<(typeof window.novelistApi)['createStoryNode']>>;
type WikiStatus = Awaited<ReturnType<(typeof window.novelistApi)['wikiGetStatus']>>;
type WikiSearchResult = Awaited<ReturnType<(typeof window.novelistApi)['wikiSearch']>>[number];
type DashboardSnapshot = Awaited<ReturnType<(typeof window.novelistApi)['listSnapshots']>>[number];
type DashboardWritingSession = Awaited<
  ReturnType<(typeof window.novelistApi)['listWritingSessions']>
>[number];
type DashboardCharacterCard = Awaited<
  ReturnType<(typeof window.novelistApi)['listCharacterCards']>
>[number];
type DashboardLocationCard = Awaited<
  ReturnType<(typeof window.novelistApi)['listLocationCards']>
>[number];
type DashboardSceneCard = Awaited<
  ReturnType<(typeof window.novelistApi)['listSceneCards']>
>[number];
type ChapterDocumentRecord = Awaited<ReturnType<(typeof window.novelistApi)['getChapterDocument']>>;
type CodexMemorySource = NonNullable<
  Awaited<ReturnType<(typeof window.novelistApi)['codexChat']>>['memorySources']
>[number];
type ChapterCanvasNode = Node<ChapterFlowNodeData, 'chapter'>;
type PlotCanvasNode = Node<PlotFlowNodeData, 'plot'>;

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

interface PlotStructureBlock {
  title: string;
  description: string;
}

interface DashboardChapterMetric {
  id: string;
  title: string;
  plotNumber: number;
  blockNumber: number;
  wordCount: number;
  updatedAt: string;
  hasDescription: boolean;
  descriptionStale: boolean;
}

interface DashboardSceneMetric {
  id: string;
  name: string;
  chapterTitle: string;
  plotNumber: number;
  wordCount: number;
  updatedAt: string;
  hasText: boolean;
  hasChapter: boolean;
  connected: boolean;
}

interface DashboardState {
  loading: boolean;
  error: string | null;
  totalWords: number;
  chapterMetrics: DashboardChapterMetric[];
  lastModifiedChapter: DashboardChapterMetric | null;
  chaptersWithoutDescription: DashboardChapterMetric[];
  chaptersWithStaleDescription: DashboardChapterMetric[];
  chaptersWithoutCharacters: DashboardChapterMetric[];
  chaptersWithoutLocations: DashboardChapterMetric[];
  chaptersWithoutScenes: DashboardChapterMetric[];
  unusedCharacters: string[];
  unusedLocations: string[];
  unusedScenes: string[];
  scenesWithoutText: string[];
  disconnectedScenes: string[];
  sceneMetrics: DashboardSceneMetric[];
  disconnectedChapters: DashboardChapterMetric[];
  latestSnapshot: DashboardSnapshot | null;
  writingSessions: DashboardWritingSession[];
  characterCount: number;
  locationCount: number;
  sceneCount: number;
}

interface DashboardGoalMetrics {
  targetWordCount: number | null;
  targetChapterWordCount: number | null;
  plannedCompletionDate: string | null;
  editorialFolders: number | null;
  progressPercent: number | null;
  remainingWords: number | null;
  averageWordsPerSession: number | null;
  averageWordsPerDay: number | null;
  requiredWordsPerDay: number | null;
  estimatedCompletionDate: Date | null;
  plannedDaysRemaining: number | null;
  estimatedDaysRemaining: number | null;
  deliveryStatus: string;
  deliveryTone: 'success' | 'warning' | 'neutral';
}

interface OutlineChapter {
  node: StoryNodeRecord;
  plot: PlotRecord | null;
  scenes: DashboardSceneCard[];
  characters: DashboardCharacterCard[];
  locations: DashboardLocationCard[];
  incomingIds: string[];
  outgoingIds: string[];
  issues: string[];
}

interface OutlineState {
  loading: boolean;
  saving: boolean;
  error: string | null;
  chapters: OutlineChapter[];
  isolatedCount: number;
  ambiguousCount: number;
}

interface RichTextNodeJson {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNodeJson[];
}

interface RichTextDocumentJson {
  type?: string;
  content?: RichTextNodeJson[];
}

interface ReadingChapter {
  id: string;
  title: string;
  document: RichTextDocumentJson;
  wordCount: number;
}

interface ReadingViewState {
  title: string;
  subtitle: string;
  chapters: ReadingChapter[];
}

const DEFAULT_PROJECT_NAME = 'Romanzo senza titolo';
const MEMORY_SUMMARY_STORAGE_PREFIX = 'the-novelist.memory-summary.v1';
const DEFAULT_API_MODEL = 'gpt-5-mini';
const DEFAULT_API_IMAGE_MODEL = 'gpt-image-1';
const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b-it-q4_K_M';

function createEmptyDashboardState(): DashboardState {
  return {
    loading: false,
    error: null,
    totalWords: 0,
    chapterMetrics: [],
    lastModifiedChapter: null,
    chaptersWithoutDescription: [],
    chaptersWithStaleDescription: [],
    chaptersWithoutCharacters: [],
    chaptersWithoutLocations: [],
    chaptersWithoutScenes: [],
    unusedCharacters: [],
    unusedLocations: [],
    unusedScenes: [],
    scenesWithoutText: [],
    disconnectedScenes: [],
    sceneMetrics: [],
    disconnectedChapters: [],
    latestSnapshot: null,
    writingSessions: [],
    characterCount: 0,
    locationCount: 0,
    sceneCount: 0,
  };
}

function createEmptyOutlineState(): OutlineState {
  return {
    loading: false,
    saving: false,
    error: null,
    chapters: [],
    isolatedCount: 0,
    ambiguousCount: 0,
  };
}

function parseTime(value: string | null | undefined): number {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function formatDateTime(value: string | null | undefined): string {
  const timestamp = parseTime(value);
  if (!timestamp) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(timestamp));
}

function formatDate(value: string | Date | null | undefined): string {
  const timestamp = value instanceof Date ? value.getTime() : parseTime(value);
  if (!timestamp) {
    return '-';
  }

  return new Intl.DateTimeFormat('it-IT', {
    dateStyle: 'medium',
  }).format(new Date(timestamp));
}

function formatInteger(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 }).format(value);
}

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '-';
  }

  return `${new Intl.NumberFormat('it-IT', { maximumFractionDigits: 1 }).format(value)}%`;
}

function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const timestamp = Date.parse(`${value}T00:00:00`);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function differenceInDays(left: Date, right: Date): number {
  const millisecondsPerDay = 86_400_000;
  return Math.ceil((left.getTime() - right.getTime()) / millisecondsPerDay);
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function toOptionalPositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getEditorialFoldersFromWords(wordCount: number | null | undefined): number | null {
  if (!wordCount || wordCount <= 0) {
    return null;
  }

  return Math.ceil(wordCount / 300);
}

function projectPlanningMatches(
  project: NonNullable<ProjectRecord>,
  input: {
    targetWordCount: number | null;
    targetChapterWordCount: number | null;
    plannedCompletionDate: string | null;
  },
): boolean {
  return (
    (project.targetWordCount ?? null) === input.targetWordCount &&
    (project.targetChapterWordCount ?? null) === input.targetChapterWordCount &&
    (project.plannedCompletionDate ?? null) === input.plannedCompletionDate
  );
}

function buildDashboardGoalMetrics(
  project: NonNullable<ProjectRecord>,
  dashboard: DashboardState,
): DashboardGoalMetrics {
  const targetWordCount = project.targetWordCount ?? null;
  const targetChapterWordCount = project.targetChapterWordCount ?? null;
  const plannedCompletionDate = project.plannedCompletionDate ?? null;
  const progressPercent = targetWordCount
    ? Math.min(100, (dashboard.totalWords / targetWordCount) * 100)
    : null;
  const remainingWords = targetWordCount
    ? Math.max(0, targetWordCount - dashboard.totalWords)
    : null;
  const writtenInSessions = dashboard.writingSessions.reduce(
    (sum, session) => sum + Math.max(0, session.wordDelta),
    0,
  );
  const averageWordsPerSession =
    dashboard.writingSessions.length > 0
      ? writtenInSessions / dashboard.writingSessions.length
      : null;

  const firstSessionDate = dashboard.writingSessions[0]
    ? new Date(parseTime(dashboard.writingSessions[0].createdAt))
    : null;
  const today = startOfToday();
  const activeDays = firstSessionDate
    ? Math.max(
        1,
        differenceInDays(
          today,
          new Date(
            firstSessionDate.getFullYear(),
            firstSessionDate.getMonth(),
            firstSessionDate.getDate(),
          ),
        ) + 1,
      )
    : 0;
  const averageWordsPerDay =
    activeDays > 0 && writtenInSessions > 0 ? writtenInSessions / activeDays : null;
  const estimatedDaysRemaining =
    remainingWords !== null && averageWordsPerDay && averageWordsPerDay > 0
      ? Math.ceil(remainingWords / averageWordsPerDay)
      : null;
  const estimatedCompletionDate =
    estimatedDaysRemaining !== null ? addDays(today, estimatedDaysRemaining) : null;
  const plannedDate = parseDateInput(plannedCompletionDate);
  const plannedDaysRemaining = plannedDate
    ? Math.max(0, differenceInDays(plannedDate, today))
    : null;
  const requiredWordsPerDay =
    remainingWords !== null && plannedDaysRemaining !== null
      ? remainingWords / Math.max(1, plannedDaysRemaining)
      : null;

  let deliveryStatus = 'Imposta un target parole e una data prevista';
  let deliveryTone: DashboardGoalMetrics['deliveryTone'] = 'neutral';
  if (targetWordCount && plannedDate && estimatedCompletionDate) {
    const driftDays = differenceInDays(estimatedCompletionDate, plannedDate);
    if (driftDays <= 0) {
      deliveryStatus = 'In linea con la data prevista';
      deliveryTone = 'success';
    } else {
      deliveryStatus = `Ritardo stimato: ${driftDays} giorni`;
      deliveryTone = 'warning';
    }
  } else if (targetWordCount && plannedDate) {
    deliveryStatus =
      requiredWordsPerDay !== null
        ? `${formatInteger(requiredWordsPerDay)} parole/giorno richieste`
        : 'Servono sessioni salvate per calcolare la proiezione';
  }

  return {
    targetWordCount,
    targetChapterWordCount,
    plannedCompletionDate,
    editorialFolders: getEditorialFoldersFromWords(targetWordCount),
    progressPercent,
    remainingWords,
    averageWordsPerSession,
    averageWordsPerDay,
    requiredWordsPerDay,
    estimatedCompletionDate,
    plannedDaysRemaining,
    estimatedDaysRemaining,
    deliveryStatus,
    deliveryTone,
  };
}

function ProgressPie({ percent }: { percent: number | null }) {
  const normalizedPercent =
    percent === null || !Number.isFinite(percent) ? 0 : Math.max(0, Math.min(100, percent));
  const style = { '--progress': `${normalizedPercent}%` } as CSSProperties;

  return (
    <div className="dashboard-progress-pie" style={style} aria-label="Avanzamento percentuale">
      <span>{formatPercent(percent)}</span>
    </div>
  );
}

function SessionBars({ sessions }: { sessions: DashboardWritingSession[] }) {
  const maxWords = Math.max(1, ...sessions.map((session) => Math.max(0, session.wordDelta)));

  if (sessions.length === 0) {
    return <p className="muted">Nessuna sessione registrata.</p>;
  }

  return (
    <div className="dashboard-session-bars" aria-label="Parole scritte per sessione">
      {sessions.map((session, index) => {
        const heightPercent = Math.max(8, (Math.max(0, session.wordDelta) / maxWords) * 100);
        return (
          <div className="dashboard-session-bar-item" key={session.id}>
            <span
              className="dashboard-session-bar"
              style={{ '--bar-height': `${heightPercent}%` } as CSSProperties}
              title={`${formatInteger(session.wordDelta)} parole - ${formatDateTime(
                session.createdAt,
              )}`}
            />
            <small>{index + 1}</small>
          </div>
        );
      })}
    </div>
  );
}

function DeliveryBars({ metrics }: { metrics: DashboardGoalMetrics }) {
  const requiredWordsPerDay = metrics.requiredWordsPerDay ?? 0;
  const averageWordsPerDay = metrics.averageWordsPerDay ?? 0;
  const maxWordsPerDay = Math.max(1, requiredWordsPerDay, averageWordsPerDay);

  return (
    <div className="dashboard-delivery-bars" aria-label="Confronto ritmo di consegna">
      <div>
        <span>Richiesto</span>
        <strong>
          {metrics.requiredWordsPerDay === null
            ? '-'
            : `${formatInteger(requiredWordsPerDay)} parole/g`}
        </strong>
        <div className="dashboard-horizontal-bar-track">
          <span
            className="dashboard-horizontal-bar dashboard-horizontal-bar-planned"
            style={
              { '--bar-width': `${(requiredWordsPerDay / maxWordsPerDay) * 100}%` } as CSSProperties
            }
          />
        </div>
      </div>
      <div>
        <span>Attuale</span>
        <strong>
          {metrics.averageWordsPerDay === null
            ? '-'
            : `${formatInteger(averageWordsPerDay)} parole/g`}
        </strong>
        <div className="dashboard-horizontal-bar-track">
          <span
            className="dashboard-horizontal-bar dashboard-horizontal-bar-estimated"
            style={
              { '--bar-width': `${(averageWordsPerDay / maxWordsPerDay) * 100}%` } as CSSProperties
            }
          />
        </div>
      </div>
    </div>
  );
}

function formatAutosaveLabel(preferences: AppPreferences | null): string {
  if (!preferences) {
    return 'Non caricato';
  }

  if (preferences.autosaveMode === 'auto') {
    return 'Automatico a ogni modifica';
  }

  if (preferences.autosaveMode === 'interval') {
    return `Ogni ${normalizeIntervalMinutes(preferences.autosaveIntervalMinutes)} min`;
  }

  return 'Manuale';
}

function formatCharacterName(card: DashboardCharacterCard): string {
  const fullName = `${card.firstName} ${card.lastName}`.trim();
  return fullName || 'Personaggio senza nome';
}

function formatLocationName(card: DashboardLocationCard): string {
  return card.name.trim() || 'Location senza nome';
}

function formatSceneName(card: DashboardSceneCard): string {
  return card.name.trim() || 'Scena senza nome';
}

function countWords(value: string): number {
  const text = value.trim();
  if (!text) {
    return 0;
  }
  return text.split(/\s+/).filter(Boolean).length;
}

function getApiKeyStorageLabel(storage: CodexSettings['apiKeyStorage']): string {
  if (storage === 'secure_storage') {
    return 'archivio sicuro di sistema';
  }
  if (storage === 'legacy_db') {
    return 'archivio legacy (DB)';
  }
  return 'nessuno';
}

function getAiProviderLabel(provider: CodexSettings['provider']): string {
  if (provider === 'openai_api') {
    return 'OpenAI API';
  }

  if (provider === 'ollama') {
    return 'Ollama';
  }

  return 'Codex CLI';
}

function getAiFallbackLabel(fallbackProvider: CodexSettings['fallbackProvider']): string {
  if (fallbackProvider === 'none') {
    return 'Non AI';
  }

  return getAiProviderLabel(fallbackProvider);
}

function getAiFallbackOptions(
  provider: CodexSettings['provider'],
): Array<{ value: CodexSettings['fallbackProvider']; label: string }> {
  return [
    { value: 'none', label: 'Non AI' },
    ...(['codex_cli', 'openai_api', 'ollama'] as const)
      .filter((candidate) => candidate !== provider)
      .map((candidate) => ({
        value: candidate,
        label: getAiProviderLabel(candidate),
      })),
  ];
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

function sortStoryNodesForOutline(chapters: StoryNodeRecord[]): StoryNodeRecord[] {
  return [...chapters].sort((left, right) => {
    if (left.plotNumber !== right.plotNumber) {
      return left.plotNumber - right.plotNumber;
    }
    if (left.blockNumber !== right.blockNumber) {
      return left.blockNumber - right.blockNumber;
    }
    return left.title.localeCompare(right.title, 'it');
  });
}

function buildOutlineChapterOrder(
  chapters: StoryNodeRecord[],
  edges: StoryEdgeRecord[],
): {
  orderedChapters: StoryNodeRecord[];
  incomingById: Map<string, string[]>;
  outgoingById: Map<string, string[]>;
  cycleIds: Set<string>;
} {
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const incomingById = new Map<string, string[]>(chapters.map((chapter) => [chapter.id, []]));
  const outgoingById = new Map<string, string[]>(chapters.map((chapter) => [chapter.id, []]));

  for (const edge of edges) {
    if (!chapterIds.has(edge.sourceId) || !chapterIds.has(edge.targetId)) {
      continue;
    }
    outgoingById.get(edge.sourceId)?.push(edge.targetId);
    incomingById.get(edge.targetId)?.push(edge.sourceId);
  }

  const byCanonicalOrder = (leftId: string, rightId: string): number => {
    const left = chapterById.get(leftId);
    const right = chapterById.get(rightId);
    if (!left || !right) {
      return leftId.localeCompare(rightId);
    }
    return sortStoryNodesForOutline([left, right])[0]?.id === left.id ? -1 : 1;
  };

  for (const ids of incomingById.values()) {
    ids.sort(byCanonicalOrder);
  }
  for (const ids of outgoingById.values()) {
    ids.sort(byCanonicalOrder);
  }

  const orderedChapters: StoryNodeRecord[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycleIds = new Set<string>();

  function visit(chapter: StoryNodeRecord): void {
    if (visiting.has(chapter.id)) {
      cycleIds.add(chapter.id);
      return;
    }
    if (visited.has(chapter.id)) {
      return;
    }

    visiting.add(chapter.id);
    orderedChapters.push(chapter);
    visited.add(chapter.id);

    for (const targetId of outgoingById.get(chapter.id) ?? []) {
      const target = chapterById.get(targetId);
      if (!target) {
        continue;
      }
      if (visiting.has(targetId)) {
        cycleIds.add(chapter.id);
        cycleIds.add(targetId);
        continue;
      }
      visit(target);
    }
    visiting.delete(chapter.id);
  }

  const canonicalChapters = sortStoryNodesForOutline(chapters);
  const startChapters = canonicalChapters.filter(
    (chapter) => (incomingById.get(chapter.id)?.length ?? 0) === 0,
  );

  for (const chapter of startChapters.length > 0 ? startChapters : canonicalChapters) {
    visit(chapter);
  }
  for (const chapter of canonicalChapters) {
    visit(chapter);
  }

  return { orderedChapters, incomingById, outgoingById, cycleIds };
}

function parseReadingDocument(contentJson: string): RichTextDocumentJson {
  try {
    const parsed = JSON.parse(contentJson) as RichTextDocumentJson;
    if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
      return parsed;
    }
  } catch {
    return { type: 'doc', content: [] };
  }

  return { type: 'doc', content: [] };
}

function richTextNodeHasContent(node: RichTextNodeJson): boolean {
  if (typeof node.text === 'string' && node.text.trim().length > 0) {
    return true;
  }
  if (node.type === 'referenceMention') {
    const label = typeof node.attrs?.label === 'string' ? node.attrs.label.trim() : '';
    return label.length > 0;
  }
  return Array.isArray(node.content) && node.content.some(richTextNodeHasContent);
}

function richTextDocumentHasContent(document: RichTextDocumentJson): boolean {
  return Array.isArray(document.content) && document.content.some(richTextNodeHasContent);
}

function getReadingTextAlign(attrs: Record<string, unknown> | undefined): CSSProperties | undefined {
  const textAlign = attrs?.textAlign;
  if (
    textAlign === 'left' ||
    textAlign === 'center' ||
    textAlign === 'right' ||
    textAlign === 'justify'
  ) {
    return { textAlign };
  }

  return undefined;
}

function renderReadingInlineNode(node: RichTextNodeJson, key: string): ReactNode {
  if (node.type === 'hardBreak') {
    return <br key={key} />;
  }

  if (node.type === 'referenceMention') {
    return null;
  }

  let content: ReactNode =
    typeof node.text === 'string'
      ? node.text
      : node.content?.map((child, index) => renderReadingInlineNode(child, `${key}-${index}`));

  for (const [markIndex, mark] of (node.marks ?? []).entries()) {
    const markKey = `${key}-mark-${markIndex}`;
    if (mark.type === 'bold') {
      content = <strong key={markKey}>{content}</strong>;
    } else if (mark.type === 'italic') {
      content = <em key={markKey}>{content}</em>;
    } else if (mark.type === 'strike') {
      content = <s key={markKey}>{content}</s>;
    } else if (mark.type === 'code') {
      content = <code key={markKey}>{content}</code>;
    } else if (mark.type === 'underline') {
      content = <u key={markKey}>{content}</u>;
    }
  }

  return <span key={key}>{content}</span>;
}

function renderReadingBlockNode(node: RichTextNodeJson, key: string): ReactNode {
  const children = Array.isArray(node.content)
    ? node.content.map((child, index) => {
        if (child.type === 'bulletList' || child.type === 'orderedList' || child.type === 'blockquote') {
          return renderReadingBlockNode(child, `${key}-${index}`);
        }
        return renderReadingInlineNode(child, `${key}-${index}`);
      })
    : null;
  const textAlignStyle = getReadingTextAlign(node.attrs);

  if (node.type === 'heading') {
    const level = node.attrs?.level === 1 ? 2 : node.attrs?.level === 2 ? 3 : 4;
    if (level === 2) {
      return (
        <h2 key={key} style={textAlignStyle}>
          {children}
        </h2>
      );
    }
    if (level === 3) {
      return (
        <h3 key={key} style={textAlignStyle}>
          {children}
        </h3>
      );
    }
    return (
      <h4 key={key} style={textAlignStyle}>
        {children}
      </h4>
    );
  }

  if (node.type === 'blockquote') {
    return (
      <blockquote key={key} style={textAlignStyle}>
        {children}
      </blockquote>
    );
  }

  if (node.type === 'bulletList') {
    return <ul key={key}>{children}</ul>;
  }

  if (node.type === 'orderedList') {
    return <ol key={key}>{children}</ol>;
  }

  if (node.type === 'listItem') {
    return <li key={key}>{children}</li>;
  }

  return (
    <p key={key} style={textAlignStyle}>
      {children}
    </p>
  );
}

function renderReadingDocument(document: RichTextDocumentJson): ReactNode {
  if (!richTextDocumentHasContent(document)) {
    return <p className="reader-empty-chapter">Capitolo vuoto.</p>;
  }

  return (document.content ?? []).map((node, index) => renderReadingBlockNode(node, `block-${index}`));
}

function normalizeCodexSettings(settings: CodexSettings): CodexSettings {
  const maybeSettings = settings as CodexSettings & {
    allowExternalMemorySharing?: boolean;
    apiImageModel?: string;
    ollamaModel?: string;
  };
  return {
    ...settings,
    allowExternalMemorySharing: maybeSettings.allowExternalMemorySharing ?? true,
    apiImageModel: maybeSettings.apiImageModel?.trim() || DEFAULT_API_IMAGE_MODEL,
    ollamaModel: maybeSettings.ollamaModel?.trim() || DEFAULT_OLLAMA_MODEL,
  };
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
    localSettings.fallbackProvider !== persistedSettings.fallbackProvider ||
    localSettings.allowApiCalls !== persistedSettings.allowApiCalls ||
    localSettings.allowExternalMemorySharing !==
      normalizeCodexSettings(persistedSettings).allowExternalMemorySharing ||
    localSettings.autoSummarizeDescriptions !== persistedSettings.autoSummarizeDescriptions ||
    localSettings.apiModel !== persistedSettings.apiModel ||
    normalizeCodexSettings(localSettings).apiImageModel !==
      normalizeCodexSettings(persistedSettings).apiImageModel ||
    normalizeCodexSettings(localSettings).ollamaModel !==
      normalizeCodexSettings(persistedSettings).ollamaModel ||
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

function formatWikiCategoryLabel(category: WikiSearchResult['category']): string {
  if (category === 'source') {
    return 'fonte';
  }

  if (category === 'index') {
    return 'indice';
  }

  return 'wiki';
}

function formatWikiResultTitle(result: WikiSearchResult): string {
  if (result.path === 'sources/cards/plot.md') {
    return 'Trame';
  }

  if (result.path === 'sources/cards/characters.md') {
    return 'Personaggi';
  }

  if (result.path === 'sources/cards/locations.md') {
    return 'Location';
  }

  return result.title.replace(/\s+Sources$/i, '');
}

function mapPlotRecordToFlowNode(
  record: PlotRecord,
  options?: { selected?: boolean },
): PlotCanvasNode {
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

function syncPlotFlowNodes(
  records: PlotRecord[],
  previousNodes: PlotCanvasNode[],
  selectedPlotId: string | null,
): PlotCanvasNode[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));

  return sortPlots(records).map((record) => {
    const nextNode = mapPlotRecordToFlowNode(record, { selected: record.id === selectedPlotId });
    const previousNode = previousById.get(record.id);

    if (!previousNode) {
      return nextNode;
    }

    return {
      ...previousNode,
      ...nextNode,
      position: nextNode.position,
      data: nextNode.data,
      style: nextNode.style,
      width: nextNode.width,
      height: nextNode.height,
      selected: nextNode.selected,
    };
  });
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
    source: record.sourceId,
    target: record.targetId,
    sourceHandle: handles?.sourceHandle ?? record.sourceHandle ?? 'handle-right',
    targetHandle: handles?.targetHandle ?? record.targetHandle ?? 'handle-left',
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

function buildMemoryStorySummary(plots: PlotRecord[]): string {
  const plotSummaries = getPlotSummaryLines(plots);

  if (plotSummaries.length === 0) {
    return 'Riassunto non ancora disponibile.\nAggiungi una sinossi alle trame.\nLa memoria usera questa sintesi quando sara disponibile.';
  }

  return plotSummaries
    .slice(0, 5)
    .map((line) => truncateSummaryLine(line))
    .join('\n');
}

function truncateSummaryLine(value: string, maxLength = 180): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  const sliced = compact.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${sliced.slice(0, Math.max(80, lastSpace)).trim()}...`;
}

function getPlotSummaryLines(plots: PlotRecord[]): string[] {
  return sortPlots(plots)
    .map((plot) => {
      const summary = plot.summary.trim();
      if (!summary) {
        return null;
      }
      return `${normalizePlotLabel(plot.number, plot.label)}: ${summary}`;
    })
    .filter((summary): summary is string => Boolean(summary));
}

function buildMemorySummaryContext(plots: PlotRecord[]): string {
  const lines = getPlotSummaryLines(plots);
  return lines.length > 0 ? lines.join('\n') : 'Nessuna sinossi trama disponibile.';
}

function buildMemorySummaryKey(project: ProjectRecord | null, plots: PlotRecord[]): string {
  const plotKey = sortPlots(plots)
    .map((plot) => `${plot.id}:${plot.updatedAt}:${plot.label}:${plot.summary}`)
    .join('|');
  return `${project?.id ?? 'no-project'}::${plotKey}`;
}

function getMemorySummaryStorageKey(project: ProjectRecord): string {
  return `${MEMORY_SUMMARY_STORAGE_PREFIX}.${project?.id || project?.rootPath || 'default'}`;
}

function readStoredMemorySummary(project: ProjectRecord): { key: string; summary: string } | null {
  try {
    const raw = window.localStorage.getItem(getMemorySummaryStorageKey(project));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as { key?: unknown; summary?: unknown };
    if (typeof parsed.key !== 'string' || typeof parsed.summary !== 'string') {
      return null;
    }
    return {
      key: parsed.key,
      summary: parsed.summary,
    };
  } catch {
    return null;
  }
}

function writeStoredMemorySummary(project: ProjectRecord, key: string, summary: string): void {
  try {
    window.localStorage.setItem(
      getMemorySummaryStorageKey(project),
      JSON.stringify({
        key,
        summary,
        updatedAt: new Date().toISOString(),
      }),
    );
  } catch {
    // The summary is an optimization; the view can fall back to regenerating it.
  }
}

function normalizeMemorySummaryOutput(output: string, fallback: string): string {
  const lines = output
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.replace(/^[-*\d.\s]+/u, '').trim())
    .map((line) => truncateSummaryLine(line, 190))
    .filter(Boolean)
    .slice(0, 5);

  if (lines.length >= 2) {
    return lines.join('\n');
  }

  const sentences = output
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/u)
    .map((sentence) => sentence.trim())
    .map((sentence) => truncateSummaryLine(sentence, 190))
    .filter(Boolean)
    .slice(0, 5);

  return sentences.length > 0 ? sentences.join('\n') : fallback;
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
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { blocks?: unknown[] }).blocks)
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
  const [createProjectTargetWords, setCreateProjectTargetWords] = useState<string>('');
  const [createProjectTargetChapterWords, setCreateProjectTargetChapterWords] =
    useState<string>('');
  const [createProjectCompletionDate, setCreateProjectCompletionDate] = useState<string>('');
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState<boolean>(false);
  const [editProjectTargetWords, setEditProjectTargetWords] = useState<string>('');
  const [editProjectTargetChapterWords, setEditProjectTargetChapterWords] = useState<string>('');
  const [editProjectCompletionDate, setEditProjectCompletionDate] = useState<string>('');
  const [isProjectTargetsModalOpen, setIsProjectTargetsModalOpen] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('dashboard');
  const [appPreferences, setAppPreferences] = useState<AppPreferences | null>(null);
  const [appPreferencesBusy, setAppPreferencesBusy] = useState<boolean>(false);
  const [aiSettings, setAiSettings] = useState<CodexSettings | null>(null);
  const [aiSettingsBusy, setAiSettingsBusy] = useState<boolean>(false);
  const [aiApiKeyInput, setAiApiKeyInput] = useState<string>('');
  const [clearStoredApiKey, setClearStoredApiKey] = useState<boolean>(false);
  const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState<boolean>(false);
  const [wikiStatus, setWikiStatus] = useState<WikiStatus | null>(null);
  const [wikiBusy, setWikiBusy] = useState<boolean>(false);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [wikiSearchQuery, setWikiSearchQuery] = useState<string>('');
  const [wikiSearchResults, setWikiSearchResults] = useState<WikiSearchResult[]>([]);
  const [lastAiMemorySources, setLastAiMemorySources] = useState<CodexMemorySource[]>([]);
  const [memoryStorySummary, setMemoryStorySummary] = useState<string>('');
  const [memoryStorySummaryBusy, setMemoryStorySummaryBusy] = useState<boolean>(false);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardState>(() => createEmptyDashboardState());
  const [outline, setOutline] = useState<OutlineState>(() => createEmptyOutlineState());
  const [draggedOutlineChapterId, setDraggedOutlineChapterId] = useState<string | null>(null);
  const [readingView, setReadingView] = useState<ReadingViewState | null>(null);
  const [readingViewLoading, setReadingViewLoading] = useState<boolean>(false);

  const [plots, setPlots] = useState<PlotRecord[]>([]);
  const [plotNodes, setPlotNodes] = useState<PlotCanvasNode[]>([]);
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
  const [sceneBoardDirty, setSceneBoardDirty] = useState<boolean>(false);
  const [isCloseProjectConfirmOpen, setIsCloseProjectConfirmOpen] = useState<boolean>(false);

  const chapterEditorFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const characterBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const locationBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const sceneBoardFlushRef = useRef<(() => Promise<boolean>) | null>(null);
  const wikiAutoSyncInFlightRef = useRef<Promise<void> | null>(null);
  const workspaceNoticeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyFlowRef = useRef<ReactFlowInstance<ChapterCanvasNode, Edge> | null>(null);
  const plotFlowRef = useRef<ReactFlowInstance<PlotCanvasNode> | null>(null);
  const previousStoryTabRef = useRef<WorkspaceTab>('dashboard');
  const previousStoryNodeCountRef = useRef<number>(0);
  const previousStoryProjectRootRef = useRef<string | null>(null);
  const previousPlotTabRef = useRef<WorkspaceTab>('dashboard');
  const previousPlotCountRef = useRef<number>(0);
  const memoryStorySummaryKeyRef = useRef<string>('');
  const storyAutosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storyAutosaveInFlightRef = useRef<boolean>(false);

  const plotsById = useMemo(() => new Map(plots.map((plot) => [plot.id, plot])), [plots]);
  const nodesById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const selectedPlot = useMemo(
    () => (selectedPlotId ? (plotsById.get(selectedPlotId) ?? null) : null),
    [plotsById, selectedPlotId],
  );
  const selectedNode = useMemo(
    () => (selectedNodeId ? (nodesById.get(selectedNodeId) ?? null) : null),
    [nodesById, selectedNodeId],
  );
  const dashboardGoalMetrics = useMemo(
    () => (currentProject ? buildDashboardGoalMetrics(currentProject, dashboard) : null),
    [currentProject, dashboard],
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
  const outlineChapterTitleById = useMemo(
    () => new Map(outline.chapters.map((chapter) => [chapter.node.id, chapter.node.title])),
    [outline.chapters],
  );
  const memoryStorySummaryFallback = useMemo(() => buildMemoryStorySummary(plots), [plots]);
  const memoryStorySummaryKey = useMemo(
    () => buildMemorySummaryKey(currentProject, plots),
    [currentProject, plots],
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
    !currentProject &&
    !busy &&
    Boolean(createProjectRoot.trim()) &&
    Boolean(createProjectName.trim());
  const canSaveProjectTargets = Boolean(currentProject) && !busy;
  const canOpenProject = !currentProject && !busy;
  const canSaveProject = Boolean(currentProject) && !busy;
  const canCloseProject = Boolean(currentProject) && !busy;
  const canCreatePlot =
    Boolean(currentProject) && !busy && newPlotNumber >= 1 && !existingPlotForNewNumber;
  const canCreatePlotStructure = canCreatePlot && Boolean(newPlotSummary.trim());

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

  const syncProjectWikiAfterWorkspaceChange = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      return;
    }

    if (wikiAutoSyncInFlightRef.current) {
      showWorkspaceNotice('aggiornamento memoria in corso...');
      await wikiAutoSyncInFlightRef.current;
      return;
    }

    showWorkspaceNotice('aggiornamento memoria in corso...');
    const syncPromise = (async () => {
      try {
        await window.novelistApi.wikiSync();
        const status = await window.novelistApi.wikiGetStatus();
        setWikiStatus(status);
        setWikiError(null);
        showWorkspaceNotice('memoria aggiornata', 1800);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setWikiError(message);
        setError(message);
        showWorkspaceNotice('errore aggiornamento memoria', 4500);
        setStatus('Errore aggiornamento automatico memoria progetto');
      }
    })();

    wikiAutoSyncInFlightRef.current = syncPromise;
    try {
      await syncPromise;
    } finally {
      if (wikiAutoSyncInFlightRef.current === syncPromise) {
        wikiAutoSyncInFlightRef.current = null;
      }
    }
  }, [currentProject, showWorkspaceNotice]);

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
    setPlotNodes((prev) => syncPlotFlowNodes(plots, prev, selectedPlotId));
  }, [plots, selectedPlotId]);

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
    setSceneBoardDirty(false);
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
        fallbackProvider: aiSettings.fallbackProvider,
        allowApiCalls: aiSettings.allowApiCalls,
        allowExternalMemorySharing: aiSettings.allowExternalMemorySharing !== false,
        autoSummarizeDescriptions: aiSettings.autoSummarizeDescriptions,
        apiKey: apiKeyInput || undefined,
        clearStoredApiKey: shouldClearStoredApiKey || undefined,
        apiModel: aiSettings.apiModel,
        apiImageModel: normalizeCodexSettings(aiSettings).apiImageModel,
        ollamaModel: normalizeCodexSettings(aiSettings).ollamaModel,
      });
      setAiSettings(normalizeCodexSettings(saved));
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
      setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
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
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setDashboard((previous) => ({
        ...previous,
        loading: false,
        error: message,
      }));
      setError(message);
      setStatus('Errore aggiornamento cruscotto');
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
      setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
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
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setOutline((previous) => ({
        ...previous,
        loading: false,
        saving: false,
        error: message,
      }));
      setError(message);
      setStatus('Errore aggiornamento scaletta');
    }
  }, [currentProject]);

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
        setStatus('Scaletta sincronizzata con il canvas Capitoli');
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setOutline((previous) => ({
          ...previous,
          saving: false,
          error: message,
        }));
        setError(message);
        setStatus('Errore sincronizzazione scaletta');
      } finally {
        setBusy(false);
      }
    },
    [currentProject, refreshOutlineData, syncProjectWikiAfterWorkspaceChange],
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

  async function openChapterReadingView(chapter: OutlineChapter): Promise<void> {
    if (!currentProject) {
      setStatus('Apri o crea prima un progetto');
      return;
    }

    setReadingViewLoading(true);
    setError(null);

    try {
      const document = await window.novelistApi.getChapterDocument({
        chapterNodeId: chapter.node.id,
      });
      setReadingView({
        title: chapter.node.title,
        subtitle: currentProject.name,
        chapters: [
          {
            id: chapter.node.id,
            title: chapter.node.title,
            document: parseReadingDocument(document.contentJson),
            wordCount: document.wordCount,
          },
        ],
      });
      setStatus(`Vista lettura aperta: ${chapter.node.title}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore apertura vista lettura');
    } finally {
      setReadingViewLoading(false);
    }
  }

  async function openFullDocumentReadingView(): Promise<void> {
    if (!currentProject) {
      setStatus('Apri o crea prima un progetto');
      return;
    }

    setReadingViewLoading(true);
    setError(null);

    try {
      const state = await window.novelistApi.getStoryState();
      const { orderedChapters } = buildOutlineChapterOrder(state.nodes, state.edges);
      if (orderedChapters.length === 0) {
        setError('Nessun capitolo disponibile per aprire il documento completo.');
        setStatus('Documento completo non disponibile');
        return;
      }

      const documentsByNodeId = new Map<string, ChapterDocumentRecord>(
        (
          await Promise.all(
            orderedChapters.map(async (chapter) => {
              const document = await window.novelistApi.getChapterDocument({
                chapterNodeId: chapter.id,
              });
              return [chapter.id, document] as const;
            }),
          )
        ).map(([chapterNodeId, document]) => [chapterNodeId, document]),
      );

      setReadingView({
        title: `${currentProject.name} - Documento completo`,
        subtitle: `${orderedChapters.length} capitoli`,
        chapters: orderedChapters.map((chapter) => {
          const document = documentsByNodeId.get(chapter.id);
          return {
            id: chapter.id,
            title: chapter.title,
            document: parseReadingDocument(document?.contentJson ?? ''),
            wordCount: document?.wordCount ?? 0,
          };
        }),
      });
      setStatus('Vista lettura documento completo aperta');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore apertura documento completo');
    } finally {
      setReadingViewLoading(false);
    }
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
    if (!readingView) {
      return undefined;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setReadingView(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [readingView]);

  async function refreshWikiStatus(): Promise<void> {
    if (!currentProject) {
      setWikiStatus(null);
      setWikiError(null);
      return;
    }

    setWikiError(null);
    try {
      const status = await window.novelistApi.wikiGetStatus();
      setWikiStatus(status);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setWikiError(message);
      setError(message);
      setStatus('Errore lettura stato memoria progetto');
    }
  }

  async function handleWikiSync(): Promise<void> {
    if (!currentProject || wikiBusy) {
      return;
    }

    setWikiBusy(true);
    setError(null);
    setWikiError(null);
    try {
      const result = await window.novelistApi.wikiSync();
      const status = await window.novelistApi.wikiGetStatus();
      setWikiStatus(status);
      setStatus(
        result.changed
          ? `Memoria progetto aggiornata: ${result.changedSources.length} fonti modificate`
          : 'Memoria progetto gia aggiornata',
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setWikiError(message);
      setError(message);
      setStatus('Errore aggiornamento memoria progetto');
    } finally {
      setWikiBusy(false);
    }
  }

  async function handleWikiSearch(): Promise<void> {
    if (!currentProject || wikiBusy) {
      return;
    }

    const query = wikiSearchQuery.trim();
    if (!query) {
      setWikiSearchResults([]);
      setStatus('Inserisci una ricerca per la memoria progetto');
      return;
    }

    setWikiBusy(true);
    setError(null);
    setWikiError(null);
    try {
      const results = await window.novelistApi.wikiSearch({ query, limit: 10 });
      setWikiSearchResults(results);
      setStatus(
        results.length > 0
          ? `Memoria progetto: ${results.length} risultati`
          : 'Memoria progetto: nessun risultato',
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setWikiError(message);
      setError(message);
      setStatus('Errore ricerca memoria progetto');
    } finally {
      setWikiBusy(false);
    }
  }

  const refreshMemoryStorySummary = useCallback(
    async (options?: { force?: boolean }): Promise<void> => {
      if (!currentProject) {
        setMemoryStorySummary('');
        memoryStorySummaryKeyRef.current = '';
        return;
      }

      const fallback = memoryStorySummaryFallback;
      const cachedSummary = readStoredMemorySummary(currentProject);
      if (!options?.force && cachedSummary?.key === memoryStorySummaryKey) {
        memoryStorySummaryKeyRef.current = memoryStorySummaryKey;
        setMemoryStorySummary(cachedSummary.summary);
        return;
      }

      if (!options?.force && memoryStorySummaryKeyRef.current === memoryStorySummaryKey) {
        if (!memoryStorySummary.trim()) {
          setMemoryStorySummary(fallback);
        }
        return;
      }

      memoryStorySummaryKeyRef.current = memoryStorySummaryKey;
      setMemoryStorySummary(fallback);

      if (!aiSettings?.enabled) {
        return;
      }

      setMemoryStorySummaryBusy(true);
      try {
        const response = await window.novelistApi.codexAssist({
          projectName: currentProject.name,
          message:
            'Scrivi una sintesi editoriale della storia in italiano. Deve essere composta da 4 o 5 righe brevi, senza elenco puntato, senza titoli e senza spiegare il tuo lavoro. Concentrati su protagonista, conflitto, posta in gioco e trame principali.',
          context: buildMemorySummaryContext(plots),
        });
        const summary = normalizeMemorySummaryOutput(response.output, fallback);
        setMemoryStorySummary(summary);
        writeStoredMemorySummary(currentProject, memoryStorySummaryKey, summary);
      } catch {
        setMemoryStorySummary(fallback);
      } finally {
        setMemoryStorySummaryBusy(false);
      }
    },
    [
      aiSettings?.enabled,
      currentProject,
      memoryStorySummary,
      memoryStorySummaryFallback,
      memoryStorySummaryKey,
      plots,
    ],
  );

  useEffect(() => {
    if (activeTab !== 'memory') {
      return;
    }
    void refreshMemoryStorySummary();
  }, [activeTab, refreshMemoryStorySummary]);

  function openMemoryTab(): void {
    setWikiSearchQuery('');
    setWikiSearchResults([]);
    setActiveTab('memory');
    void refreshWikiStatus();
    void refreshMemoryStorySummary();
  }

  function openProjectTargetsModal(): void {
    if (!currentProject) {
      return;
    }

    setEditProjectTargetWords(
      currentProject.targetWordCount === null ? '' : String(currentProject.targetWordCount),
    );
    setEditProjectTargetChapterWords(
      currentProject.targetChapterWordCount === null
        ? ''
        : String(currentProject.targetChapterWordCount),
    );
    setEditProjectCompletionDate(currentProject.plannedCompletionDate ?? '');
    setIsProjectTargetsModalOpen(true);
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
      const message =
        "La sessione dell'app non ha ancora caricato il salvataggio obiettivi. Riavvia The Novelist e riprova.";
      setError(message);
      setStatus('Riavvia l’app per salvare gli obiettivi progetto');
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
        const message =
          'Gli obiettivi non sono stati confermati dal processo principale. Riavvia The Novelist e riprova.';
        setError(message);
        setStatus('Obiettivi progetto non salvati');
        return;
      }
      setCurrentProject(project);
      setIsProjectTargetsModalOpen(false);
      setStatus('Obiettivi progetto aggiornati');
      void refreshDashboardData();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore aggiornamento obiettivi progetto');
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
      setNodes(state.nodes.map((node) => mapNodeRecordToFlowNode(node, state.plots)));
      setEdges(state.edges.map((edge) => mapEdgeRecordToFlowEdge(edge)));
      setActiveTab('dashboard');
      setAiSettings(settings);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      setWikiStatus(memoryStatus);
      setWikiError(null);
      setWikiSearchQuery('');
      setWikiSearchResults([]);
      setLastAiMemorySources([]);
      setStatus(statusMessage);
      void refreshDashboardData();
    },
    [refreshDashboardData, resetStoryWorkspace],
  );

  async function handleCreateProject(): Promise<void> {
    const rootPath = createProjectRoot.trim();
    const name = createProjectName.trim();
    const targetWordCount = toOptionalPositiveInteger(createProjectTargetWords);
    const targetChapterWordCount = toOptionalPositiveInteger(createProjectTargetChapterWords);
    const plannedCompletionDate = createProjectCompletionDate.trim() || null;
    if (!rootPath || !name) {
      setStatus('Seleziona una cartella e inserisci un nome progetto.');
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
        setError(
          'Il progetto e stato creato, ma gli obiettivi non sono stati confermati dal processo principale. Riavvia The Novelist e reinseriscili dal cruscotto.',
        );
      }
      setCreateProjectRoot(project.rootPath);
      setCreateProjectName(project.name);
      setCreateProjectTargetWords('');
      setCreateProjectTargetChapterWords('');
      setCreateProjectCompletionDate('');
      setIsCreateProjectModalOpen(false);
      await syncOpenedProject(
        project,
        shouldPersistPlanning && !planningPersisted
          ? 'Progetto creato senza obiettivi salvati'
          : `Progetto creato: ${project.name}`,
      );
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
      void refreshDashboardData();
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
      setCreateProjectTargetWords('');
      setCreateProjectTargetChapterWords('');
      setCreateProjectCompletionDate('');
      setIsCreateProjectModalOpen(false);
      setEditProjectTargetWords('');
      setEditProjectTargetChapterWords('');
      setEditProjectCompletionDate('');
      setIsProjectTargetsModalOpen(false);
      setAiSettings(null);
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      setIsAiSettingsModalOpen(false);
      setWikiStatus(null);
      setWikiError(null);
      setWikiSearchQuery('');
      setWikiSearchResults([]);
      setLastAiMemorySources([]);
      setActiveTab('dashboard');
      setDashboard(createEmptyDashboardState());
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
      setStatus(`Cartella di lavoro selezionata: ${selectedPath}`);
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
            allowExternalMemorySharing: aiSettings?.allowExternalMemorySharing !== false,
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

      setAiSettings(normalizeCodexSettings(runtimeAiSettings));
      setAiApiKeyInput('');
      setClearStoredApiKey(false);
      if (!runtimeAiSettings.enabled) {
        await refreshStoryState();
        setStatus(
          'Trama salvata. Abilita prima il consenso AI nelle Impostazioni AI per creare la struttura.',
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

      setStatus('AI sta creando la struttura della trama...');
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
        setStatus('Richiesta AI annullata');
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
        setStatus('AI sta raffinando la struttura della trama...');
        const repairResponse = await window.novelistApi.codexAssist({
          projectName: currentProject.name,
          message:
            'Correggi il seguente output e restituisci solo JSON valido nel formato {"blocks":[{"title":"...","description":"..."}]}. Devono esserci da 4 a 12 blocchi narrativi ordinati cronologicamente, con titolo e descrizione per ogni blocco. Non aggiungere testo fuori dal JSON.',
          context: `${structureRequestContext}\n\nOutput precedente da correggere:\n${response.output}`,
        });

        if (repairResponse.cancelled || !repairResponse.output.trim()) {
          await refreshStoryState();
          setStatus('Richiesta AI annullata');
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
          sourceId: createdNodes[index - 1]!.id,
          targetId: createdNodes[index]!.id,
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
      void syncProjectWikiAfterWorkspaceChange();
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
      if (node.type === 'chapter') {
        const data = node.data as ChapterFlowNodeData;
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
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore nel salvataggio posizione blocco');
    }
  };

  const handleNodeClick: NodeMouseHandler<ChapterCanvasNode> = (_event, node) => {
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
    [
      editBlockNumber,
      editDescription,
      editNodeId,
      editPlotNumber,
      editTitle,
      isStoryEditDirty,
      nodes,
      plots,
    ],
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
    [plotsById],
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
          label: normalizePlotLabel(plot.number, plot.label),
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
        <p>Scrivi la tua storia da professionista</p>
        <div className="workspace-tabs">
          <button
            type="button"
            className={activeTab === 'dashboard' ? 'tab-active' : ''}
            onClick={() => setActiveTab('dashboard')}
          >
            Cruscotto
          </button>
          <button
            type="button"
            className={activeTab === 'outline' ? 'tab-active' : ''}
            onClick={() => setActiveTab('outline')}
            disabled={!currentProject}
          >
            Scaletta
          </button>
          <button
            type="button"
            className={activeTab === 'timeline' ? 'tab-active' : ''}
            onClick={() => setActiveTab('timeline')}
            disabled={!currentProject}
          >
            Timeline
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
            className={activeTab === 'story' ? 'tab-active' : ''}
            onClick={() => setActiveTab('story')}
            disabled={!currentProject}
          >
            Capitoli
          </button>
          <button
            type="button"
            className={activeTab === 'scenes' ? 'tab-active' : ''}
            onClick={() => setActiveTab('scenes')}
            disabled={!currentProject}
          >
            Scene
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
            className={activeTab === 'revisions' ? 'tab-active' : ''}
            onClick={() => setActiveTab('revisions')}
            disabled={!currentProject}
          >
            Revisioni
          </button>
          <button
            type="button"
            className={activeTab === 'analysis' ? 'tab-active' : ''}
            onClick={() => setActiveTab('analysis')}
            disabled={!currentProject}
          >
            Analisi
          </button>
          <button
            type="button"
            className={activeTab === 'memory' ? 'tab-active' : ''}
            onClick={openMemoryTab}
            disabled={!currentProject}
          >
            Memoria
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

      {activeTab === 'dashboard' ? (
        <section className="dashboard-workspace">
          <section className="panel dashboard-project-panel">
            <div>
              <h2>Cruscotto</h2>
              <p className="muted project-summary">
                {currentProject ? (
                  <>
                    Progetto aperto: <strong>{currentProject.name}</strong>
                  </>
                ) : (
                  'Nessun progetto aperto.'
                )}
              </p>
            </div>
            <div className="dashboard-project-actions">
              <button
                type="button"
                className="sidebar-action-button"
                onClick={() => {
                  setCreateProjectRoot('');
                  setCreateProjectName(DEFAULT_PROJECT_NAME);
                  setCreateProjectTargetWords('');
                  setCreateProjectTargetChapterWords('');
                  setCreateProjectCompletionDate('');
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
                disabled={!canSaveProject || !hasUnsavedChanges}
              >
                Salva
              </button>
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
                onClick={() => void handlePrintManuscript()}
                disabled={!currentProject || busy}
              >
                Stampa
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
          </section>

          {!currentProject ? (
            <section className="panel dashboard-empty-panel">
              <h2>Nessun progetto aperto</h2>
              <p className="muted">
                Crea un nuovo progetto o aprine uno esistente per vedere stato manoscritto,
                capitoli, schede, memoria, snapshot e impostazioni.
              </p>
              <p className={`status status-${statusTone}`}>
                <span>{status}</span>
              </p>
              {error ? <p className="error">{error}</p> : null}
            </section>
          ) : (
            <>
              <section className="dashboard-summary-grid">
                <article className="panel dashboard-stat-card">
                  <span className="dashboard-stat-label">Parole totali</span>
                  <strong>{dashboard.totalWords}</strong>
                  <span className="muted">{dashboard.chapterMetrics.length} capitoli</span>
                </article>
                <article className="panel dashboard-stat-card">
                  <span className="dashboard-stat-label">Trame</span>
                  <strong>{plots.length}</strong>
                  <span className="muted">
                    {dashboard.disconnectedChapters.length} capitoli non collegati
                  </span>
                </article>
                <article className="panel dashboard-stat-card">
                  <span className="dashboard-stat-label">Capitoli</span>
                  <strong>{dashboard.chapterMetrics.length}</strong>
                  <span className="muted">
                    {dashboard.chaptersWithoutDescription.length} senza descrizione
                  </span>
                </article>
                <article className="panel dashboard-stat-card">
                  <span className="dashboard-stat-label">Scene</span>
                  <strong>{dashboard.sceneCount}</strong>
                  <span className="muted">{dashboard.scenesWithoutText.length} senza testo</span>
                </article>
                <article className="panel dashboard-stat-card">
                  <span className="dashboard-stat-label">Personaggi</span>
                  <strong>{dashboard.characterCount}</strong>
                  <span className="muted">{dashboard.unusedCharacters.length} non usati</span>
                </article>
                <article className="panel dashboard-stat-card">
                  <span className="dashboard-stat-label">Location</span>
                  <strong>{dashboard.locationCount}</strong>
                  <span className="muted">{dashboard.unusedLocations.length} non usate</span>
                </article>
              </section>

              {dashboardGoalMetrics ? (
                <section className="panel dashboard-goals-panel">
                  <header>
                    <div>
                      <h2>Obiettivi</h2>
                      <p className="muted">
                        Target e proiezioni calcolati sui salvataggi del manoscritto.
                      </p>
                    </div>
                    <div className="dashboard-goals-actions">
                      <button
                        type="button"
                        className={`dashboard-delivery-status ${dashboardGoalMetrics.deliveryTone}`}
                        onClick={openProjectTargetsModal}
                        disabled={!currentProject || busy}
                      >
                        {dashboardGoalMetrics.deliveryStatus}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => void refreshDashboardData()}
                        disabled={dashboard.loading || busy}
                      >
                        {dashboard.loading ? 'Aggiorno...' : 'Aggiorna Cruscotto'}
                      </button>
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => void handleWikiSync()}
                        disabled={!wikiStatus?.derivedPending || wikiBusy || busy}
                      >
                        {wikiBusy ? 'Aggiorno Memoria...' : 'Aggiorna Memoria'}
                      </button>
                    </div>
                  </header>

                  <div className="dashboard-goals-grid">
                    <article className="dashboard-goal-metric">
                      <span>Target progetto</span>
                      <strong>{formatInteger(dashboardGoalMetrics.targetWordCount)}</strong>
                      <small>parole</small>
                    </article>
                    <article className="dashboard-goal-metric">
                      <span>Target capitolo</span>
                      <strong>{formatInteger(dashboardGoalMetrics.targetChapterWordCount)}</strong>
                      <small>parole</small>
                    </article>
                    <article className="dashboard-goal-metric">
                      <span>Completamento</span>
                      <strong>{formatDate(dashboardGoalMetrics.plannedCompletionDate)}</strong>
                      <small>data prevista</small>
                    </article>
                    <article className="dashboard-goal-metric">
                      <span>Cartelle editoriali</span>
                      <strong>{formatInteger(dashboardGoalMetrics.editorialFolders)}</strong>
                      <small>stima 1.800 battute</small>
                    </article>
                    <article className="dashboard-goal-metric">
                      <span>Ritmo richiesto</span>
                      <strong>{formatInteger(dashboardGoalMetrics.requiredWordsPerDay)}</strong>
                      <small>parole/giorno</small>
                    </article>
                    <article className="dashboard-goal-metric">
                      <span>Restanti</span>
                      <strong>{formatInteger(dashboardGoalMetrics.remainingWords)}</strong>
                      <small>parole</small>
                    </article>
                  </div>

                  <div className="dashboard-chart-grid">
                    <article className="dashboard-chart-card">
                      <h3>Avanzamento</h3>
                      <ProgressPie percent={dashboardGoalMetrics.progressPercent} />
                    </article>
                    <article className="dashboard-chart-card">
                      <h3>Parole per sessione</h3>
                      <SessionBars sessions={dashboard.writingSessions} />
                    </article>
                    <article className="dashboard-chart-card">
                      <h3>Consegna</h3>
                      <DeliveryBars metrics={dashboardGoalMetrics} />
                      <p className="muted">
                        Stima:{' '}
                        {dashboardGoalMetrics.estimatedCompletionDate
                          ? formatDate(dashboardGoalMetrics.estimatedCompletionDate)
                          : '-'}
                      </p>
                    </article>
                  </div>
                </section>
              ) : null}

              <section className="dashboard-grid">
                <article className="panel dashboard-section dashboard-section-wide">
                  <h2>Riepilogo</h2>
                  <dl className="dashboard-detail-list">
                    <div>
                      <dt>Ultimo capitolo modificato</dt>
                      <dd>
                        {dashboard.lastModifiedChapter ? (
                          <>
                            <strong>{dashboard.lastModifiedChapter.title}</strong>
                            <span>{formatDateTime(dashboard.lastModifiedChapter.updatedAt)}</span>
                          </>
                        ) : (
                          '-'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Ultimo snapshot</dt>
                      <dd>
                        {dashboard.latestSnapshot ? (
                          <>
                            <strong>{dashboard.latestSnapshot.fileName}</strong>
                            <span>{formatDateTime(dashboard.latestSnapshot.createdAt)}</span>
                          </>
                        ) : (
                          'Nessuno snapshot'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Memoria Wiki</dt>
                      <dd>
                        {wikiStatus ? (
                          <>
                            <strong>
                              {wikiStatus.derivedPending ? 'Da aggiornare' : 'Aggiornata'}
                            </strong>
                            <span>{formatDateTime(wikiStatus.updatedAt)}</span>
                          </>
                        ) : (
                          'Non disponibile'
                        )}
                      </dd>
                    </div>
                    <div>
                      <dt>Autosave</dt>
                      <dd>{formatAutosaveLabel(appPreferences)}</dd>
                    </div>
                    <div>
                      <dt>AI</dt>
                      <dd>
                        {aiSettings?.enabled
                          ? `${getAiProviderLabel(aiSettings.provider)} con fallback ${getAiFallbackLabel(
                              aiSettings.fallbackProvider,
                            )}`
                          : 'Disattivata'}
                      </dd>
                    </div>
                  </dl>
                  {dashboard.error ? <p className="error">{dashboard.error}</p> : null}
                </article>

                <article className="panel dashboard-section">
                  <h2>Parole per Capitolo</h2>
                  {dashboard.chapterMetrics.length > 0 ? (
                    <div className="dashboard-chapter-list">
                      {dashboard.chapterMetrics.map((chapter) => (
                        <div className="dashboard-chapter-row" key={chapter.id}>
                          <span>
                            {chapter.plotNumber}.{chapter.blockNumber} {chapter.title}
                          </span>
                          <strong>{chapter.wordCount}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Nessun capitolo creato.</p>
                  )}
                </article>

                <article className="panel dashboard-section">
                  <h2>Capitoli da controllare</h2>
                  <ul className="dashboard-check-list">
                    <li>
                      <strong>{dashboard.chaptersWithoutDescription.length}</strong> senza
                      descrizione
                    </li>
                    <li>
                      <strong>{dashboard.chaptersWithStaleDescription.length}</strong> con
                      descrizione potenzialmente vecchia
                    </li>
                    <li>
                      <strong>{dashboard.chaptersWithoutCharacters.length}</strong> senza personaggi
                      collegati
                    </li>
                    <li>
                      <strong>{dashboard.chaptersWithoutLocations.length}</strong> senza location
                      collegate
                    </li>
                    <li>
                      <strong>{dashboard.chaptersWithoutScenes.length}</strong> senza scene
                      collegate
                    </li>
                    <li>
                      <strong>{dashboard.disconnectedChapters.length}</strong> non collegati nel
                      canvas
                    </li>
                  </ul>
                </article>

                <article className="panel dashboard-section">
                  <h2>Parole per Scena</h2>
                  {dashboard.sceneMetrics.length > 0 ? (
                    <div className="dashboard-chapter-list">
                      {dashboard.sceneMetrics.map((scene) => (
                        <div className="dashboard-chapter-row" key={scene.id}>
                          <span>
                            {scene.plotNumber} · {scene.name}
                            <small>{scene.chapterTitle}</small>
                          </span>
                          <strong>{scene.wordCount}</strong>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">Nessuna scena creata.</p>
                  )}
                </article>

                <article className="panel dashboard-section">
                  <h2>Scene da controllare</h2>
                  <ul className="dashboard-check-list">
                    <li>
                      <strong>{dashboard.scenesWithoutText.length}</strong> senza testo
                    </li>
                    <li>
                      <strong>{dashboard.unusedScenes.length}</strong> senza capitolo valido
                    </li>
                    <li>
                      <strong>{dashboard.disconnectedScenes.length}</strong> non collegate nel
                      canvas
                    </li>
                  </ul>
                </article>

                <article className="panel dashboard-section dashboard-section-wide">
                  <h2>Schede non usate</h2>
                  <div className="dashboard-unused-grid">
                    <div>
                      <h3>Personaggi</h3>
                      {dashboard.unusedCharacters.length > 0 ? (
                        <ul>
                          {dashboard.unusedCharacters.slice(0, 8).map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Nessuna scheda personaggio isolata.</p>
                      )}
                    </div>
                    <div>
                      <h3>Location</h3>
                      {dashboard.unusedLocations.length > 0 ? (
                        <ul>
                          {dashboard.unusedLocations.slice(0, 8).map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Nessuna scheda location isolata.</p>
                      )}
                    </div>
                    <div>
                      <h3>Scene</h3>
                      {dashboard.unusedScenes.length > 0 ? (
                        <ul>
                          {dashboard.unusedScenes.slice(0, 8).map((name) => (
                            <li key={name}>{name}</li>
                          ))}
                        </ul>
                      ) : dashboard.scenesWithoutText.length > 0 ? (
                        <ul>
                          {dashboard.scenesWithoutText.slice(0, 8).map((name) => (
                            <li key={name}>{name} senza testo</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="muted">Nessuna scheda scena isolata.</p>
                      )}
                    </div>
                  </div>
                </article>
              </section>

              <section className="panel status-panel">
                <p className={`status status-${statusTone}`}>
                  <span>{status}</span>
                  {workspaceNotice ? (
                    <span className="status-inline-notice">{workspaceNotice}</span>
                  ) : null}
                </p>
                {error ? <p className="error">{error}</p> : null}
              </section>
            </>
          )}
        </section>
      ) : null}

      {activeTab === 'outline' ? (
        currentProject ? (
          <section className="outline-workspace">
            <section className="panel outline-header-panel">
              <div>
                <h2>Scaletta</h2>
                <p className="muted">
                  Vista editoriale lineare ricostruita dai collegamenti del canvas Capitoli.
                </p>
              </div>
              <div className="outline-header-actions">
                <span className="outline-summary-pill">{outline.chapters.length} capitoli</span>
                <span className="outline-summary-pill warning">
                  {outline.isolatedCount} isolati
                </span>
                <span className="outline-summary-pill warning">
                  {outline.ambiguousCount} ambigui
                </span>
                <button
                  type="button"
                  onClick={() => void refreshOutlineData()}
                  disabled={outline.loading || outline.saving || readingViewLoading || busy}
                >
                  {outline.loading ? 'Aggiorno...' : 'Aggiorna Scaletta'}
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
                  {readingViewLoading ? 'Apro...' : 'Apri Documento completo'}
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
                                  ? normalizePlotLabel(chapter.plot.number, chapter.plot.label)
                                  : `Trama ${chapter.node.plotNumber}`}
                              </p>
                              <h3>{chapter.node.title}</h3>
                            </div>
                            <button
                              type="button"
                              className="button-secondary"
                              onClick={() => void openChapterReadingView(chapter)}
                              disabled={outline.saving || readingViewLoading || busy}
                            >
                              Apri
                            </button>
                          </header>

                          <p className="outline-description">
                            {chapter.node.description.trim() || 'Nessun riassunto disponibile.'}
                          </p>

                          <div className="outline-connection-row">
                            <span>
                              Da:{' '}
                              <strong>
                                {incomingTitles.length > 0 ? incomingTitles.join(', ') : '-'}
                              </strong>
                            </span>
                            <span>
                              A:{' '}
                              <strong>
                                {outgoingTitles.length > 0 ? outgoingTitles.join(', ') : '-'}
                              </strong>
                            </span>
                          </div>

                          <div className="outline-reference-grid">
                            <div>
                              <span>Scene</span>
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
                              <span>Personaggi</span>
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
                              <span>Location</span>
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
                    <p className="muted">Nessun capitolo presente nella scaletta.</p>
                  </section>
                )}
              </div>

              <aside className="panel outline-side-panel">
                <h2>Trame</h2>
                <div className="outline-plot-list">
                  {plots.map((plot) => (
                    <div key={plot.id}>
                      <span
                        className="outline-plot-swatch"
                        style={{ backgroundColor: getPlotColor(plot.number, plots) }}
                      />
                      <strong>{normalizePlotLabel(plot.number, plot.label)}</strong>
                    </div>
                  ))}
                </div>
                <h2>Segnalazioni</h2>
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
                  <p className="muted">Nessuna criticita strutturale rilevata.</p>
                )}
                {outline.error ? <p className="error">{outline.error}</p> : null}
              </aside>
            </section>

            <section className="panel status-panel">
              <p className={`status status-${statusTone}`}>
                <span>{outline.saving ? 'Sincronizzazione scaletta...' : status}</span>
                {workspaceNotice ? (
                  <span className="status-inline-notice">{workspaceNotice}</span>
                ) : null}
              </p>
              {error ? <p className="error">{error}</p> : null}
            </section>
          </section>
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto per visualizzare la scaletta.</p>
          </section>
        )
      ) : null}

      {activeTab === 'timeline' ? (
        currentProject ? (
          <TimelineBoard onStatus={setStatus} />
        ) : (
          <section className="workspace empty-workspace">
            <p>Apri o crea un progetto per usare la timeline.</p>
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
                Nuovo Capitolo
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
              onNodeClick={handleNodeClick}
              onConnect={(connection) => void handleConnect(connection)}
              onSelectionChange={onSelectionChange}
              onEdgeClick={onEdgeClick}
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
                  Nuova Trama
                </button>
              </div>

              <div className="panel">
                <h2>Selezione</h2>
                <p>
                  Trama:{' '}
                  <strong>
                    {selectedPlot
                      ? normalizePlotLabel(selectedPlot.number, selectedPlot.label)
                      : '-'}
                  </strong>
                </p>
                <p>
                  Numero: <strong>{selectedPlot?.number ?? '-'}</strong>
                </p>
                <p className="selection-summary">
                  Sinossi: <strong>{selectedPlot?.summary.trim() || '-'}</strong>
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
            <p>Apri o crea un progetto nella scheda "Struttura Storia" per gestire le trame.</p>
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
          />
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto nella scheda "Struttura Storia" per gestire le scene.</p>
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
            workspaceNotice={workspaceNotice}
            onStatus={handleWorkspaceStatus}
            onDirtyChange={setLocationBoardDirty}
            onRegisterFlush={(handler) => {
              locationBoardFlushRef.current = handler;
            }}
            onWikiSync={syncProjectWikiAfterWorkspaceChange}
          />
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto nella scheda "Struttura Storia" per gestire le location.</p>
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
          />
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto per gestire revisioni e versioni.</p>
          </section>
        )
      ) : null}

      {activeTab === 'analysis' ? (
        currentProject ? (
          <AnalysisBoard currentProject={currentProject} onStatus={handleWorkspaceStatus} />
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto per usare gli strumenti di analisi.</p>
          </section>
        )
      ) : null}

      {activeTab === 'memory' ? (
        currentProject ? (
          <section className="memory-workspace">
            <div className="panel memory-hero">
              <div>
                <p className="eyebrow">Memoria progetto</p>
                <h2>Riassunto storia</h2>
                <p className="muted memory-story-summary">
                  {memoryStorySummaryBusy
                    ? 'Sintesi AI in corso...'
                    : memoryStorySummary || memoryStorySummaryFallback}
                </p>
              </div>
              <div className="memory-status-card">
                <span
                  className={
                    wikiStatus?.derivedPending ? 'memory-status-dot pending' : 'memory-status-dot'
                  }
                />
                <div>
                  <strong>{wikiStatus?.derivedPending ? 'Da aggiornare' : 'Aggiornata'}</strong>
                  <p>
                    {wikiStatus
                      ? `${wikiStatus.sourceCount} fonti indicizzate`
                      : 'Stato memoria non disponibile'}
                  </p>
                  <small>
                    {wikiStatus?.updatedAt
                      ? `Ultimo sync: ${new Date(wikiStatus.updatedAt).toLocaleString()}`
                      : 'Nessun sync registrato'}
                  </small>
                  <div className="memory-status-actions">
                    <button type="button" onClick={() => void handleWikiSync()} disabled={wikiBusy}>
                      Aggiorna
                    </button>
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => void refreshWikiStatus()}
                      disabled={wikiBusy}
                    >
                      Rileggi stato
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {wikiError ? (
              <section className="panel memory-error-panel">
                <h2>Errore memoria</h2>
                <p>{wikiError}</p>
              </section>
            ) : null}

            <section className="panel memory-search-panel">
              <h2>Ricerca</h2>
              <form
                className="memory-search-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleWikiSearch();
                }}
              >
                <label>
                  Cerca nella wiki locale
                  <input
                    type="search"
                    value={wikiSearchQuery}
                    onChange={(event) => setWikiSearchQuery(event.target.value)}
                    placeholder="es. magazzino, patto, Tizio..."
                    disabled={wikiBusy}
                  />
                </label>
                <button type="submit" disabled={wikiBusy || !wikiSearchQuery.trim()}>
                  Cerca
                </button>
              </form>
            </section>

            <details className="panel memory-results-panel memory-collapsible-panel" open>
              <summary>Risultati</summary>
              {wikiSearchResults.length > 0 ? (
                <div className="memory-results">
                  {wikiSearchResults.map((result) => (
                    <article className="memory-result-card memory-answer-card" key={result.path}>
                      <strong>{formatWikiResultTitle(result)}</strong>
                      <p>{result.snippet}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Nessun risultato da mostrare. Esegui una ricerca per verificare cosa vede la AI.
                </p>
              )}
            </details>

            <details className="panel memory-results-panel memory-collapsible-panel" open>
              <summary>Fonti ricerca</summary>
              {wikiSearchResults.length > 0 ? (
                <div className="memory-results">
                  {wikiSearchResults.map((result) => (
                    <article className="memory-result-card" key={`search-source-${result.path}`}>
                      <div className="memory-result-header">
                        <strong>{formatWikiResultTitle(result)}</strong>
                        <span>{formatWikiCategoryLabel(result.category)}</span>
                      </div>
                      <code>{result.path}</code>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">Le fonti della ricerca appariranno dopo una ricerca.</p>
              )}
            </details>

            <details className="panel memory-results-panel memory-collapsible-panel" open>
              <summary>Fonti ultima risposta AI</summary>
              {lastAiMemorySources.length > 0 ? (
                <div className="memory-results">
                  {lastAiMemorySources.map((source) => (
                    <article className="memory-result-card" key={`last-ai-${source.path}`}>
                      <div className="memory-result-header">
                        <strong>{source.title}</strong>
                        <span>{formatWikiCategoryLabel(source.category)}</span>
                      </div>
                      <code>{source.path}</code>
                      <p>{source.snippet}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="muted">
                  Nessuna fonte registrata per l'ultima risposta AI in questa sessione.
                </p>
              )}
            </details>
          </section>
        ) : (
          <section className="panel">
            <p>Apri o crea un progetto nella scheda "Struttura Storia" per usare la memoria.</p>
          </section>
        )
      ) : null}

      {isAiSettingsModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card settings-modal-card">
            <h3>Impostazioni</h3>
            <details className="panel panel-subsection settings-section" open>
              <summary>Salvataggio Automatico</summary>
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
            </details>

            <details className="panel panel-subsection settings-section" open>
              <summary>Impostazioni AI</summary>
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
                            fallbackProvider:
                              prev.fallbackProvider === event.target.value
                                ? 'none'
                                : prev.fallbackProvider,
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
              <label>
                Fallback se il provider non risponde
                <select
                  value={aiSettings?.fallbackProvider ?? 'none'}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            fallbackProvider: event.target
                              .value as CodexSettings['fallbackProvider'],
                          }
                        : prev,
                    )
                  }
                  disabled={!aiSettings}
                >
                  {getAiFallbackOptions(aiSettings?.provider ?? 'codex_cli').map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                Provider primario: {getAiProviderLabel(aiSettings?.provider ?? 'codex_cli')}.
                Fallback: {getAiFallbackLabel(aiSettings?.fallbackProvider ?? 'none')}.
              </p>
              <label>
                Modello API
                <input
                  value={aiSettings?.apiModel ?? DEFAULT_API_MODEL}
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
                  placeholder={DEFAULT_API_MODEL}
                  disabled={!aiSettings}
                />
              </label>
              <label>
                Modello API immagini
                <input
                  value={
                    aiSettings
                      ? normalizeCodexSettings(aiSettings).apiImageModel
                      : DEFAULT_API_IMAGE_MODEL
                  }
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            apiImageModel: event.target.value,
                          }
                        : prev,
                    )
                  }
                  placeholder={DEFAULT_API_IMAGE_MODEL}
                  disabled={!aiSettings}
                />
              </label>
              <label>
                Modello Ollama
                <input
                  value={aiSettings ? normalizeCodexSettings(aiSettings).ollamaModel : DEFAULT_OLLAMA_MODEL}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            ollamaModel: event.target.value,
                          }
                        : prev,
                    )
                  }
                  placeholder={DEFAULT_OLLAMA_MODEL}
                  disabled={!aiSettings}
                />
              </label>
              {!currentProject ? (
                <p className="muted">
                  Le impostazioni AI restano legate al progetto aperto e sono disabilitate finché
                  non ne apri uno.
                </p>
              ) : null}
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => void handleSaveAiSettings()}
                  disabled={!aiSettings || aiSettingsBusy || !currentProject}
                >
                  Salva Impostazioni AI
                </button>
              </div>
            </details>

            <details className="panel panel-subsection settings-section" open>
              <summary>Consensi</summary>
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
              <p className="muted">
                Richiesto per OpenAI API e per l'endpoint HTTP locale di Ollama.
              </p>
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
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={aiSettings ? aiSettings.allowExternalMemorySharing !== false : false}
                  disabled={!aiSettings}
                  onChange={(event) =>
                    setAiSettings((prev) =>
                      prev
                        ? {
                            ...prev,
                            allowExternalMemorySharing: event.target.checked,
                          }
                        : prev,
                    )
                  }
                />
                <span>Consenso invio memoria progetto a provider esterni</span>
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
              <p className="muted">
                Se disattivato, la chat AI non allega la wiki del progetto quando il provider o il
                fallback possono inviare il prompt fuori dal computer.
              </p>
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => void handleSaveAiSettings()}
                  disabled={!aiSettings || aiSettingsBusy || !currentProject}
                >
                  Salva Consensi
                </button>
              </div>
            </details>

            <details className="panel panel-subsection settings-section">
              <summary>Segreti</summary>
              <label>
                API Key
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
                <button
                  type="button"
                  onClick={() => void handleSaveAiSettings()}
                  disabled={!aiSettings || aiSettingsBusy || !currentProject}
                >
                  Salva Segreti
                </button>
              </div>
            </details>
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

      {activeTab === 'dashboard' && isCreateProjectModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Crea Progetto</h3>
            <label>
              Cartella di lavoro
              <div className="input-with-button">
                <input
                  value={createProjectRoot}
                  placeholder="Seleziona la cartella che conterra il progetto"
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
            <div className="grid-two">
              <label>
                Target parole progetto
                <input
                  type="number"
                  min={1}
                  value={createProjectTargetWords}
                  onChange={(event) => setCreateProjectTargetWords(event.target.value)}
                  placeholder="Es. 80000"
                />
              </label>
              <label>
                Target parole capitolo
                <input
                  type="number"
                  min={1}
                  value={createProjectTargetChapterWords}
                  onChange={(event) => setCreateProjectTargetChapterWords(event.target.value)}
                  placeholder="Es. 3000"
                />
              </label>
            </div>
            <label>
              Data prevista di completamento
              <input
                type="date"
                value={createProjectCompletionDate}
                onChange={(event) => setCreateProjectCompletionDate(event.target.value)}
              />
            </label>
            <p className="muted">
              The Novelist creera una sottocartella con il nome del progetto e salvera li database,
              asset, snapshot e memoria.
            </p>
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsCreateProjectModalOpen(false)}
                disabled={busy}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void handleCreateProject()}
                disabled={!canCreateProject}
              >
                Crea e Apri
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {activeTab === 'dashboard' && isProjectTargetsModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Obiettivi progetto</h3>
            <div className="grid-two">
              <label>
                Target parole progetto
                <input
                  type="number"
                  min={1}
                  value={editProjectTargetWords}
                  onChange={(event) => setEditProjectTargetWords(event.target.value)}
                  placeholder="Es. 80000"
                />
              </label>
              <label>
                Target parole capitolo
                <input
                  type="number"
                  min={1}
                  value={editProjectTargetChapterWords}
                  onChange={(event) => setEditProjectTargetChapterWords(event.target.value)}
                  placeholder="Es. 3000"
                />
              </label>
            </div>
            <label>
              Data prevista di completamento
              <input
                type="date"
                value={editProjectCompletionDate}
                onChange={(event) => setEditProjectCompletionDate(event.target.value)}
              />
            </label>
            <p className="muted">
              Lascia un campo vuoto per rimuovere il relativo obiettivo dal cruscotto.
            </p>
            <div className="row-buttons modal-actions">
              <button
                type="button"
                className="button-secondary"
                onClick={() => setIsProjectTargetsModalOpen(false)}
                disabled={busy}
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => void handleSaveProjectTargets()}
                disabled={!canSaveProjectTargets}
              >
                Salva obiettivi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {(activeTab === 'story' || activeTab === 'plots') && isPlotModalOpen ? (
        <div className="modal-overlay">
          <div className="modal-card">
            <h3>Nuova Trama</h3>
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
                Trama esistente:{' '}
                <strong>{existingPlotForNewNumber.label || '(senza etichetta)'}</strong>. Modificala
                dal tab Trame con doppio click sul blocco.
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
              <button
                type="button"
                onClick={() => void handleCreatePlot()}
                disabled={!canCreatePlot}
              >
                Crea Trama
              </button>
              <button
                type="button"
                className={plotStructureBusy ? 'ai-working' : undefined}
                onClick={() => void handleCreatePlotStructure()}
                disabled={!canCreatePlotStructure}
              >
                {plotStructureBusy ? 'In Creazione...' : 'Crea Capitoli'}
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
              Trama
              <select
                value={newNodePlotNumber}
                onChange={(event) =>
                  setNewNodePlotNumber(Math.max(1, Number(event.target.value) || 1))
                }
              >
                {plots.length > 0 ? (
                  plots.map((plot) => (
                    <option key={plot.id} value={plot.number}>
                      {normalizePlotLabel(plot.number, plot.label)}
                    </option>
                  ))
                ) : (
                  <option value={newNodePlotNumber}>{`Trama ${newNodePlotNumber}`}</option>
                )}
              </select>
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
          onMemorySources={setLastAiMemorySources}
        />
      ) : null}

      {readingView ? (
        <section className="reading-view-overlay" role="dialog" aria-modal="true">
          <header className="reading-view-header">
            <div>
              <p>{readingView.subtitle}</p>
              <h1>{readingView.title}</h1>
            </div>
            <button type="button" className="button-secondary" onClick={() => setReadingView(null)}>
              Chiudi
            </button>
          </header>
          <div className="reading-view-scroll">
            <div className="reading-view-document">
              {readingView.chapters.map((chapter) => (
                <article key={chapter.id} className="reading-view-chapter">
                  {readingView.chapters.length > 1 ? <h2>{chapter.title}</h2> : null}
                  <div className="reading-view-content">{renderReadingDocument(chapter.document)}</div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
