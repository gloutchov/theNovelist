import { type NodeProps } from '@xyflow/react';

export interface CharacterFlowNodeData extends Record<string, unknown> {
  label: string;
  plotNumber: number;
  subtitle: string;
  imageSrc: string | null;
}

function initialsFromName(name: string): string {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) {
    return '?';
  }
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export default function CharacterFlowNode({ data }: NodeProps) {
  const typedData = data as CharacterFlowNodeData;
  const subtitle = typedData.subtitle?.trim() ? typedData.subtitle : 'Scheda personaggio';
  const name = typedData.label?.trim() ? typedData.label : 'Personaggio';
  const initials = initialsFromName(name);

  return (
    <div className="character-flow-node">
      <div className="character-flow-node-avatar">
        {typedData.imageSrc ? (
          <img src={typedData.imageSrc} alt={`Foto ${name}`} />
        ) : (
          <div className="character-flow-node-avatar-fallback">{initials}</div>
        )}
      </div>
      <div className="character-flow-node-content">
        <p className="character-flow-node-meta">Trama {typedData.plotNumber}</p>
        <h4 className="character-flow-node-title">{name}</h4>
        <p className="character-flow-node-subtitle">{subtitle}</p>
      </div>
    </div>
  );
}
