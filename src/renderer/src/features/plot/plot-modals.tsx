import { normalizePlotLabel } from './plot-flow';

interface PlotModalRecord {
  id: string;
  number: number;
  label: string;
  summary: string;
}

interface CreatePlotModalProps {
  busy: boolean;
  canCreatePlot: boolean;
  canCreatePlotStructure: boolean;
  existingPlotForNewNumber: PlotModalRecord | null;
  newPlotLabel: string;
  newPlotNumber: number;
  newPlotSummary: string;
  onCancel: () => void;
  onCreatePlot: () => void;
  onCreatePlotStructure: () => void;
  plotStructureBusy: boolean;
  setNewPlotLabel: (value: string) => void;
  setNewPlotNumber: (value: number) => void;
  setNewPlotSummary: (value: string) => void;
}

interface EditPlotModalProps {
  busy: boolean;
  currentEditPlot: PlotModalRecord;
  editPlotLabelInput: string;
  editPlotSummaryInput: string;
  onCancel: () => void;
  onSavePlotEdit: () => void;
  setEditPlotLabelInput: (value: string) => void;
  setEditPlotSummaryInput: (value: string) => void;
}

export function CreatePlotModal({
  busy,
  canCreatePlot,
  canCreatePlotStructure,
  existingPlotForNewNumber,
  newPlotLabel,
  newPlotNumber,
  newPlotSummary,
  onCancel,
  onCreatePlot,
  onCreatePlotStructure,
  plotStructureBusy,
  setNewPlotLabel,
  setNewPlotNumber,
  setNewPlotSummary,
}: CreatePlotModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Nuova Trama</h3>
        <label>
          Numero trama
          <input
            type="number"
            min={1}
            value={newPlotNumber}
            onChange={(event) => setNewPlotNumber(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label>
          Etichetta trama
          <input
            value={existingPlotForNewNumber ? existingPlotForNewNumber.label : newPlotLabel}
            onChange={(event) => setNewPlotLabel(event.target.value)}
            placeholder="Trama principale"
            disabled={Boolean(existingPlotForNewNumber)}
          />
        </label>
        <label>
          Bozza trama / struttura
          <textarea
            rows={7}
            value={existingPlotForNewNumber ? existingPlotForNewNumber.summary : newPlotSummary}
            onChange={(event) => setNewPlotSummary(event.target.value)}
            placeholder="Riassunto, struttura grezza, scene chiave, conflitti..."
            disabled={Boolean(existingPlotForNewNumber)}
          />
        </label>
        {existingPlotForNewNumber ? (
          <p className="muted">
            Trama esistente:{' '}
            <strong>{existingPlotForNewNumber.label || '(senza etichetta)'}</strong>. Modificala dal
            tab Trame con doppio click sul blocco.
          </p>
        ) : null}
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </button>
          <button type="button" onClick={onCreatePlot} disabled={!canCreatePlot}>
            Crea Trama
          </button>
          <button
            type="button"
            className={plotStructureBusy ? 'ai-working' : undefined}
            onClick={onCreatePlotStructure}
            disabled={!canCreatePlotStructure}
          >
            {plotStructureBusy ? 'In Creazione...' : 'Crea Capitoli'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditPlotModal({
  busy,
  currentEditPlot,
  editPlotLabelInput,
  editPlotSummaryInput,
  onCancel,
  onSavePlotEdit,
  setEditPlotLabelInput,
  setEditPlotSummaryInput,
}: EditPlotModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Modifica Trama</h3>
        <label>
          Numero trama
          <input value={String(currentEditPlot.number)} readOnly />
        </label>
        <label>
          Titolo trama
          <input
            value={editPlotLabelInput}
            onChange={(event) => setEditPlotLabelInput(event.target.value)}
            placeholder={normalizePlotLabel(currentEditPlot.number, '')}
          />
        </label>
        <label>
          Bozza trama / struttura
          <textarea
            rows={8}
            value={editPlotSummaryInput}
            onChange={(event) => setEditPlotSummaryInput(event.target.value)}
          />
        </label>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </button>
          <button type="button" onClick={onSavePlotEdit} disabled={busy}>
            Salva Trama
          </button>
        </div>
      </div>
    </div>
  );
}
