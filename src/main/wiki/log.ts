import { appendFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export async function appendWikiLogEntry(params: {
  logPath: string;
  action: string;
  summary: string;
  details?: string[];
  timestamp?: string;
}): Promise<void> {
  const timestamp = params.timestamp ?? new Date().toISOString();
  const details = params.details?.length
    ? ['', ...params.details.map((detail) => `- ${detail}`), '']
    : [''];
  const entry = [`## [${timestamp}] ${params.action} | ${params.summary}`, ...details].join('\n');

  await mkdir(path.dirname(params.logPath), { recursive: true });
  await appendFile(params.logPath, `${entry}\n`, 'utf8');
}
