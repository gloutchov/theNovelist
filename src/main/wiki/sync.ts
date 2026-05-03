import type { NovelistRepository } from '../persistence/repository';
import type { ProjectRecord } from '../persistence/types';
import { writeTextFileAtomic } from './atomic-write';
import { ensureProjectWiki } from './bootstrap';
import { buildWikiIndex } from './indexer';
import { appendWikiLogEntry } from './log';
import { resolveProjectWikiPaths } from './paths';
import { exportProjectSources, type WikiSourceExportResult } from './source-export';
import { readLastSyncState, writeLastSyncState } from './sync-state';
import { buildAgentsTemplate } from './templates';

export interface ProjectWikiSyncResult extends WikiSourceExportResult {
  indexUpdated: boolean;
  logUpdated: boolean;
}

export async function syncProjectWikiDeterministic(params: {
  wikiPath: string;
  repository: NovelistRepository;
  project: ProjectRecord;
  reason?: string;
}): Promise<ProjectWikiSyncResult> {
  await ensureProjectWiki({ wikiPath: params.wikiPath, project: params.project });
  const exportResult = await exportProjectSources(params);
  const paths = resolveProjectWikiPaths(params.wikiPath);
  const state = await readLastSyncState(paths.lastSyncPath);
  const now = new Date().toISOString();
  const indexContent = buildWikiIndex({
    projectName: params.project.name,
    updatedAt: now,
    sources: state.sources,
  });

  await writeTextFileAtomic(paths.agentsPath, buildAgentsTemplate());
  await writeTextFileAtomic(paths.indexPath, indexContent);
  await appendWikiLogEntry({
    logPath: paths.logPath,
    action: 'sync',
    summary: params.reason ?? 'deterministic wiki sync',
    timestamp: now,
    details: [
      `source_count: ${exportResult.sourceCount}`,
      `changed_sources: ${exportResult.changedSources.length}`,
    ],
  });

  await writeLastSyncState(paths.lastSyncPath, {
    ...state,
    updatedAt: now,
    derivedPending: false,
  });

  return {
    ...exportResult,
    derivedPending: false,
    indexUpdated: true,
    logUpdated: true,
  };
}
