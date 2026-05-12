import { normalizePlotLabel } from '../plot/plot-flow';

interface StoryNodePlotOption {
  id: string;
  number: number;
  label: string;
}

interface CreateStoryNodeModalProps {
  busy: boolean;
  canCreateNode: boolean;
  newNodeBlockNumber: string;
  newNodeDescription: string;
  newNodePlotNumber: number;
  newNodeTitle: string;
  onCancel: () => void;
  onCreateNode: () => void;
  plots: StoryNodePlotOption[];
  setNewNodeBlockNumber: (value: string) => void;
  setNewNodeDescription: (value: string) => void;
  setNewNodePlotNumber: (value: number) => void;
  setNewNodeTitle: (value: string) => void;
}

interface EditStoryNodeModalProps {
  busy: boolean;
  editBlockNumber: number;
  editDescription: string;
  editNodeId: string;
  editPlotLabel: string;
  editPlotNumber: number;
  editTitle: string;
  onCancel: () => void;
  onOpenChapterEditor: (nodeId: string) => void;
  onSaveNodeEdit: () => void;
  setEditBlockNumber: (value: number) => void;
  setEditDescription: (value: string) => void;
  setEditPlotNumber: (value: number) => void;
  setEditTitle: (value: string) => void;
}

export function CreateStoryNodeModal({
  busy,
  canCreateNode,
  newNodeBlockNumber,
  newNodeDescription,
  newNodePlotNumber,
  newNodeTitle,
  onCancel,
  onCreateNode,
  plots,
  setNewNodeBlockNumber,
  setNewNodeDescription,
  setNewNodePlotNumber,
  setNewNodeTitle,
}: CreateStoryNodeModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Nuovo Capitolo</h3>
        <label>
          Titolo
          <input
            value={newNodeTitle}
            onChange={(event) => setNewNodeTitle(event.target.value)}
            placeholder="Titolo capitolo"
          />
        </label>
        <label>
          Descrizione
          <textarea
            value={newNodeDescription}
            onChange={(event) => setNewNodeDescription(event.target.value)}
            placeholder="Descrizione capitolo"
            rows={3}
          />
        </label>
        <label>
          Trama
          <select
            value={newNodePlotNumber}
            onChange={(event) => setNewNodePlotNumber(Math.max(1, Number(event.target.value) || 1))}
          >
            {plots.length > 0 ? (
              plots.map((plot) => (
                <option key={plot.id} value={plot.number}>
                  {normalizePlotLabel(plot.number, plot.label)}
                </option>
              ))
            ) : (
              <option value={newNodePlotNumber}>{`Trama ${newNodePlotNumber}`}</option>
            )}
          </select>
        </label>
        <label>
          Numero blocco (opzionale)
          <input
            type="number"
            min={1}
            value={newNodeBlockNumber}
            onChange={(event) => setNewNodeBlockNumber(event.target.value)}
            placeholder="Auto"
          />
        </label>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </button>
          <button type="button" onClick={onCreateNode} disabled={!canCreateNode}>
            Crea Blocco
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditStoryNodeModal({
  busy,
  editBlockNumber,
  editDescription,
  editNodeId,
  editPlotLabel,
  editPlotNumber,
  editTitle,
  onCancel,
  onOpenChapterEditor,
  onSaveNodeEdit,
  setEditBlockNumber,
  setEditDescription,
  setEditPlotNumber,
  setEditTitle,
}: EditStoryNodeModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Modifica Blocco</h3>
        <label>
          Titolo blocco
          <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
        </label>
        <label>
          Descrizione
          <textarea
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            rows={4}
          />
        </label>
        <label>
          Numero trama{editPlotLabel ? ` (${editPlotLabel})` : ''}
          <input
            type="number"
            min={1}
            value={editPlotNumber}
            onChange={(event) => setEditPlotNumber(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label>
          Numero blocco
          <input
            type="number"
            min={1}
            value={editBlockNumber}
            onChange={(event) => setEditBlockNumber(Number(event.target.value))}
          />
        </label>
        <div className="row-buttons">
          <button type="button" onClick={() => onOpenChapterEditor(editNodeId)}>
            Apri editor capitolo
          </button>
          <button type="button" onClick={onCancel}>
            Annulla
          </button>
          <button type="button" onClick={onSaveNodeEdit} disabled={busy}>
            Salva
          </button>
        </div>
      </div>
    </div>
  );
}
