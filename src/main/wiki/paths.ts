import path from 'node:path';

export const WIKI_SCHEMA_VERSION = 1;

export interface ProjectWikiPaths {
  wikiPath: string;
  agentsPath: string;
  indexPath: string;
  logPath: string;
  sourcesPath: string;
  chapterSourcesPath: string;
  cardSourcesPath: string;
  maintenancePath: string;
  lastSyncPath: string;
}

export function resolveProjectWikiPaths(wikiPath: string): ProjectWikiPaths {
  const sourcesPath = path.join(wikiPath, 'sources');
  const maintenancePath = path.join(wikiPath, 'maintenance');

  return {
    wikiPath,
    agentsPath: path.join(wikiPath, 'AGENTS.md'),
    indexPath: path.join(wikiPath, 'index.md'),
    logPath: path.join(wikiPath, 'log.md'),
    sourcesPath,
    chapterSourcesPath: path.join(sourcesPath, 'chapters'),
    cardSourcesPath: path.join(sourcesPath, 'cards'),
    maintenancePath,
    lastSyncPath: path.join(maintenancePath, 'last-sync.json'),
  };
}
