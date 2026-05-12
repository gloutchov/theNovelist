import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

export type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;

interface AppPreferencesStateOptions {
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
}

export function normalizeIntervalMinutes(value: number): number {
  return Math.min(120, Math.max(1, Math.round(value || 1)));
}

export function formatAutosaveLabel(preferences: AppPreferences | null): string {
  if (!preferences) {
    return 'Non caricato';
  }

  if (preferences.autosaveMode === 'auto') {
    return 'Automatico a ogni modifica';
  }

  if (preferences.autosaveMode === 'interval') {
    return `Ogni ${normalizeIntervalMinutes(preferences.autosaveIntervalMinutes)} min`;
  }

  return 'Manuale';
}

export function useAppPreferencesState({ setError, setStatus }: AppPreferencesStateOptions) {
  const [appPreferences, setAppPreferences] = useState<AppPreferences | null>(null);
  const [appPreferencesBusy, setAppPreferencesBusy] = useState<boolean>(false);

  const refreshAppPreferences = useCallback(async (): Promise<AppPreferences> => {
    const preferences = await window.novelistApi.getAppPreferences();
    setAppPreferences(preferences);
    return preferences;
  }, []);

  const handleSaveAppPreferences = useCallback(async (): Promise<void> => {
    if (!appPreferences) {
      return;
    }

    setAppPreferencesBusy(true);
    setError(null);
    try {
      const saved = await window.novelistApi.updateAppPreferences({
        autosaveMode: appPreferences.autosaveMode,
        autosaveIntervalMinutes: normalizeIntervalMinutes(appPreferences.autosaveIntervalMinutes),
      });
      setAppPreferences(saved);
      setStatus('Preferenze utente salvate');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setStatus('Errore salvataggio preferenze utente');
    } finally {
      setAppPreferencesBusy(false);
    }
  }, [appPreferences, setError, setStatus]);

  return {
    appPreferences,
    appPreferencesBusy,
    handleSaveAppPreferences,
    refreshAppPreferences,
    setAppPreferences,
  };
}
