import type {
  TimelineItemRecord,
  TimelineItemType,
  TimelineSettingsRecord,
  UpsertTimelineItemInput,
  UpsertTimelineSettingsInput,
} from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import { getStoryContext } from './project-context';

export interface TimelineState {
  settings: TimelineSettingsRecord;
  items: TimelineItemRecord[];
}

export class TimelineService {
  constructor(private readonly sessionManager: ProjectSessionManager) {}

  getState(): TimelineState {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return {
      settings: repository.getTimelineSettings(projectId),
      items: repository.listTimelineItems(projectId),
    };
  }

  updateSettings(input: UpsertTimelineSettingsInput): TimelineSettingsRecord {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return repository.upsertTimelineSettings(projectId, input);
  }

  updateItem(input: UpsertTimelineItemInput): TimelineItemRecord {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    this.assertTimelineEntityBelongsToProject(input.itemType, input.entityId);

    return repository.upsertTimelineItem(projectId, input);
  }

  private assertTimelineEntityBelongsToProject(itemType: TimelineItemType, entityId: string): void {
    const { repository, projectId } = getStoryContext(this.sessionManager);

    if (itemType === 'chapter') {
      const chapter = repository.getChapterNodeById(entityId);
      if (!chapter || chapter.projectId !== projectId) {
        throw new Error('Chapter node not found');
      }
      return;
    }

    const scene = repository.getSceneCardById(entityId);
    if (!scene || scene.projectId !== projectId) {
      throw new Error('Scene card not found');
    }
  }
}
