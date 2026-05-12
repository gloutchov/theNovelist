import type {
  DashboardCharacterCard,
  DashboardLocationCard,
  DashboardSceneCard,
} from '../dashboard/dashboard-state';

type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
export type StoryNodeRecord = StoryState['nodes'][number];
type StoryEdgeRecord = StoryState['edges'][number];
type PlotRecord = StoryState['plots'][number];

export interface OutlineChapter {
  node: StoryNodeRecord;
  plot: PlotRecord | null;
  scenes: DashboardSceneCard[];
  characters: DashboardCharacterCard[];
  locations: DashboardLocationCard[];
  incomingIds: string[];
  outgoingIds: string[];
  issues: string[];
}

export interface OutlineState {
  loading: boolean;
  saving: boolean;
  error: string | null;
  chapters: OutlineChapter[];
  isolatedCount: number;
  ambiguousCount: number;
}

export function createEmptyOutlineState(): OutlineState {
  return {
    loading: false,
    saving: false,
    error: null,
    chapters: [],
    isolatedCount: 0,
    ambiguousCount: 0,
  };
}

function sortStoryNodesForOutline(chapters: StoryNodeRecord[]): StoryNodeRecord[] {
  return [...chapters].sort((left, right) => {
    if (left.plotNumber !== right.plotNumber) {
      return left.plotNumber - right.plotNumber;
    }
    if (left.blockNumber !== right.blockNumber) {
      return left.blockNumber - right.blockNumber;
    }
    return left.title.localeCompare(right.title, 'it');
  });
}

export function buildOutlineChapterOrder(
  chapters: StoryNodeRecord[],
  edges: StoryEdgeRecord[],
): {
  orderedChapters: StoryNodeRecord[];
  incomingById: Map<string, string[]>;
  outgoingById: Map<string, string[]>;
  cycleIds: Set<string>;
} {
  const chapterIds = new Set(chapters.map((chapter) => chapter.id));
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const incomingById = new Map<string, string[]>(chapters.map((chapter) => [chapter.id, []]));
  const outgoingById = new Map<string, string[]>(chapters.map((chapter) => [chapter.id, []]));

  for (const edge of edges) {
    if (!chapterIds.has(edge.sourceId) || !chapterIds.has(edge.targetId)) {
      continue;
    }
    outgoingById.get(edge.sourceId)?.push(edge.targetId);
    incomingById.get(edge.targetId)?.push(edge.sourceId);
  }

  const byCanonicalOrder = (leftId: string, rightId: string): number => {
    const left = chapterById.get(leftId);
    const right = chapterById.get(rightId);
    if (!left || !right) {
      return leftId.localeCompare(rightId);
    }
    return sortStoryNodesForOutline([left, right])[0]?.id === left.id ? -1 : 1;
  };

  for (const ids of incomingById.values()) {
    ids.sort(byCanonicalOrder);
  }
  for (const ids of outgoingById.values()) {
    ids.sort(byCanonicalOrder);
  }

  const orderedChapters: StoryNodeRecord[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const cycleIds = new Set<string>();

  function visit(chapter: StoryNodeRecord): void {
    if (visiting.has(chapter.id)) {
      cycleIds.add(chapter.id);
      return;
    }
    if (visited.has(chapter.id)) {
      return;
    }

    visiting.add(chapter.id);
    orderedChapters.push(chapter);
    visited.add(chapter.id);

    for (const targetId of outgoingById.get(chapter.id) ?? []) {
      const target = chapterById.get(targetId);
      if (!target) {
        continue;
      }
      if (visiting.has(targetId)) {
        cycleIds.add(chapter.id);
        cycleIds.add(targetId);
        continue;
      }
      visit(target);
    }
    visiting.delete(chapter.id);
  }

  const canonicalChapters = sortStoryNodesForOutline(chapters);
  const startChapters = canonicalChapters.filter(
    (chapter) => (incomingById.get(chapter.id)?.length ?? 0) === 0,
  );

  for (const chapter of startChapters.length > 0 ? startChapters : canonicalChapters) {
    visit(chapter);
  }
  for (const chapter of canonicalChapters) {
    visit(chapter);
  }

  return { orderedChapters, incomingById, outgoingById, cycleIds };
}
