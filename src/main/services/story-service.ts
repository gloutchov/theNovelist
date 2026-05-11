import type {
  ChapterNodeRecord,
  CreateChapterNodeInput,
  CreatePlotInput,
  CreateStoryEdgeInput,
  PlotRecord,
  StoryEdgeRecord,
  UpdateChapterNodeInput,
  UpdatePlotInput,
} from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';

export interface StoryState {
  plots: PlotRecord[];
  nodes: ChapterNodeRecord[];
  edges: StoryEdgeRecord[];
}

export interface CreatePlotServiceInput extends Omit<
  CreatePlotInput,
  'label' | 'summary' | 'color'
> {
  label?: string;
  summary?: string;
  color?: string;
}

export interface CreateChapterNodeServiceInput extends Omit<CreateChapterNodeInput, 'blockNumber'> {
  blockNumber?: number;
}

export interface UpdateChapterNodeServiceInput extends Omit<
  UpdateChapterNodeInput,
  'richTextDocId'
> {
  id: string;
  richTextDocId?: string | null;
}

function colorFromPlotNumber(plotNumber: number): string {
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
}

export class StoryService {
  constructor(private readonly sessionManager: ProjectSessionManager) {}

  getState(): StoryState {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return {
      plots: repository.listPlots(projectId),
      nodes: repository.listChapterNodes(projectId),
      edges: repository.listStoryEdges(projectId),
    };
  }

  async createPlot(input: CreatePlotServiceInput): Promise<PlotRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const plot = repository.createPlot(projectId, {
      number: input.number,
      label: input.label ?? `Trama ${input.number}`,
      summary: input.summary ?? '',
      color: input.color ?? colorFromPlotNumber(input.number),
      positionX: input.positionX,
      positionY: input.positionY,
    });

    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return plot;
  }

  async updatePlot(id: string, input: UpdatePlotInput): Promise<PlotRecord> {
    const { repository } = getStoryContext(this.sessionManager);
    const plot = repository.updatePlot(id, input);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return plot;
  }

  async deletePlot(id: string): Promise<void> {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deletePlot(id);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
  }

  async createNode(input: CreateChapterNodeServiceInput): Promise<ChapterNodeRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const blockNumber =
      input.blockNumber ?? repository.getNextBlockNumberForPlot(projectId, input.plotNumber);
    const node = repository.createChapterNode(projectId, {
      title: input.title,
      description: input.description,
      plotNumber: input.plotNumber,
      blockNumber,
      positionX: input.positionX,
      positionY: input.positionY,
    });

    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return node;
  }

  async updateNode(input: UpdateChapterNodeServiceInput): Promise<ChapterNodeRecord> {
    const { repository } = getStoryContext(this.sessionManager);
    const existing = repository.getChapterNodeById(input.id);
    if (!existing) {
      throw new Error(`Chapter node not found: ${input.id}`);
    }

    repository.updateChapterNode(input.id, {
      title: input.title,
      description: input.description,
      plotNumber: input.plotNumber,
      blockNumber: input.blockNumber,
      positionX: input.positionX,
      positionY: input.positionY,
      richTextDocId: input.richTextDocId ?? existing.richTextDocId,
    });

    const updated = repository.getChapterNodeById(input.id);
    if (!updated) {
      throw new Error(`Chapter node not found after update: ${input.id}`);
    }

    await syncProjectWikiSourcesBestEffort(this.sessionManager);
    return updated;
  }

  async deleteNode(id: string): Promise<void> {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deleteChapterNode(id);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);
  }

  createEdge(input: CreateStoryEdgeInput): StoryEdgeRecord {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    if (!repository.isIdInProject(projectId, input.sourceId)) {
      throw new Error(`Source entity does not belong to the project: ${input.sourceId}`);
    }
    if (!repository.isIdInProject(projectId, input.targetId)) {
      throw new Error(`Target entity does not belong to the project: ${input.targetId}`);
    }

    return repository.createStoryEdge(projectId, input);
  }

  deleteEdge(id: string): void {
    const { repository } = getStoryContext(this.sessionManager);
    repository.deleteStoryEdge(id);
  }
}
