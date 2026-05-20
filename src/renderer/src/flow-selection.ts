import { SelectionMode, type Edge, type Node, type ReactFlowProps } from '@xyflow/react';

type CanvasMultiSelectProps = Pick<
  ReactFlowProps<Node, Edge>,
  'multiSelectionKeyCode' | 'panOnDrag' | 'selectionMode' | 'selectionOnDrag'
>;

export const canvasMultiSelectProps: CanvasMultiSelectProps = {
  multiSelectionKeyCode: ['Control', 'Meta'],
  panOnDrag: [1, 2],
  selectionMode: SelectionMode.Partial,
  selectionOnDrag: true,
};
