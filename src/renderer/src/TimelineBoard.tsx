import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import type { Translate } from './i18n';

type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type StoryChapterNode = StoryState['nodes'][number];
type StoryPlot = StoryState['plots'][number];
type SceneCard = Awaited<ReturnType<(typeof window.novelistApi)['listSceneCards']>>[number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type TimelineItemType = 'chapter' | 'scene';

interface TimelineSettingsRecord {
  projectId: string;
  startLabel: string;
  endLabel: string;
  timelineEndX: number;
  updatedAt: string;
}

interface TimelineItemRecord {
  id: string;
  projectId: string;
  itemType: TimelineItemType;
  entityId: string;
  positionX: number;
  positionY: number;
  dateLabel: string;
  createdAt: string;
  updatedAt: string;
}

interface TimelineStateRecord {
  settings: TimelineSettingsRecord;
  items: TimelineItemRecord[];
}

interface TimelineApi {
  getTimelineState?: () => Promise<TimelineStateRecord>;
  updateTimelineSettings?: (payload: {
    startLabel: string;
    endLabel: string;
    timelineEndX: number;
  }) => Promise<TimelineSettingsRecord>;
  updateTimelineItem?: (payload: {
    itemType: TimelineItemType;
    entityId: string;
    positionX: number;
    positionY: number;
    dateLabel: string;
  }) => Promise<TimelineItemRecord>;
}

interface TimelineBoardProps {
  onStatus: (message: string) => void;
  t: Translate;
}

interface TimelineBlock {
  key: string;
  itemType: TimelineItemType;
  entityId: string;
  title: string;
  subtitle: string;
  plotNumber: number;
  plotLabel: string;
  plotColor: string;
  positionX: number;
  positionY: number;
  dateLabel: string;
}

interface DragState {
  key: string;
  offsetX: number;
  offsetY: number;
}

interface AxisDragState {
  startClientX: number;
  startTimelineEndX: number;
}

interface PanDragState {
  startClientX: number;
  startClientY: number;
  startScrollLeft: number;
  startScrollTop: number;
}

interface TimelineViewport {
  left: number;
  top: number;
  width: number;
  height: number;
}

const TIMELINE_Y = 96;
const TIMELINE_AXIS_START_X = 74;
const TIMELINE_DEFAULT_END_X = 1148;
const TIMELINE_MIN_END_X = 620;
const TIMELINE_MAX_END_X = 20_000;
const TIMELINE_CARD_WIDTH = 236;
const TIMELINE_SNAP_Y = 144;
const TIMELINE_SNAP_THRESHOLD = 190;
const TIMELINE_CANVAS_MIN_WIDTH = 1240;
const TIMELINE_CANVAS_MIN_HEIGHT = 680;
const TIMELINE_SIMULTANEOUS_X_THRESHOLD = 48;
const TIMELINE_STACK_GAP = 132;
const TIMELINE_ZOOM_MIN = 0.5;
const TIMELINE_ZOOM_MAX = 1.8;
const TIMELINE_ZOOM_STEP = 0.15;
const TIMELINE_LOCAL_STORAGE_PREFIX = 'the-novelist.timeline.v1';
const TIMELINE_MINIMAP_MAX_WIDTH = 190;
const TIMELINE_MINIMAP_MAX_HEIGHT = 130;

function getTimelineApi(): TimelineApi {
  return window.novelistApi as unknown as TimelineApi;
}

function createEmptyTimelineState(projectId = ''): TimelineStateRecord {
  return {
    settings: {
      projectId,
      startLabel: '',
      endLabel: '',
      timelineEndX: TIMELINE_DEFAULT_END_X,
      updatedAt: new Date().toISOString(),
    },
    items: [],
  };
}

function getLocalTimelineKey(projectId: string): string {
  return `${TIMELINE_LOCAL_STORAGE_PREFIX}.${projectId || 'default'}`;
}

function readLocalTimelineState(projectId: string): TimelineStateRecord | null {
  try {
    const raw = window.localStorage.getItem(getLocalTimelineKey(projectId));
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<TimelineStateRecord>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    const settings = parsed.settings;
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    return {
      settings: {
        projectId,
        startLabel: typeof settings?.startLabel === 'string' ? settings.startLabel : '',
        endLabel: typeof settings?.endLabel === 'string' ? settings.endLabel : '',
        timelineEndX: Number(settings?.timelineEndX) || TIMELINE_DEFAULT_END_X,
        updatedAt:
          typeof settings?.updatedAt === 'string' ? settings.updatedAt : new Date().toISOString(),
      },
      items: items
        .filter(
          (item): item is TimelineItemRecord =>
            Boolean(item) &&
            (item as TimelineItemRecord).itemType !== undefined &&
            ((item as TimelineItemRecord).itemType === 'chapter' ||
              (item as TimelineItemRecord).itemType === 'scene') &&
            typeof (item as TimelineItemRecord).entityId === 'string',
        )
        .map((item) => ({
          id: String(item.id || `local-${item.itemType}-${item.entityId}`),
          projectId,
          itemType: item.itemType,
          entityId: item.entityId,
          positionX: Number(item.positionX) || 0,
          positionY: Number(item.positionY) || 0,
          dateLabel: typeof item.dateLabel === 'string' ? item.dateLabel : '',
          createdAt: typeof item.createdAt === 'string' ? item.createdAt : new Date().toISOString(),
          updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : new Date().toISOString(),
        })),
    };
  } catch {
    return null;
  }
}

function writeLocalTimelineState(projectId: string, state: TimelineStateRecord): void {
  try {
    window.localStorage.setItem(
      getLocalTimelineKey(projectId),
      JSON.stringify({
        settings: { ...state.settings, projectId },
        items: state.items.map((item) => ({ ...item, projectId })),
      }),
    );
  } catch {
    // localStorage can be unavailable in hardened contexts; IPC remains the primary persistence.
  }
}

function upsertLocalTimelineItem(
  projectId: string,
  item: TimelineBlock,
  currentState: TimelineStateRecord,
): TimelineItemRecord {
  const timestamp = new Date().toISOString();
  const existing = currentState.items.find(
    (savedItem) => savedItem.itemType === item.itemType && savedItem.entityId === item.entityId,
  );
  const saved: TimelineItemRecord = {
    id: existing?.id ?? `local-${item.itemType}-${item.entityId}`,
    projectId,
    itemType: item.itemType,
    entityId: item.entityId,
    positionX: item.positionX,
    positionY: item.positionY,
    dateLabel: item.dateLabel,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  };
  return saved;
}

function getProjectTimelineId(project: ProjectRecord | null): string {
  return project?.id || project?.rootPath || 'default';
}

function timelineKey(itemType: TimelineItemType, entityId: string): string {
  return `${itemType}:${entityId}`;
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

function normalizePlotLabel(plot: StoryPlot | undefined, plotNumber: number, t: Translate): string {
  return plot?.label?.trim() || `${t('common.plot')} ${plotNumber}`;
}

function getPlotColor(plot: StoryPlot | undefined, plotNumber: number): string {
  return plot?.color ?? colorFromPlotNumber(plotNumber);
}

function getSavedItem(
  savedItems: Map<string, TimelineItemRecord>,
  itemType: TimelineItemType,
  entityId: string,
): TimelineItemRecord | undefined {
  return savedItems.get(timelineKey(itemType, entityId));
}

function buildTimelineBlocks(
  chapters: StoryChapterNode[],
  scenes: SceneCard[],
  plots: StoryPlot[],
  savedItems: TimelineItemRecord[],
  t: Translate,
): TimelineBlock[] {
  const plotsByNumber = new Map(plots.map((plot) => [plot.number, plot]));
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const savedItemsByKey = new Map(
    savedItems.map((item) => [timelineKey(item.itemType, item.entityId), item]),
  );

  const chapterBlocks = [...chapters]
    .sort((left, right) => {
      if (left.plotNumber !== right.plotNumber) return left.plotNumber - right.plotNumber;
      if (left.blockNumber !== right.blockNumber) return left.blockNumber - right.blockNumber;
      return left.title.localeCompare(right.title, 'it');
    })
    .map<TimelineBlock>((chapter, index) => {
      const saved = getSavedItem(savedItemsByKey, 'chapter', chapter.id);
      const plot = plotsByNumber.get(chapter.plotNumber);
      return {
        key: timelineKey('chapter', chapter.id),
        itemType: 'chapter',
        entityId: chapter.id,
        title: chapter.title,
        subtitle: chapter.description || `${t('story.modal.blockNumber')} ${chapter.blockNumber}`,
        plotNumber: chapter.plotNumber,
        plotLabel: normalizePlotLabel(plot, chapter.plotNumber, t),
        plotColor: getPlotColor(plot, chapter.plotNumber),
        positionX: saved?.positionX ?? 72 + (index % 4) * 280,
        positionY: saved?.positionY ?? 250 + Math.floor(index / 4) * 128,
        dateLabel: saved?.dateLabel ?? '',
      };
    });

  const sceneBlocks = [...scenes]
    .sort((left, right) => {
      if (left.plotNumber !== right.plotNumber) return left.plotNumber - right.plotNumber;
      return left.name.localeCompare(right.name, 'it');
    })
    .map<TimelineBlock>((scene, index) => {
      const saved = getSavedItem(savedItemsByKey, 'scene', scene.id);
      const chapter = chaptersById.get(scene.chapterNodeId);
      const plot = plotsByNumber.get(scene.plotNumber);
      const defaultIndex = chapterBlocks.length + index;
      return {
        key: timelineKey('scene', scene.id),
        itemType: 'scene',
        entityId: scene.id,
        title: scene.name,
        subtitle: chapter?.title ?? t('common.unavailable'),
        plotNumber: scene.plotNumber,
        plotLabel: normalizePlotLabel(plot, scene.plotNumber, t),
        plotColor: getPlotColor(plot, scene.plotNumber),
        positionX: saved?.positionX ?? 72 + (defaultIndex % 4) * 280,
        positionY: saved?.positionY ?? 250 + Math.floor(defaultIndex / 4) * 128,
        dateLabel: saved?.dateLabel ?? '',
      };
    });

  return [...chapterBlocks, ...sceneBlocks];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getTimelineCenterX(item: Pick<TimelineBlock, 'positionX'>): number {
  return item.positionX + TIMELINE_CARD_WIDTH / 2;
}

function isSameTimelineColumn(left: TimelineBlock, right: TimelineBlock): boolean {
  return (
    Math.abs(getTimelineCenterX(left) - getTimelineCenterX(right)) <=
    TIMELINE_SIMULTANEOUS_X_THRESHOLD
  );
}

function isDirectlyAttachedToTimeline(item: TimelineBlock): boolean {
  return item.positionY <= TIMELINE_SNAP_Y + 8 || Boolean(item.dateLabel.trim());
}

function isAttachedToTimeline(item: TimelineBlock, items: TimelineBlock[]): boolean {
  if (isDirectlyAttachedToTimeline(item)) {
    return true;
  }

  return items.some(
    (candidate) =>
      candidate.key !== item.key &&
      isSameTimelineColumn(candidate, item) &&
      isDirectlyAttachedToTimeline(candidate),
  );
}

function snapTimelineItem(item: TimelineBlock, items: TimelineBlock[]): TimelineBlock {
  if (item.positionY >= TIMELINE_SNAP_THRESHOLD) {
    return item;
  }

  const centerX = getTimelineCenterX(item);
  const sameMomentItems = items
    .filter(
      (candidate) =>
        candidate.key !== item.key &&
        isAttachedToTimeline(candidate, items) &&
        Math.abs(getTimelineCenterX(candidate) - centerX) <= TIMELINE_SIMULTANEOUS_X_THRESHOLD,
    )
    .sort((left, right) => left.positionY - right.positionY);

  if (sameMomentItems.length === 0) {
    return { ...item, positionY: TIMELINE_SNAP_Y };
  }

  const anchorCenterX = getTimelineCenterX(sameMomentItems[0]);
  const nextY =
    Math.max(...sameMomentItems.map((candidate) => candidate.positionY)) + TIMELINE_STACK_GAP;
  return {
    ...item,
    positionX: anchorCenterX - TIMELINE_CARD_WIDTH / 2,
    positionY: nextY,
  };
}

export default function TimelineBoard({ onStatus, t }: TimelineBoardProps) {
  const [items, setItems] = useState<TimelineBlock[]>([]);
  const [settings, setSettings] = useState<TimelineSettingsRecord | null>(null);
  const [startLabel, setStartLabel] = useState<string>('');
  const [endLabel, setEndLabel] = useState<string>('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [dragging, setDragging] = useState<DragState | null>(null);
  const [axisDrag, setAxisDrag] = useState<AxisDragState | null>(null);
  const [panDrag, setPanDrag] = useState<PanDragState | null>(null);
  const [timelineZoom, setTimelineZoom] = useState<number>(1);
  const [timelineEndX, setTimelineEndX] = useState<number>(TIMELINE_DEFAULT_END_X);
  const [timelineViewport, setTimelineViewport] = useState<TimelineViewport>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const scrollShellRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const itemsRef = useRef<TimelineBlock[]>(items);
  const projectIdRef = useRef<string>('default');
  const localTimelineStateRef = useRef<TimelineStateRecord>(createEmptyTimelineState('default'));

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const selectedItem = useMemo(
    () => (selectedKey ? (items.find((item) => item.key === selectedKey) ?? null) : null),
    [items, selectedKey],
  );

  const canvasWidth = useMemo(
    () =>
      Math.max(
        TIMELINE_CANVAS_MIN_WIDTH,
        timelineEndX + 220,
        ...items.map((item) => item.positionX + TIMELINE_CARD_WIDTH + 96),
      ),
    [items, timelineEndX],
  );

  const canvasHeight = useMemo(
    () => Math.max(TIMELINE_CANVAS_MIN_HEIGHT, ...items.map((item) => item.positionY + 160)),
    [items],
  );

  const minimapScale = useMemo(
    () => Math.min(TIMELINE_MINIMAP_MAX_WIDTH / canvasWidth, TIMELINE_MINIMAP_MAX_HEIGHT / canvasHeight),
    [canvasHeight, canvasWidth],
  );
  const minimapWidth = Math.max(120, Math.round(canvasWidth * minimapScale));
  const minimapHeight = Math.max(76, Math.round(canvasHeight * minimapScale));

  const refreshTimeline = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const timelineApi = getTimelineApi();
      const [currentProject, storyState, scenes] = await Promise.all([
        window.novelistApi.getCurrentProject(),
        window.novelistApi.getStoryState(),
        window.novelistApi.listSceneCards(),
      ]);
      const projectId = getProjectTimelineId(currentProject);
      projectIdRef.current = projectId;
      const localState = readLocalTimelineState(projectId) ?? createEmptyTimelineState(projectId);
      let timelineState = localState;
      let usingLocalTimeline = !timelineApi.getTimelineState;
      if (timelineApi.getTimelineState) {
        try {
          timelineState = await timelineApi.getTimelineState();
          if (localState.items.length > 0) {
            const databaseItemKeys = new Set(
              timelineState.items.map((item) => timelineKey(item.itemType, item.entityId)),
            );
            timelineState = {
              settings: {
                ...timelineState.settings,
                startLabel: timelineState.settings.startLabel || localState.settings.startLabel,
                endLabel: timelineState.settings.endLabel || localState.settings.endLabel,
                timelineEndX:
                  timelineState.settings.timelineEndX || localState.settings.timelineEndX,
              },
              items: [
                ...timelineState.items,
                ...localState.items.filter(
                  (item) => !databaseItemKeys.has(timelineKey(item.itemType, item.entityId)),
                ),
              ],
            };
          }
        } catch {
          usingLocalTimeline = true;
        }
      }
      localTimelineStateRef.current = timelineState;
      setSettings(timelineState.settings);
      setStartLabel(timelineState.settings.startLabel);
      setEndLabel(timelineState.settings.endLabel);
      setTimelineEndX(timelineState.settings.timelineEndX || TIMELINE_DEFAULT_END_X);
      setItems(
        buildTimelineBlocks(storyState.nodes, scenes, storyState.plots, timelineState.items, t),
      );
      if (usingLocalTimeline) {
        onStatus(t('timeline.statusLocalLoaded'));
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      onStatus(t('timeline.statusRefreshError'));
    } finally {
      setLoading(false);
    }
  }, [onStatus, t]);

  useEffect(() => {
    void refreshTimeline();
  }, [refreshTimeline]);

  const persistSettings = useCallback(
    async (override?: { timelineEndX?: number }): Promise<void> => {
      const nextTimelineEndX = override?.timelineEndX ?? timelineEndX;
      if (
        !settings ||
        (startLabel === settings.startLabel &&
          endLabel === settings.endLabel &&
          nextTimelineEndX === settings.timelineEndX)
      ) {
        return;
      }

      setSaving(true);
      setError(null);
      try {
        const timelineApi = getTimelineApi();
        if (!timelineApi.updateTimelineSettings) {
          const projectId = projectIdRef.current;
          const fallbackSettings = {
            ...settings,
            projectId,
            startLabel,
            endLabel,
            timelineEndX: nextTimelineEndX,
            updatedAt: new Date().toISOString(),
          };
          const nextState = {
            ...localTimelineStateRef.current,
            settings: fallbackSettings,
          };
          localTimelineStateRef.current = nextState;
          writeLocalTimelineState(projectId, nextState);
          setSettings(fallbackSettings);
          onStatus(t('timeline.statusLocalSaved'));
          return;
        }

        const saved = await timelineApi.updateTimelineSettings({
          startLabel,
          endLabel,
          timelineEndX: nextTimelineEndX,
        });
        localTimelineStateRef.current = {
          ...localTimelineStateRef.current,
          settings: saved,
        };
        writeLocalTimelineState(projectIdRef.current, localTimelineStateRef.current);
        setSettings(saved);
        onStatus(t('timeline.statusUpdated'));
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        const projectId = projectIdRef.current;
        const fallbackSettings = {
          ...(settings ?? createEmptyTimelineState(projectId).settings),
          projectId,
          startLabel,
          endLabel,
          timelineEndX: nextTimelineEndX,
          updatedAt: new Date().toISOString(),
        };
        const nextState = {
          ...localTimelineStateRef.current,
          settings: fallbackSettings,
        };
        localTimelineStateRef.current = nextState;
        writeLocalTimelineState(projectId, nextState);
        setSettings(fallbackSettings);
        setError(t('timeline.statusDatabaseUnavailable', { message }));
        onStatus(t('timeline.statusLocalSaved'));
      } finally {
        setSaving(false);
      }
    },
    [endLabel, onStatus, settings, startLabel, timelineEndX, t],
  );

  const persistItem = useCallback(
    async (item: TimelineBlock): Promise<void> => {
      setSaving(true);
      setError(null);
      try {
        const timelineApi = getTimelineApi();
        if (!timelineApi.updateTimelineItem) {
          const projectId = projectIdRef.current;
          const saved = upsertLocalTimelineItem(projectId, item, localTimelineStateRef.current);
          const nextState = {
            ...localTimelineStateRef.current,
            items: [
              ...localTimelineStateRef.current.items.filter(
                (savedItem) =>
                  !(savedItem.itemType === item.itemType && savedItem.entityId === item.entityId),
              ),
              saved,
            ],
          };
          localTimelineStateRef.current = nextState;
          writeLocalTimelineState(projectId, nextState);
          onStatus(t('timeline.statusLocalSaved'));
          return;
        }

        const saved = await timelineApi.updateTimelineItem({
          itemType: item.itemType,
          entityId: item.entityId,
          positionX: item.positionX,
          positionY: item.positionY,
          dateLabel: item.dateLabel,
        });
        setItems((current) =>
          current.map((currentItem) =>
            currentItem.key === item.key
              ? {
                  ...currentItem,
                  positionX: saved.positionX,
                  positionY: saved.positionY,
                  dateLabel: saved.dateLabel,
                }
              : currentItem,
          ),
        );
        localTimelineStateRef.current = {
          ...localTimelineStateRef.current,
          items: [
            ...localTimelineStateRef.current.items.filter(
              (savedItem) =>
                !(savedItem.itemType === item.itemType && savedItem.entityId === item.entityId),
            ),
            saved,
          ],
        };
        writeLocalTimelineState(projectIdRef.current, localTimelineStateRef.current);
        onStatus(t('timeline.statusUpdated'));
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        const projectId = projectIdRef.current;
        const saved = upsertLocalTimelineItem(projectId, item, localTimelineStateRef.current);
        const nextState = {
          ...localTimelineStateRef.current,
          items: [
            ...localTimelineStateRef.current.items.filter(
              (savedItem) =>
                !(savedItem.itemType === item.itemType && savedItem.entityId === item.entityId),
            ),
            saved,
          ],
        };
        localTimelineStateRef.current = nextState;
        writeLocalTimelineState(projectId, nextState);
        setError(t('timeline.statusDatabaseUnavailable', { message }));
        onStatus(t('timeline.statusLocalSaved'));
      } finally {
        setSaving(false);
      }
    },
    [onStatus, t],
  );

  useEffect(() => {
    if (!dragging) {
      return;
    }
    const activeDrag = dragging;

    function handlePointerMove(event: PointerEvent): void {
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const nextX = clamp(
        (event.clientX - rect.left) / timelineZoom - activeDrag.offsetX,
        24,
        canvasWidth - 260,
      );
      const nextY = clamp(
        (event.clientY - rect.top) / timelineZoom - activeDrag.offsetY,
        128,
        canvasHeight - 130,
      );
      setItems((current) =>
        current.map((item) =>
          item.key === activeDrag.key ? { ...item, positionX: nextX, positionY: nextY } : item,
        ),
      );
    }

    function handlePointerUp(): void {
      const current = itemsRef.current.find((item) => item.key === activeDrag.key);
      if (current) {
        const snapped = snapTimelineItem(current, itemsRef.current);
        setItems((nextItems) =>
          nextItems.map((item) => (item.key === snapped.key ? snapped : item)),
        );
        void persistItem(snapped);
      }
      setDragging(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [canvasHeight, canvasWidth, dragging, persistItem, timelineZoom]);

  useEffect(() => {
    if (!axisDrag) {
      return;
    }
    const activeDrag = axisDrag;

    function getNextTimelineEndX(event: PointerEvent): number {
      return clamp(
        activeDrag.startTimelineEndX + (event.clientX - activeDrag.startClientX) / timelineZoom,
        TIMELINE_MIN_END_X,
        TIMELINE_MAX_END_X,
      );
    }

    function handlePointerMove(event: PointerEvent): void {
      setTimelineEndX(getNextTimelineEndX(event));
    }

    function handlePointerUp(event: PointerEvent): void {
      const nextTimelineEndX = getNextTimelineEndX(event);
      setTimelineEndX(nextTimelineEndX);
      setAxisDrag(null);
      void persistSettings({ timelineEndX: nextTimelineEndX });
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [axisDrag, persistSettings, timelineZoom]);

  useEffect(() => {
    if (!panDrag) {
      return;
    }
    const activePan = panDrag;

    function handlePointerMove(event: PointerEvent): void {
      const shell = scrollShellRef.current;
      if (!shell) {
        return;
      }
      shell.scrollLeft = activePan.startScrollLeft - (event.clientX - activePan.startClientX);
      shell.scrollTop = activePan.startScrollTop - (event.clientY - activePan.startClientY);
    }

    function handlePointerUp(): void {
      setPanDrag(null);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp, { once: true });
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [panDrag]);

  function handleBlockPointerDown(
    event: ReactPointerEvent<HTMLElement>,
    item: TimelineBlock,
  ): void {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (target.closest('input, button, textarea, select')) {
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    setSelectedKey(item.key);
    setDragging({
      key: item.key,
      offsetX: (event.clientX - rect.left) / timelineZoom,
      offsetY: (event.clientY - rect.top) / timelineZoom,
    });
  }

  function handleAxisPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setAxisDrag({
      startClientX: event.clientX,
      startTimelineEndX: timelineEndX,
    });
  }

  function handlePanPointerDown(event: ReactPointerEvent<HTMLElement>): void {
    if (event.button !== 0) {
      return;
    }
    const target = event.target as HTMLElement;
    if (
      target.closest(
        '.timeline-block, .timeline-axis, .timeline-endpoint, input, button, textarea, select',
      )
    ) {
      return;
    }
    const shell = scrollShellRef.current;
    if (!shell) {
      return;
    }
    event.preventDefault();
    setPanDrag({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startScrollLeft: shell.scrollLeft,
      startScrollTop: shell.scrollTop,
    });
  }

  function handleDateChange(item: TimelineBlock, dateLabel: string): void {
    setItems((current) =>
      current.map((currentItem) =>
        currentItem.key === item.key ? { ...currentItem, dateLabel } : currentItem,
      ),
    );
  }

  const updateTimelineViewport = useCallback((): void => {
    const shell = scrollShellRef.current;
    if (!shell) {
      return;
    }

    setTimelineViewport({
      left: shell.scrollLeft / timelineZoom,
      top: shell.scrollTop / timelineZoom,
      width: shell.clientWidth / timelineZoom,
      height: shell.clientHeight / timelineZoom,
    });
  }, [timelineZoom]);

  const zoomTimelineFromCenter = useCallback(
    (direction: 1 | -1): void => {
      const shell = scrollShellRef.current;
      if (!shell) {
        setTimelineZoom((current) =>
          clamp(
            current + direction * TIMELINE_ZOOM_STEP,
            TIMELINE_ZOOM_MIN,
            TIMELINE_ZOOM_MAX,
          ),
        );
        return;
      }

      const pointerX = shell.clientWidth / 2;
      const pointerY = shell.clientHeight / 2;
      setTimelineZoom((currentZoom) => {
        const nextZoom = clamp(
          currentZoom + direction * TIMELINE_ZOOM_STEP,
          TIMELINE_ZOOM_MIN,
          TIMELINE_ZOOM_MAX,
        );
        if (nextZoom === currentZoom) {
          return currentZoom;
        }

        const contentX = (shell.scrollLeft + pointerX) / currentZoom;
        const contentY = (shell.scrollTop + pointerY) / currentZoom;
        window.requestAnimationFrame(() => {
          shell.scrollLeft = contentX * nextZoom - pointerX;
          shell.scrollTop = contentY * nextZoom - pointerY;
          updateTimelineViewport();
        });
        return nextZoom;
      });
    },
    [updateTimelineViewport],
  );

  const fitTimelineView = useCallback((): void => {
    const shell = scrollShellRef.current;
    if (!shell) {
      setTimelineZoom(1);
      return;
    }

    const contentBounds = items.reduce(
      (bounds, item) => ({
        left: Math.min(bounds.left, item.positionX),
        top: Math.min(bounds.top, item.positionY),
        right: Math.max(bounds.right, item.positionX + TIMELINE_CARD_WIDTH),
        bottom: Math.max(bounds.bottom, item.positionY + 132),
      }),
      {
        left: TIMELINE_AXIS_START_X,
        top: Math.max(0, TIMELINE_Y - 64),
        right: timelineEndX + 140,
        bottom: TIMELINE_Y + 180,
      },
    );
    const padding = 56;
    const contentWidth = contentBounds.right - contentBounds.left + padding * 2;
    const contentHeight = contentBounds.bottom - contentBounds.top + padding * 2;
    const nextZoom = clamp(
      Math.min(shell.clientWidth / contentWidth, shell.clientHeight / contentHeight, 1),
      TIMELINE_ZOOM_MIN,
      TIMELINE_ZOOM_MAX,
    );

    setTimelineZoom(nextZoom);
    window.requestAnimationFrame(() => {
      shell.scrollLeft = Math.max(0, (contentBounds.left - padding) * nextZoom);
      shell.scrollTop = Math.max(0, (contentBounds.top - padding) * nextZoom);
      updateTimelineViewport();
    });
  }, [items, timelineEndX, updateTimelineViewport]);

  function handleMinimapPointerDown(event: ReactPointerEvent<HTMLDivElement>): void {
    if (event.button !== 0) {
      return;
    }

    const shell = scrollShellRef.current;
    if (!shell) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const nextCenterX = ((event.clientX - rect.left) / minimapWidth) * canvasWidth;
    const nextCenterY = ((event.clientY - rect.top) / minimapHeight) * canvasHeight;
    shell.scrollLeft = Math.max(0, nextCenterX * timelineZoom - shell.clientWidth / 2);
    shell.scrollTop = Math.max(0, nextCenterY * timelineZoom - shell.clientHeight / 2);
    updateTimelineViewport();
  }

  const handleTimelineWheel = useCallback((event: WheelEvent): void => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest('input, textarea, select')) {
      return;
    }

    const shell = scrollShellRef.current;
    if (!shell) {
      return;
    }

    event.preventDefault();
    const rect = shell.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = event.clientY - rect.top;
    const deltaY = event.deltaY;

    setTimelineZoom((currentZoom) => {
      const direction = deltaY > 0 ? -1 : 1;
      const nextZoom = clamp(
        currentZoom + direction * TIMELINE_ZOOM_STEP,
        TIMELINE_ZOOM_MIN,
        TIMELINE_ZOOM_MAX,
      );
      if (nextZoom === currentZoom) {
        return currentZoom;
      }

      const contentX = (shell.scrollLeft + pointerX) / currentZoom;
      const contentY = (shell.scrollTop + pointerY) / currentZoom;
      window.requestAnimationFrame(() => {
        shell.scrollLeft = contentX * nextZoom - pointerX;
        shell.scrollTop = contentY * nextZoom - pointerY;
        updateTimelineViewport();
      });
      return nextZoom;
    });
  }, [updateTimelineViewport]);

  useEffect(() => {
    const shell = scrollShellRef.current;
    if (!shell) {
      return;
    }

    updateTimelineViewport();
    shell.addEventListener('wheel', handleTimelineWheel, { passive: false });
    return () => {
      shell.removeEventListener('wheel', handleTimelineWheel);
    };
  }, [handleTimelineWheel, updateTimelineViewport]);

  useEffect(() => {
    updateTimelineViewport();
  }, [canvasHeight, canvasWidth, timelineZoom, updateTimelineViewport]);

  useEffect(() => {
    const shell = scrollShellRef.current;
    if (!shell) {
      return;
    }

    const resizeObserver = new ResizeObserver(() => updateTimelineViewport());
    resizeObserver.observe(shell);
    return () => resizeObserver.disconnect();
  }, [updateTimelineViewport]);

  return (
    <section className="timeline-workspace">
      <aside className="sidebar">
        <div className="sidebar-action-group">
          <button
            type="button"
            className="sidebar-action-button"
            onClick={() => void refreshTimeline()}
            disabled={loading || saving}
          >
            {t('timeline.refresh')}
          </button>
        </div>

        <div className="panel">
          <h2>{t('timeline.title')}</h2>
          <p>
            {t('timeline.blocks')} <strong>{items.length}</strong>
          </p>
          <p>
            {t('timeline.attached')}{' '}
            <strong>{items.filter((item) => isAttachedToTimeline(item, items)).length}</strong>
          </p>
          <p>
            {t('timeline.unplaced')}{' '}
            <strong>{items.filter((item) => !isAttachedToTimeline(item, items)).length}</strong>
          </p>
        </div>

        <div className="panel">
          <h2>{t('timeline.selection')}</h2>
          <p>
            {t('timeline.type')}{' '}
            <strong>
              {selectedItem
                ? selectedItem.itemType === 'chapter'
                  ? t('timeline.itemChapter')
                  : t('timeline.itemScene')
                : '-'}
            </strong>
          </p>
          <p>
            {t('timeline.titleField')} <strong>{selectedItem?.title ?? '-'}</strong>
          </p>
          <p>
            {t('plot.selection')} <strong>{selectedItem?.plotLabel ?? '-'}</strong>
          </p>
        </div>

        <div className="panel status-panel">
          <p className="status">
            <span>
              {saving
                ? t('timeline.saving')
                : loading
                  ? t('timeline.statusRefreshing')
                  : t('timeline.ready')}
            </span>
          </p>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </aside>

      <section className="timeline-canvas-shell">
        <section
          ref={scrollShellRef}
          className={panDrag ? 'timeline-scroll-shell is-panning' : 'timeline-scroll-shell'}
          onPointerDown={handlePanPointerDown}
          onScroll={updateTimelineViewport}
        >
          <div
            className="timeline-scale-frame"
            style={{ width: canvasWidth * timelineZoom, height: canvasHeight * timelineZoom }}
          >
            <div
              ref={canvasRef}
              className={dragging ? 'timeline-canvas is-dragging' : 'timeline-canvas'}
              style={{
                width: canvasWidth,
                height: canvasHeight,
                transform: `scale(${timelineZoom})`,
              }}
            >
              <div
                className={axisDrag ? 'timeline-axis is-resizing' : 'timeline-axis'}
                style={{
                  top: TIMELINE_Y,
                  left: TIMELINE_AXIS_START_X,
                  width: timelineEndX - TIMELINE_AXIS_START_X,
                }}
                onPointerDown={handleAxisPointerDown}
                title="Trascina per allungare o accorciare la timeline"
              >
                <span className="timeline-axis-line" />
                <span className="timeline-axis-arrow" />
              </div>

              <label className="timeline-endpoint timeline-start" style={{ top: TIMELINE_Y - 48 }}>
                <span>{t('timeline.start')}</span>
                <input
                  value={startLabel}
                  onChange={(event) => setStartLabel(event.target.value)}
                  onBlur={() => void persistSettings()}
                  placeholder={t('timeline.date')}
                  disabled={saving}
                />
              </label>

              <label
                className="timeline-endpoint timeline-end"
                style={{ top: TIMELINE_Y - 48, left: timelineEndX + 24 }}
              >
                <span>{t('timeline.end')}</span>
                <input
                  value={endLabel}
                  onChange={(event) => setEndLabel(event.target.value)}
                  onBlur={() => void persistSettings()}
                  placeholder="Data"
                  disabled={saving}
                />
              </label>

              {items
                .filter((item) => isAttachedToTimeline(item, items))
                .map((item) => {
                  const connectorHeight = Math.max(28, item.positionY - TIMELINE_Y - 6);
                  return (
                    <span key={`connector-${item.key}`}>
                      <span
                        className="timeline-connector"
                        style={
                          {
                            left: getTimelineCenterX(item),
                            top: TIMELINE_Y + 8,
                            height: connectorHeight,
                            backgroundColor: item.plotColor,
                          } as CSSProperties
                        }
                      />
                      {item.dateLabel.trim() ? (
                        <span
                          className="timeline-connector-label"
                          style={
                            {
                              left: getTimelineCenterX(item),
                              top: Math.max(TIMELINE_Y + 24, item.positionY - 30),
                              borderColor: item.plotColor,
                            } as CSSProperties
                          }
                        >
                          {item.dateLabel}
                        </span>
                      ) : null}
                    </span>
                  );
                })}

              {items.map((item) => {
                const isSelected = item.key === selectedKey;
                return (
                  <article
                    key={item.key}
                    className={[
                      'timeline-block',
                      item.itemType === 'chapter' ? 'timeline-block-chapter' : 'timeline-block-scene',
                      isSelected ? 'is-selected' : '',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    style={
                      {
                        left: item.positionX,
                        top: item.positionY,
                        width: TIMELINE_CARD_WIDTH,
                        '--plot-color': item.plotColor,
                      } as CSSProperties
                    }
                    onPointerDown={(event) => handleBlockPointerDown(event, item)}
                  >
                    <header className="timeline-block-header">
                      <span className="timeline-block-kind">
                        {item.itemType === 'chapter'
                          ? t('timeline.itemChapter')
                          : t('timeline.itemScene')}
                      </span>
                      <span className="timeline-block-plot">{item.plotLabel}</span>
                    </header>
                    <h3>{item.itemType === 'scene' ? `#${item.title}` : item.title}</h3>
                    <p>{item.subtitle || '-'}</p>
                    {isSelected ? (
                      <label className="timeline-date-field">
                        <span>{t('timeline.dateAnchor')}</span>
                        <input
                          value={item.dateLabel}
                          onChange={(event) => handleDateChange(item, event.target.value)}
                          onBlur={() => {
                            const current = itemsRef.current.find(
                              (currentItem) => currentItem.key === item.key,
                            );
                            if (current) {
                              void persistItem(current);
                            }
                          }}
                          placeholder="Riferimento temporale"
                          disabled={saving}
                        />
                      </label>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        <div className="timeline-canvas-controls" aria-label={t('timeline.zoomControls')}>
          <button
            type="button"
            onClick={() => zoomTimelineFromCenter(1)}
            disabled={timelineZoom >= TIMELINE_ZOOM_MAX}
            title="Zoom in"
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            onClick={() => zoomTimelineFromCenter(-1)}
            disabled={timelineZoom <= TIMELINE_ZOOM_MIN}
            title="Zoom out"
            aria-label="Zoom out"
          >
            -
          </button>
          <button
            type="button"
            onClick={fitTimelineView}
            title={t('timeline.fitView')}
            aria-label={t('timeline.fitView')}
          >
            [ ]
          </button>
        </div>

        <div
          className="timeline-minimap"
          style={{ width: minimapWidth, height: minimapHeight }}
          onPointerDown={handleMinimapPointerDown}
          title={t('timeline.workspaceArea')}
        >
          <span
            className="timeline-minimap-axis"
            style={{
              left: TIMELINE_AXIS_START_X * minimapScale,
              top: TIMELINE_Y * minimapScale,
              width: Math.max(20, (timelineEndX - TIMELINE_AXIS_START_X) * minimapScale),
            }}
          />
          {items.map((item) => (
            <span
              key={`minimap-${item.key}`}
              className="timeline-minimap-item"
              style={{
                left: item.positionX * minimapScale,
                top: item.positionY * minimapScale,
                width: Math.max(4, TIMELINE_CARD_WIDTH * minimapScale),
                height: Math.max(3, 84 * minimapScale),
                backgroundColor: item.plotColor,
              }}
            />
          ))}
          <span
            className="timeline-minimap-viewport"
            style={{
              left: clamp(timelineViewport.left * minimapScale, 0, minimapWidth),
              top: clamp(timelineViewport.top * minimapScale, 0, minimapHeight),
              width: clamp(timelineViewport.width * minimapScale, 8, minimapWidth),
              height: clamp(timelineViewport.height * minimapScale, 8, minimapHeight),
            }}
          />
        </div>
      </section>
    </section>
  );
}
