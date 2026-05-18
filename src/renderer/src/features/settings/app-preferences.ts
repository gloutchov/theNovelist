import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';
import { createTranslator, resolveRendererLanguage, type AppLanguage } from '../../i18n';

export type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;

interface AppPreferencesStateOptions {
  setError: Dispatch<SetStateAction<string | null>>;
  setStatus: Dispatch<SetStateAction<string>>;
}

export function normalizeIntervalMinutes(value: number): number {
  return Math.min(120, Math.max(1, Math.round(value || 1)));
}

export function formatAutosaveLabel(
  preferences: AppPreferences | null,
  language: AppLanguage = 'it',
): string {
  if (!preferences) {
    return language === 'en' ? 'Not loaded' : 'Non caricato';
  }

  if (preferences.autosaveMode === 'auto') {
    return language === 'en' ? 'Automatic on every change' : 'Automatico a ogni modifica';
  }

  if (preferences.autosaveMode === 'interval') {
    return language === 'en'
      ? `Every ${normalizeIntervalMinutes(preferences.autosaveIntervalMinutes)} min`
      : `Ogni ${normalizeIntervalMinutes(preferences.autosaveIntervalMinutes)} min`;
  }

  return language === 'en' ? 'Manual' : 'Manuale';
}

export function getLanguageModeLabel(
  languageMode: AppPreferences['languageMode'],
  language: AppLanguage = 'it',
): string {
  if (languageMode === 'it') {
    return 'Italiano';
  }

  if (languageMode === 'en') {
    return 'English';
  }

  return language === 'en' ? 'Automatic' : 'Automatico';
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
        languageMode: appPreferences.languageMode,
      });
      setAppPreferences(saved);
      const t = createTranslator(resolveRendererLanguage(saved));
      setStatus(t('settings.status.userPreferencesSaved'));
    } catch (caughtError) {
      const t = createTranslator(resolveRendererLanguage(appPreferences));
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('settings.status.userPreferencesSaveError'));
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
