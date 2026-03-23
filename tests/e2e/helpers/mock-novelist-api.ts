import type { Page } from '@playwright/test';

export interface NovelistApiMockBootstrap {
  projectName?: string;
  rootPath?: string;
  plotCount?: number;
  storyNodeCount?: number;
  longChapterWords?: number;
}

export interface NovelistApiMockOptions {
  bootstrap?: NovelistApiMockBootstrap;
}

export async function installNovelistApiMock(page: Page, options: NovelistApiMockOptions = {}): Promise<void> {
  await page.addInitScript((inputOptions: NovelistApiMockOptions) => {
    const windowWithApi = window as Window & { novelistApi?: Record<string, unknown> };
    const bootstrap = inputOptions?.bootstrap ?? null;

    const nowIso = (): string => new Date().toISOString();
    const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

    let idCounter = 1;
    const nextId = (prefix: string): string => `${prefix}-${idCounter++}`;

    const plotColor = (plotNumber: number): string => {
      const palette = [
        '#2563eb',
        '#16a34a',
        '#dc2626',
        '#9333ea',
        '#ea580c',
        '#0d9488',
        '#4f46e5',
        '#ca8a04',
        '#0891b2',
        '#be123c',
      ];
      return palette[(plotNumber - 1) % palette.length] ?? '#6b7280';
    };

    const state = {
      currentProject: null as null | {
        id: string;
        name: string;
        rootPath: string;
        dbPath: string;
        assetsPath: string;
        snapshotsPath: string;
      },
      plots: [] as Array<{
        id: string;
        projectId: string;
        number: number;
        label: string;
        summary: string;
        color: string;
        positionX: number;
        positionY: number;
        createdAt: string;
        updatedAt: string;
      }>,
      nodes: [] as Array<{
        id: string;
        projectId: string;
        title: string;
        description: string;
        plotNumber: number;
        blockNumber: number;
        positionX: number;
        positionY: number;
        richTextDocId: string | null;
        createdAt: string;
        updatedAt: string;
      }>,
      edges: [] as Array<{
        id: string;
        projectId: string;
        sourceNodeId: string;
        targetNodeId: string;
        label: string | null;
        createdAt: string;
      }>,
      chapterDocumentsByNodeId: new Map<
        string,
        {
          id: string;
          chapterNodeId: string;
          contentJson: string;
          wordCount: number;
          createdAt: string;
          updatedAt: string;
        }
      >(),
      codexSettings: {
        projectId: '',
        enabled: true,
        provider: 'codex_cli' as 'codex_cli' | 'openai_api' | 'ollama',
        allowApiCalls: false,
        autoSummarizeDescriptions: true,
        apiKey: null as string | null,
        hasStoredApiKey: false,
        hasRuntimeApiKey: false,
        apiKeyStorage: 'none' as 'secure_storage' | 'legacy_db' | 'none',
        apiModel: 'gpt-5-mini',
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
      appPreferences: {
        autosaveMode: 'auto' as 'manual' | 'interval' | 'auto',
        autosaveIntervalMinutes: 5,
        updatedAt: nowIso(),
      },
      codexMessages: [] as Array<{
        id: string;
        projectId: string;
        chapterNodeId: string;
        role: 'user' | 'assistant';
        content: string;
        mode: 'cli' | 'fallback' | null;
        createdAt: string;
      }>,
      characterCards: [] as Array<{
        id: string;
        projectId: string;
        firstName: string;
        lastName: string;
        sex: string;
        age: number | null;
        sexualOrientation: string;
        species: string;
        hairColor: string;
        bald: boolean;
        beard: string;
        physique: string;
        job: string;
        notes: string;
        plotNumber: number;
        positionX: number;
        positionY: number;
        createdAt: string;
        updatedAt: string;
      }>,
      characterImages: [] as Array<{
        id: string;
        characterCardId: string;
        imageType: string;
        filePath: string;
        prompt: string;
        createdAt: string;
      }>,
      characterChapterLinks: [] as Array<{
        characterCardId: string;
        chapterNodeId: string;
        createdAt: string;
      }>,
      locationCards: [] as Array<{
        id: string;
        projectId: string;
        name: string;
        locationType: string;
        description: string;
        notes: string;
        plotNumber: number;
        positionX: number;
        positionY: number;
        createdAt: string;
        updatedAt: string;
      }>,
      locationImages: [] as Array<{
        id: string;
        locationCardId: string;
        imageType: string;
        filePath: string;
        prompt: string;
        createdAt: string;
      }>,
      locationChapterLinks: [] as Array<{
        locationCardId: string;
        chapterNodeId: string;
        createdAt: string;
      }>,
    };

    const ensureProject = () => {
      if (!state.currentProject) {
        throw new Error('No open project session');
      }
      return state.currentProject;
    };

    const resetProjectData = (): void => {
      state.plots = [];
      state.nodes = [];
      state.edges = [];
      state.chapterDocumentsByNodeId.clear();
      state.codexMessages = [];
      state.characterCards = [];
      state.characterImages = [];
      state.characterChapterLinks = [];
      state.locationCards = [];
      state.locationImages = [];
      state.locationChapterLinks = [];
    };

    const buildWordSequence = (wordCount: number): string =>
      Array.from({ length: wordCount }, (_unused, index) => `parola${(index % 1000) + 1}`).join(' ');

    const richTextFromPlainText = (text: string): string =>
      JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: text ? [{ type: 'text', text }] : [],
          },
        ],
      });

    const applyBootstrap = (): void => {
      if (!bootstrap) {
        return;
      }

      const now = nowIso();
      const projectId = nextId('project');
      const rootPath = bootstrap.rootPath?.trim() || '/tmp/the-novelist-perf-project';
      const projectName = bootstrap.projectName?.trim() || 'Progetto Performance';
      const plotCount = Math.max(1, Math.min(bootstrap.plotCount ?? 1, 10));
      const requestedNodes = Math.max(0, bootstrap.storyNodeCount ?? 0);
      const longChapterWords = Math.max(0, bootstrap.longChapterWords ?? 0);
      const totalNodes = Math.max(requestedNodes, longChapterWords > 0 ? 1 : 0);

      state.currentProject = {
        id: projectId,
        name: projectName,
        rootPath,
        dbPath: `${rootPath}/project.db`,
        assetsPath: `${rootPath}/assets`,
        snapshotsPath: `${rootPath}/.snapshots`,
      };

      resetProjectData();
      state.codexSettings = {
        ...state.codexSettings,
        projectId,
        updatedAt: now,
      };

      for (let index = 0; index < plotCount; index += 1) {
        const number = index + 1;
        state.plots.push({
          id: nextId('plot'),
          projectId,
          number,
          label: `Trama ${number}`,
          summary: '',
          color: plotColor(number),
          positionX: 120 + (index % 2) * 340,
          positionY: 120 + Math.floor(index / 2) * 220,
          createdAt: now,
          updatedAt: now,
        });
      }

      const perPlotBlockCounter = new Map<number, number>();
      for (let index = 0; index < totalNodes; index += 1) {
        const plotNumber = (index % plotCount) + 1;
        const nextBlock = (perPlotBlockCounter.get(plotNumber) ?? 0) + 1;
        perPlotBlockCounter.set(plotNumber, nextBlock);

        state.nodes.push({
          id: nextId('node'),
          projectId,
          title: `Capitolo ${index + 1}`,
          description: `Nodo performance ${index + 1}`,
          plotNumber,
          blockNumber: nextBlock,
          positionX: 80 + (index % 25) * 220,
          positionY: 80 + Math.floor(index / 25) * 120,
          richTextDocId: null,
          createdAt: now,
          updatedAt: now,
        });
      }

      if (longChapterWords > 0 && state.nodes[0]) {
        const chapterNodeId = state.nodes[0].id;
        const document = {
          id: nextId('doc'),
          chapterNodeId,
          contentJson: richTextFromPlainText(buildWordSequence(longChapterWords)),
          wordCount: longChapterWords,
          createdAt: now,
          updatedAt: now,
        };
        state.chapterDocumentsByNodeId.set(chapterNodeId, document);
        state.nodes[0].richTextDocId = document.id;
      }
    };

    applyBootstrap();

    const api = {
      ping: async (payload: { message: string }) => ({
        message: `Pong: ${payload.message}`,
        timestamp: nowIso(),
      }),

      getAppPreferences: async () => clone(state.appPreferences),

      updateAppPreferences: async (payload: {
        autosaveMode?: 'manual' | 'interval' | 'auto';
        autosaveIntervalMinutes?: number;
      }) => {
        state.appPreferences = {
          ...state.appPreferences,
          ...payload,
          updatedAt: nowIso(),
        };
        return clone(state.appPreferences);
      },

      createProject: async (payload: { rootPath: string; name: string }) => {
        const id = nextId('project');
        state.currentProject = {
          id,
          name: payload.name,
          rootPath: payload.rootPath,
          dbPath: `${payload.rootPath}/project.db`,
          assetsPath: `${payload.rootPath}/assets`,
          snapshotsPath: `${payload.rootPath}/.snapshots`,
        };
        resetProjectData();
        state.codexSettings = {
          ...state.codexSettings,
          projectId: id,
          updatedAt: nowIso(),
        };
        return clone(state.currentProject);
      },

      openProject: async (payload: { rootPath: string }) => {
        if (!state.currentProject || state.currentProject.rootPath !== payload.rootPath) {
          return api.createProject({ rootPath: payload.rootPath, name: 'Progetto Mock' });
        }
        return clone(state.currentProject);
      },

      closeProject: async () => {
        state.currentProject = null;
        return { ok: true as const };
      },

      inspectProjectPath: async (payload: { rootPath: string }) => {
        const exists = state.currentProject?.rootPath === payload.rootPath;
        return {
          exists,
          projectName: exists ? state.currentProject?.name ?? null : null,
        };
      },

      selectImageFile: async () => null as string | null,

      readImageDataUrl: async (payload: { filePath: string }) => {
        void payload;
        return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';
      },

      selectProjectDirectory: async () => state.currentProject?.rootPath ?? '/tmp/the-novelist-mock',

      getCurrentProject: async () => clone(state.currentProject),

      saveSnapshot: async (payload?: { reason?: string }) => ({
        fileName: `${nowIso().replace(/[:.]/g, '-')}.sqlite`,
        filePath: `${ensureProject().snapshotsPath}/snapshot.sqlite`,
        createdAt: nowIso(),
        reason: payload?.reason ?? 'manual',
      }),

      listSnapshots: async () => [],

      recoverLatestSnapshot: async () => null,

      getStoryState: async () => ({
        plots: clone(state.plots),
        nodes: clone(state.nodes),
        edges: clone(state.edges),
      }),

      createPlot: async (payload: {
        number: number;
        label?: string;
        summary?: string;
        color?: string;
        positionX?: number;
        positionY?: number;
      }) => {
        const project = ensureProject();
        const now = nowIso();
        const existing = state.plots.find((plot) => plot.number === payload.number);
        if (existing) {
          existing.label = payload.label?.trim() || existing.label;
          existing.summary = payload.summary ?? existing.summary;
          existing.color = payload.color?.trim() || existing.color;
          existing.updatedAt = now;
          return clone(existing);
        }

        const plot = {
          id: nextId('plot'),
          projectId: project.id,
          number: payload.number,
          label: payload.label?.trim() || `Trama ${payload.number}`,
          summary: payload.summary ?? '',
          color: payload.color?.trim() || plotColor(payload.number),
          positionX: payload.positionX ?? 120,
          positionY: payload.positionY ?? 120,
          createdAt: now,
          updatedAt: now,
        };
        state.plots.push(plot);
        return clone(plot);
      },

      updatePlot: async (payload: {
        id: string;
        label: string;
        summary: string;
        color?: string;
        positionX?: number;
        positionY?: number;
      }) => {
        const plot = state.plots.find((item) => item.id === payload.id);
        if (!plot) {
          throw new Error('Plot not found');
        }
        plot.label = payload.label.trim();
        plot.summary = payload.summary;
        plot.color = payload.color?.trim() || plot.color;
        plot.positionX = payload.positionX ?? plot.positionX;
        plot.positionY = payload.positionY ?? plot.positionY;
        plot.updatedAt = nowIso();
        return clone(plot);
      },

      deletePlot: async (payload: { id: string }) => {
        const plot = state.plots.find((item) => item.id === payload.id);
        if (!plot) {
          throw new Error('Plot not found');
        }

        const deletedNodeIds = new Set(
          state.nodes
            .filter((node) => node.projectId === plot.projectId && node.plotNumber === plot.number)
            .map((node) => node.id),
        );
        const deletedCharacterIds = new Set(
          state.characterCards
            .filter((card) => card.projectId === plot.projectId && card.plotNumber === plot.number)
            .map((card) => card.id),
        );
        const deletedLocationIds = new Set(
          state.locationCards
            .filter((card) => card.projectId === plot.projectId && card.plotNumber === plot.number)
            .map((card) => card.id),
        );

        state.nodes = state.nodes.filter((node) => !deletedNodeIds.has(node.id));
        state.edges = state.edges.filter(
          (edge) => !deletedNodeIds.has(edge.sourceNodeId) && !deletedNodeIds.has(edge.targetNodeId),
        );
        for (const nodeId of deletedNodeIds) {
          state.chapterDocumentsByNodeId.delete(nodeId);
        }
        state.codexMessages = state.codexMessages.filter(
          (message) => !deletedNodeIds.has(message.chapterNodeId),
        );
        state.characterChapterLinks = state.characterChapterLinks.filter(
          (link) =>
            !deletedNodeIds.has(link.chapterNodeId) && !deletedCharacterIds.has(link.characterCardId),
        );
        state.locationChapterLinks = state.locationChapterLinks.filter(
          (link) =>
            !deletedNodeIds.has(link.chapterNodeId) && !deletedLocationIds.has(link.locationCardId),
        );
        state.characterCards = state.characterCards.filter((card) => !deletedCharacterIds.has(card.id));
        state.characterImages = state.characterImages.filter(
          (image) => !deletedCharacterIds.has(image.characterCardId),
        );
        state.locationCards = state.locationCards.filter((card) => !deletedLocationIds.has(card.id));
        state.locationImages = state.locationImages.filter(
          (image) => !deletedLocationIds.has(image.locationCardId),
        );
        state.plots = state.plots.filter((item) => item.id !== payload.id);
        return { ok: true as const };
      },

      createStoryNode: async (payload: {
        title: string;
        description?: string;
        plotNumber: number;
        blockNumber?: number;
        positionX: number;
        positionY: number;
      }) => {
        const project = ensureProject();
        const now = nowIso();
        const maxBlock = state.nodes
          .filter((node) => node.plotNumber === payload.plotNumber)
          .reduce((max, node) => Math.max(max, node.blockNumber), 0);
        const node = {
          id: nextId('node'),
          projectId: project.id,
          title: payload.title.trim(),
          description: payload.description?.trim() ?? '',
          plotNumber: payload.plotNumber,
          blockNumber: payload.blockNumber ?? maxBlock + 1,
          positionX: payload.positionX,
          positionY: payload.positionY,
          richTextDocId: null,
          createdAt: now,
          updatedAt: now,
        };
        state.nodes.push(node);
        return clone(node);
      },

      updateStoryNode: async (payload: {
        id: string;
        title: string;
        description: string;
        plotNumber: number;
        blockNumber: number;
        positionX: number;
        positionY: number;
        richTextDocId?: string | null;
      }) => {
        const node = state.nodes.find((item) => item.id === payload.id);
        if (!node) {
          throw new Error(`Chapter node not found: ${payload.id}`);
        }
        node.title = payload.title.trim();
        node.description = payload.description.trim();
        node.plotNumber = payload.plotNumber;
        node.blockNumber = payload.blockNumber;
        node.positionX = payload.positionX;
        node.positionY = payload.positionY;
        node.richTextDocId = payload.richTextDocId ?? node.richTextDocId;
        node.updatedAt = nowIso();
        return clone(node);
      },

      deleteStoryNode: async (payload: { id: string }) => {
        state.nodes = state.nodes.filter((node) => node.id !== payload.id);
        state.edges = state.edges.filter((edge) => edge.sourceNodeId !== payload.id && edge.targetNodeId !== payload.id);
        state.chapterDocumentsByNodeId.delete(payload.id);
        state.characterChapterLinks = state.characterChapterLinks.filter((link) => link.chapterNodeId !== payload.id);
        state.locationChapterLinks = state.locationChapterLinks.filter((link) => link.chapterNodeId !== payload.id);
        return { ok: true as const };
      },

      createStoryEdge: async (payload: { sourceNodeId: string; targetNodeId: string; label?: string }) => {
        const project = ensureProject();
        const edge = {
          id: nextId('edge'),
          projectId: project.id,
          sourceNodeId: payload.sourceNodeId,
          targetNodeId: payload.targetNodeId,
          label: payload.label?.trim() || null,
          createdAt: nowIso(),
        };
        state.edges.push(edge);
        return clone(edge);
      },

      deleteStoryEdge: async (payload: { id: string }) => {
        state.edges = state.edges.filter((edge) => edge.id !== payload.id);
        return { ok: true as const };
      },

      getChapterDocument: async (payload: { chapterNodeId: string }) => {
        const node = state.nodes.find((item) => item.id === payload.chapterNodeId);
        if (!node) {
          throw new Error('Chapter node not found');
        }
        const existing = state.chapterDocumentsByNodeId.get(payload.chapterNodeId);
        if (existing) {
          return clone(existing);
        }
        const now = nowIso();
        const created = {
          id: nextId('doc'),
          chapterNodeId: payload.chapterNodeId,
          contentJson: JSON.stringify({
            type: 'doc',
            content: [{ type: 'paragraph', content: [] }],
          }),
          wordCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        state.chapterDocumentsByNodeId.set(payload.chapterNodeId, created);
        node.richTextDocId = created.id;
        return clone(created);
      },

      saveChapterDocument: async (payload: {
        chapterNodeId: string;
        contentJson: string;
        wordCount?: number;
      }) => {
        const existing = await api.getChapterDocument({ chapterNodeId: payload.chapterNodeId });
        const updated = {
          ...existing,
          contentJson: payload.contentJson,
          wordCount: payload.wordCount ?? existing.wordCount,
          updatedAt: nowIso(),
        };
        state.chapterDocumentsByNodeId.set(payload.chapterNodeId, updated);
        return clone(updated);
      },

      exportChapterDocx: async (payload: { chapterNodeId: string }) => ({
        filePath: `/tmp/${payload.chapterNodeId}.docx`,
      }),

      exportChapterPdf: async (payload: { chapterNodeId: string }) => ({
        filePath: `/tmp/${payload.chapterNodeId}.pdf`,
      }),

      printChapter: async () => ({ ok: true as const }),

      exportManuscriptDocx: async () => ({
        filePath: '/tmp/manoscritto-completo.docx',
      }),

      exportManuscriptPdf: async () => ({
        filePath: '/tmp/manoscritto-completo.pdf',
      }),

      printManuscript: async () => ({ ok: true as const }),

      listChapterCharacters: async (payload: { chapterNodeId: string }) => {
        const ids = new Set(
          state.characterChapterLinks
            .filter((link) => link.chapterNodeId === payload.chapterNodeId)
            .map((link) => link.characterCardId),
        );
        return clone(state.characterCards.filter((card) => ids.has(card.id)));
      },

      listChapterLocations: async (payload: { chapterNodeId: string }) => {
        const ids = new Set(
          state.locationChapterLinks
            .filter((link) => link.chapterNodeId === payload.chapterNodeId)
            .map((link) => link.locationCardId),
        );
        return clone(state.locationCards.filter((card) => ids.has(card.id)));
      },

      listCharacterCards: async () => clone(state.characterCards),

      createCharacterCard: async (payload: {
        firstName: string;
        lastName: string;
        sex: string;
        age: number | null;
        sexualOrientation: string;
        species: string;
        hairColor: string;
        bald: boolean;
        beard: string;
        physique: string;
        job: string;
        notes: string;
        plotNumber: number;
        positionX: number;
        positionY: number;
      }) => {
        const project = ensureProject();
        const now = nowIso();
        const card = {
          id: nextId('character'),
          projectId: project.id,
          firstName: payload.firstName,
          lastName: payload.lastName,
          sex: payload.sex,
          age: payload.age,
          sexualOrientation: payload.sexualOrientation,
          species: payload.species,
          hairColor: payload.hairColor,
          bald: payload.bald,
          beard: payload.beard,
          physique: payload.physique,
          job: payload.job,
          notes: payload.notes,
          plotNumber: payload.plotNumber,
          positionX: payload.positionX,
          positionY: payload.positionY,
          createdAt: now,
          updatedAt: now,
        };
        state.characterCards.push(card);
        return clone(card);
      },

      updateCharacterCard: async (payload: {
        id: string;
        firstName: string;
        lastName: string;
        sex: string;
        age: number | null;
        sexualOrientation: string;
        species: string;
        hairColor: string;
        bald: boolean;
        beard: string;
        physique: string;
        job: string;
        notes: string;
        plotNumber: number;
        positionX: number;
        positionY: number;
      }) => {
        const card = state.characterCards.find((item) => item.id === payload.id);
        if (!card) {
          throw new Error('Character card not found');
        }
        Object.assign(card, payload, { updatedAt: nowIso() });
        return clone(card);
      },

      deleteCharacterCard: async (payload: { id: string }) => {
        state.characterCards = state.characterCards.filter((card) => card.id !== payload.id);
        state.characterImages = state.characterImages.filter((image) => image.characterCardId !== payload.id);
        state.characterChapterLinks = state.characterChapterLinks.filter((link) => link.characterCardId !== payload.id);
        return { ok: true as const };
      },

      listCharacterChapterLinks: async (payload: { characterCardId: string }) =>
        state.characterChapterLinks
          .filter((link) => link.characterCardId === payload.characterCardId)
          .map((link) => link.chapterNodeId),

      setCharacterChapterLinks: async (payload: { characterCardId: string; chapterNodeIds: string[] }) => {
        state.characterChapterLinks = state.characterChapterLinks.filter(
          (link) => link.characterCardId !== payload.characterCardId,
        );
        const uniqueIds = [...new Set(payload.chapterNodeIds)];
        const createdAt = nowIso();
        state.characterChapterLinks.push(
          ...uniqueIds.map((chapterNodeId) => ({
            characterCardId: payload.characterCardId,
            chapterNodeId,
            createdAt,
          })),
        );
        return uniqueIds;
      },

      listCharacterImages: async (payload: { characterCardId: string }) =>
        clone(state.characterImages.filter((image) => image.characterCardId === payload.characterCardId)),

      createCharacterImage: async (payload: {
        characterCardId: string;
        imageType: string;
        filePath: string;
        prompt: string;
      }) => {
        const created = {
          id: nextId('character-image'),
          characterCardId: payload.characterCardId,
          imageType: payload.imageType,
          filePath: payload.filePath,
          prompt: payload.prompt,
          createdAt: nowIso(),
        };
        state.characterImages.push(created);
        return clone(created);
      },

      generateCharacterImage: async (payload: {
        characterCardId: string;
        imageType: string;
        prompt: string;
        size?: '1024x1024' | '1536x1024' | '1024x1536';
      }) =>
        api.createCharacterImage({
          characterCardId: payload.characterCardId,
          imageType: payload.imageType,
          filePath: `/mock/characters/${nextId('generated')}.png`,
          prompt: payload.prompt,
        }),

      deleteCharacterImage: async (payload: { id: string }) => {
        state.characterImages = state.characterImages.filter((image) => image.id !== payload.id);
        return { ok: true as const };
      },

      listLocationCards: async () => clone(state.locationCards),

      createLocationCard: async (payload: {
        name: string;
        locationType: string;
        description: string;
        notes: string;
        plotNumber: number;
        positionX: number;
        positionY: number;
      }) => {
        const project = ensureProject();
        const now = nowIso();
        const card = {
          id: nextId('location'),
          projectId: project.id,
          name: payload.name,
          locationType: payload.locationType,
          description: payload.description,
          notes: payload.notes,
          plotNumber: payload.plotNumber,
          positionX: payload.positionX,
          positionY: payload.positionY,
          createdAt: now,
          updatedAt: now,
        };
        state.locationCards.push(card);
        return clone(card);
      },

      updateLocationCard: async (payload: {
        id: string;
        name: string;
        locationType: string;
        description: string;
        notes: string;
        plotNumber: number;
        positionX: number;
        positionY: number;
      }) => {
        const card = state.locationCards.find((item) => item.id === payload.id);
        if (!card) {
          throw new Error('Location card not found');
        }
        Object.assign(card, payload, { updatedAt: nowIso() });
        return clone(card);
      },

      deleteLocationCard: async (payload: { id: string }) => {
        state.locationCards = state.locationCards.filter((card) => card.id !== payload.id);
        state.locationImages = state.locationImages.filter((image) => image.locationCardId !== payload.id);
        state.locationChapterLinks = state.locationChapterLinks.filter((link) => link.locationCardId !== payload.id);
        return { ok: true as const };
      },

      listLocationChapterLinks: async (payload: { locationCardId: string }) =>
        state.locationChapterLinks
          .filter((link) => link.locationCardId === payload.locationCardId)
          .map((link) => link.chapterNodeId),

      setLocationChapterLinks: async (payload: { locationCardId: string; chapterNodeIds: string[] }) => {
        state.locationChapterLinks = state.locationChapterLinks.filter(
          (link) => link.locationCardId !== payload.locationCardId,
        );
        const uniqueIds = [...new Set(payload.chapterNodeIds)];
        const createdAt = nowIso();
        state.locationChapterLinks.push(
          ...uniqueIds.map((chapterNodeId) => ({
            locationCardId: payload.locationCardId,
            chapterNodeId,
            createdAt,
          })),
        );
        return uniqueIds;
      },

      listLocationImages: async (payload: { locationCardId: string }) =>
        clone(state.locationImages.filter((image) => image.locationCardId === payload.locationCardId)),

      createLocationImage: async (payload: {
        locationCardId: string;
        imageType: string;
        filePath: string;
        prompt: string;
      }) => {
        const created = {
          id: nextId('location-image'),
          locationCardId: payload.locationCardId,
          imageType: payload.imageType,
          filePath: payload.filePath,
          prompt: payload.prompt,
          createdAt: nowIso(),
        };
        state.locationImages.push(created);
        return clone(created);
      },

      generateLocationImage: async (payload: {
        locationCardId: string;
        imageType: string;
        prompt: string;
        size?: '1024x1024' | '1536x1024' | '1024x1536';
      }) =>
        api.createLocationImage({
          locationCardId: payload.locationCardId,
          imageType: payload.imageType,
          filePath: `/mock/locations/${nextId('generated')}.png`,
          prompt: payload.prompt,
        }),

      deleteLocationImage: async (payload: { id: string }) => {
        state.locationImages = state.locationImages.filter((image) => image.id !== payload.id);
        return { ok: true as const };
      },

      codexStatus: async () => ({
        available: true,
        command: 'mock-codex',
        mode: 'fallback' as const,
        activeRequest: false,
        queuedRequests: 0,
        provider: state.codexSettings.provider,
        apiCallsEnabled: state.codexSettings.allowApiCalls,
      }),

      codexGetSettings: async () => clone(state.codexSettings),

      codexUpdateSettings: async (payload: {
        enabled?: boolean;
        provider?: 'codex_cli' | 'openai_api' | 'ollama';
        allowApiCalls?: boolean;
        autoSummarizeDescriptions?: boolean;
        apiKey?: string | null;
        clearStoredApiKey?: boolean;
        apiModel?: string;
      }) => {
        if (payload.enabled !== undefined) {
          state.codexSettings.enabled = payload.enabled;
        }
        if (payload.provider !== undefined) {
          state.codexSettings.provider = payload.provider;
        }
        if (payload.allowApiCalls !== undefined) {
          state.codexSettings.allowApiCalls = payload.allowApiCalls;
        }
        if (payload.autoSummarizeDescriptions !== undefined) {
          state.codexSettings.autoSummarizeDescriptions = payload.autoSummarizeDescriptions;
        }
        if (payload.apiModel !== undefined && payload.apiModel.trim()) {
          state.codexSettings.apiModel = payload.apiModel.trim();
        }
        if (payload.clearStoredApiKey || payload.apiKey === null) {
          state.codexSettings.hasStoredApiKey = false;
          state.codexSettings.hasRuntimeApiKey = false;
          state.codexSettings.apiKeyStorage = 'none';
        } else if (typeof payload.apiKey === 'string' && payload.apiKey.trim()) {
          state.codexSettings.hasStoredApiKey = true;
          state.codexSettings.hasRuntimeApiKey = true;
          state.codexSettings.apiKeyStorage = 'secure_storage';
        }
        state.codexSettings.updatedAt = nowIso();
        return clone(state.codexSettings);
      },

      codexAssist: async (payload: {
        message: string;
        context?: string;
        projectName?: string;
      }) => {
        if (payload.message.includes('descrizione di personaggio')) {
          return {
            output: JSON.stringify({
              personaggio: {
                sesso: 'femmina',
                età: 32,
                colore_capelli: 'rossi',
                corporatura: 'slanciata',
                professione: 'investigatrice',
              },
            }),
            mode: 'fallback' as const,
            usedCommand: 'mock-codex',
          };
        }

        if (payload.message.includes('descrizione di location')) {
          return {
            output: JSON.stringify({
              location: {
                tipologia_luogo: 'porto',
                descrizione: 'Porto nebbioso con banchine umide e gru arrugginite.',
              },
            }),
            mode: 'fallback' as const,
            usedCommand: 'mock-codex',
          };
        }

        return {
          output: `Suggerimento mock: ${payload.message}`,
          mode: 'fallback' as const,
          usedCommand: 'mock-codex',
        };
      },

      codexTransformSelection: async (payload: {
        action: 'correggi' | 'riscrivi' | 'espandi' | 'riduci';
        selectedText: string;
        chapterTitle?: string;
        projectName?: string;
        chapterText?: string;
      }) => {
        const source = payload.selectedText.trim();
        let output = source;
        if (payload.action === 'correggi') {
          output = source ? source.charAt(0).toUpperCase() + source.slice(1) : source;
        } else if (payload.action === 'riscrivi') {
          output = `Versione riscritta: ${source}`;
        } else if (payload.action === 'espandi') {
          output = `${source}\nDettaglio aggiuntivo mock.`;
        } else if (payload.action === 'riduci') {
          output = source.length > 24 ? `${source.slice(0, 24)}...` : source;
        }
        return {
          output,
          mode: 'fallback' as const,
          usedCommand: 'mock-codex',
        };
      },

      codexChat: async (payload: {
        message: string;
        chapterNodeId: string;
        chapterTitle?: string;
        projectName?: string;
        chapterText?: string;
      }) => {
        const project = ensureProject();
        const userMessage = {
          id: nextId('chat'),
          projectId: project.id,
          chapterNodeId: payload.chapterNodeId,
          role: 'user' as const,
          content: payload.message,
          mode: null,
          createdAt: nowIso(),
        };
        const assistantMessage = {
          id: nextId('chat'),
          projectId: project.id,
          chapterNodeId: payload.chapterNodeId,
          role: 'assistant' as const,
          content: `Risposta mock: ${payload.message}`,
          mode: 'fallback' as const,
          createdAt: nowIso(),
        };
        state.codexMessages.push(userMessage, assistantMessage);
        return {
          output: assistantMessage.content,
          mode: 'fallback' as const,
          usedCommand: 'mock-codex',
        };
      },

      codexGetChatHistory: async (payload: { chapterNodeId: string; limit?: number }) => {
        const max = payload.limit ?? 100;
        const filtered = state.codexMessages.filter((msg) => msg.chapterNodeId === payload.chapterNodeId);
        return clone(filtered.slice(Math.max(filtered.length - max, 0)));
      },

      codexCancelActiveRequest: async () => ({ ok: true as const, cancelled: false }),
    };

    windowWithApi.novelistApi = api;
  }, options);
}
