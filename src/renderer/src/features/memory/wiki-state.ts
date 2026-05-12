import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';

export type WikiStatus = Awaited<ReturnType<(typeof window.novelistApi)['wikiGetStatus']>>;
export type WikiSearchResult = Awaited<
  ReturnType<(typeof window.novelistApi)['wikiSearch']>
>[number];
export type SelectedWikiSearchResult = WikiSearchResult & { content: string };

interface WikiStateOptions {
  currentProject: unknown | null;
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
  showWorkspaceNotice: (message: string | null, durationMs?: number) => void;
}

export function useWikiState({
  currentProject,
  setError,
  setStatus,
  showWorkspaceNotice,
}: WikiStateOptions) {
  const [wikiStatus, setWikiStatus] = useState<WikiStatus | null>(null);
  const [wikiBusy, setWikiBusy] = useState<boolean>(false);
  const [wikiError, setWikiError] = useState<string | null>(null);
  const [wikiSearchQuery, setWikiSearchQuery] = useState<string>('');
  const [wikiSearchResults, setWikiSearchResults] = useState<WikiSearchResult[]>([]);
  const [selectedWikiSearchResult, setSelectedWikiSearchResult] =
    useState<SelectedWikiSearchResult | null>(null);
  const wikiAutoSyncInFlightRef = useRef<Promise<void> | null>(null);

  const resetWikiSearch = useCallback((): void => {
    setWikiSearchQuery('');
    setWikiSearchResults([]);
    setSelectedWikiSearchResult(null);
  }, []);

  const resetWikiState = useCallback((): void => {
    setWikiStatus(null);
    setWikiError(null);
    resetWikiSearch();
  }, [resetWikiSearch]);

  const refreshWikiStatus = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      setWikiStatus(null);
      setWikiError(null);
      return;
    }

    setWikiError(null);
    try {
      const status = await window.novelistApi.wikiGetStatus();
      setWikiStatus(status);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setWikiError(message);
      setError(message);
      setStatus('Errore lettura stato memoria progetto');
    }
  }, [currentProject, setError, setStatus]);

  const handleWikiSync = useCallback(async (): Promise<void> => {
    if (!currentProject || wikiBusy) {
      return;
    }

    setWikiBusy(true);
    setError(null);
    setWikiError(null);
    try {
      const result = await window.novelistApi.wikiSync();
      const status = await window.novelistApi.wikiGetStatus();
      setWikiStatus(status);
      setStatus(
        result.changed
          ? `Memoria progetto aggiornata: ${result.changedSources.length} fonti modificate`
          : 'Memoria progetto gia aggiornata',
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setWikiError(message);
      setError(message);
      setStatus('Errore aggiornamento memoria progetto');
    } finally {
      setWikiBusy(false);
    }
  }, [currentProject, setError, setStatus, wikiBusy]);

  const handleWikiSearch = useCallback(async (): Promise<void> => {
    if (!currentProject || wikiBusy) {
      return;
    }

    const query = wikiSearchQuery.trim();
    if (!query) {
      setWikiSearchResults([]);
      setSelectedWikiSearchResult(null);
      setStatus('Inserisci una ricerca per la memoria progetto');
      return;
    }

    setWikiBusy(true);
    setError(null);
    setWikiError(null);
    try {
      const results = await window.novelistApi.wikiSearch({ query, limit: 10 });
      setWikiSearchResults(results);
      setSelectedWikiSearchResult(null);
      setStatus(
        results.length > 0
          ? `Memoria progetto: ${results.length} risultati`
          : 'Memoria progetto: nessun risultato',
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setWikiError(message);
      setError(message);
      setStatus('Errore ricerca memoria progetto');
    } finally {
      setWikiBusy(false);
    }
  }, [currentProject, setError, setStatus, wikiBusy, wikiSearchQuery]);

  const handleOpenWikiSearchResult = useCallback(
    async (result: WikiSearchResult): Promise<void> => {
      setWikiBusy(true);
      setError(null);
      setWikiError(null);
      try {
        const readSource = window.novelistApi.wikiReadSource;
        const source =
          typeof readSource === 'function' ? await readSource({ path: result.path }) : null;
        setSelectedWikiSearchResult({
          ...result,
          content: source?.content || result.content || result.snippet,
        });
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setWikiError(message);
        setError(message);
        setStatus('Errore apertura fonte memoria');
      } finally {
        setWikiBusy(false);
      }
    },
    [setError, setStatus],
  );

  const syncProjectWikiAfterWorkspaceChange = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      return;
    }

    if (wikiAutoSyncInFlightRef.current) {
      showWorkspaceNotice('aggiornamento memoria in corso...');
      await wikiAutoSyncInFlightRef.current;
      return;
    }

    showWorkspaceNotice('aggiornamento memoria in corso...');
    const syncPromise = (async () => {
      try {
        await window.novelistApi.wikiSync();
        const status = await window.novelistApi.wikiGetStatus();
        setWikiStatus(status);
        setWikiError(null);
        showWorkspaceNotice('memoria aggiornata', 1800);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setWikiError(message);
        setError(message);
        showWorkspaceNotice('errore aggiornamento memoria', 4500);
        setStatus('Errore aggiornamento automatico memoria progetto');
      }
    })();

    wikiAutoSyncInFlightRef.current = syncPromise;
    try {
      await syncPromise;
    } finally {
      if (wikiAutoSyncInFlightRef.current === syncPromise) {
        wikiAutoSyncInFlightRef.current = null;
      }
    }
  }, [currentProject, setError, setStatus, showWorkspaceNotice]);

  return {
    handleOpenWikiSearchResult,
    handleWikiSearch,
    handleWikiSync,
    refreshWikiStatus,
    resetWikiSearch,
    resetWikiState,
    selectedWikiSearchResult,
    setSelectedWikiSearchResult,
    setWikiError,
    setWikiSearchQuery,
    setWikiStatus,
    syncProjectWikiAfterWorkspaceChange,
    wikiBusy,
    wikiError,
    wikiSearchQuery,
    wikiSearchResults,
    wikiStatus,
  };
}
