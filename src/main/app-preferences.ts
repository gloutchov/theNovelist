import { app } from 'electron';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_CONFIG } from './config/app-config';

export interface AppPreferencesRecord {
  autosaveMode: 'manual' | 'interval' | 'auto';
  autosaveIntervalMinutes: number;
  languageMode: 'auto' | 'it' | 'en';
  effectiveLanguage: 'it' | 'en';
  themeMode: 'system' | 'light' | 'dark';
  updatedAt: string;
}

export const DEFAULT_APP_PREFERENCES: AppPreferencesRecord = {
  autosaveMode: APP_CONFIG.appPreferences.defaultAutosaveMode,
  autosaveIntervalMinutes: APP_CONFIG.appPreferences.defaultAutosaveIntervalMinutes,
  languageMode: APP_CONFIG.appPreferences.defaultLanguageMode,
  effectiveLanguage: 'en',
  themeMode: APP_CONFIG.appPreferences.defaultThemeMode,
  updatedAt: new Date().toISOString(),
};

function getPreferencesFilePath(): string {
  return path.join(app.getPath('userData'), APP_CONFIG.appPreferences.fileName);
}

export function resolveEffectiveLanguage(
  languageMode: AppPreferencesRecord['languageMode'],
  systemLocale: string,
): AppPreferencesRecord['effectiveLanguage'] {
  if (languageMode === 'it' || languageMode === 'en') {
    return languageMode;
  }

  return systemLocale.toLowerCase().startsWith('it') ? 'it' : 'en';
}

function normalizePreferences(
  input: Partial<AppPreferencesRecord> | null | undefined,
): AppPreferencesRecord {
  const autosaveMode =
    input?.autosaveMode === 'manual' ||
    input?.autosaveMode === 'interval' ||
    input?.autosaveMode === 'auto'
      ? input.autosaveMode
      : DEFAULT_APP_PREFERENCES.autosaveMode;
  const autosaveIntervalMinutes = Number.isFinite(input?.autosaveIntervalMinutes)
    ? Math.min(
        APP_CONFIG.appPreferences.maxAutosaveIntervalMinutes,
        Math.max(
          APP_CONFIG.appPreferences.minAutosaveIntervalMinutes,
          Math.round(
            input?.autosaveIntervalMinutes ?? DEFAULT_APP_PREFERENCES.autosaveIntervalMinutes,
          ),
        ),
      )
    : DEFAULT_APP_PREFERENCES.autosaveIntervalMinutes;
  const languageMode =
    input?.languageMode === 'it' || input?.languageMode === 'en' || input?.languageMode === 'auto'
      ? input.languageMode
      : DEFAULT_APP_PREFERENCES.languageMode;
  const effectiveLanguage = resolveEffectiveLanguage(languageMode, app.getLocale());
  const themeMode =
    input?.themeMode === 'light' || input?.themeMode === 'dark' || input?.themeMode === 'system'
      ? input.themeMode
      : DEFAULT_APP_PREFERENCES.themeMode;

  return {
    autosaveMode,
    autosaveIntervalMinutes,
    languageMode,
    effectiveLanguage,
    themeMode,
    updatedAt:
      typeof input?.updatedAt === 'string' && input.updatedAt.trim()
        ? input.updatedAt
        : new Date().toISOString(),
  };
}

export async function getAppPreferences(): Promise<AppPreferencesRecord> {
  try {
    const raw = await readFile(getPreferencesFilePath(), 'utf8');
    return normalizePreferences(JSON.parse(raw) as Partial<AppPreferencesRecord>);
  } catch {
    return normalizePreferences(null);
  }
}

export async function updateAppPreferences(
  input: Partial<
    Pick<
      AppPreferencesRecord,
      'autosaveMode' | 'autosaveIntervalMinutes' | 'languageMode' | 'themeMode'
    >
  >,
): Promise<AppPreferencesRecord> {
  const current = await getAppPreferences();
  const next = normalizePreferences({
    ...current,
    ...input,
    updatedAt: new Date().toISOString(),
  });

  const filePath = getPreferencesFilePath();
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, JSON.stringify(next, null, 2), 'utf8');
  return next;
}
