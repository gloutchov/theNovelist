import { useCallback, useState } from 'react';
import type { AppLanguage, Translate } from '../../i18n';
import type { ProjectRecord } from '../project/project-session';

export type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;

export const DEFAULT_API_MODEL = 'gpt-5-mini';
export const DEFAULT_API_IMAGE_MODEL = 'gpt-image-1';
export const DEFAULT_OLLAMA_MODEL = 'gemma4:e4b-it-q4_K_M';

export function getApiKeyStorageLabel(
  storage: CodexSettings['apiKeyStorage'],
  language: AppLanguage = 'it',
): string {
  if (storage === 'secure_storage') {
    return language === 'en' ? 'secure system storage' : 'archivio sicuro di sistema';
  }
  if (storage === 'legacy_db') {
    return language === 'en' ? 'legacy storage (DB)' : 'archivio legacy (DB)';
  }
  return language === 'en' ? 'none' : 'nessuno';
}

export function getAiProviderLabel(provider: CodexSettings['provider']): string {
  if (provider === 'openai_api') {
    return 'OpenAI API';
  }

  return 'Ollama';
}

export function getAiFallbackLabel(
  fallbackProvider: CodexSettings['fallbackProvider'],
  language: AppLanguage = 'it',
): string {
  if (fallbackProvider === 'none') {
    return language === 'en' ? 'Non-AI' : 'Non AI';
  }

  return getAiProviderLabel(fallbackProvider);
}

function aiProviderCanLeaveDevice(provider: CodexSettings['provider']): boolean {
  return provider === 'openai_api';
}

function aiSettingsMaySendPromptExternally(settings: CodexSettings): boolean {
  return (
    aiProviderCanLeaveDevice(settings.provider) ||
    (settings.fallbackProvider !== 'none' && aiProviderCanLeaveDevice(settings.fallbackProvider))
  );
}

export function getAiMemorySharingLabel(
  settings: CodexSettings | null,
  language: AppLanguage = 'it',
): string {
  if (!settings) {
    return language === 'en'
      ? 'Project memory: unavailable.'
      : 'Memoria progetto: non disponibile.';
  }

  const normalized = normalizeCodexSettings(settings);
  if (!aiSettingsMaySendPromptExternally(normalized)) {
    return language === 'en'
      ? 'Project memory: local, not sent to external providers.'
      : 'Memoria progetto: locale, non inviata a provider esterni.';
  }

  return normalized.allowExternalMemorySharing
    ? language === 'en'
      ? 'Project memory: sending to external providers is allowed.'
      : 'Memoria progetto: invio a provider esterni consentito.'
    : language === 'en'
      ? 'Project memory: not sent to external providers.'
      : 'Memoria progetto: non inviata a provider esterni.';
}

export function getAiFallbackOptions(
  provider: CodexSettings['provider'],
  language: AppLanguage = 'it',
): Array<{ value: CodexSettings['fallbackProvider']; label: string }> {
  return [
    { value: 'none', label: getAiFallbackLabel('none', language) },
    ...(['openai_api', 'ollama'] as const)
      .filter((candidate) => candidate !== provider)
      .map((candidate) => ({
        value: candidate,
        label: getAiProviderLabel(candidate),
      })),
  ];
}

export function normalizeCodexSettings(settings: CodexSettings): CodexSettings {
  const maybeSettings = settings as CodexSettings & {
    allowExternalMemorySharing?: boolean;
    apiImageModel?: string;
    ollamaModel?: string;
  };
  return {
    ...settings,
    allowExternalMemorySharing: maybeSettings.allowExternalMemorySharing ?? false,
    apiImageModel: maybeSettings.apiImageModel?.trim() || DEFAULT_API_IMAGE_MODEL,
    ollamaModel: maybeSettings.ollamaModel?.trim() || DEFAULT_OLLAMA_MODEL,
  };
}

