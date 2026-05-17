import type { Translate } from '../../i18n';

interface CloseProjectConfirmModalProps {
  busy: boolean;
  onCancel: () => void;
  onCloseWithoutSaving: () => void;
  onSaveAndClose: () => void;
  t: Translate;
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
  t: Translate;
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
  t: Translate;
}

export function CloseProjectConfirmModal({
  busy,
  onCancel,
  onCloseWithoutSaving,
  onSaveAndClose,
  t,
}: CloseProjectConfirmModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('project.closeConfirm.title')}</h3>
        <p className="muted">{t('project.closeConfirm.body')}</p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onCloseWithoutSaving}
            disabled={busy}
          >
            {t('project.closeConfirm.closeWithoutSaving')}
          </button>
          <button type="button" onClick={onSaveAndClose} disabled={busy}>
            {t('project.closeConfirm.saveAndClose')}
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
  t,
}: CreateProjectModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('project.create.title')}</h3>
        <label>
          {t('project.create.workDirectory')}
          <div className="input-with-button">
            <input
              value={createProjectRoot}
              placeholder={t('project.create.workDirectoryPlaceholder')}
              readOnly
            />
            <button
              type="button"
              className="button-secondary"
              onClick={onSelectDirectory}
              disabled={busy}
            >
              {t('project.create.browse')}
            </button>
          </div>
        </label>
        <label>
          {t('project.create.name')}
          <input
            value={createProjectName}
            onChange={(event) => setCreateProjectName(event.target.value)}
            placeholder={t('project.create.namePlaceholder')}
          />
        </label>
        <div className="grid-two">
          <label>
            {t('project.targets.projectWords')}
            <input
              type="number"
              min={1}
              value={createProjectTargetWords}
              onChange={(event) => setCreateProjectTargetWords(event.target.value)}
              placeholder={t('project.targets.projectWordsPlaceholder')}
            />
          </label>
          <label>
            {t('project.targets.chapterWords')}
            <input
              type="number"
              min={1}
              value={createProjectTargetChapterWords}
              onChange={(event) => setCreateProjectTargetChapterWords(event.target.value)}
              placeholder={t('project.targets.chapterWordsPlaceholder')}
            />
          </label>
        </div>
        <label>
          {t('project.targets.completionDate')}
          <input
            type="date"
            value={createProjectCompletionDate}
            onChange={(event) => setCreateProjectCompletionDate(event.target.value)}
          />
        </label>
        <p className="muted">{t('project.create.storageNote')}</p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onCreateProject} disabled={!canCreateProject}>
            {t('project.create.createAndOpen')}
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
  t,
}: ProjectTargetsModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card">
        <h3>{t('project.targets.title')}</h3>
        <div className="grid-two">
          <label>
            {t('project.targets.projectWords')}
            <input
              type="number"
              min={1}
              value={editProjectTargetWords}
              onChange={(event) => setEditProjectTargetWords(event.target.value)}
              placeholder={t('project.targets.projectWordsPlaceholder')}
            />
          </label>
          <label>
            {t('project.targets.chapterWords')}
            <input
              type="number"
              min={1}
              value={editProjectTargetChapterWords}
              onChange={(event) => setEditProjectTargetChapterWords(event.target.value)}
              placeholder={t('project.targets.chapterWordsPlaceholder')}
            />
          </label>
        </div>
        <label>
          {t('project.targets.completionDate')}
          <input
            type="date"
            value={editProjectCompletionDate}
            onChange={(event) => setEditProjectCompletionDate(event.target.value)}
          />
        </label>
        <p className="muted">{t('project.targets.emptyHelp')}</p>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onCancel} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button type="button" onClick={onSaveProjectTargets} disabled={!canSaveProjectTargets}>
            {t('project.targets.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
