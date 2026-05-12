import { useCallback, useMemo, useState } from 'react';

export interface PlotSessionRecord {
  id: string;
  number: number;
  label: string;
  summary: string;
}

interface PlotSessionStateOptions<TPlot extends PlotSessionRecord> {
  busy: boolean;
  currentProject: unknown | null;
  plots: TPlot[];
  plotsById: Map<string, TPlot>;
}

export function usePlotSessionState<TPlot extends PlotSessionRecord>({
  busy,
  currentProject,
  plots,
  plotsById,
}: PlotSessionStateOptions<TPlot>) {
  const [newPlotNumber, setNewPlotNumber] = useState<number>(1);
  const [newPlotLabel, setNewPlotLabel] = useState<string>('');
  const [newPlotSummary, setNewPlotSummary] = useState<string>('');
  const [plotStructureBusy, setPlotStructureBusy] = useState<boolean>(false);
  const [isPlotModalOpen, setIsPlotModalOpen] = useState<boolean>(false);
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [editPlotId, setEditPlotId] = useState<string | null>(null);
  const [editPlotLabelInput, setEditPlotLabelInput] = useState<string>('');
  const [editPlotSummaryInput, setEditPlotSummaryInput] = useState<string>('');

  const selectedPlot = useMemo(
    () => (selectedPlotId ? (plotsById.get(selectedPlotId) ?? null) : null),
    [plotsById, selectedPlotId],
  );
  const existingPlotForNewNumber = useMemo(
    () => plots.find((plot) => plot.number === newPlotNumber) ?? null,
    [plots, newPlotNumber],
  );
  const currentEditPlot = useMemo(
    () => (editPlotId ? (plotsById.get(editPlotId) ?? null) : null),
    [editPlotId, plotsById],
  );
  const canCreatePlot =
    Boolean(currentProject) && !busy && newPlotNumber >= 1 && !existingPlotForNewNumber;
  const canCreatePlotStructure = canCreatePlot && Boolean(newPlotSummary.trim());

  const resetPlotDraftAfterCreate = useCallback((nextPlotNumber: number): void => {
    setNewPlotNumber(nextPlotNumber);
    setNewPlotLabel('');
    setNewPlotSummary('');
    setIsPlotModalOpen(false);
  }, []);

  const resetPlotEditor = useCallback((): void => {
    setEditPlotId(null);
    setEditPlotLabelInput('');
    setEditPlotSummaryInput('');
  }, []);

  const resetPlotState = useCallback((): void => {
    setSelectedPlotId(null);
    setNewPlotNumber(1);
    setNewPlotLabel('');
    setNewPlotSummary('');
    setPlotStructureBusy(false);
    setIsPlotModalOpen(false);
    resetPlotEditor();
  }, [resetPlotEditor]);

  const openPlotEditor = useCallback((plot: TPlot): void => {
    setSelectedPlotId(plot.id);
    setEditPlotId(plot.id);
    setEditPlotLabelInput(plot.label);
    setEditPlotSummaryInput(plot.summary);
  }, []);

  return {
    canCreatePlot,
    canCreatePlotStructure,
    currentEditPlot,
    editPlotLabelInput,
    editPlotSummaryInput,
    existingPlotForNewNumber,
    isPlotModalOpen,
    newPlotLabel,
    newPlotNumber,
    newPlotSummary,
    openPlotEditor,
    plotStructureBusy,
    resetPlotDraftAfterCreate,
    resetPlotEditor,
    resetPlotState,
    selectedPlot,
    selectedPlotId,
    setEditPlotLabelInput,
    setEditPlotSummaryInput,
    setIsPlotModalOpen,
    setNewPlotLabel,
    setNewPlotNumber,
    setNewPlotSummary,
    setPlotStructureBusy,
    setSelectedPlotId,
  };
}
