import { useCallback, useMemo, useRef, useState } from 'react';
import type { ProjectRecord } from '../project/project-session';
import type { Translate } from '../../i18n';

const MEMORY_SUMMARY_STORAGE_PREFIX = 'the-novelist.memory-summary.v1';

export interface MemorySummaryPlot {
  id: string;
  number: number;
  label: string;
  summary: string;
  updatedAt: string;
}

interface MemorySummaryStateOptions {
  aiEnabled: boolean;
  currentProject: ProjectRecord | null;
  plots: MemorySummaryPlot[];
  t: Translate;
}

function normalizePlotLabel(plotNumber: number, label: string, t: Translate): string {
  return label.trim() || `${t('common.plot')} ${plotNumber}`;
}

function sortPlots(records: MemorySummaryPlot[]): MemorySummaryPlot[] {
  return [...records].sort((left, right) => left.number - right.number);
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

function getPlotSummaryLines(plots: MemorySummaryPlot[], t: Translate): string[] {
  return sortPlots(plots)
    .map((plot) => {
      const summary = plot.summary.trim();
      if (!summary) {
        return null;
      }
      return `${normalizePlotLabel(plot.number, plot.label, t)}: ${summary}`;
    })
    .filter((summary): summary is string => Boolean(summary));
}

export function buildMemoryStorySummary(plots: MemorySummaryPlot[], t: Translate): string {
  const plotSummaries = getPlotSummaryLines(plots, t);

  if (plotSummaries.length === 0) {
    return t('memory.storySummary.empty');
  }

  return plotSummaries
    .slice(0, 5)
    .map((line) => truncateSummaryLine(line))
    .join('\n');
}

function buildMemorySummaryContext(plots: MemorySummaryPlot[], t: Translate): string {
  const lines = getPlotSummaryLines(plots, t);
  return lines.length > 0 ? lines.join('\n') : t('memory.storySummary.noPlotSummary');
}

function buildMemorySummaryKey(project: ProjectRecord | null, plots: MemorySummaryPlot[]): string {
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

export function useMemorySummaryState({
  aiEnabled,
  currentProject,
  plots,
  t,
}: MemorySummaryStateOptions) {
  const [memoryStorySummary, setMemoryStorySummary] = useState<string>('');
  const [memoryStorySummaryBusy, setMemoryStorySummaryBusy] = useState<boolean>(false);
  const memoryStorySummaryKeyRef = useRef<string>('');
  const memoryStorySummaryFallback = useMemo(() => buildMemoryStorySummary(plots, t), [plots, t]);
  const memoryStorySummaryKey = useMemo(
    () => buildMemorySummaryKey(currentProject, plots),
    [currentProject, plots],
  );

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

      if (!aiEnabled) {
        return;
      }

      setMemoryStorySummaryBusy(true);
      try {
        const response = await window.novelistApi.codexAssist({
          projectName: currentProject.name,
          message: t('memory.storySummary.prompt'),
          context: buildMemorySummaryContext(plots, t),
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
      aiEnabled,
      currentProject,
      memoryStorySummary,
      memoryStorySummaryFallback,
      memoryStorySummaryKey,
      plots,
      t,
    ],
  );

  return {
    memoryStorySummary,
    memoryStorySummaryBusy,
    memoryStorySummaryFallback,
    refreshMemoryStorySummary,
  };
}
