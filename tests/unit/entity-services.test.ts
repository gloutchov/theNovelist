import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openDatabase } from '../../src/main/persistence/database';
import { NovelistRepository } from '../../src/main/persistence/repository';
import type { ProjectRecord } from '../../src/main/persistence/types';
import type { ProjectSessionManager } from '../../src/main/projects/session';
import { CharacterService } from '../../src/main/services/character-service';
import type { ResolveImageApiRuntime } from '../../src/main/services/image-runtime';
import { LocationService } from '../../src/main/services/location-service';
import { ProjectService } from '../../src/main/services/project-service';
import { RevisionService } from '../../src/main/services/revision-service';
import { SceneService } from '../../src/main/services/scene-service';
import { StoryService } from '../../src/main/services/story-service';
import { TimelineService } from '../../src/main/services/timeline-service';

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
  syncProjectWikiSources = vi.fn().mockResolvedValue(undefined),
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
    syncProjectWikiSources,
  } as unknown as ProjectSessionManager;
}

const resolveImageApiRuntime: ResolveImageApiRuntime = async () => ({
  apiKey: 'test-key',
  model: 'gpt-image-1',
});

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('entity card services', () => {
  it('updates character cards while preserving legacy color fields when requested', async () => {
    const dir = await createTempDir('novelist-character-service-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repository = new NovelistRepository(db);
    const project = repository.createProject({ name: 'Romanzo', rootPath: dir });
    const syncProjectWikiSources = vi.fn().mockResolvedValue(undefined);

    try {
      repository.createPlot(project.id, {
        number: 1,
        label: 'Trama',
        summary: '',
        color: '#3366ff',
        positionX: 0,
        positionY: 0,
      });
      const character = repository.createCharacterCard(project.id, {
        firstName: 'Anna',
        lastName: 'Rossi',
        sex: 'F',
        age: 31,
        sexualOrientation: '',
        species: 'umana',
        hairColor: 'castani',
        eyeColor: 'verdi',
        skinColor: 'chiara',
        bald: false,
        beard: '',
        physique: '',
        job: 'giornalista',
        notes: '',
        plotNumber: 1,
        positionX: 10,
        positionY: 20,
      });

      const service = new CharacterService(
        createSessionManager(repository, project, syncProjectWikiSources),
        resolveImageApiRuntime,
      );
      const updated = await service.updateCard({
        id: character.id,
        firstName: 'Anna',
        lastName: 'Rossi',
        sex: 'F',
        age: 32,
        sexualOrientation: '',
        species: 'umana',
        hairColor: 'neri',
        eyeColor: '',
        skinColor: '',
        bald: false,
        beard: '',
        physique: '',
        job: 'direttrice',
        notes: 'Aggiornata',
        plotNumber: 1,
        positionX: 10,
        positionY: 20,
        preserveExistingEyeColor: true,
        preserveExistingSkinColor: true,
      });

      expect(updated.eyeColor).toBe('verdi');
      expect(updated.skinColor).toBe('chiara');
      expect(updated.job).toBe('direttrice');
      expect(syncProjectWikiSources).toHaveBeenCalledTimes(1);
    } finally {
      db.close();
    }
  });

  it('deduplicates location chapter links and rejects links outside the project', async () => {
    const dir = await createTempDir('novelist-location-service-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repository = new NovelistRepository(db);
    const project = repository.createProject({ name: 'Romanzo', rootPath: dir });
    const otherProject = repository.createProject({
      name: 'Altro romanzo',
      rootPath: path.join(dir, 'other'),
    });

    try {
      repository.createPlot(project.id, {
        number: 1,
        label: 'Trama',
        summary: '',
        color: '#3366ff',
        positionX: 0,
        positionY: 0,
      });
      repository.createPlot(otherProject.id, {
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
      const otherChapter = repository.createChapterNode(otherProject.id, {
        title: 'Capitolo esterno',
        description: '',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 0,
        positionY: 0,
      });
      const location = repository.createLocationCard(project.id, {
        name: 'Porto Vecchio',
        locationType: 'quartiere',
        description: '',
        notes: '',
        plotNumber: 1,
        positionX: 30,
        positionY: 40,
      });

      const service = new LocationService(
        createSessionManager(repository, project),
        resolveImageApiRuntime,
      );

      await expect(
        service.setChapterLinks(location.id, [chapter.id, otherChapter.id]),
      ).rejects.toThrow(`Chapter node not found: ${otherChapter.id}`);

      await expect(service.setChapterLinks(location.id, [chapter.id, chapter.id])).resolves.toEqual(
        [chapter.id],
      );
    } finally {
      db.close();
    }
  });

  it('creates story nodes with default block numbers and rejects edges outside the project', async () => {
    const dir = await createTempDir('novelist-story-service-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repository = new NovelistRepository(db);
    const project = repository.createProject({ name: 'Romanzo', rootPath: dir });
    const otherProject = repository.createProject({
      name: 'Altro romanzo',
      rootPath: path.join(dir, 'other'),
    });
    const syncProjectWikiSources = vi.fn().mockResolvedValue(undefined);

    try {
      const service = new StoryService(
        createSessionManager(repository, project, syncProjectWikiSources),
      );
      const plot = await service.createPlot({
        number: 1,
        positionX: 100,
        positionY: 100,
      });
      const firstNode = await service.createNode({
        title: 'Capitolo 1',
        description: '',
        plotNumber: plot.number,
        positionX: 10,
        positionY: 20,
      });
      const secondNode = await service.createNode({
        title: 'Capitolo 2',
        description: '',
        plotNumber: plot.number,
        positionX: 30,
        positionY: 40,
      });

      repository.createPlot(otherProject.id, {
        number: 1,
        label: 'Trama',
        summary: '',
        color: '#3366ff',
        positionX: 0,
        positionY: 0,
      });
      const externalNode = repository.createChapterNode(otherProject.id, {
        title: 'Capitolo esterno',
        description: '',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 0,
        positionY: 0,
      });

      expect(firstNode.blockNumber).toBe(1);
      expect(secondNode.blockNumber).toBe(2);
      expect(() =>
        service.createEdge({
          sourceId: firstNode.id,
          targetId: externalNode.id,
          sourceHandle: null,
          targetHandle: null,
          label: null,
        }),
      ).toThrow(`Target entity does not belong to the project: ${externalNode.id}`);
      expect(syncProjectWikiSources).toHaveBeenCalledTimes(3);
    } finally {
      db.close();
    }
  });

  it('validates scene and timeline entities against the active project', async () => {
    const dir = await createTempDir('novelist-scene-timeline-service-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repository = new NovelistRepository(db);
    const project = repository.createProject({ name: 'Romanzo', rootPath: dir });
    const otherProject = repository.createProject({
      name: 'Altro romanzo',
      rootPath: path.join(dir, 'other'),
    });

    try {
      for (const projectId of [project.id, otherProject.id]) {
        repository.createPlot(projectId, {
          number: 1,
          label: 'Trama',
          summary: '',
          color: '#3366ff',
          positionX: 0,
          positionY: 0,
        });
      }
      const chapter = repository.createChapterNode(project.id, {
        title: 'Capitolo 1',
        description: '',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 0,
        positionY: 0,
      });
      const otherChapter = repository.createChapterNode(otherProject.id, {
        title: 'Capitolo esterno',
        description: '',
        plotNumber: 1,
        blockNumber: 1,
        positionX: 0,
        positionY: 0,
      });

      const sessionManager = createSessionManager(repository, project);
      const sceneService = new SceneService(sessionManager);
      const timelineService = new TimelineService(sessionManager);

      await expect(
        sceneService.createCard({
          chapterNodeId: otherChapter.id,
          name: 'Scena esterna',
          text: '',
          contentJson: null,
          notes: '',
          plotNumber: 1,
          positionX: 0,
          positionY: 0,
        }),
      ).rejects.toThrow('Chapter node not found');

      const scene = await sceneService.createCard({
        chapterNodeId: chapter.id,
        name: 'Scena interna',
        text: '',
        contentJson: null,
        notes: '',
        plotNumber: 1,
        positionX: 0,
        positionY: 0,
      });
      expect(
        timelineService.updateItem({
          itemType: 'scene',
          entityId: scene.id,
          positionX: 200,
          positionY: 40,
          dateLabel: 'Giorno 1',
        }).entityId,
      ).toBe(scene.id);
      expect(() =>
        timelineService.updateItem({
          itemType: 'chapter',
          entityId: otherChapter.id,
          positionX: 200,
          positionY: 40,
          dateLabel: 'Giorno 2',
        }),
      ).toThrow('Chapter node not found');
    } finally {
      db.close();
    }
  });

  it('restores a saved scene revision through the service layer', async () => {
    const dir = await createTempDir('novelist-revision-service-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repository = new NovelistRepository(db);
    const project = repository.createProject({ name: 'Romanzo', rootPath: dir });
    const syncProjectWikiSources = vi.fn().mockResolvedValue(undefined);

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
      const scene = repository.createSceneCard(project.id, {
        chapterNodeId: chapter.id,
        name: 'Scena originale',
        text: 'Testo originale',
        contentJson: null,
        notes: 'Note originali',
        plotNumber: 1,
        positionX: 0,
        positionY: 0,
      });
      const service = new RevisionService(
        createSessionManager(repository, project, syncProjectWikiSources),
      );
      const revision = service.create({
        entityType: 'scene',
        entityId: scene.id,
        label: 'Prima versione',
      });

      repository.updateSceneCard(scene.id, {
        chapterNodeId: chapter.id,
        name: 'Scena modificata',
        text: 'Testo modificato',
        contentJson: null,
        notes: 'Note modificate',
        plotNumber: 1,
        positionX: 10,
        positionY: 20,
      });

      await service.restore(revision.id);

      const restored = repository.getSceneCardById(scene.id);
      expect(restored?.name).toBe('Scena originale');
      expect(restored?.text).toBe('Testo originale');
      expect(restored?.notes).toBe('Note originali');
      expect(syncProjectWikiSources).toHaveBeenCalledOnce();
    } finally {
      db.close();
    }
  });

  it('reads only validated local project images from project assets', async () => {
    const dir = await createTempDir('novelist-project-service-');
    const externalDir = await createTempDir('novelist-project-external-');
    const db = openDatabase(path.join(dir, 'project.db'));
    const repository = new NovelistRepository(db);
    const project = repository.createProject({ name: 'Romanzo', rootPath: dir });
    const assetsPath = path.join(dir, 'assets');
    const imagePath = path.join(assetsPath, 'img', 'characters', 'portrait.png');
    const externalPath = path.join(externalDir, 'external.png');

    try {
      await mkdir(path.dirname(imagePath), { recursive: true });
      await writeFile(imagePath, pngSignature);
      await writeFile(externalPath, pngSignature);

      const service = new ProjectService(createSessionManager(repository, project));
      const dataUrl = await service.readImageDataUrl(
        path.join('assets', 'img', 'characters', 'portrait.png'),
      );

      expect(dataUrl).toBe(`data:image/png;base64,${pngSignature.toString('base64')}`);
      await expect(service.readImageDataUrl(externalPath)).rejects.toThrow(
        'Image file access outside project assets is not allowed',
      );
    } finally {
      db.close();
    }
  });
});
