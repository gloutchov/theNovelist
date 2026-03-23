import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

describe('NovelistRepository', () => {
  it('supports project + plot + chapter CRUD basics', async () => {
    const dir = await createTempDir('novelist-repo-');
    const dbPath = path.join(dir, 'project.db');
    const db = openDatabase(dbPath);
    const repo = new NovelistRepository(db);

    try {
      const project = repo.createProject({ name: 'Romanzo Test', rootPath: dir });
      expect(repo.getProjectById(project.id)?.name).toBe('Romanzo Test');

      const plot = repo.createPlot(project.id, {
        number: 1,
        label: 'Trama principale',
        summary: 'Bozza iniziale della trama',
        color: '#3366ff',
        positionX: 120,
        positionY: 120,
      });
      expect(plot.projectId).toBe(project.id);
      expect(plot.summary).toBe('Bozza iniziale della trama');
      expect(plot.positionX).toBe(120);
      expect(plot.positionY).toBe(120);
      expect(repo.listPlots(project.id)).toHaveLength(1);

      const movedPlot = repo.updatePlot(plot.id, {
        label: plot.label,
        summary: plot.summary,
        color: plot.color,
        positionX: 420,
        positionY: 260,
      });
      expect(movedPlot.positionX).toBe(420);
      expect(movedPlot.positionY).toBe(260);

      const chapterNode = repo.createChapterNode(project.id, {
        title: 'Capitolo 1',
        description: 'Introduzione',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 100,
        positionY: 200,
      });
      const chapterNode2 = repo.createChapterNode(project.id, {
        title: 'Capitolo 2',
        description: 'Sviluppo',
        plotNumber: 1,
        blockNumber: 2,
        positionX: 220,
        positionY: 240,
      });

      repo.updateChapterNode(chapterNode.id, {
        title: 'Capitolo 1 - Rev',
        description: 'Introduzione aggiornata',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 150,
        positionY: 250,
        richTextDocId: 'doc-1',
      });

      const reloadedNode = repo.listChapterNodes(project.id)[0];
      expect(reloadedNode?.title).toBe('Capitolo 1 - Rev');
      expect(reloadedNode?.richTextDocId).toBe('doc-1');

      const edge = repo.createChapterEdge(project.id, {
        sourceNodeId: chapterNode.id,
        targetNodeId: chapterNode.id,
        label: 'self',
      });
      expect(repo.listChapterEdges(project.id)[0]?.id).toBe(edge.id);

      const document = repo.upsertChapterDocument({
        chapterNodeId: chapterNode.id,
        contentJson: '{"type":"doc","content":[]}',
        wordCount: 0,
      });
      expect(document.chapterNodeId).toBe(chapterNode.id);

      const codexSettings = repo.getOrCreateCodexSettings(project.id);
      expect(codexSettings.enabled).toBe(false);
      expect(codexSettings.provider).toBe('codex_cli');
      expect(codexSettings.allowApiCalls).toBe(false);
      expect(codexSettings.autoSummarizeDescriptions).toBe(true);
      expect(codexSettings.apiModel).toBe('gpt-5-mini');

      const updatedCodexSettings = repo.upsertCodexSettings(project.id, {
        enabled: true,
        provider: 'openai_api',
        allowApiCalls: true,
        autoSummarizeDescriptions: false,
        apiKey: 'test-key',
        apiModel: 'gpt-5-mini',
      });
      expect(updatedCodexSettings.enabled).toBe(true);
      expect(updatedCodexSettings.provider).toBe('openai_api');
      expect(updatedCodexSettings.allowApiCalls).toBe(true);
      expect(updatedCodexSettings.autoSummarizeDescriptions).toBe(false);
      expect(updatedCodexSettings.apiKey).toBe('test-key');

      repo.appendCodexChatMessage(project.id, {
        chapterNodeId: chapterNode.id,
        role: 'user',
        content: 'Dammi un idea per il conflitto centrale.',
      });
      repo.appendCodexChatMessage(project.id, {
        chapterNodeId: chapterNode.id,
        role: 'assistant',
        content: 'Fai emergere una promessa tradita tra i protagonisti.',
        mode: 'fallback',
      });

      const history = repo.listCodexChatMessages(project.id, chapterNode.id);
      expect(history).toHaveLength(2);
      expect(history[0]?.role).toBe('user');
      expect(history[1]?.role).toBe('assistant');

      const character = repo.createCharacterCard(project.id, {
        firstName: 'Anna',
        lastName: 'Rossi',
        sex: 'F',
        age: 31,
        sexualOrientation: 'etero',
        species: 'umana',
        hairColor: 'castani',
        bald: false,
        beard: 'nessuna',
        physique: 'atletica',
        job: 'giornalista',
        notes: 'Protagonista',
        plotNumber: 1,
        positionX: 120,
        positionY: 220,
      });
      expect(repo.listCharacterCards(project.id)).toHaveLength(1);

      repo.createCharacterImage({
        characterCardId: character.id,
        imageType: 'mezzo-busto',
        filePath: '/tmp/anna.png',
        prompt: 'ritratto realistico',
      });
      expect(repo.listCharacterImages(character.id)).toHaveLength(1);
      repo.setCharacterChapterLinks({
        characterCardId: character.id,
        chapterNodeIds: [chapterNode.id, chapterNode2.id, chapterNode.id],
      });
      expect(repo.listCharacterChapterLinks(character.id).map((link) => link.chapterNodeId).sort()).toEqual(
        [chapterNode.id, chapterNode2.id].sort(),
      );
      expect(repo.listCharactersForChapter(project.id, chapterNode.id)).toHaveLength(1);

      const location = repo.createLocationCard(project.id, {
        name: 'Porto Vecchio',
        locationType: 'quartiere',
        description: 'zona industriale dismessa',
        notes: 'clima cupo',
        plotNumber: 1,
        positionX: 300,
        positionY: 150,
      });
      expect(repo.listLocationCards(project.id)).toHaveLength(1);

      repo.createLocationImage({
        locationCardId: location.id,
        imageType: 'esterno',
        filePath: '/tmp/porto.png',
        prompt: 'porto nebbioso notturno',
      });
      expect(repo.listLocationImages(location.id)).toHaveLength(1);
      repo.setLocationChapterLinks({
        locationCardId: location.id,
        chapterNodeIds: [chapterNode2.id],
      });
      expect(repo.listLocationChapterLinks(location.id).map((link) => link.chapterNodeId)).toEqual([chapterNode2.id]);
      expect(repo.listLocationsForChapter(project.id, chapterNode2.id)).toHaveLength(1);

      repo.deleteChapterEdge(edge.id);
      expect(repo.listChapterEdges(project.id)).toHaveLength(0);

      repo.deleteChapterNode(chapterNode.id);
      repo.deleteChapterNode(chapterNode2.id);
      expect(repo.listChapterNodes(project.id)).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});
