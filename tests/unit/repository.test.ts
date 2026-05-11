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
      const project = repo.createProject({
        name: 'Romanzo Test',
        rootPath: dir,
        targetWordCount: 80_000,
        targetChapterWordCount: 3_000,
        plannedCompletionDate: '2026-12-31',
      });
      expect(repo.getProjectById(project.id)?.name).toBe('Romanzo Test');
      expect(project.targetWordCount).toBe(80_000);
      expect(project.targetChapterWordCount).toBe(3_000);
      expect(project.plannedCompletionDate).toBe('2026-12-31');

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

      const edge = repo.createStoryEdge(project.id, {
        sourceId: chapterNode.id,
        targetId: chapterNode.id,
        label: 'self',
      });
      expect(repo.listStoryEdges(project.id)[0]?.id).toBe(edge.id);

      const document = repo.upsertChapterDocument({
        chapterNodeId: chapterNode.id,
        contentJson: '{"type":"doc","content":[]}',
        wordCount: 0,
      });
      expect(document.chapterNodeId).toBe(chapterNode.id);

      const session = repo.recordWritingSession(project.id, {
        chapterNodeId: chapterNode.id,
        wordDelta: 450,
        wordCount: 450,
      });
      expect(session.wordDelta).toBe(450);
      expect(repo.listWritingSessions(project.id)).toHaveLength(1);

      const codexSettings = repo.getOrCreateCodexSettings(project.id);
      expect(codexSettings.enabled).toBe(false);
      expect(codexSettings.provider).toBe('codex_cli');
      expect(codexSettings.fallbackProvider).toBe('none');
      expect(codexSettings.allowApiCalls).toBe(false);
      expect(codexSettings.allowExternalMemorySharing).toBe(false);
      expect(codexSettings.autoSummarizeDescriptions).toBe(true);
      expect(codexSettings.apiModel).toBe('gpt-5-mini');
      expect(codexSettings.apiImageModel).toBe('gpt-image-1');
      expect(codexSettings.ollamaModel).toBe('gemma4:e4b-it-q4_K_M');

      const updatedCodexSettings = repo.upsertCodexSettings(project.id, {
        enabled: true,
        provider: 'openai_api',
        fallbackProvider: 'ollama',
        allowApiCalls: true,
        allowExternalMemorySharing: false,
        autoSummarizeDescriptions: false,
        apiKey: 'test-key',
        apiModel: 'gpt-5-mini',
        apiImageModel: 'gpt-image-1',
        ollamaModel: 'gemma3:4b-it-q4_K_M',
      });
      expect(updatedCodexSettings.enabled).toBe(true);
      expect(updatedCodexSettings.provider).toBe('openai_api');
      expect(updatedCodexSettings.fallbackProvider).toBe('ollama');
      expect(updatedCodexSettings.allowApiCalls).toBe(true);
      expect(updatedCodexSettings.allowExternalMemorySharing).toBe(false);
      expect(updatedCodexSettings.autoSummarizeDescriptions).toBe(false);
      expect(updatedCodexSettings.apiKey).toBe('test-key');
      expect(updatedCodexSettings.apiImageModel).toBe('gpt-image-1');
      expect(updatedCodexSettings.ollamaModel).toBe('gemma3:4b-it-q4_K_M');

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
        eyeColor: 'verdi',
        skinColor: 'chiara',
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
      expect(character.eyeColor).toBe('verdi');
      expect(character.skinColor).toBe('chiara');

      repo.updateCharacterCard(character.id, {
        firstName: 'Anna',
        lastName: 'Rossi',
        sex: 'F',
        age: 31,
        sexualOrientation: 'etero',
        species: 'umana',
        hairColor: 'castani',
        eyeColor: 'nocciola',
        skinColor: 'olivastra',
        bald: false,
        beard: 'nessuna',
        physique: 'atletica',
        job: 'giornalista',
        notes: 'Protagonista',
        plotNumber: 1,
        positionX: 120,
        positionY: 220,
      });
      const updatedCharacter = repo.getCharacterCardById(character.id);
      expect(updatedCharacter?.eyeColor).toBe('nocciola');
      expect(updatedCharacter?.skinColor).toBe('olivastra');

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
      expect(
        repo
          .listCharacterChapterLinks(character.id)
          .map((link) => link.chapterNodeId)
          .sort(),
      ).toEqual([chapterNode.id, chapterNode2.id].sort());
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
      expect(repo.listLocationChapterLinks(location.id).map((link) => link.chapterNodeId)).toEqual([
        chapterNode2.id,
      ]);
      expect(repo.listLocationsForChapter(project.id, chapterNode2.id)).toHaveLength(1);

      repo.deleteStoryEdge(edge.id);
      expect(repo.listStoryEdges(project.id)).toHaveLength(0);

      repo.deleteChapterNode(chapterNode.id);
      repo.deleteChapterNode(chapterNode2.id);
      expect(repo.listChapterNodes(project.id)).toHaveLength(0);
    } finally {
      db.close();
    }
  });

  it('keeps destructive story deletes transactional across related tables', async () => {
    const dir = await createTempDir('novelist-repo-delete-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repo = new NovelistRepository(db);

    try {
      const project = repo.createProject({ name: 'Romanzo Test', rootPath: dir });
      const plot = repo.createPlot(project.id, {
        number: 1,
        label: 'Trama principale',
        summary: '',
        color: '#3366ff',
        positionX: 0,
        positionY: 0,
      });
      const chapter = repo.createChapterNode(project.id, {
        title: 'Capitolo 1',
        description: '',
        plotNumber: plot.number,
        blockNumber: 1,
        positionX: 0,
        positionY: 0,
      });
      const scene = repo.createSceneCard(project.id, {
        chapterNodeId: chapter.id,
        name: 'Scena 1',
        text: '',
        contentJson: null,
        notes: '',
        plotNumber: plot.number,
        positionX: 0,
        positionY: 0,
      });
      repo.upsertTimelineItem(project.id, {
        itemType: 'chapter',
        entityId: chapter.id,
        positionX: 10,
        positionY: 10,
        dateLabel: '',
      });
      repo.upsertTimelineItem(project.id, {
        itemType: 'scene',
        entityId: scene.id,
        positionX: 20,
        positionY: 20,
        dateLabel: '',
      });

      repo.deleteChapterNode(chapter.id);

      expect(repo.listChapterNodes(project.id)).toHaveLength(0);
      expect(repo.listSceneCards(project.id)).toHaveLength(0);
      expect(repo.listTimelineItems(project.id)).toHaveLength(0);

      const chapterAfterDelete = repo.createChapterNode(project.id, {
        title: 'Capitolo 2',
        description: '',
        plotNumber: plot.number,
        blockNumber: 1,
        positionX: 0,
        positionY: 0,
      });
      const character = repo.createCharacterCard(project.id, {
        firstName: 'Anna',
        lastName: 'Rossi',
        sex: 'F',
        age: null,
        sexualOrientation: '',
        species: 'umana',
        hairColor: '',
        eyeColor: '',
        skinColor: '',
        bald: false,
        beard: '',
        physique: '',
        job: '',
        notes: '',
        plotNumber: plot.number,
        positionX: 0,
        positionY: 0,
      });
      const location = repo.createLocationCard(project.id, {
        name: 'Porto',
        locationType: '',
        description: '',
        notes: '',
        plotNumber: plot.number,
        positionX: 0,
        positionY: 0,
      });
      repo.setCharacterChapterLinks({
        characterCardId: character.id,
        chapterNodeIds: [chapterAfterDelete.id],
      });
      repo.setLocationChapterLinks({
        locationCardId: location.id,
        chapterNodeIds: [chapterAfterDelete.id],
      });

      repo.deletePlot(plot.id);

      expect(repo.listPlots(project.id)).toHaveLength(0);
      expect(repo.listChapterNodes(project.id)).toHaveLength(0);
      expect(repo.listCharacterCards(project.id)).toHaveLength(0);
      expect(repo.listLocationCards(project.id)).toHaveLength(0);
      expect(repo.listTimelineItems(project.id)).toHaveLength(0);
    } finally {
      db.close();
    }
  });
});
