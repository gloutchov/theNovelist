import type { ProjectSessionManager } from '../projects/session';
import type { ProjectMemoryContext } from '../wiki/chat-context';
import type { ProjectWikiSearchResult } from '../wiki/search';
import type { ProjectWikiStatus } from '../wiki/status';
import type { ProjectWikiSyncResult } from '../wiki/sync';

export class WikiService {
  constructor(private readonly sessionManager: ProjectSessionManager) {}

  getStatus(): Promise<ProjectWikiStatus> {
    return this.sessionManager.getProjectWikiStatus();
  }

  sync(reason = 'manual'): Promise<ProjectWikiSyncResult> {
    return this.sessionManager.syncProjectWiki(reason);
  }

  search(params: { query: string; limit?: number }): Promise<ProjectWikiSearchResult[]> {
    return this.sessionManager.searchProjectWiki(params);
  }

  readSource(path: string): Promise<string> {
    return this.sessionManager.readProjectWikiSource(path);
  }

  buildMemoryContext(params: { query: string; limit?: number }): Promise<ProjectMemoryContext> {
    return this.sessionManager.buildProjectMemoryContext(params);
  }
}
