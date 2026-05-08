import type { Node } from '@xyflow/react';

const FALLBACK_MINIMAP_NODE_COLOR = '#64748b';
const BORDER_COLOR_PATTERN = /(#[0-9a-f]{3,8}\b|rgba?\([^)]+\)|hsla?\([^)]+\))/i;

function readDataColor(node: Node): string | null {
  const data = node.data as Record<string, unknown> | undefined;
  const color = data?.color ?? data?.plotColor;
  return typeof color === 'string' && color.trim() ? color : null;
}

function extractCssColor(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.match(BORDER_COLOR_PATTERN);
  return match?.[1] ?? null;
}

function readStyleColor(node: Node): string | null {
  const style = node.style as Record<string, unknown> | undefined;
  return (
    extractCssColor(style?.borderColor) ??
    extractCssColor(style?.borderLeftColor) ??
    extractCssColor(style?.border)
  );
}

export function getFlowMiniMapNodeColor(node: Node): string {
  return readDataColor(node) ?? readStyleColor(node) ?? FALLBACK_MINIMAP_NODE_COLOR;
}

export function getFlowMiniMapNodeStrokeColor(node: Node): string {
  return getFlowMiniMapNodeColor(node);
}

export const FLOW_MINIMAP_MASK_COLOR = 'rgba(241, 245, 249, 0.64)';
