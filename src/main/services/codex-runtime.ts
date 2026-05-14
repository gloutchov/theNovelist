import { APP_CONFIG } from '../config/app-config';
import type { CodexSettingsRecord as PersistedCodexSettingsRecord } from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import {
  getStoredCodexApiKey,
  isSecureStorageAvailable,
  setStoredCodexApiKey,
} from '../security/secure-settings';
import type { ResolveImageApiRuntime } from './image-runtime';

export type Repository = ReturnType<ProjectSessionManager['getRepository']>;
export type CodexSettingsRecord = ReturnType<Repository['getOrCreateCodexSettings']>;

export interface CodexSettingsView extends Omit<PersistedCodexSettingsRecord, 'apiKey'> {
  apiKey: null;
  hasStoredApiKey: boolean;
  hasRuntimeApiKey: boolean;
  apiKeyStorage: 'secure_storage' | 'legacy_db' | 'none';
}

export interface ResolvedCodexRuntime {
  settings: CodexSettingsRecord;
  runtimeApiKey: string | null;
  apiKeyStorage: 'secure_storage' | 'legacy_db' | 'none';
}

export async function resolveCodexRuntime(
  repository: Repository,
  projectId: string,
): Promise<ResolvedCodexRuntime> {
  let settings = repository.getOrCreateCodexSettings(projectId);
  let runtimeApiKey: string | null = null;
  let apiKeyStorage: ResolvedCodexRuntime['apiKeyStorage'] = 'none';

  runtimeApiKey = await getStoredCodexApiKey(projectId);
  if (runtimeApiKey?.trim()) {
    apiKeyStorage = 'secure_storage';
  }

  const legacyApiKey = settings.apiKey?.trim() ?? '';
  if (!runtimeApiKey && legacyApiKey) {
    if (isSecureStorageAvailable()) {
      await setStoredCodexApiKey(projectId, legacyApiKey);
      repository.upsertCodexSettings(projectId, { apiKey: null });
      settings = repository.getOrCreateCodexSettings(projectId);
      runtimeApiKey = legacyApiKey;
      apiKeyStorage = 'secure_storage';
    } else {
      runtimeApiKey = legacyApiKey;
      apiKeyStorage = 'legacy_db';
    }
  }

  return {
    settings,
    runtimeApiKey: runtimeApiKey?.trim() ? runtimeApiKey.trim() : null,
    apiKeyStorage,
  };
}

export function toCodexSettingsResponse(resolved: ResolvedCodexRuntime): CodexSettingsView {
  return {
    ...resolved.settings,
    apiKey: null,
    hasStoredApiKey: resolved.apiKeyStorage !== 'none',
    hasRuntimeApiKey: Boolean(
      resolved.runtimeApiKey?.trim() || process.env['OPENAI_API_KEY']?.trim(),
    ),
    apiKeyStorage: resolved.apiKeyStorage,
  };
}

function providerCanLeaveDevice(provider: CodexSettingsRecord['provider']): boolean {
  return provider === 'openai_api';
}

function settingsMaySendPromptExternally(
  settings: Pick<CodexSettingsRecord, 'provider' | 'fallbackProvider'>,
): boolean {
  return (
    providerCanLeaveDevice(settings.provider) ||
    (settings.fallbackProvider !== 'none' && providerCanLeaveDevice(settings.fallbackProvider))
  );
}

export function shouldAttachProjectMemoryForSettings(
  settings: Pick<
    CodexSettingsRecord,
    'allowExternalMemorySharing' | 'provider' | 'fallbackProvider'
  >,
): boolean {
  return settings.allowExternalMemorySharing || !settingsMaySendPromptExternally(settings);
}

export const resolveImageApiRuntime: ResolveImageApiRuntime = async (
  repository: Repository,
  projectId: string,
): Promise<{ apiKey: string; model: string }> => {
  const runtime = await resolveCodexRuntime(repository, projectId);
  const settings = runtime.settings;
  if (!settings.enabled) {
    throw new Error('Consenso AI non abilitato per questo progetto.');
  }
  if (!settings.allowApiCalls) {
    throw new Error('Chiamate API disabilitate nelle Impostazioni AI.');
  }
  if (settings.provider !== 'openai_api') {
    throw new Error('Provider AI non compatibile: imposta OpenAI API nelle Impostazioni AI.');
  }

  const apiKey = runtime.runtimeApiKey?.trim() || process.env['OPENAI_API_KEY']?.trim();
  if (!apiKey) {
    throw new Error('API key mancante: configura OPENAI_API_KEY o la chiave in Impostazioni AI.');
  }

  const modelFromEnv = process.env[APP_CONFIG.ai.imageModelEnvVar]?.trim();

  return {
    apiKey,
    model: modelFromEnv || settings.apiImageModel.trim() || APP_CONFIG.ai.defaultImageModel,
  };
};
