import type { Translate } from '../../i18n';
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
  t: Translate;
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
  t: Translate;
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
  t,
}: CreatePlotModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('plot.modal.title')}</h3>
        <label>
          {t('plot.field.number')}
          <input
            type="number"
            min={1}
            value={newPlotNumber}
            onChange={(event) => setNewPlotNumber(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label>
          {t('plot.field.label')}
          <input
            value={existingPlotForNewNumber ? existingPlotForNewNumber.label : newPlotLabel}
            onChange={(event) => setNewPlotLabel(event.target.value)}
            placeholder={t('plot.modal.placeholderLabel')}
            disabled={Boolean(existingPlotForNewNumber)}
          />
        </label>
        <label>
          {t('plot.field.summary')}
          <textarea
            rows={7}
            value={existingPlotForNewNumber ? existingPlotForNewNumber.summary : newPlotSummary}
            onChange={(event) => setNewPlotSummary(event.target.value)}
            placeholder={t('plot.modal.placeholderSummary')}
            disabled={Boolean(existingPlotForNewNumber)}
          />
        </label>
        {existingPlotForNewNumber ? (
          <p className="muted">
            {t('plot.modal.existing')}{' '}
            <strong>{existingPlotForNewNumber.label || t('plot.modal.noLabel')}</strong>.{' '}
            {t('plot.modal.existingHelp')}
          </p>
        ) : null}
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onCreatePlot} disabled={!canCreatePlot}>
            {t('plot.modal.createPlot')}
          </button>
          <button
            type="button"
            className={plotStructureBusy ? 'ai-working' : undefined}
            onClick={onCreatePlotStructure}
            disabled={!canCreatePlotStructure}
          >
            {plotStructureBusy
              ? t('plot.modal.createChaptersBusy')
              : t('plot.modal.createChapters')}
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
  t,
}: EditPlotModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('plot.modal.editTitle')}</h3>
        <label>
          {t('plot.field.number')}
          <input value={String(currentEditPlot.number)} readOnly />
        </label>
        <label>
          {t('plot.field.title')}
          <input
            value={editPlotLabelInput}
            onChange={(event) => setEditPlotLabelInput(event.target.value)}
            placeholder={normalizePlotLabel(currentEditPlot.number, '', t('common.plot'))}
          />
        </label>
        <label>
          {t('plot.field.summary')}
          <textarea
            rows={8}
            value={editPlotSummaryInput}
            onChange={(event) => setEditPlotSummaryInput(event.target.value)}
          />
        </label>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onSavePlotEdit} disabled={busy}>
            {t('plot.modal.savePlot')}
          </button>
        </div>
      </div>
    </div>
  );
}
