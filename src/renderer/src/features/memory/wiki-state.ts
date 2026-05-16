import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { Translate } from '../../i18n';

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
  t: Translate;
}

export function useWikiState({
  currentProject,
  setError,
  setStatus,
  showWorkspaceNotice,
  t,
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
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setWikiError(message);
      setError(message);
      setStatus(t('memory.wiki.statusReadError'));
    }
  }, [currentProject, setError, setStatus, t]);

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
          ? t('memory.wiki.statusSynced', { count: result.changedSources.length })
          : t('memory.wiki.statusSyncedNoChanges'),
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setWikiError(message);
      setError(message);
      setStatus(t('memory.wiki.statusSyncError'));
    } finally {
      setWikiBusy(false);
    }
  }, [currentProject, setError, setStatus, t, wikiBusy]);

  const handleWikiSearch = useCallback(async (): Promise<void> => {
    if (!currentProject || wikiBusy) {
      return;
    }

    const query = wikiSearchQuery.trim();
    if (!query) {
      setWikiSearchResults([]);
      setSelectedWikiSearchResult(null);
      setStatus(t('memory.wiki.statusSearchMissing'));
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
          ? t('memory.wiki.statusSearchResults', { count: results.length })
          : t('memory.wiki.statusSearchEmpty'),
      );
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setWikiError(message);
      setError(message);
      setStatus(t('memory.wiki.statusSearchError'));
    } finally {
      setWikiBusy(false);
    }
  }, [currentProject, setError, setStatus, t, wikiBusy, wikiSearchQuery]);

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
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setWikiError(message);
        setError(message);
        setStatus(t('memory.wiki.statusSourceOpenError'));
      } finally {
        setWikiBusy(false);
      }
    },
    [setError, setStatus, t],
  );

  const syncProjectWikiAfterWorkspaceChange = useCallback(async (): Promise<void> => {
    if (!currentProject) {
      return;
    }

    if (wikiAutoSyncInFlightRef.current) {
      showWorkspaceNotice(t('memory.wiki.noticeSyncing'));
      await wikiAutoSyncInFlightRef.current;
      return;
    }

    showWorkspaceNotice(t('memory.wiki.noticeSyncing'));
    const syncPromise = (async () => {
      try {
        await window.novelistApi.wikiSync();
        const status = await window.novelistApi.wikiGetStatus();
        setWikiStatus(status);
        setWikiError(null);
        showWorkspaceNotice(t('memory.wiki.noticeUpdated'), 1800);
      } catch (caughtError) {
        const message =
          caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setWikiError(message);
        setError(message);
        showWorkspaceNotice(t('memory.wiki.noticeError'), 4500);
        setStatus(t('memory.wiki.statusAutoSyncError'));
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
  }, [currentProject, setError, setStatus, showWorkspaceNotice, t]);

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
