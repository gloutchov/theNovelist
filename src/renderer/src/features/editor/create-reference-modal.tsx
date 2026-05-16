import type { Translate } from '../../i18n';

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
  t: Translate;
}

function getReferenceModalTitle(type: ReferenceType, t: Translate): string {
  if (type === 'character') {
    return t('editor.createReference.characterTitle');
  }

  if (type === 'location') {
    return t('editor.createReference.locationTitle');
  }

  return t('editor.createReference.sceneTitle');
}

function getReferenceNameLabel(type: ReferenceType, t: Translate): string {
  if (type === 'character') {
    return t('editor.createReference.characterName');
  }

  if (type === 'location') {
    return t('editor.createReference.locationName');
  }

  return t('editor.createReference.sceneName');
}

export function CreateReferenceModal({
  modal,
  onCancel,
  onNameChange,
  onSubmit,
  t,
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
        <h3>{getReferenceModalTitle(modal.type, t)}</h3>
        <label>
          {getReferenceNameLabel(modal.type, t)}
          <input
            autoFocus
            value={modal.name}
            onChange={(event) => onNameChange(event.target.value)}
          />
        </label>
        <label>
          {t('editor.createReference.selectedText')}
          <textarea rows={6} value={modal.text} readOnly />
        </label>
        <p className="muted">
          {modal.type === 'scene'
            ? t('editor.createReference.sceneNote')
            : t('editor.createReference.note')}
        </p>
        <div className="row-buttons">
          <button
            type="button"
            className="button-secondary"
            onClick={onCancel}
            disabled={modal.submitting}
          >
            {t('common.cancel')}
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={modal.submitting}
            className={modal.submitting ? 'ai-working' : undefined}
          >
            {modal.submitting
              ? t('editor.createReference.creating')
              : modal.type === 'scene'
                ? t('editor.createReference.createHash')
                : t('editor.createReference.createAt')}
          </button>
        </div>
      </div>
    </div>
  );
}
