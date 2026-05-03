import { readFile } from 'node:fs/promises';
import { WIKI_SCHEMA_VERSION } from './paths';
import { writeTextFileAtomic } from './atomic-write';

export interface WikiSourceSyncEntry {
  path: string;
  hash: string;
  updatedAt: string;
}

export interface WikiLastSyncState {
  schemaVersion: number;
  updatedAt: string;
  derivedPending: boolean;
  sources: Record<string, WikiSourceSyncEntry>;
}

export function createInitialLastSyncState(): WikiLastSyncState {
  return {
    schemaVersion: WIKI_SCHEMA_VERSION,
    updatedAt: new Date().toISOString(),
    derivedPending: false,
    sources: {},
  };
}

export async function readLastSyncState(lastSyncPath: string): Promise<WikiLastSyncState> {
  try {
    const raw = await readFile(lastSyncPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<WikiLastSyncState>;

    return {
      schemaVersion:
        typeof parsed.schemaVersion === 'number' ? parsed.schemaVersion : WIKI_SCHEMA_VERSION,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString(),
      derivedPending: Boolean(parsed.derivedPending),
      sources: parsed.sources && typeof parsed.sources === 'object' ? parsed.sources : {},
    };
  } catch {
    return createInitialLastSyncState();
  }
}

export async function writeLastSyncState(
  lastSyncPath: string,
  state: WikiLastSyncState,
): Promise<void> {
  await writeTextFileAtomic(lastSyncPath, `${JSON.stringify(state, null, 2)}\n`);
}
