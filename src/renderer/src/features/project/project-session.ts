import { useCallback, useState } from 'react';

const DEFAULT_PROJECT_NAME = 'Romanzo senza titolo';

export type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;

type OpenProjectRecord = NonNullable<ProjectRecord>;

interface ProjectPlanningInput {
  targetWordCount: number | null;
  targetChapterWordCount: number | null;
  plannedCompletionDate: string | null;
}

export function toOptionalPositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function projectPlanningMatches(
  project: OpenProjectRecord,
  input: ProjectPlanningInput,
): boolean {
  return (
    (project.targetWordCount ?? null) === input.targetWordCount &&
    (project.targetChapterWordCount ?? null) === input.targetChapterWordCount &&
    (project.plannedCompletionDate ?? null) === input.plannedCompletionDate
  );
}

export function useProjectSessionState(busy: boolean) {
  const [currentProject, setCurrentProject] = useState<ProjectRecord>(null);
  const [createProjectRoot, setCreateProjectRoot] = useState<string>('');
  const [createProjectName, setCreateProjectName] = useState<string>(DEFAULT_PROJECT_NAME);
  const [createProjectTargetWords, setCreateProjectTargetWords] = useState<string>('');
  const [createProjectTargetChapterWords, setCreateProjectTargetChapterWords] =
    useState<string>('');
  const [createProjectCompletionDate, setCreateProjectCompletionDate] = useState<string>('');
  const [isCreateProjectModalOpen, setIsCreateProjectModalOpen] = useState<boolean>(false);
  const [editProjectTargetWords, setEditProjectTargetWords] = useState<string>('');
  const [editProjectTargetChapterWords, setEditProjectTargetChapterWords] = useState<string>('');
  const [editProjectCompletionDate, setEditProjectCompletionDate] = useState<string>('');
  const [isProjectTargetsModalOpen, setIsProjectTargetsModalOpen] = useState<boolean>(false);
  const [isCloseProjectConfirmOpen, setIsCloseProjectConfirmOpen] = useState<boolean>(false);

  const openCreateProjectModal = useCallback((): void => {
    setCreateProjectRoot('');
    setCreateProjectName(DEFAULT_PROJECT_NAME);
    setCreateProjectTargetWords('');
    setCreateProjectTargetChapterWords('');
    setCreateProjectCompletionDate('');
    setIsCreateProjectModalOpen(true);
  }, []);

  const closeCreateProjectModal = useCallback((): void => {
    setIsCreateProjectModalOpen(false);
  }, []);

  const openProjectTargetsModal = useCallback((): void => {
    if (!currentProject) {
      return;
    }

    setEditProjectTargetWords(
      currentProject.targetWordCount === null ? '' : String(currentProject.targetWordCount),
    );
    setEditProjectTargetChapterWords(
      currentProject.targetChapterWordCount === null
        ? ''
        : String(currentProject.targetChapterWordCount),
    );
    setEditProjectCompletionDate(currentProject.plannedCompletionDate ?? '');
    setIsProjectTargetsModalOpen(true);
  }, [currentProject]);

  const resetCreateProjectFormAfterCreate = useCallback((project: OpenProjectRecord): void => {
    setCreateProjectRoot(project.rootPath);
    setCreateProjectName(project.name);
    setCreateProjectTargetWords('');
    setCreateProjectTargetChapterWords('');
    setCreateProjectCompletionDate('');
    setIsCreateProjectModalOpen(false);
  }, []);

  const resetProjectSessionState = useCallback((): void => {
    setCurrentProject(null);
    setCreateProjectRoot('');
    setCreateProjectName(DEFAULT_PROJECT_NAME);
    setCreateProjectTargetWords('');
    setCreateProjectTargetChapterWords('');
    setCreateProjectCompletionDate('');
    setIsCreateProjectModalOpen(false);
    setEditProjectTargetWords('');
    setEditProjectTargetChapterWords('');
    setEditProjectCompletionDate('');
    setIsProjectTargetsModalOpen(false);
    setIsCloseProjectConfirmOpen(false);
  }, []);

  return {
    currentProject,
    setCurrentProject,
    createProjectRoot,
    setCreateProjectRoot,
    createProjectName,
    setCreateProjectName,
    createProjectTargetWords,
    setCreateProjectTargetWords,
    createProjectTargetChapterWords,
    setCreateProjectTargetChapterWords,
    createProjectCompletionDate,
    setCreateProjectCompletionDate,
    isCreateProjectModalOpen,
    setIsCreateProjectModalOpen,
    editProjectTargetWords,
    setEditProjectTargetWords,
    editProjectTargetChapterWords,
    setEditProjectTargetChapterWords,
    editProjectCompletionDate,
    setEditProjectCompletionDate,
    isProjectTargetsModalOpen,
    setIsProjectTargetsModalOpen,
    isCloseProjectConfirmOpen,
    setIsCloseProjectConfirmOpen,
    canCreateProject:
      !currentProject &&
      !busy &&
      Boolean(createProjectRoot.trim()) &&
      Boolean(createProjectName.trim()),
    canSaveProjectTargets: Boolean(currentProject) && !busy,
    canOpenProject: !currentProject && !busy,
    canSaveProject: Boolean(currentProject) && !busy,
    canCloseProject: Boolean(currentProject) && !busy,
    closeCreateProjectModal,
    openCreateProjectModal,
    openProjectTargetsModal,
    resetCreateProjectFormAfterCreate,
    resetProjectSessionState,
  };
}
