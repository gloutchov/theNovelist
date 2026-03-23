import { type NodeProps } from '@xyflow/react';

export interface PlotFlowNodeData extends Record<string, unknown> {
  number: number;
  label: string;
  summary: string;
  color: string;
}

export default function PlotFlowNode({ data }: NodeProps) {
  const typedData = data as PlotFlowNodeData;
  const title = typedData.label?.trim() ? typedData.label : `Trama ${typedData.number}`;
  const summary = typedData.summary?.trim() ? typedData.summary : 'Nessuna bozza trama disponibile.';

  return (
    <div className="plot-flow-node">
      <p className="plot-flow-node-meta">Trama {typedData.number}</p>
      <h4 className="plot-flow-node-title">{title}</h4>
      <p className="plot-flow-node-description">{summary}</p>
    </div>
  );
}
