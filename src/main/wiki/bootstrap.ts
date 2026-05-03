import { access, mkdir, writeFile } from 'node:fs/promises';
import type { ProjectRecord } from '../persistence/types';
import { resolveProjectWikiPaths, type ProjectWikiPaths } from './paths';
import { buildAgentsTemplate, buildIndexTemplate, buildLogTemplate } from './templates';
import { createInitialLastSyncState } from './sync-state';
import { cleanupAtomicTempFiles } from './atomic-write';

async function writeIfMissing(filePath: string, content: string): Promise<void> {
  try {
    await access(filePath);
  } catch {
    await writeFile(filePath, content, { encoding: 'utf8', flag: 'wx' });
  }
}

export async function ensureProjectWiki(params: {
  wikiPath: string;
  project: Pick<ProjectRecord, 'name'>;
}): Promise<ProjectWikiPaths> {
  const paths = resolveProjectWikiPaths(params.wikiPath);

  await mkdir(paths.wikiPath, { recursive: true });
  await mkdir(paths.chapterSourcesPath, { recursive: true });
  await mkdir(paths.cardSourcesPath, { recursive: true });
  await mkdir(paths.maintenancePath, { recursive: true });
  await cleanupAtomicTempFiles(paths.wikiPath);

  await writeIfMissing(paths.agentsPath, buildAgentsTemplate());
  await writeIfMissing(paths.indexPath, buildIndexTemplate(params.project.name));
  await writeIfMissing(paths.logPath, buildLogTemplate());
  await writeIfMissing(
    paths.lastSyncPath,
    `${JSON.stringify(createInitialLastSyncState(), null, 2)}\n`,
  );

  return paths;
}
