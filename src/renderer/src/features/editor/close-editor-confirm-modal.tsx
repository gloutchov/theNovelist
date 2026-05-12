interface CloseEditorConfirmModalProps {
  documentLabel: string;
  isSaving: boolean;
  onCancel: () => void;
  onSaveAndClose: () => void;
}

export function CloseEditorConfirmModal({
  documentLabel,
  isSaving,
  onCancel,
  onSaveAndClose,
}: CloseEditorConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Modifiche non salvate</h3>
        <p className="muted">
          Il documento "{documentLabel}" contiene modifiche non salvate. Salva prima di chiudere
          l'editor.
        </p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={isSaving}>
            Annulla
          </button>
          <button
            type="button"
            onClick={onSaveAndClose}
            disabled={isSaving}
            className={isSaving ? 'ai-working' : undefined}
          >
            {isSaving ? 'Salvataggio...' : 'Salva e chiudi'}
          </button>
        </div>
      </div>
    </div>
  );
}
