import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  applyNodeChanges,
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  type Node,
  type NodeMouseHandler,
  type OnNodesChange,
  type OnSelectionChangeParams,
} from '@xyflow/react';
import { getNearbyCanvasPosition } from './canvas-position';
import CharacterFlowNode, { type CharacterFlowNodeData } from './CharacterFlowNode';
import { getStatusTone } from './status-tone';
import { toImageSource } from './image-path';

type CharacterCard = Awaited<ReturnType<(typeof window.novelistApi)['listCharacterCards']>>[number];
type CharacterImage = Awaited<
  ReturnType<(typeof window.novelistApi)['listCharacterImages']>
>[number];
type StoryChapterNode = Awaited<
  ReturnType<(typeof window.novelistApi)['getStoryState']>
>['nodes'][number];
type StoryPlot = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>['plots'][number];
type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;
type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;
type CharacterCanvasNode = Node<CharacterFlowNodeData, 'character'>;

interface CharacterDraft {
  firstName: string;
  lastName: string;
  sex: string;
  age: string;
  sexualOrientation: string;
  species: string;
  hairColor: string;
  bald: boolean;
  beard: string;
  physique: string;
  job: string;
  notes: string;
  plotNumber: number;
}

interface CharacterBoardProps {
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

function emptyCharacterDraft(plotNumber = 1): CharacterDraft {
  return {
    firstName: '',
    lastName: '',
    sex: '',
    age: '',
    sexualOrientation: '',
    species: '',
    hairColor: '',
    bald: false,
    beard: '',
    physique: '',
    job: '',
    notes: '',
    plotNumber,
  };
}

function characterToDraft(card: CharacterCard): CharacterDraft {
  return {
    firstName: card.firstName,
    lastName: card.lastName,
    sex: card.sex,
    age: card.age === null ? '' : String(card.age),
    sexualOrientation: card.sexualOrientation,
    species: card.species,
    hairColor: card.hairColor,
    bald: card.bald,
    beard: card.beard,
    physique: card.physique,
    job: card.job,
    notes: card.notes,
    plotNumber: card.plotNumber,
  };
}

function areCharacterDraftsEqual(left: CharacterDraft, right: CharacterDraft): boolean {
  return (
    left.firstName === right.firstName &&
    left.lastName === right.lastName &&
    left.sex === right.sex &&
    left.age === right.age &&
    left.sexualOrientation === right.sexualOrientation &&
    left.species === right.species &&
    left.hairColor === right.hairColor &&
    left.bald === right.bald &&
    left.beard === right.beard &&
    left.physique === right.physique &&
    left.job === right.job &&
    left.notes === right.notes &&
    left.plotNumber === right.plotNumber
  );
}

function mapCardToNode(
  card: CharacterCard,
  imageSrc: string | null = null,
  options?: { selected?: boolean },
): CharacterCanvasNode {
  const name = `${card.firstName} ${card.lastName}`.trim();
  const color = colorFromPlotNumber(card.plotNumber);

  return {
    id: card.id,
    type: 'character',
    position: {
      x: card.positionX,
      y: card.positionY,
    },
    selected: options?.selected,
    data: {
      label: name || 'Personaggio',
      plotNumber: card.plotNumber,
      subtitle: card.job || card.species || card.physique || 'Scheda personaggio',
      imageSrc,
    },
    style: {
      border: `2px solid ${color}`,
      borderRadius: '12px',
      width: 280,
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

export default function CharacterBoard({
  currentProject,
  aiSettings,
  autosaveSettings,
  statusMessage,
  onStatus,
  onDirtyChange,
  onRegisterFlush,
}: CharacterBoardProps) {
  const [cards, setCards] = useState<CharacterCard[]>([]);
  const [nodes, setNodes] = useState<CharacterCanvasNode[]>([]);
  const [chapterOptions, setChapterOptions] = useState<StoryChapterNode[]>([]);
  const [plotOptions, setPlotOptions] = useState<StoryPlot[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [createDraft, setCreateDraft] = useState<CharacterDraft>(() => emptyCharacterDraft(1));
  const [editCardId, setEditCardId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<CharacterDraft>(() => emptyCharacterDraft(1));

  const [images, setImages] = useState<CharacterImage[]>([]);
  const [imagePreviewSources, setImagePreviewSources] = useState<Record<string, string>>({});
  const [previewErrors, setPreviewErrors] = useState<string[]>([]);
  const [linkedChapterIds, setLinkedChapterIds] = useState<string[]>([]);
  const [imageType, setImageType] = useState<string>('mezzo-busto');
  const [imageSize, setImageSize] = useState<'1024x1024' | '1536x1024' | '1024x1536'>('1024x1024');
  const [imagePath, setImagePath] = useState<string>('');
  const [imagePrompt, setImagePrompt] = useState<string>('');
  const [imageGenerating, setImageGenerating] = useState<boolean>(false);
  const [codexSuggesting, setCodexSuggesting] = useState<boolean>(false);
  const [codexPrompting, setCodexPrompting] = useState<boolean>(false);
  const [viewerImage, setViewerImage] = useState<{ src: string; label: string } | null>(null);
  const [codexSettings, setCodexSettings] = useState<CodexSettings | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef<boolean>(false);

  const cardsById = useMemo(() => new Map(cards.map((card) => [card.id, card])), [cards]);
  const emptyEdges = useMemo(() => [], []);
  const nodeTypes = useMemo(() => ({ character: CharacterFlowNode }), []);
  const selectedCard = useMemo(
    () => (selectedCardId ? (cardsById.get(selectedCardId) ?? null) : null),
    [cardsById, selectedCardId],
  );
  const currentEditCard = useMemo(
    () => (editCardId ? (cardsById.get(editCardId) ?? null) : null),
    [cardsById, editCardId],
  );
  const editDirty = useMemo(
    () => (currentEditCard ? !areCharacterDraftsEqual(editDraft, characterToDraft(currentEditCard)) : false),
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
    const nextCards = await window.novelistApi.listCharacterCards();
    const primaryImageByCardId = new Map<string, string | null>();

    await Promise.all(
      nextCards.map(async (card) => {
        const cardImages = await window.novelistApi.listCharacterImages({
          characterCardId: card.id,
        });
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
    async (characterCardId: string): Promise<void> => {
      const nextImages = await window.novelistApi.listCharacterImages({ characterCardId });
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
          node.id === characterCardId
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

  const loadCardLinks = useCallback(async (characterCardId: string): Promise<void> => {
    const chapterNodeIds = await window.novelistApi.listCharacterChapterLinks({ characterCardId });
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
        onStatus('Canvas personaggi caricato');
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
      } finally {
        setBusy(false);
      }
    })();
  }, [currentProject, onStatus, refreshCards, refreshChapterOptions, refreshCodexSettings]);

  const onNodesChange: OnNodesChange<CharacterCanvasNode> = useCallback((changes) => {
    setNodes((prev) => applyNodeChanges(changes, prev));
  }, []);

  const onSelectionChange = useCallback(
    (selection: OnSelectionChangeParams<CharacterCanvasNode>) => {
      setSelectedCardId(selection.nodes[0]?.id ?? null);
    },
    [],
  );

  const onNodeClick: NodeMouseHandler<CharacterCanvasNode> = useCallback((_event, node) => {
    setSelectedCardId(node.id);
  }, []);

  const onNodeDoubleClick: NodeMouseHandler<CharacterCanvasNode> = useCallback(
    (_event, node) => {
      const card = cardsById.get(node.id);
      if (!card) {
        return;
      }

      setEditCardId(card.id);
      setEditDraft(characterToDraft(card));
      setImagePath('');
      setImagePrompt('');
      setImageType('mezzo-busto');
      setImageSize('1024x1024');
      void Promise.all([loadImages(card.id), loadCardLinks(card.id), refreshCodexSettings()]);
    },
    [cardsById, loadCardLinks, loadImages, refreshCodexSettings],
  );

  const onNodeDragStop: NodeMouseHandler<CharacterCanvasNode> = useCallback(
    async (_event, node) => {
      const card = cardsById.get(node.id);
      if (!card) {
        return;
      }

      try {
        const updated = await window.novelistApi.updateCharacterCard({
          id: card.id,
          firstName: card.firstName,
          lastName: card.lastName,
          sex: card.sex,
          age: card.age,
          sexualOrientation: card.sexualOrientation,
          species: card.species,
          hairColor: card.hairColor,
          bald: card.bald,
          beard: card.beard,
          physique: card.physique,
          job: card.job,
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
    if (!createDraft.firstName.trim()) {
      onStatus('Inserisci almeno il nome del personaggio.');
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const nextPosition = getNearbyCanvasPosition(
        nodes.map((node) => node.position),
        {
          emptyPosition: { x: 120, y: 120 },
          minDistance: 210,
          radiusStep: 150,
        },
      );
      const created = await window.novelistApi.createCharacterCard({
        firstName: createDraft.firstName.trim(),
        lastName: createDraft.lastName.trim(),
        sex: createDraft.sex.trim(),
        age: createDraft.age ? Number(createDraft.age) : null,
        sexualOrientation: createDraft.sexualOrientation.trim(),
        species: createDraft.species.trim(),
        hairColor: createDraft.hairColor.trim(),
        bald: createDraft.bald,
        beard: createDraft.beard.trim(),
        physique: createDraft.physique.trim(),
        job: createDraft.job.trim(),
        notes: createDraft.notes.trim(),
        plotNumber: createDraft.plotNumber,
        positionX: nextPosition.x,
        positionY: nextPosition.y,
      });

      setCards((prev) => [...prev, created]);
      setNodes((prev) => [...prev, mapCardToNode(created, null)]);
      setCreateDraft(emptyCharacterDraft(createDraft.plotNumber));
      setSelectedCardId(created.id);
      onStatus(`Personaggio creato: ${created.firstName} ${created.lastName}`.trim());
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
      await window.novelistApi.deleteCharacterCard({ id: selectedCardId });
      setCards((prev) => prev.filter((card) => card.id !== selectedCardId));
      setNodes((prev) => prev.filter((node) => node.id !== selectedCardId));
      setSelectedCardId(null);
      onStatus('Personaggio eliminato');
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
        const updated = await window.novelistApi.updateCharacterCard({
          id: editCardId,
          firstName: editDraft.firstName.trim(),
          lastName: editDraft.lastName.trim(),
          sex: editDraft.sex.trim(),
          age: editDraft.age ? Number(editDraft.age) : null,
          sexualOrientation: editDraft.sexualOrientation.trim(),
          species: editDraft.species.trim(),
          hairColor: editDraft.hairColor.trim(),
          bald: editDraft.bald,
          beard: editDraft.beard.trim(),
          physique: editDraft.physique.trim(),
          job: editDraft.job.trim(),
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
        setEditDraft(characterToDraft(updated));
        if (!options?.silent) {
          onStatus(
            options?.successStatus ??
              `Personaggio salvato: ${updated.firstName} ${updated.lastName}`.trim(),
          );
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
        successStatus: 'Personaggio salvato automaticamente',
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
        successStatus: 'Personaggio salvato automaticamente',
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
      await window.novelistApi.createCharacterImage({
        characterCardId: editCardId,
        imageType: imageType.trim(),
        filePath: imagePath.trim(),
        prompt: imagePrompt.trim(),
      });
      await loadImages(editCardId);
      setImagePath('');
      onStatus('Immagine personaggio associata');
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
      await window.novelistApi.deleteCharacterImage({ id: imageId });
      await loadImages(editCardId);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    }
  }

  function handleViewImage(image: CharacterImage): void {
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
      const created = await window.novelistApi.generateCharacterImage({
        characterCardId: editCardId,
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

  async function handleCodexPhysiqueSuggestion(): Promise<void> {
    if (!editCardId) {
      return;
    }
    const currentSettings = effectiveCodexSettings ?? (await refreshCodexSettings());
    if (!currentSettings?.enabled) {
      onStatus('Abilita prima il consenso Codex nelle Impostazioni AI.');
      return;
    }

    setCodexSuggesting(true);
    onStatus('Codex sta elaborando suggerimenti personaggio...');
    try {
      const response = await window.novelistApi.codexAssist({
        projectName: currentProject?.name,
        message:
          'Suggerisci una fisionomia credibile, dettagli comportamentali e conflitto interno coerenti con questo personaggio.',
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
          'Crea un prompt immagini dettagliato in italiano per un ritratto personaggio (inquadratura, luce, stile, dettagli fisici).',
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
          <h2>Nuovo Personaggio</h2>
          <label>
            Nome
            <input
              value={createDraft.firstName}
              onChange={(event) =>
                setCreateDraft((prev) => ({ ...prev, firstName: event.target.value }))
              }
            />
          </label>
          <label>
            Cognome
            <input
              value={createDraft.lastName}
              onChange={(event) =>
                setCreateDraft((prev) => ({ ...prev, lastName: event.target.value }))
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
            Personaggio:{' '}
            <strong>
              {selectedCard ? `${selectedCard.firstName} ${selectedCard.lastName}`.trim() : '-'}
            </strong>
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
        <ReactFlow
          nodes={nodes}
          edges={emptyEdges}
          nodeTypes={nodeTypes}
          onlyRenderVisibleElements
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          onNodeDragStop={onNodeDragStop}
          onNodeDoubleClick={onNodeDoubleClick}
          onSelectionChange={onSelectionChange}
          elevateNodesOnSelect
          fitView
          deleteKeyCode={null}
        >
          <MiniMap zoomable pannable />
          <Controls />
          <Background gap={18} size={1} color="#d1d5db" />
        </ReactFlow>
      </section>

      {editCardId ? (
        <div className="modal-overlay">
          <div className="modal-card large-modal-card">
            <h3>Modifica Personaggio</h3>
            <div className="grid-two">
              <label>
                Nome
                <input
                  value={editDraft.firstName}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, firstName: event.target.value }))
                  }
                />
              </label>
              <label>
                Cognome
                <input
                  value={editDraft.lastName}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, lastName: event.target.value }))
                  }
                />
              </label>
              <label>
                Sesso
                <input
                  value={editDraft.sex}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, sex: event.target.value }))
                  }
                />
              </label>
              <label>
                Età
                <input
                  type="number"
                  min={0}
                  value={editDraft.age}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, age: event.target.value }))
                  }
                />
              </label>
              <label>
                Orientamento sessuale
                <input
                  value={editDraft.sexualOrientation}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, sexualOrientation: event.target.value }))
                  }
                />
              </label>
              <label>
                Razza/Specie
                <input
                  value={editDraft.species}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, species: event.target.value }))
                  }
                />
              </label>
              <label>
                Colore capelli
                <input
                  value={editDraft.hairColor}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, hairColor: event.target.value }))
                  }
                />
              </label>
              <label>
                Barba
                <input
                  value={editDraft.beard}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, beard: event.target.value }))
                  }
                />
              </label>
              <label>
                Fisicità
                <input
                  value={editDraft.physique}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, physique: event.target.value }))
                  }
                />
              </label>
              <label>
                Lavoro
                <input
                  value={editDraft.job}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, job: event.target.value }))
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
              <label className="checkbox-inline">
                <input
                  type="checkbox"
                  checked={editDraft.bald}
                  onChange={(event) =>
                    setEditDraft((prev) => ({ ...prev, bald: event.target.checked }))
                  }
                />
                <span>Calvizie</span>
              </label>
            </div>
            <label>
              Note
              <textarea
                rows={6}
                value={editDraft.notes}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, notes: event.target.value }))
                }
              />
            </label>

            <div className="row-buttons">
              <button
                type="button"
                onClick={() => void handleCodexPhysiqueSuggestion()}
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
                    <option value="mezzo-busto">Mezzo busto</option>
                    <option value="intero-fronte">Intero fronte</option>
                    <option value="intero-lato">Intero lato</option>
                    <option value="posa-libera">Posa libera</option>
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
