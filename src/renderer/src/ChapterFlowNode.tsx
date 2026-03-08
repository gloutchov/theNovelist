import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface ChapterFlowNodeData extends Record<string, unknown> {
  title: string;
  description: string;
  plotNumber: number;
  blockNumber: number;
}

const handleStyle = {
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: '#1f2937',
  border: '2px solid #f8fafc',
} as const;

export default function ChapterFlowNode({ data }: NodeProps) {
  const typedData = data as ChapterFlowNodeData;
  const description = typedData.description?.trim() ? typedData.description : 'Nessuna descrizione';

  return (
    <div className="chapter-flow-node">
      <Handle id="handle-left" type="source" position={Position.Left} style={handleStyle} />
      <Handle id="handle-right" type="source" position={Position.Right} style={handleStyle} />
      <Handle id="handle-top" type="source" position={Position.Top} style={handleStyle} />
      <Handle id="handle-bottom" type="source" position={Position.Bottom} style={handleStyle} />
      <p className="chapter-flow-node-meta">
        Trama {typedData.plotNumber} • Blocco {typedData.blockNumber}
      </p>
      <h4 className="chapter-flow-node-title">{typedData.title}</h4>
      <p className="chapter-flow-node-description">{description}</p>
    </div>
  );
}