export function hasPendingAiSettingsChanges(
  localSettings: CodexSettings | null,
  persistedSettings: CodexSettings,
  apiKeyInput: string,
  clearStoredApiKey: boolean,
): boolean {
  if (!localSettings) {
    return false;
  }

  return (
    localSettings.enabled !== persistedSettings.enabled ||
    localSettings.provider !== persistedSettings.provider ||
    localSettings.fallbackProvider !== persistedSettings.fallbackProvider ||
    localSettings.allowApiCalls !== persistedSettings.allowApiCalls ||
    localSettings.allowExternalMemorySharing !==
      normalizeCodexSettings(persistedSettings).allowExternalMemorySharing ||
    localSettings.autoSummarizeDescriptions !== persistedSettings.autoSummarizeDescriptions ||
    localSettings.apiModel !== persistedSettings.apiModel ||
    normalizeCodexSettings(localSettings).apiImageModel !==
      normalizeCodexSettings(persistedSettings).apiImageModel ||
    normalizeCodexSettings(localSettings).ollamaModel !==
      normalizeCodexSettings(persistedSettings).ollamaModel ||
    Boolean(apiKeyInput.trim()) ||
    clearStoredApiKey
  );
}

export function useAiSettingsState({
  currentProject,
  setError,
  setStatus,
  t,
}: {
  currentProject: ProjectRecord;
  setError: (message: string | null) => void;
  setStatus: (message: string) => void;
  t: Translate;
}) {
  const [aiSettings, setAiSettings] = useState<CodexSettings | null>(null);
  const [aiSettingsBusy, setAiSettingsBusy] = useState<boolean>(false);
  const [aiApiKeyInput, setAiApiKeyInput] = useState<string>('');
  const [clearStoredApiKey, setClearStoredApiKey] = useState<boolean>(false);
  const [isAiSettingsModalOpen, setIsAiSettingsModalOpen] = useState<boolean>(false);

  const loadAiSettings = useCallback((settings: CodexSettings): void => {
    setAiSettings(normalizeCodexSettings(settings));
    setAiApiKeyInput('');
    setClearStoredApiKey(false);
  }, []);

  const resetAiSettings = useCallback((): void => {
    setAiSettings(null);
    setAiApiKeyInput('');
    setClearStoredApiKey(false);
    setIsAiSettingsModalOpen(false);
  }, []);

  const handleSaveAiSettings = useCallback(async (): Promise<void> => {
    if (!aiSettings || !currentProject) {
      return;
    }

    const apiKeyInput = aiApiKeyInput.trim();
    const shouldClearStoredApiKey = clearStoredApiKey && !apiKeyInput;

    setAiSettingsBusy(true);
    setError(null);
    try {
      const saved = await window.novelistApi.codexUpdateSettings({
        enabled: aiSettings.enabled,
        provider: aiSettings.provider,
        fallbackProvider: aiSettings.fallbackProvider,
        allowApiCalls: aiSettings.allowApiCalls,
        allowExternalMemorySharing: aiSettings.allowExternalMemorySharing,
        autoSummarizeDescriptions: aiSettings.autoSummarizeDescriptions,
        apiKey: apiKeyInput || undefined,
        clearStoredApiKey: shouldClearStoredApiKey || undefined,
        apiModel: aiSettings.apiModel,
        apiImageModel: normalizeCodexSettings(aiSettings).apiImageModel,
        ollamaModel: normalizeCodexSettings(aiSettings).ollamaModel,
      });
      loadAiSettings(saved);
      setStatus(t('settings.status.aiSettingsSaved'));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setStatus(t('settings.status.aiSettingsSaveError'));
    } finally {
      setAiSettingsBusy(false);
    }
  }, [
    aiApiKeyInput,
    aiSettings,
    clearStoredApiKey,
    currentProject,
    loadAiSettings,
    setError,
    setStatus,
    t,
  ]);

  return {
    aiSettings,
    setAiSettings,
    aiSettingsBusy,
    aiApiKeyInput,
    setAiApiKeyInput,
    clearStoredApiKey,
    setClearStoredApiKey,
    isAiSettingsModalOpen,
    setIsAiSettingsModalOpen,
    handleSaveAiSettings,
    loadAiSettings,
    resetAiSettings,
  };
}
