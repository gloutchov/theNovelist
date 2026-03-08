import { type NodeProps } from '@xyflow/react';

export interface LocationFlowNodeData extends Record<string, unknown> {
  label: string;
  plotNumber: number;
  subtitle: string;
  imageSrc: string | null;
}

export default function LocationFlowNode({ data }: NodeProps) {
  const typedData = data as LocationFlowNodeData;
  const name = typedData.label?.trim() ? typedData.label : 'Location';
  const subtitle = typedData.subtitle?.trim() ? typedData.subtitle : 'Scheda location';

  return (
    <div className="location-flow-node">
      <div className="location-flow-node-image">
        {typedData.imageSrc ? (
          <img src={typedData.imageSrc} alt={`Foto ${name}`} />
        ) : (
          <div className="location-flow-node-image-fallback">LOC</div>
        )}
      </div>
      <div className="location-flow-node-content">
        <p className="location-flow-node-meta">Trama {typedData.plotNumber}</p>
        <h4 className="location-flow-node-title">{name}</h4>
        <p className="location-flow-node-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
