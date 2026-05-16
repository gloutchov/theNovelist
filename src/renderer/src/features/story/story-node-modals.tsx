import type { Translate } from '../../i18n';
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
  t: Translate;
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
  t: Translate;
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
  t,
}: CreateStoryNodeModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('story.modal.newTitle')}</h3>
        <label>
          {t('story.modal.title')}
          <input
            value={newNodeTitle}
            onChange={(event) => setNewNodeTitle(event.target.value)}
            placeholder={t('story.modal.titlePlaceholder')}
          />
        </label>
        <label>
          {t('story.modal.description')}
          <textarea
            value={newNodeDescription}
            onChange={(event) => setNewNodeDescription(event.target.value)}
            placeholder={t('story.modal.descriptionPlaceholder')}
            rows={3}
          />
        </label>
        <label>
          {t('story.modal.plot')}
          <select
            value={newNodePlotNumber}
            onChange={(event) => setNewNodePlotNumber(Math.max(1, Number(event.target.value) || 1))}
          >
            {plots.length > 0 ? (
              plots.map((plot) => (
                <option key={plot.id} value={plot.number}>
                  {normalizePlotLabel(plot.number, plot.label, t('common.plot'))}
                </option>
              ))
            ) : (
              <option
                value={newNodePlotNumber}
              >{`${t('common.plot')} ${newNodePlotNumber}`}</option>
            )}
          </select>
        </label>
        <label>
          {t('story.modal.blockNumberOptional')}
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
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onCreateNode} disabled={!canCreateNode}>
            {t('story.modal.createBlock')}
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
  t,
}: EditStoryNodeModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('story.modal.editTitle')}</h3>
        <label>
          {t('story.modal.titleBlock')}
          <input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} />
        </label>
        <label>
          {t('story.modal.description')}
          <textarea
            value={editDescription}
            onChange={(event) => setEditDescription(event.target.value)}
            rows={4}
          />
        </label>
        <label>
          {t('story.modal.plotNumber')}
          {editPlotLabel ? ` (${editPlotLabel})` : ''}
          <input
            type="number"
            min={1}
            value={editPlotNumber}
            onChange={(event) => setEditPlotNumber(Math.max(1, Number(event.target.value) || 1))}
          />
        </label>
        <label>
          {t('story.modal.blockNumber')}
          <input
            type="number"
            min={1}
            value={editBlockNumber}
            onChange={(event) => setEditBlockNumber(Number(event.target.value))}
          />
        </label>
        <div className="row-buttons">
          <button type="button" onClick={() => onOpenChapterEditor(editNodeId)}>
            {t('story.modal.openChapterEditor')}
          </button>
          <button type="button" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onSaveNodeEdit} disabled={busy}>
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
