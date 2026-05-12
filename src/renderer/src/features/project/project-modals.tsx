interface CloseProjectConfirmModalProps {
  busy: boolean;
  onCancel: () => void;
  onCloseWithoutSaving: () => void;
  onSaveAndClose: () => void;
}

interface CreateProjectModalProps {
  busy: boolean;
  canCreateProject: boolean;
  createProjectCompletionDate: string;
  createProjectName: string;
  createProjectRoot: string;
  createProjectTargetChapterWords: string;
  createProjectTargetWords: string;
  onCancel: () => void;
  onCreateProject: () => void;
  onSelectDirectory: () => void;
  setCreateProjectCompletionDate: (value: string) => void;
  setCreateProjectName: (value: string) => void;
  setCreateProjectTargetChapterWords: (value: string) => void;
  setCreateProjectTargetWords: (value: string) => void;
}

interface ProjectTargetsModalProps {
  busy: boolean;
  canSaveProjectTargets: boolean;
  editProjectCompletionDate: string;
  editProjectTargetChapterWords: string;
  editProjectTargetWords: string;
  onCancel: () => void;
  onSaveProjectTargets: () => void;
  setEditProjectCompletionDate: (value: string) => void;
  setEditProjectTargetChapterWords: (value: string) => void;
  setEditProjectTargetWords: (value: string) => void;
}

export function CloseProjectConfirmModal({
  busy,
  onCancel,
  onCloseWithoutSaving,
  onSaveAndClose,
}: CloseProjectConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Chiudere il progetto?</h3>
        <p className="muted">
          Sono presenti modifiche non ancora persistite. Puoi salvarle prima di chiudere oppure
          uscire senza salvare.
        </p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onCloseWithoutSaving}
            disabled={busy}
          >
            Chiudi senza salvare
          </button>
          <button type="button" onClick={onSaveAndClose} disabled={busy}>
            Salva e chiudi
          </button>
        </div>
      </div>
    </div>
  );
}

export function CreateProjectModal({
  busy,
  canCreateProject,
  createProjectCompletionDate,
  createProjectName,
  createProjectRoot,
  createProjectTargetChapterWords,
  createProjectTargetWords,
  onCancel,
  onCreateProject,
  onSelectDirectory,
  setCreateProjectCompletionDate,
  setCreateProjectName,
  setCreateProjectTargetChapterWords,
  setCreateProjectTargetWords,
}: CreateProjectModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Crea Progetto</h3>
        <label>
          Cartella di lavoro
          <div className="input-with-button">
            <input
              value={createProjectRoot}
              placeholder="Seleziona la cartella che conterra il progetto"
              readOnly
            />
            <button
              type="button"
              className="button-secondary"
              onClick={onSelectDirectory}
              disabled={busy}
            >
              Sfoglia...
            </button>
          </div>
        </label>
        <label>
          Nome progetto
          <input
            value={createProjectName}
            onChange={(event) => setCreateProjectName(event.target.value)}
            placeholder="Titolo progetto"
          />
        </label>
        <div className="grid-two">
          <label>
            Target parole progetto
            <input
              type="number"
              min={1}
              value={createProjectTargetWords}
              onChange={(event) => setCreateProjectTargetWords(event.target.value)}
              placeholder="Es. 80000"
            />
          </label>
          <label>
            Target parole capitolo
            <input
              type="number"
              min={1}
              value={createProjectTargetChapterWords}
              onChange={(event) => setCreateProjectTargetChapterWords(event.target.value)}
              placeholder="Es. 3000"
            />
          </label>
        </div>
        <label>
          Data prevista di completamento
          <input
            type="date"
            value={createProjectCompletionDate}
            onChange={(event) => setCreateProjectCompletionDate(event.target.value)}
          />
        </label>
        <p className="muted">
          The Novelist creera una sottocartella con il nome del progetto e salvera li database,
          asset, snapshot e memoria.
        </p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </button>
          <button type="button" onClick={onCreateProject} disabled={!canCreateProject}>
            Crea e Apri
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectTargetsModal({
  busy,
  canSaveProjectTargets,
  editProjectCompletionDate,
  editProjectTargetChapterWords,
  editProjectTargetWords,
  onCancel,
  onSaveProjectTargets,
  setEditProjectCompletionDate,
  setEditProjectTargetChapterWords,
  setEditProjectTargetWords,
}: ProjectTargetsModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>Obiettivi progetto</h3>
        <div className="grid-two">
          <label>
            Target parole progetto
            <input
              type="number"
              min={1}
              value={editProjectTargetWords}
              onChange={(event) => setEditProjectTargetWords(event.target.value)}
              placeholder="Es. 80000"
            />
          </label>
          <label>
            Target parole capitolo
            <input
              type="number"
              min={1}
              value={editProjectTargetChapterWords}
              onChange={(event) => setEditProjectTargetChapterWords(event.target.value)}
              placeholder="Es. 3000"
            />
          </label>
        </div>
        <label>
          Data prevista di completamento
          <input
            type="date"
            value={editProjectCompletionDate}
            onChange={(event) => setEditProjectCompletionDate(event.target.value)}
          />
        </label>
        <p className="muted">
          Lascia un campo vuoto per rimuovere il relativo obiettivo dal cruscotto.
        </p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            Annulla
          </button>
          <button type="button" onClick={onSaveProjectTargets} disabled={!canSaveProjectTargets}>
            Salva obiettivi
          </button>
        </div>
      </div>
    </div>
  );
}
