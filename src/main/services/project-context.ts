import type { ProjectSessionManager } from '../projects/session';

export function getStoryContext(sessionManager: ProjectSessionManager): {
  repository: ReturnType<ProjectSessionManager['getRepository']>;
  projectId: string;
} {
  return {
    repository: sessionManager.getRepository(),
    projectId: sessionManager.getCurrentProjectId(),
  };
}

export async function syncProjectWikiSourcesBestEffort(
  sessionManager: ProjectSessionManager,
): Promise<void> {
  try {
    await sessionManager.syncProjectWikiSources();
  } catch {
    // The wiki is derived and recoverable. Primary project mutations must not fail because of it.
  }
}

export function assertChapterNodeIdsBelongToProject(
  repository: ReturnType<ProjectSessionManager['getRepository']>,
  projectId: string,
  chapterNodeIds: string[],
): void {
  for (const chapterNodeId of chapterNodeIds) {
    const node = repository.getChapterNodeById(chapterNodeId);
    if (!node || node.projectId !== projectId) {
      throw new Error(`Chapter node not found: ${chapterNodeId}`);
    }
  }
}
