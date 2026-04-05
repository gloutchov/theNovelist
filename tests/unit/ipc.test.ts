import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildPingResponse, collectManuscriptChapters } from '../../src/main/ipc';
import { openDatabase } from '../../src/main/persistence/database';
import { NovelistRepository } from '../../src/main/persistence/repository';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('buildPingResponse', () => {
  it('returns a formatted pong message', () => {
    const response = buildPingResponse({ message: 'ciao' });

    expect(response.message).toBe('Pong: ciao');
    expect(new Date(response.timestamp).toString()).not.toBe('Invalid Date');
  });
});

describe('collectManuscriptChapters', () => {
  it('includes only chapters with saved text content and preserves connection order', async () => {
    const dir = await createTempDir('novelist-ipc-');
    const dbPath = path.join(dir, 'project.db');
    const db = openDatabase(dbPath);
    const repository = new NovelistRepository(db);

    try {
      const project = repository.createProject({ name: 'Io sono Luna', rootPath: dir });

      const chapterA = repository.createChapterNode(project.id, {
        title: 'Una vita tra i Boschi',
        description: '',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 120,
        positionY: 120,
      });
      const chapterB = repository.createChapterNode(project.id, {
        title: 'Valeria',
        description: '',
        plotNumber: 1,
        blockNumber: 2,
        positionX: 240,
        positionY: 120,
      });
      const emptyConnected = repository.createChapterNode(project.id, {
        title: 'Indagini sul passato',
        description: '',
        plotNumber: 1,
        blockNumber: 3,
        positionX: 360,
        positionY: 120,
      });
      const chapterC = repository.createChapterNode(project.id, {
        title: 'La scoperta',
        description: '',
        plotNumber: 1,
        blockNumber: 4,
        positionX: 480,
        positionY: 120,
      });

      for (const chapter of [chapterA, chapterB, chapterC]) {
        const document = repository.upsertChapterDocument({
          chapterNodeId: chapter.id,
          contentJson:
            '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Contenuto capitolo"}]}]}',
          wordCount: 2,
        });
        repository.setChapterNodeRichTextDocId(chapter.id, document.id);
      }

      const emptyDocument = repository.upsertChapterDocument({
        chapterNodeId: emptyConnected.id,
        contentJson: '{"type":"doc","content":[{"type":"paragraph","content":[]}]}',
        wordCount: 0,
      });
      repository.setChapterNodeRichTextDocId(emptyConnected.id, emptyDocument.id);

      repository.createStoryEdge(project.id, {
        sourceId: chapterA.id,
        targetId: chapterB.id,
      });
      repository.createStoryEdge(project.id, {
        sourceId: chapterB.id,
        targetId: emptyConnected.id,
      });
      repository.createStoryEdge(project.id, {
        sourceId: emptyConnected.id,
        targetId: chapterC.id,
      });

      const chapters = collectManuscriptChapters(repository, project.id);

      expect(chapters.map((chapter) => chapter.title)).toEqual([
        'Una vita tra i Boschi',
        'Valeria',
        'La scoperta',
      ]);
    } finally {
      db.close();
    }
  });
});
