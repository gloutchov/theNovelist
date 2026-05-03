import { access } from 'node:fs/promises';
import { readLastSyncState } from './sync-state';
import { resolveProjectWikiPaths } from './paths';

export interface ProjectWikiStatus {
  initialized: boolean;
  derivedPending: boolean;
  updatedAt: string | null;
  sourceCount: number;
}

export async function getProjectWikiStatus(wikiPath: string): Promise<ProjectWikiStatus> {
  const paths = resolveProjectWikiPaths(wikiPath);

  try {
    await access(paths.lastSyncPath);
    const state = await readLastSyncState(paths.lastSyncPath);
    return {
      initialized: true,
      derivedPending: state.derivedPending,
      updatedAt: state.updatedAt,
      sourceCount: Object.keys(state.sources).length,
    };
  } catch {
    return {
      initialized: false,
      derivedPending: true,
      updatedAt: null,
      sourceCount: 0,
    };
  }
}
