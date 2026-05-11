import type { EntityRevisionRecord, EntityRevisionType } from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';
import {
  buildRevisionContent,
  restoreRevisionSnapshot,
  type RevisionSnapshotContent,
} from './revision-content';

export interface RevisionEntityInput {
  entityType: EntityRevisionType;
  entityId: string;
}

export interface CreateRevisionInput extends RevisionEntityInput {
  label?: string;
}

export class RevisionService {
  constructor(private readonly sessionManager: ProjectSessionManager) {}

  getCurrent(input: RevisionEntityInput): RevisionSnapshotContent {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return buildRevisionContent(repository, projectId, input.entityType, input.entityId);
  }

  create(input: CreateRevisionInput): EntityRevisionRecord {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const content = buildRevisionContent(repository, projectId, input.entityType, input.entityId);
    return repository.createEntityRevision(projectId, {
      entityType: input.entityType,
      entityId: input.entityId,
      label: input.label || 'Versione manuale',
      reason: 'manual',
      snapshotJson: content.snapshotJson,
      textContent: content.textContent,
    });
  }

  list(input: RevisionEntityInput): EntityRevisionRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    buildRevisionContent(repository, projectId, input.entityType, input.entityId);
    return repository.listEntityRevisions(projectId, input.entityType, input.entityId);
  }

  async restore(revisionId: string): Promise<RevisionSnapshotContent> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const revision = repository.getEntityRevisionById(revisionId);
    if (!revision || revision.projectId !== projectId) {
      throw new Error('Revision not found');
    }

    restoreRevisionSnapshot(repository, projectId, revision);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return buildRevisionContent(repository, projectId, revision.entityType, revision.entityId);
  }
}
