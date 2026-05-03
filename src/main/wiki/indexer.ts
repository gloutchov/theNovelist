import type { WikiSourceSyncEntry } from './sync-state';

export function buildWikiIndex(params: {
  projectName: string;
  updatedAt: string;
  sources: Record<string, WikiSourceSyncEntry>;
}): string {
  const sourceEntries = Object.entries(params.sources).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  const chapterSources = sourceEntries.filter(([key]) => key.startsWith('chapters/'));
  const cardSources = sourceEntries.filter(([key]) => key.startsWith('cards/'));

  return [
    '# Project Wiki Index',
    '',
    `Project: ${params.projectName}`,
    `Updated: ${params.updatedAt}`,
    '',
    '## Status',
    '',
    '- Source of truth: `project.db` and `sources/`',
    '- This index is generated deterministically by The Novelist.',
    '',
    '## Chapter Sources',
    '',
    formatSourceList(chapterSources),
    '',
    '## Card Sources',
    '',
    formatSourceList(cardSources),
    '',
  ].join('\n');
}

function formatSourceList(entries: Array<[string, WikiSourceSyncEntry]>): string {
  if (entries.length === 0) {
    return '- none';
  }

  return entries.map(([key, entry]) => `- [${key}](${entry.path})`).join('\n');
}
