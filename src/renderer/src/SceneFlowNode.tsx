import type { NodeProps } from '@xyflow/react';

export interface SceneFlowNodeData extends Record<string, unknown> {
  label: string;
  chapterTitle: string;
  plotLabel: string;
  subtitle: string;
}

export default function SceneFlowNode({ data }: NodeProps) {
  const typedData = data as SceneFlowNodeData;
  const name = typedData.label?.trim() ? typedData.label : 'Scena';

  return (
    <div className="scene-flow-node">
      <p className="scene-flow-node-meta">{typedData.plotLabel}</p>
      <h4 className="scene-flow-node-title">#{name}</h4>
      <p className="scene-flow-node-subtitle">{typedData.chapterTitle}</p>
      {typedData.subtitle ? <p className="scene-flow-node-excerpt">{typedData.subtitle}</p> : null}
    </div>
  );
}
