import type { Node } from '@xyflow/react';
import type { ChapterFlowNodeData } from '../../ChapterFlowNode';
import type { PlotFlowNodeData } from '../../PlotFlowNode';

export interface PlotFlowRecord {
  id: string;
  number: number;
  label: string;
  summary: string;
  color: string;
  positionX: number;
  positionY: number;
}

export interface ChapterFlowRecord {
  id: string;
  title: string;
  description: string;
  plotNumber: number;
  blockNumber: number;
  positionX: number;
  positionY: number;
}

export type ChapterCanvasNode = Node<ChapterFlowNodeData, 'chapter'>;
export type PlotCanvasNode = Node<PlotFlowNodeData, 'plot'>;

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

export function getPlotColor(plotNumber: number, plots: PlotFlowRecord[]): string {
  return plots.find((plot) => plot.number === plotNumber)?.color ?? colorFromPlotNumber(plotNumber);
}

export function normalizePlotLabel(
  plotNumber: number,
  label: string,
  fallbackPrefix = 'Trama',
): string {
  const trimmed = label.trim();
  const defaultLabelPattern = new RegExp(`^(Trama|Plot)\\s+${plotNumber}$`, 'i');
  if (!trimmed || defaultLabelPattern.test(trimmed)) {
    return `${fallbackPrefix} ${plotNumber}`;
  }
  return trimmed;
}

export function sortPlots<T extends { number: number }>(records: T[]): T[] {
  return [...records].sort((left, right) => left.number - right.number);
}

export function mapNodeRecordToFlowNode(
  record: ChapterFlowRecord,
  plots: PlotFlowRecord[],
  labels?: {
    noDescriptionLabel?: string;
    plotLabel?: string;
  },
): ChapterCanvasNode {
  const color = getPlotColor(record.plotNumber, plots);
  const plot = plots.find((item) => item.number === record.plotNumber);

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
      noDescriptionLabel: labels?.noDescriptionLabel,
      plotLabel: normalizePlotLabel(record.plotNumber, plot?.label ?? '', labels?.plotLabel),
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

export function getDefaultPlotPosition(plotNumber: number): { x: number; y: number } {
  const index = Math.max(0, plotNumber - 1);
  const column = index % 2;
  const row = Math.floor(index / 2);

  return {
    x: 120 + column * 340,
    y: 120 + row * 220,
  };
}

function getSafePlotPosition(plot: Pick<PlotFlowRecord, 'number' | 'positionX' | 'positionY'>): {
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

function mapPlotRecordToFlowNode(
  record: PlotFlowRecord,
  fallbackPrefix: string,
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
      label: normalizePlotLabel(record.number, record.label, fallbackPrefix),
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

export function syncPlotFlowNodes(
  records: PlotFlowRecord[],
  previousNodes: PlotCanvasNode[],
  selectedPlotId: string | null,
  fallbackPrefix = 'Trama',
): PlotCanvasNode[] {
  const previousById = new Map(previousNodes.map((node) => [node.id, node]));

  return sortPlots(records).map((record) => {
    const nextNode = mapPlotRecordToFlowNode(record, fallbackPrefix, {
      selected: record.id === selectedPlotId,
    });
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
