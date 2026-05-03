export function buildAgentsTemplate(): string {
  return [
    '# Project Wiki Instructions',
    '',
    'This wiki is a derived project-local memory for The Novelist.',
    '',
    'Rules:',
    '',
    '- Treat `project.db` and `sources/` as the source of truth.',
    '- Treat every file in this wiki as app-managed and replaceable by The Novelist.',
    '- Do not preserve manual edits in generated files.',
    '- Do not invent facts. Use source files for factual claims.',
    '- Cite source files for factual claims.',
    '- Never write outside this `wiki/` directory.',
    '',
  ].join('\n');
}

export function buildIndexTemplate(projectName: string): string {
  return [
    '# Project Wiki Index',
    '',
    `Project: ${projectName}`,
    '',
    'Status: initialized',
    '',
    '## Sources',
    '',
    '- [Chapter sources](sources/chapters/)',
    '- [Card sources](sources/cards/)',
    '',
  ].join('\n');
}

export function buildLogTemplate(): string {
  return [
    '# Project Wiki Log',
    '',
    `## [${new Date().toISOString()}] init | Wiki created`,
    '',
  ].join('\n');
}
