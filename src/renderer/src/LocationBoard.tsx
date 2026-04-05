import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
  type OnEdgesChange,
  type OnNodesChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { getNearbyCanvasPosition } from './canvas-position';
import LocationFlowNode, { type LocationFlowNodeData } from './LocationFlowNode';
import { getStatusTone } from './status-tone';
import { toImageSource } from './image-path';

type LocationCard = Awaited<ReturnType<(typeof window.novelistApi)['listLocationCards']>>[number];
type LocationImage = Awaited<ReturnType<(typeof window.novelistApi)['listLocationImages']>>[number];
type StoryChapterNode = Awaited<
  ReturnType<(typeof window.novelistApi)['getStoryState']>
>['nodes'][number];
type StoryPlot = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>['plots'][number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;
type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;
type LocationCanvasNode = Node<LocationFlowNodeData, 'location'>;

interface LocationDraft {
  name: string;
  locationType: string;
  description: string;
  notes: string;
  plotNumber: number;
}

interface LocationBoardProps {
  currentProject: ProjectRecord;
  aiSettings: CodexSettings | null;
  autosaveSettings: AppPreferences | null;
  statusMessage: string;
  onStatus: (message: string) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterFlush?: (handler: (() => Promise<boolean>) | null) => void;
}

function getImageGenerationMissingRequirements(settings: CodexSettings | null): string[] {
  const missing: string[] = [];
  if (!settings?.enabled) {
    missing.push('consenso AI');
  }
  if (settings?.provider !== 'openai_api') {
    missing.push('provider OpenAI API');
  }
  if (!settings?.allowApiCalls) {
    missing.push('chiamate API abilitate');
  }
  if (!settings?.hasRuntimeApiKey) {
    missing.push('API key disponibile');
  }
  return missing;
}

function getAiAssistantLabel(settings: CodexSettings | null): string {
  if (settings?.provider === 'ollama') {
    return 'Ollama';
  }
  if (settings?.provider === 'openai_api') {
    return 'OpenAI';
  }
  return 'Codex';
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

function emptyLocationDraft(plotNumber = 1): LocationDraft {
  return {
    name: '',
    locationType: '',
    description: '',
    notes: '',
    plotNumber,
  };
}

function locationToDraft(card: LocationCard): LocationDraft {
  return {
    name: card.name,
    locationType: card.locationType,
    description: card.description,
    notes: card.notes,
    plotNumber: card.plotNumber,
  };
}

function areLocationDraftsEqual(left: LocationDraft, right: LocationDraft): boolean {
  return (
    left.name === right.name &&
    left.locationType === right.locationType &&
    left.description === right.description &&
    left.notes === right.notes &&
    left.plotNumber === right.plotNumber
  );
}

function mapCardToNode(
  card: LocationCard,
  imageSrc: string | null = null,
  options?: { selected?: boolean },
): LocationCanvasNode {
  const color = colorFromPlotNumber(card.plotNumber);

  return {
    id: card.id,
    type: 'location',
    position: {
      x: card.positionX,
      y: card.positionY,
    },
    selected: options?.selected,
    data: {
      label: card.name || 'Location',
      plotNumber: card.plotNumber,
      subtitle: card.locationType || 'Scheda location',
      imageSrc,
      isBoard: true,
    },
    style: {
      border: `2px solid ${color}`,
      borderRadius: '12px',
      width: 300,
      background: 'var(--surface-primary)',
      boxShadow: 'var(--flow-node-shadow)',
      padding: '10px',
    },
  };
}

function formatChapterLabel(node: StoryChapterNode): string {
  return `T${node.plotNumber} • B${node.blockNumber} • ${node.title}`;
}

function formatPlotLabel(plot: StoryPlot): string {
  return plot.label?.trim() || `Trama ${plot.number}`;
}

export default function LocationBoard({
  currentProject,
  aiSettings,
  autosaveSettings,
  statusMessage,
  onStatus,
  onDirtyChange,
  onRegisterFlush,
}: LocationBoardProps) {
  const [cards, setCards] = useState<LocationCard[]>([]);
  const [nodes, setNodes] = useState<LocationCanvasNode[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [chapterOptions, setChapterOptions] = useState<StoryChapterNode[]>([]);
  const [plotOptions, setPlotOptions] = useState<StoryPlot[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<LocationDraft>(() => emptyLocationDraft(1));
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<LocationDraft>(() => emptyLocationDraft(1));

  const [images, setImages] = useState<LocationImage[]>([]);
  const [imagePreviewSources, setImagePreviewSources] = useState<Record<string, string>>({});
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [linkedChapterIds, setLinkedChapterIds] = useState<string[]>([]);
  const [imageType, setImageType] = useState<string>('esterno');
  const [imageSize, setImageSize] = useState<'1024x1024' | '1536x1024' | '1024x1536'>('1024x1024');
  const [imagePath, setImagePath] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imageGenerating, setImageGenerating] = useState<boolean>(false);
  const [codexSettings, setCodexSettings] = useState<CodexSettings | null>(null);
  const [codexSuggesting, setCodexSuggesting] = useState<boolean>(false);
  const [codexPrompting, setCodexPrompting] = useState<boolean>(false);
  const [viewerImage, setViewerImage] = useState<{ src: string; label: string } | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef<boolean>(false);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const nodeTypes = useMemo(() => ({ location: LocationFlowNode }), []);
  const selectedCard = useMemo(
    () => (selectedCardId ? (cardsById.get(selectedCardId) ?? null) : null),
    [cardsById, selectedCardId],
  );
  const currentEditCard = useMemo(
    () => (editCardId ? (cardsById.get(editCardId) ?? null) : null),
    [cardsById, editCardId],
  );
  const editDirty = useMemo(
    () => (currentEditCard ? !areLocationDraftsEqual(editDraft, locationToDraft(currentEditCard)) : false),
    [currentEditCard, editDraft],
  );
  const effectiveCodexSettings = aiSettings ?? codexSettings;
  const aiAssistantLabel = getAiAssistantLabel(effectiveCodexSettings);
  const statusTone = getStatusTone(statusMessage);
  const linkedChapters = useMemo(
    () => chapterOptions.filter((chapter) => linkedChapterIds.includes(chapter.id)),
    [chapterOptions, linkedChapterIds],
  );

  const resolveImageSource = useCallback(async (filePath: string): Promise<string | null> => {
    const trimmedPath = filePath.trim();
    if (!trimmedPath) {
      return null;
    }
    if (/^(https?:|data:|file:)/i.test(trimmedPath)) {
      return toImageSource(trimmedPath);
    }
    try {
      return await window.novelistApi.readImageDataUrl({ filePath: trimmedPath });
    } catch {
      return toImageSource(trimmedPath);
    }
  }, []);

  const refreshCards = useCallback(async (): Promise<void> => {
    const [nextCards, state] = await Promise.all([
      window.novelistApi.listLocationCards(),
      window.novelistApi.getStoryState(),
    ]);

    const cardIds = new Set(nextCards.map((c) => c.id));
    const relevantEdges = state.edges.filter(
      (edge) => cardIds.has(edge.sourceId) && cardIds.has(edge.targetId)
    );

    const primaryImageByCardId = new Map<string, string | null>();

    await Promise.all(
      nextCards.map(async (card) => {
        const cardImages = await window.novelistApi.listLocationImages({ locationCardId: card.id });
        const primaryImage = cardImages.find((image) => image.filePath.trim());
        if (!primaryImage) {
          primaryImageByCardId.set(card.id, null);
          return;
        }

        const source = await resolveImageSource(primaryImage.filePath);
        primaryImageByCardId.set(card.id, source);
      }),
    );

    setCards(nextCards);
    setEdges(relevantEdges.map((edge) => ({
      id: edge.id,
      source: edge.sourceId,
      target: edge.targetId,
      sourceHandle: edge.sourceHandle ?? 'handle-bottom',
      targetHandle: edge.targetHandle ?? 'handle-top',
      markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color)' },
      style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
    })));
    setNodes(
      nextCards.map((card) =>
        mapCardToNode(card, primaryImageByCardId.get(card.id) ?? null, {
          selected: card.id === selectedCardId,
        }),
      ),
    );
  }, [resolveImageSource, selectedCardId]);

  const refreshChapterOptions = useCallback(async (): Promise<void> => {
    const state = await window.novelistApi.getStoryState();
    const sortedPlots = [...state.plots].sort((left, right) => left.number - right.number);
    const sortedNodes = [...state.nodes].sort((left, right) => {
      if (left.plotNumber !== right.plotNumber) {
        return left.plotNumber - right.plotNumber;
      }
      if (left.blockNumber !== right.blockNumber) {
        return left.blockNumber - right.blockNumber;
      }
      return left.title.localeCompare(right.title, 'it');
    });
    setPlotOptions(sortedPlots);
    setChapterOptions(sortedNodes);
  }, []);

  const loadImages = useCallback(
    async (locationCardId: string): Promise<void> => {
      const nextImages = await window.novelistApi.listLocationImages({ locationCardId });
      setImages(nextImages);
      setImagePreviewSources({});
      const loadedSources: Record<string, string> = {};
      const failedIds: string[] = [];

      await Promise.all(
        nextImages.map(async (image) => {
          const path = image.filePath.trim();
          if (!path) {
            failedIds.push(image.id);
            return;
          }

          const source = await resolveImageSource(path);
          if (!source) {
            failedIds.push(image.id);
            return;
          }
          loadedSources[image.id] = source;
        }),
      );

      setImagePreviewSources(loadedSources);
      setPreviewErrors(failedIds);
      const nextPrimaryImage =
        nextImages
          .map((image) => loadedSources[image.id])
          .find((source) => typeof source === 'string' && source.trim().length > 0) ?? null;
      setNodes((prev) =>
        prev.map((node) =>
          node.id === locationCardId
            ? {
                ...node,
                data: {
                  ...node.data,
                  imageSrc: nextPrimaryImage,
                },
              }
            : node,
        ),
      );
    },
    [resolveImageSource],
  );

  const loadCardLinks = useCallback(async (locationCardId: string): Promise<void> => {
    const chapterNodeIds = await window.novelistApi.listLocationChapterLinks({ locationCardId });
    setLinkedChapterIds(chapterNodeIds);
  }, []);

  const refreshCodexSettings = useCallback(async (): Promise<CodexSettings | null> => {
    try {
      const settings = await window.novelistApi.codexGetSettings();
      setCodexSettings(settings);
      return settings;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    if (!currentProject) {
      return;
    }

    void (async () => {
      setBusy(true);
      setError(null);
      try {
        await refreshCodexSettings();
        await Promise.all([refreshCards(), refreshChapterOptions()]);
        onStatus('Canvas location caricato');
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
      } finally {
        setBusy(false);
      }
    })();
  }, [currentProject, onStatus, refreshCards, refreshChapterOptions, refreshCodexSettings]);

  const onNodesChange: OnNodesChange<LocationCanvasNode> = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((prev) => applyEdgeChanges(changes, prev));
  }, []);

  async function handleConnect(connection: Connection): Promise<void> {
    if (!connection.source || !connection.target) {
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const created = await window.novelistApi.createStoryEdge({
        sourceId: connection.source,
        targetId: connection.target,
        sourceHandle: connection.sourceHandle,
        targetHandle: connection.targetHandle,
      });

      setEdges((prev) => [
        ...prev,
        {
          id: created.id,
          source: created.sourceId,
          target: created.targetId,
          sourceHandle: created.sourceHandle ?? 'handle-bottom',
          targetHandle: created.targetHandle ?? 'handle-top',
          markerEnd: { type: MarkerType.ArrowClosed, color: 'var(--edge-color)' },
          style: { stroke: 'var(--edge-color)', strokeWidth: 2 },
        },
      ]);
      onStatus('Connessione creata');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const onEdgesDelete = useCallback(
    async (deletedEdges: Edge[]) => {
      if (deletedEdges.length === 0) {
        return;
      }

      setBusy(true);
      try {
        await Promise.all(
          deletedEdges.map((edge) => window.novelistApi.deleteStoryEdge({ id: edge.id })),
        );
        onStatus(`${deletedEdges.length} connessioni eliminate`);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
      } finally {
        setBusy(false);
      }
    },
    [onStatus],
  );

  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<LocationCanvasNode>) => {
      setSelectedCardId(selection.nodes[0]?.id ?? null);
    },
    [],
  );

  const onNodeDoubleClick: NodeMouseHandler<LocationCanvasNode> = useCallback(
    (_event, node) => {
      const card = cardsById.get(node.id);
      if (!card) {
        return;
      }

      setEditCardId(card.id);
      setEditDraft(locationToDraft(card));
      setImagePath('');
      setImagePrompt('');
      setImageType('esterno');
      setImageSize('1024x1024');
      void Promise.all([loadImages(card.id), loadCardLinks(card.id), refreshCodexSettings()]);
    },
    [cardsById, loadCardLinks, loadImages, refreshCodexSettings],
  );

  const onNodeDragStop: NodeMouseHandler<LocationCanvasNode> = useCallback(
    async (_event, node) => {
      const card = cardsById.get(node.id);
      if (!card) {
        return;
      }

      try {
        const updated = await window.novelistApi.updateLocationCard({
          id: card.id,
          name: card.name,
          locationType: card.locationType,
          description: card.description,
          notes: card.notes,
          plotNumber: card.plotNumber,
          positionX: node.position.x,
          positionY: node.position.y,
        });

        setCards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setNodes((prev) =>
          prev.map((item) =>
            item.id === updated.id
              ? mapCardToNode(updated, item.data.imageSrc ?? null, { selected: item.selected })
              : item,
          ),
        );
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
      }
    },
    [cardsById],
  );

  async function handleCreateCard(): Promise<void> {
    if (!createDraft.name.trim()) {
      onStatus('Inserisci almeno il nome della location.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextPosition = getNearbyCanvasPosition(
        nodes.map((node) => node.position),
        {
          emptyPosition: { x: 120, y: 120 },
          minDistance: 225,
          radiusStep: 155,
        },
      );
      const created = await window.novelistApi.createLocationCard({
        name: createDraft.name.trim(),
        locationType: createDraft.locationType.trim(),
        description: createDraft.description.trim(),
        notes: createDraft.notes.trim(),
        plotNumber: createDraft.plotNumber,
        positionX: nextPosition.x,
        positionY: nextPosition.y,
      });

      setCards((prev) => [...prev, created]);
      setNodes((prev) => [...prev, mapCardToNode(created, null)]);
      setCreateDraft(emptyLocationDraft(createDraft.plotNumber));
      setSelectedCardId(created.id);
      onStatus(`Location creata: ${created.name}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteSelectedCard(): Promise<void> {
    if (!selectedCardId) {
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await window.novelistApi.deleteLocationCard({ id: selectedCardId });
      setCards((prev) => prev.filter((card) => card.id !== selectedCardId));
      setNodes((prev) => prev.filter((node) => node.id !== selectedCardId));
      setSelectedCardId(null);
      onStatus('Location eliminata');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  const persistEdit = useCallback(
    async (options?: {
      closeAfterSave?: boolean;
      silent?: boolean;
      successStatus?: string;
    }): Promise<boolean> => {
      if (!editCardId) {
        return false;
      }

      const card = cards.find((item) => item.id === editCardId);
      if (!card) {
        return false;
      }

      if (!editDirty) {
        if (options?.closeAfterSave) {
          setEditCardId(null);
        }
        return false;
      }

      setBusy(true);
      setError(null);
      try {
        const updated = await window.novelistApi.updateLocationCard({
          id: editCardId,
          name: editDraft.name.trim(),
          locationType: editDraft.locationType.trim(),
          description: editDraft.description.trim(),
          notes: editDraft.notes.trim(),
          plotNumber: editDraft.plotNumber,
          positionX: card.positionX,
          positionY: card.positionY,
        });

        setCards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
        setNodes((prev) =>
          prev.map((item) =>
            item.id === updated.id ? mapCardToNode(updated, item.data.imageSrc ?? null) : item,
          ),
        );
        setEditDraft(locationToDraft(updated));
        if (!options?.silent) {
          onStatus(options?.successStatus ?? `Location salvata: ${updated.name}`);
        }
        if (options?.closeAfterSave) {
          setEditCardId(null);
        }
        return true;
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [cards, editCardId, editDirty, editDraft, onStatus],
  );

  async function handleSaveEdit(): Promise<void> {
    await persistEdit({ closeAfterSave: true });
  }

  useEffect(() => {
    onDirtyChange?.(editDirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [editDirty, onDirtyChange]);

  useEffect(() => {
    onRegisterFlush?.(() => persistEdit({ closeAfterSave: false, silent: true }));
    return () => {
      onRegisterFlush?.(null);
    };
  }, [onRegisterFlush, persistEdit]);

  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    if (autosaveSettings?.autosaveMode !== 'auto' || !editCardId || !editDirty) {
      return;
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      if (autosaveInFlightRef.current) {
        return;
      }

      autosaveInFlightRef.current = true;
      void persistEdit({
        closeAfterSave: false,
        successStatus: 'Location salvata automaticamente',
      }).finally(() => {
        autosaveInFlightRef.current = false;
      });
    }, 900);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
    };
  }, [autosaveSettings?.autosaveMode, editCardId, editDirty, persistEdit]);

  useEffect(() => {
    if (autosaveSettings?.autosaveMode !== 'interval' || !editCardId) {
      return;
    }

    const intervalId = setInterval(() => {
      if (!editDirty || autosaveInFlightRef.current) {
        return;
      }

      autosaveInFlightRef.current = true;
      void persistEdit({
        closeAfterSave: false,
        successStatus: 'Location salvata automaticamente',
      }).finally(() => {
        autosaveInFlightRef.current = false;
      });
    }, autosaveSettings.autosaveIntervalMinutes * 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    autosaveSettings?.autosaveIntervalMinutes,
    autosaveSettings?.autosaveMode,
    editCardId,
    editDirty,
    persistEdit,
  ]);

  async function handleAddImage(): Promise<void> {
    if (!editCardId || !imagePath.trim()) {
      onStatus('Inserisci un path immagine valido.');
      return;
    }

    try {
      await window.novelistApi.createLocationImage({
        locationCardId: editCardId,
        imageType: imageType.trim(),
        filePath: imagePath.trim(),
        prompt: imagePrompt.trim(),
      });
      await loadImages(editCardId);
      setImagePath('');
      onStatus('Immagine location associata');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    }
  }

  async function handleDeleteImage(imageId: string): Promise<void> {
    if (!editCardId) {
      return;
    }

    try {
      await window.novelistApi.deleteLocationImage({ id: imageId });
      await loadImages(editCardId);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    }
  }

  function handleViewImage(image: LocationImage): void {
    const source = imagePreviewSources[image.id];
    if (!source) {
      return;
    }
    setViewerImage({
      src: source,
      label: image.imageType,
    });
  }

  async function handleGenerateImageInApp(): Promise<void> {
    if (!editCardId) {
      return;
    }
    const currentSettings = effectiveCodexSettings ?? (await refreshCodexSettings());
    const missingRequirements = getImageGenerationMissingRequirements(currentSettings);
    if (missingRequirements.length > 0) {
      onStatus(`Genera In-App non disponibile: manca ${missingRequirements.join(', ')}.`);
      return;
    }
    if (!imagePrompt.trim()) {
      onStatus('Inserisci un prompt prima di generare l’immagine.');
      return;
    }

    setImageGenerating(true);
    setError(null);
    try {
      const created = await window.novelistApi.generateLocationImage({
        locationCardId: editCardId,
        imageType: imageType.trim(),
        prompt: imagePrompt.trim(),
        size: imageSize,
      });
      await loadImages(editCardId);
      setImagePath(created.filePath);
      onStatus('Immagine generata in-app e associata alla scheda');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    } finally {
      setImageGenerating(false);
    }
  }

  async function handleSelectImagePath(): Promise<void> {
    try {
      const selected = await window.novelistApi.selectImageFile();
      if (!selected) {
        return;
      }
      setImagePath(selected);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    }
  }

  async function handleCodexLocationSuggestion(): Promise<void> {
    if (!editCardId) {
      return;
    }
    const currentSettings = effectiveCodexSettings ?? (await refreshCodexSettings());
    if (!currentSettings?.enabled) {
      onStatus('Abilita prima il consenso Codex nelle Impostazioni AI.');
      return;
    }

    setCodexSuggesting(true);
    onStatus('Codex sta elaborando suggerimenti location...');
    try {
      const response = await window.novelistApi.codexAssist({
        projectName: currentProject?.name,
        message:
          'Suggerisci dettagli sensoriali, atmosfera narrativa e possibili conflitti legati a questa location.',
        context: JSON.stringify(editDraft),
      });
      if (response.cancelled || !response.output.trim()) {
        onStatus('Richiesta Codex annullata');
        return;
      }
      setEditDraft((prev) => ({
        ...prev,
        notes: prev.notes ? `${prev.notes}\n\n${response.output}` : response.output,
      }));
      onStatus(`Suggerimento Codex ricevuto (${response.mode})`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore richiesta Codex');
    } finally {
      setCodexSuggesting(false);
    }
  }

  async function handleCodexImagePrompt(): Promise<void> {
    if (!editCardId) {
      return;
    }
    const currentSettings = effectiveCodexSettings ?? (await refreshCodexSettings());
    if (!currentSettings?.enabled) {
      onStatus('Abilita prima il consenso Codex nelle Impostazioni AI.');
      return;
    }

    setCodexPrompting(true);
    onStatus('Codex sta creando il prompt immagine...');
    try {
      const response = await window.novelistApi.codexAssist({
        projectName: currentProject?.name,
        message:
          'Crea un prompt immagini dettagliato in italiano per rappresentare questa location (stile, luce, prospettiva, dettaglio ambientale).',
        context: JSON.stringify(editDraft),
      });
      if (response.cancelled || !response.output.trim()) {
        onStatus('Richiesta Codex annullata');
        return;
      }
      setImagePrompt(response.output);
      onStatus(`Prompt immagine generato (${response.mode})`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore richiesta Codex');
    } finally {
      setCodexPrompting(false);
    }
  }

  const missingImageGenerationRequirements =
    getImageGenerationMissingRequirements(effectiveCodexSettings);
  const imageGenerationReady = missingImageGenerationRequirements.length === 0;

  return (
    <section className="workspace">
      <aside className="sidebar">
        <div className="panel">
          <h2>Nuova Location</h2>
          <label>
            Nome
            <input
              value={createDraft.name}
              onChange={(event) =>
                setCreateDraft((prev) => ({ ...prev, name: event.target.value }))
              }
            />
          </label>
          <label>
            Tipo luogo
            <input
              value={createDraft.locationType}
              onChange={(event) =>
                setCreateDraft((prev) => ({ ...prev, locationType: event.target.value }))
              }
            />
          </label>
          <label>
            Trama
            <select
              value={createDraft.plotNumber}
              onChange={(event) =>
                setCreateDraft((prev) => ({
                  ...prev,
                  plotNumber: Number(event.target.value),
                }))
              }
            >
              {plotOptions.length > 0 ? (
                plotOptions.map((plot) => (
                  <option key={plot.number} value={plot.number}>
                    {formatPlotLabel(plot)}
                  </option>
                ))
              ) : (
                <option value={createDraft.plotNumber}>Trama {createDraft.plotNumber}</option>
              )}
            </select>
          </label>
          <button
            type="button"
            className="sidebar-action-button"
            onClick={() => void handleCreateCard()}
            disabled={busy || !currentProject}
          >
            Crea Scheda
          </button>
        </div>

        <div className="panel">
          <h2>Selezione</h2>
          <p>
            Location: <strong>{selectedCard?.name ?? '-'}</strong>
          </p>
          <p>
            Trama: <strong>{selectedCard?.plotNumber ?? '-'}</strong>
          </p>
          <div className="selection-action-stack">
            <button
              type="button"
              className="sidebar-action-button danger-action-button"
              onClick={() => void handleDeleteSelectedCard()}
              disabled={!selectedCardId || busy}
            >
              Elimina
            </button>
          </div>
        </div>

        <div className="panel status-panel">
          <p className={`status status-${statusTone}`}>{statusMessage}</p>
          {error ? <p className="error">{error}</p> : null}
        </div>
      </aside>

      <section className="canvas-wrap">
        <ReactFlow<LocationCanvasNode, Edge>
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements
          connectionMode={ConnectionMode.Loose}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onSelectionChange={onSelectionChange}
          onConnect={(params) => void handleConnect(params)}
          onEdgesDelete={onEdgesDelete}
          elevateNodesOnSelect
          fitView
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <MiniMap zoomable pannable />
          <Controls />
          <Background gap={18} size={1} color="#d1d5db" />
        </ReactFlow>
      </section>

      {editCardId ? (
        <div className="modal-overlay">
          <div className="modal-card large-modal-card">
            <h3>Modifica Location</h3>
            <div className="grid-two">
              <label>
                Nome
                <input
                  value={editDraft.name}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, name: event.target.value }))
                  }
                />
              </label>
              <label>
                Tipologia luogo
                <input
                  value={editDraft.locationType}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, locationType: event.target.value }))
                  }
                />
              </label>
              <label>
                Trama
                <select
                  value={editDraft.plotNumber}
                  onChange={(event) =>
                    setEditDraft((prev) => ({
                      ...prev,
                      plotNumber: Number(event.target.value),
                    }))
                  }
                >
                  {plotOptions.length > 0 ? (
                    plotOptions.map((plot) => (
                      <option key={plot.number} value={plot.number}>
                        {formatPlotLabel(plot)}
                      </option>
                    ))
                  ) : (
                    <option value={editDraft.plotNumber}>Trama {editDraft.plotNumber}</option>
                  )}
                </select>
              </label>
            </div>
            <label>
              Descrizione
              <textarea
                rows={6}
                value={editDraft.description}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </label>
            <label>
              Note
              <textarea
                rows={4}
                value={editDraft.notes}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </label>

            <div className="row-buttons">
              <button
                type="button"
                onClick={() => void handleCodexLocationSuggestion()}
                className={codexSuggesting ? 'ai-working' : undefined}
                disabled={codexSuggesting}
              >
                {`Suggerisci Con ${aiAssistantLabel}`}
              </button>
            </div>

            <div className="panel panel-subsection">
              <h4>Capitoli Collegati</h4>
              <div className="chapter-links-list">
                {linkedChapters.length === 0 ? (
                  <p className="muted">Nessun capitolo collegato.</p>
                ) : null}
                <div className="chapter-badge-list">
                  {linkedChapters.map((chapter) => (
                    <span key={chapter.id} className="chapter-link-badge">
                      {formatChapterLabel(chapter)}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel panel-subsection">
              <h4>Immagini Associate</h4>
              <div className="grid-two">
                <label>
                  Tipo
                  <select value={imageType} onChange={(event) => setImageType(event.target.value)}>
                    <option value="esterno">Esterno</option>
                    <option value="interno">Interno</option>
                    <option value="dettaglio">Dettaglio</option>
                    <option value="mappa">Mappa</option>
                  </select>
                </label>
                <label>
                  Path file immagine
                  <div className="input-with-button">
                    <input
                      value={imagePath}
                      onChange={(event) => setImagePath(event.target.value)}
                    />
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() => void handleSelectImagePath()}
                    >
                      Sfoglia...
                    </button>
                  </div>
                </label>
                <label>
                  Dimensione
                  <select
                    value={imageSize}
                    onChange={(event) => setImageSize(event.target.value as typeof imageSize)}
                  >
                    <option value="1024x1024">Quadrata (1024x1024)</option>
                    <option value="1536x1024">Orizzontale (1536x1024)</option>
                    <option value="1024x1536">Verticale (1024x1536)</option>
                  </select>
                </label>
              </div>
              <label>
                Prompt
                <textarea
                  rows={3}
                  value={imagePrompt}
                  onChange={(event) => setImagePrompt(event.target.value)}
                />
              </label>
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => void handleCodexImagePrompt()}
                  className={codexPrompting ? 'ai-working' : undefined}
                  disabled={codexPrompting}
                >
                  {`Prompt Da ${aiAssistantLabel}`}
                </button>
                <button
                  type="button"
                  onClick={() => void handleGenerateImageInApp()}
                  disabled={imageGenerating || !imagePrompt.trim() || !imageGenerationReady}
                  className={imageGenerating ? 'ai-working' : undefined}
                >
                  {imageGenerating ? 'Generazione...' : 'Genera In-App'}
                </button>
                <button type="button" onClick={() => void handleAddImage()}>
                  Associa Immagine
                </button>
              </div>
              {!imageGenerationReady ? (
                <p className="muted">
                  Genera In-App non disponibile: manca{' '}
                  {missingImageGenerationRequirements.join(', ')}.
                </p>
              ) : null}
              <div className="asset-list">
                {images.length === 0 ? <p className="muted">Nessuna immagine associata.</p> : null}
                {images.map((image) => (
                  <div key={image.id} className="asset-item">
                    <div className="asset-item-main">
                      <div className="asset-preview">
                        {previewErrors.includes(image.id) || !image.filePath.trim() ? (
                          <div className="asset-preview-fallback">Anteprima non disponibile</div>
                        ) : !imagePreviewSources[image.id] ? (
                          <div className="asset-preview-fallback">Caricamento anteprima...</div>
                        ) : (
                          <img
                            src={imagePreviewSources[image.id]}
                            alt={`Anteprima ${image.imageType}`}
                            onError={() =>
                              setPreviewErrors((prev) =>
                                prev.includes(image.id) ? prev : [...prev, image.id],
                              )
                            }
                          />
                        )}
                      </div>
                      <div className="asset-item-content">
                        <p>
                          <strong>{image.imageType}</strong>
                        </p>
                        <p className="muted">{image.filePath}</p>
                      </div>
                    </div>
                    <div className="asset-item-actions">
                      <button
                        type="button"
                        className="button-secondary"
                        onClick={() => handleViewImage(image)}
                        disabled={!imagePreviewSources[image.id]}
                      >
                        Vedi
                      </button>
                      <button type="button" onClick={() => void handleDeleteImage(image.id)}>
                        Elimina
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="row-buttons">
              <button
                type="button"
                onClick={() => {
                  setEditCardId(null);
                  setLinkedChapterIds([]);
                  setViewerImage(null);
                }}
              >
                Chiudi
              </button>
              <button type="button" onClick={() => void handleSaveEdit()} disabled={busy}>
                Salva Scheda
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {viewerImage ? (
        <div className="modal-overlay image-viewer-overlay" onClick={() => setViewerImage(null)}>
          <div
            className="modal-card image-viewer-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{viewerImage.label}</h3>
            <img src={viewerImage.src} alt={viewerImage.label} className="image-viewer-full" />
            <div className="row-buttons">
              <button type="button" onClick={() => setViewerImage(null)}>
                Chiudi
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
