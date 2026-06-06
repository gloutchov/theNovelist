import { Handle, Position, type NodeProps } from '@xyflow/react';

export interface ExternalSourceFlowNodeData extends Record<string, unknown> {
  fileName: string;
  fileType: string;
  summary: string;
  extractionMethod: 'local' | 'ai_ocr' | 'ai_analysis' | 'none';
  extractionStatus: 'indexed' | 'partial' | 'failed';
  extractionStatusLabel: string;
}

export default function ExternalSourceFlowNode({ data }: NodeProps) {
  const typedData = data as ExternalSourceFlowNodeData;
  const fileName = typedData.fileName?.trim() || 'Fonte';
  const fileType = typedData.fileType?.trim().toUpperCase() || 'FILE';
  const summary = typedData.summary?.trim() || fileName;
  const statusClass = `external-source-node-status status-${typedData.extractionStatus ?? 'indexed'}`;

  return (
    <div className="external-source-flow-node">
      <Handle
        type="source"
        position={Position.Top}
        id="handle-top"
        style={{ background: 'var(--edge-color)', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Left}
        id="handle-left"
        style={{ background: 'var(--edge-color)', width: 8, height: 8 }}
      />

      <div className="external-source-node-header">
        <span className="external-source-node-type">{fileType}</span>
        {typedData.extractionMethod === 'ai_ocr' ||
        typedData.extractionMethod === 'ai_analysis' ||
        typedData.extractionStatus !== 'indexed' ? (
          <span className={statusClass}>{typedData.extractionStatusLabel}</span>
        ) : null}
        <h4 className="external-source-node-title">{fileName}</h4>
      </div>
      <p className="external-source-node-summary">{summary}</p>

      <Handle
        type="source"
        position={Position.Right}
        id="handle-right"
        style={{ background: 'var(--edge-color)', width: 8, height: 8 }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="handle-bottom"
        style={{ background: 'var(--edge-color)', width: 8, height: 8 }}
      />
    </div>
  );
}
