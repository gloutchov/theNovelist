import type { CSSProperties } from 'react';
import { formatDateTime, formatInteger, formatPercent, parseTime } from '../../shared/formatters';

export type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
export type DashboardSnapshot = Awaited<
  ReturnType<(typeof window.novelistApi)['listSnapshots']>
>[number];
export type DashboardWritingSession = Awaited<
  ReturnType<(typeof window.novelistApi)['listWritingSessions']>
>[number];
export type DashboardCharacterCard = Awaited<
  ReturnType<(typeof window.novelistApi)['listCharacterCards']>
>[number];
export type DashboardLocationCard = Awaited<
  ReturnType<(typeof window.novelistApi)['listLocationCards']>
>[number];
export type DashboardSceneCard = Awaited<
  ReturnType<(typeof window.novelistApi)['listSceneCards']>
>[number];

export interface DashboardChapterMetric {
  id: string;
  title: string;
  plotNumber: number;
  blockNumber: number;
  wordCount: number;
  updatedAt: string;
  hasDescription: boolean;
  descriptionStale: boolean;
}

export interface DashboardSceneMetric {
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

export interface DashboardState {
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

export interface DashboardGoalMetrics {
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

export function createEmptyDashboardState(): DashboardState {
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

function getEditorialFoldersFromWords(wordCount: number | null | undefined): number | null {
  if (!wordCount || wordCount <= 0) {
    return null;
  }

  return Math.ceil(wordCount / 300);
}

export function buildDashboardGoalMetrics(
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

export function ProgressPie({ percent }: { percent: number | null }) {
  const normalizedPercent =
    percent === null || !Number.isFinite(percent) ? 0 : Math.max(0, Math.min(100, percent));
  const style = { '--progress': `${normalizedPercent}%` } as CSSProperties;

  return (
    <div className="dashboard-progress-pie" style={style} aria-label="Avanzamento percentuale">
      <span>{formatPercent(percent)}</span>
    </div>
  );
}

export function SessionBars({ sessions }: { sessions: DashboardWritingSession[] }) {
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

export function DeliveryBars({ metrics }: { metrics: DashboardGoalMetrics }) {
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

export function formatCharacterName(card: DashboardCharacterCard): string {
  const fullName = `${card.firstName} ${card.lastName}`.trim();
  return fullName || 'Personaggio senza nome';
}

export function formatLocationName(card: DashboardLocationCard): string {
  return card.name.trim() || 'Location senza nome';
}

export function formatSceneName(card: DashboardSceneCard): string {
  return card.name.trim() || 'Scena senza nome';
}

export function countWords(value: string): number {
  const text = value.trim();
  if (!text) {
    return 0;
  }
  return text.split(/\s+/).filter(Boolean).length;
}
