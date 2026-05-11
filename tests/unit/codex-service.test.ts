import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CodexCliService } from '../../src/main/codex/client';
import { openDatabase } from '../../src/main/persistence/database';
import { NovelistRepository } from '../../src/main/persistence/repository';
import type { ProjectRecord } from '../../src/main/persistence/types';
import type { ProjectSessionManager } from '../../src/main/projects/session';
import { CodexApplicationService } from '../../src/main/services/codex-service';

vi.mock('electron', () => ({
  app: {
    getPath: () => process.env['TEMP'] ?? process.cwd(),
  },
  safeStorage: {
    decryptString: () => '',
    encryptString: (value: string) => Buffer.from(value),
    isEncryptionAvailable: () => false,
  },
}));

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function createSessionManager(
  repository: NovelistRepository,
  project: ProjectRecord,
  buildProjectMemoryContext = vi.fn(),
): ProjectSessionManager {
  return {
    getRepository: () => repository,
    getCurrentProjectId: () => project.id,
    getOpenedProject: () => ({
      id: project.id,
      name: project.name,
      rootPath: project.rootPath,
      dbPath: path.join(project.rootPath, 'project.db'),
      assetsPath: path.join(project.rootPath, 'assets'),
      snapshotsPath: path.join(project.rootPath, 'snapshots'),
    }),
    buildProjectMemoryContext,
    syncProjectWikiSources: vi.fn().mockResolvedValue(undefined),
  } as unknown as ProjectSessionManager;
}

describe('CodexApplicationService', () => {
  it('does not attach project memory to external providers without explicit consent', async () => {
    const dir = await createTempDir('novelist-codex-service-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repository = new NovelistRepository(db);
    const project = repository.createProject({ name: 'Romanzo', rootPath: dir });
    const buildProjectMemoryContext = vi.fn().mockResolvedValue({
      content: 'Memoria privata',
      results: [
        {
          path: 'characters/anna.md',
          title: 'Anna',
          category: 'source',
          score: 1,
          snippet: 'Dettaglio privato',
        },
      ],
    });
    const chat = vi.fn().mockResolvedValue({
      output: 'Risposta',
      mode: 'api',
      usedCommand: 'openai_api',
    });
    const codexCliService = {
      chat,
      getStatus: vi.fn(),
      transformSelection: vi.fn(),
      cancelActiveRequest: vi.fn(),
    } as unknown as CodexCliService;

    try {
      repository.createPlot(project.id, {
        number: 1,
        label: 'Trama',
        summary: '',
        color: '#3366ff',
        positionX: 0,
        positionY: 0,
      });
      const chapter = repository.createChapterNode(project.id, {
        title: 'Capitolo 1',
        description: '',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 0,
        positionY: 0,
      });
      repository.upsertCodexSettings(project.id, {
        enabled: true,
        provider: 'openai_api',
        fallbackProvider: 'none',
        allowApiCalls: true,
        allowExternalMemorySharing: false,
        apiKey: null,
      });

      const service = new CodexApplicationService(
        createSessionManager(repository, project, buildProjectMemoryContext),
        codexCliService,
      );
      const result = await service.chat({
        message: 'Come miglioro la scena?',
        chapterNodeId: chapter.id,
        chapterTitle: chapter.title,
        projectName: project.name,
        chapterText: 'Testo del capitolo',
      });

      expect(result.memorySources).toEqual([]);
      expect(buildProjectMemoryContext).not.toHaveBeenCalled();
      expect(chat).toHaveBeenCalledWith(
        expect.objectContaining({
          projectMemoryContext: '',
        }),
        expect.objectContaining({
          provider: 'openai_api',
          allowApiCalls: true,
        }),
      );
      expect(repository.listCodexChatMessages(project.id, chapter.id)).toHaveLength(2);
    } finally {
      db.close();
    }
  });
});
