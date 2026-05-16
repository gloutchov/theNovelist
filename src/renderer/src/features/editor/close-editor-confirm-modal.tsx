import type { Translate } from '../../i18n';

interface CloseEditorConfirmModalProps {
  documentLabel: string;
  isSaving: boolean;
  onCancel: () => void;
  onSaveAndClose: () => void;
  t: Translate;
}

export function CloseEditorConfirmModal({
  documentLabel,
  isSaving,
  onCancel,
  onSaveAndClose,
  t,
}: CloseEditorConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('editor.closeConfirm.title')}</h3>
        <p className="muted">{t('editor.closeConfirm.body', { document: documentLabel })}</p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={isSaving}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onSaveAndClose}
            disabled={isSaving}
            className={isSaving ? 'ai-working' : undefined}
          >
            {isSaving ? t('editor.closeConfirm.saving') : t('editor.closeConfirm.saveAndClose')}
          </button>
        </div>
      </div>
    </div>
  );
}
