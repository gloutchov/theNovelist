import { access, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { openDatabase } from '../../src/main/persistence/database';
import { NovelistRepository } from '../../src/main/persistence/repository';
import { createProjectOnDisk } from '../../src/main/projects/project-files';
import { ensureProjectWiki } from '../../src/main/wiki/bootstrap';
import { exportProjectSources } from '../../src/main/wiki/source-export';
import { syncProjectWikiDeterministic } from '../../src/main/wiki/sync';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('project wiki', () => {
  it('bootstraps wiki files without overwriting existing pages', async () => {
    const rootPath = await createTempDir('novelist-wiki-bootstrap-');
    const project = await createProjectOnDisk({ rootPath, name: 'Wiki Test' });
    const logPath = path.join(project.wikiPath, 'log.md');

    await writeFile(logPath, '# Custom Log\n', 'utf8');
    await ensureProjectWiki({ wikiPath: project.wikiPath, project: project.project });

    await access(path.join(project.wikiPath, 'AGENTS.md'));
    await access(path.join(project.wikiPath, 'index.md'));
    await access(path.join(project.wikiPath, 'maintenance', 'last-sync.json'));
    await expect(readFile(logPath, 'utf8')).resolves.toBe('# Custom Log\n');
  });

  it('removes interrupted atomic temp files during bootstrap', async () => {
    const rootPath = await createTempDir('novelist-wiki-temp-cleanup-');
    const project = await createProjectOnDisk({ rootPath, name: 'Cleanup Test' });
    const staleRootTempPath = path.join(project.wikiPath, '.index.md.1234.abc-def.tmp');
    const staleNestedTempPath = path.join(
      project.wikiPath,
      'sources',
      'chapters',
      '.chapter-one.md.1234.abc-def.tmp',
    );
    const normalTempNamedFilePath = path.join(project.wikiPath, 'notes.tmp');

    await writeFile(staleRootTempPath, 'partial index', 'utf8');
    await writeFile(staleNestedTempPath, 'partial chapter', 'utf8');
    await writeFile(normalTempNamedFilePath, 'keep me', 'utf8');

    await ensureProjectWiki({ wikiPath: project.wikiPath, project: project.project });

    await expect(access(staleRootTempPath)).rejects.toThrow();
    await expect(access(staleNestedTempPath)).rejects.toThrow();
    await expect(readFile(normalTempNamedFilePath, 'utf8')).resolves.toBe('keep me');
  });

  it('exports deterministic sources and marks derived memory as pending', async () => {
    const rootPath = await createTempDir('novelist-wiki-export-');
    const projectContext = await createProjectOnDisk({ rootPath, name: 'Export Test' });
    const db = openDatabase(projectContext.dbPath);
    const repository = new NovelistRepository(db);

    try {
      const project = repository.getPrimaryProject();
      if (!project) {
        throw new Error('Missing project');
      }

      repository.createPlot(project.id, {
        number: 1,
        label: 'Trama principale',
        summary: 'Una promessa viene tradita.',
        color: '#3366ff',
        positionX: 120,
        positionY: 120,
      });
      const chapter = repository.createChapterNode(project.id, {
        title: 'Il patto',
        description: 'Tizio e Caio stringono un accordo.',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 120,
        positionY: 240,
      });
      const character = repository.createCharacterCard(project.id, {
        firstName: 'Tizio',
        lastName: '',
        sex: '',
        age: null,
        sexualOrientation: '',
        species: 'umano',
        hairColor: 'castani',
        eyeColor: 'marroni',
        skinColor: 'olivastra',
        bald: false,
        beard: '',
        physique: '',
        job: 'notaio',
        notes: 'Custodisce il segreto del patto.',
        plotNumber: 1,
        positionX: 220,
        positionY: 180,
      });
      const location = repository.createLocationCard(project.id, {
        name: 'Magazzino',
        locationType: 'interno',
        description: 'Un edificio vicino al porto.',
        notes: 'Qui avviene il patto.',
        plotNumber: 1,
        positionX: 320,
        positionY: 180,
      });
      repository.setCharacterChapterLinks({
        characterCardId: character.id,
        chapterNodeIds: [chapter.id],
      });
      repository.setLocationChapterLinks({
        locationCardId: location.id,
        chapterNodeIds: [chapter.id],
      });
      repository.upsertChapterDocument({
        chapterNodeId: chapter.id,
        contentJson: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'Tizio firma il patto nel magazzino.' }],
            },
          ],
        }),
        wordCount: 7,
      });
      repository.appendCodexChatMessage(project.id, {
        chapterNodeId: chapter.id,
        role: 'user',
        content: 'Dove avviene il patto?',
      });
      repository.appendCodexChatMessage(project.id, {
        chapterNodeId: chapter.id,
        role: 'assistant',
        content: 'Il patto avviene nel magazzino.',
        mode: 'fallback',
      });

      const firstExport = await exportProjectSources({
        wikiPath: projectContext.wikiPath,
        repository,
        project,
      });
      const secondExport = await exportProjectSources({
        wikiPath: projectContext.wikiPath,
        repository,
        project,
      });

      const chapterSourceFiles = await readdir(
        path.join(projectContext.wikiPath, 'sources', 'chapters'),
      );
      expect(chapterSourceFiles).toHaveLength(1);

      const chapterSource = await readFile(
        path.join(projectContext.wikiPath, 'sources', 'chapters', chapterSourceFiles[0]!),
        'utf8',
      );
      expect(chapterSource).toContain('# Il patto');
      expect(chapterSource).toContain('Tizio firma il patto nel magazzino.');
      expect(chapterSource).toContain('Tizio');
      expect(chapterSource).toContain('Magazzino');

      const charactersSource = await readFile(
        path.join(projectContext.wikiPath, 'sources', 'cards', 'characters.md'),
        'utf8',
      );
      expect(charactersSource).toContain('Custodisce il segreto del patto.');
      expect(charactersSource).toContain('- hair_color: castani');
      expect(charactersSource).toContain('- eye_color: marroni');
      expect(charactersSource).toContain('- skin_color: olivastra');

      const aiChatSource = await readFile(
        path.join(projectContext.wikiPath, 'sources', 'ai', 'chat.md'),
        'utf8',
      );
      expect(aiChatSource).toContain('# AI Chat Sources');
      expect(aiChatSource).toContain('Dove avviene il patto?');
      expect(aiChatSource).toContain('Il patto avviene nel magazzino.');
      expect(aiChatSource).toContain('non come fonte canonica del manoscritto');

      const timelineSource = await readFile(
        path.join(projectContext.wikiPath, 'sources', 'cards', 'timeline.md'),
        'utf8',
      );
      expect(timelineSource).toContain('# Timeline Sources');
      expect(timelineSource).toContain('Ordine cronologico di lavoro definito dall’autore');

      const state = JSON.parse(
        await readFile(path.join(projectContext.wikiPath, 'maintenance', 'last-sync.json'), 'utf8'),
      ) as { derivedPending: boolean; sources: Record<string, unknown> };
      expect(firstExport.changed).toBe(true);
      expect(firstExport.derivedPending).toBe(true);
      expect(secondExport.changed).toBe(false);
      expect(state.derivedPending).toBe(true);
      expect(Object.keys(state.sources)).toEqual(
        expect.arrayContaining([
          'cards/characters.md',
          'cards/locations.md',
          'cards/plot.md',
          'cards/timeline.md',
          'ai/chat.md',
        ]),
      );

      repository.deleteChapterNode(chapter.id);
      const deleteExport = await exportProjectSources({
        wikiPath: projectContext.wikiPath,
        repository,
        project,
      });
      const remainingChapterSources = await readdir(
        path.join(projectContext.wikiPath, 'sources', 'chapters'),
      );
      expect(deleteExport.changed).toBe(true);
      expect(remainingChapterSources).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('runs deterministic sync and updates index, log and pending state', async () => {
    const rootPath = await createTempDir('novelist-wiki-sync-');
    const projectContext = await createProjectOnDisk({ rootPath, name: 'Sync Test' });
    const db = openDatabase(projectContext.dbPath);
    const repository = new NovelistRepository(db);

    try {
      const project = repository.getPrimaryProject();
      if (!project) {
        throw new Error('Missing project');
      }

      const chapter = repository.createChapterNode(project.id, {
        title: 'Capitolo sync',
        description: 'Una scena da indicizzare.',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 120,
        positionY: 120,
      });
      repository.upsertChapterDocument({
        chapterNodeId: chapter.id,
        contentJson: JSON.stringify({
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [{ type: 'text', text: 'La memoria viene sincronizzata.' }],
            },
          ],
        }),
        wordCount: 4,
      });
      const result = await syncProjectWikiDeterministic({
        wikiPath: projectContext.wikiPath,
        repository,
        project,
        reason: 'unit test',
      });
      const index = await readFile(path.join(projectContext.wikiPath, 'index.md'), 'utf8');
      const log = await readFile(path.join(projectContext.wikiPath, 'log.md'), 'utf8');
      const state = JSON.parse(
        await readFile(path.join(projectContext.wikiPath, 'maintenance', 'last-sync.json'), 'utf8'),
      ) as { derivedPending: boolean };

      expect(result.indexUpdated).toBe(true);
      expect(result.logUpdated).toBe(true);
      expect(result.derivedPending).toBe(false);
      expect(index).toContain('# Project Wiki Index');
      expect(index).toContain('Chapter Sources');
      expect(index).toContain('chapters/chapter-');
      expect(log).toContain('sync | unit test');
      expect(state.derivedPending).toBe(false);
    } finally {
      db.close();
    }
  });
});
