type ReferenceType = 'character' | 'location' | 'scene';

interface CreateReferenceModalState {
  type: ReferenceType;
  text: string;
  range: {
    from: number;
    to: number;
  };
  name: string;
  submitting: boolean;
}

interface CreateReferenceModalProps {
  modal: CreateReferenceModalState;
  onCancel: () => void;
  onNameChange: (name: string) => void;
  onSubmit: () => void;
}

function getReferenceModalTitle(type: ReferenceType): string {
  if (type === 'character') {
    return 'Crea Scheda Personaggio';
  }

  if (type === 'location') {
    return 'Crea Scheda Location';
  }

  return 'Crea Scheda Scena';
}

function getReferenceNameLabel(type: ReferenceType): string {
  if (type === 'character') {
    return 'Nome personaggio';
  }

  if (type === 'location') {
    return 'Nome location';
  }

  return 'Nome scena';
}

export function CreateReferenceModal({
  modal,
  onCancel,
  onNameChange,
  onSubmit,
}: CreateReferenceModalProps) {
  return (
    <div
      className="modal-overlay"
      onClick={() => {
        if (!modal.submitting) {
          onCancel();
        }
      }}
    >
      <div className="modal-card" onClick={(event) => event.stopPropagation()}>
        <h3>{getReferenceModalTitle(modal.type)}</h3>
        <label>
          {getReferenceNameLabel(modal.type)}
          <input
            autoFocus
            value={modal.name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <label>
          Testo selezionato
          <textarea rows={6} value={modal.text} readOnly />
        </label>
        <p className="muted">
          {modal.type === 'scene'
            ? 'Il testo selezionato verra salvato nella scheda scena e marcato nel capitolo.'
            : "La descrizione verra salvata nelle note. Se l'AI e disponibile, prova anche a compilare i campi deducibili."}
        </p>
        <div className="row-buttons">
          <button
            type="button"
            className="button-secondary"
            onClick={onCancel}
            disabled={modal.submitting}
          >
            Annulla
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={modal.submitting}
            className={modal.submitting ? 'ai-working' : undefined}
          >
            {modal.submitting
              ? 'Creazione...'
              : modal.type === 'scene'
                ? 'Crea e inserisci #'
                : 'Crea e inserisci @'}
          </button>
        </div>
      </div>
    </div>
  );
}
