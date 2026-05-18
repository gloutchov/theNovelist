import type { Dispatch, SetStateAction } from 'react';
import {
  DEFAULT_API_IMAGE_MODEL,
  DEFAULT_API_MODEL,
  DEFAULT_OLLAMA_MODEL,
  getAiFallbackLabel,
  getAiFallbackOptions,
  getAiMemorySharingLabel,
  getAiProviderLabel,
  getApiKeyStorageLabel,
  normalizeCodexSettings,
  type CodexSettings,
} from '../ai/ai-settings';
import {
  getLanguageModeLabel,
  getThemeModeLabel,
  normalizeIntervalMinutes,
  type AppPreferences,
} from './app-preferences';
import { createTranslator, resolveRendererLanguage } from '../../i18n';

interface SettingsModalProps {
  aiApiKeyInput: string;
  aiSettings: CodexSettings | null;
  aiSettingsBusy: boolean;
  appPreferences: AppPreferences | null;
  appPreferencesBusy: boolean;
  clearStoredApiKey: boolean;
  currentProjectOpen: boolean;
  onClose: () => void;
  onSaveAiSettings: () => void;
  onSaveAppPreferences: () => void;
  setAiApiKeyInput: (value: string) => void;
  setAiSettings: Dispatch<SetStateAction<CodexSettings | null>>;
  setAppPreferences: Dispatch<SetStateAction<AppPreferences | null>>;
  setClearStoredApiKey: (value: boolean) => void;
}

export function SettingsModal({
  aiApiKeyInput,
  aiSettings,
  aiSettingsBusy,
  appPreferences,
  appPreferencesBusy,
  clearStoredApiKey,
  currentProjectOpen,
  onClose,
  onSaveAiSettings,
  onSaveAppPreferences,
  setAiApiKeyInput,
  setAiSettings,
  setAppPreferences,
  setClearStoredApiKey,
}: SettingsModalProps) {
  const language = resolveRendererLanguage(appPreferences);
  const t = createTranslator(language);

  return (
    <div className="modal-overlay">
      <div className="modal-card settings-modal-card">
        <h3>{t('settings.title')}</h3>
        <details className="panel panel-subsection settings-section" open>
          <summary>{t('settings.userPreferences')}</summary>
          <label>
            {t('settings.autosave.label')}
            <select
              value={appPreferences?.autosaveMode ?? 'auto'}
              onChange={(event) =>
                setAppPreferences((prev) =>
                  prev
                    ? {
                        ...prev,
                        autosaveMode: event.target.value as 'manual' | 'interval' | 'auto',
                      }
                    : prev,
                )
              }
              disabled={!appPreferences}
            >
              <option value="manual">{t('settings.autosave.manual')}</option>
              <option value="interval">{t('settings.autosave.interval')}</option>
              <option value="auto">{t('settings.autosave.auto')}</option>
            </select>
          </label>
          <label>
            {t('settings.autosave.intervalMinutes')}
            <input
              type="number"
              min={1}
              max={120}
              value={appPreferences?.autosaveIntervalMinutes ?? 5}
              onChange={(event) =>
                setAppPreferences((prev) =>
                  prev
                    ? {
                        ...prev,
                        autosaveIntervalMinutes: normalizeIntervalMinutes(
                          Number(event.target.value) || 1,
                        ),
                      }
                    : prev,
                )
              }
              disabled={!appPreferences || appPreferences.autosaveMode !== 'interval'}
            />
          </label>
          <p className="muted">{t('settings.autosave.description')}</p>
          <label>
            {t('settings.language.label')}
            <select
              value={appPreferences?.languageMode ?? 'auto'}
              onChange={(event) =>
                setAppPreferences((prev) =>
                  prev
                    ? (() => {
                        const languageMode = event.target.value as AppPreferences['languageMode'];
                        return {
                          ...prev,
                          languageMode,
                          effectiveLanguage:
                            languageMode === 'auto'
                              ? navigator.language.toLowerCase().startsWith('it')
                                ? 'it'
                                : 'en'
                              : languageMode,
                        };
                      })()
                    : prev,
                )
              }
              disabled={!appPreferences}
            >
              <option value="auto">{t('settings.language.auto')}</option>
              <option value="it">{t('settings.language.italian')}</option>
              <option value="en">{t('settings.language.english')}</option>
            </select>
          </label>
          <p className="muted">
            {t('settings.language.selected', {
              language: getLanguageModeLabel(appPreferences?.languageMode ?? 'auto', language),
            })}{' '}
            {t('settings.language.effective', {
              language:
                appPreferences?.effectiveLanguage === 'it'
                  ? t('settings.language.italian')
                  : t('settings.language.english'),
            })}
          </p>
          <label>
            {t('settings.theme.label')}
            <select
              value={appPreferences?.themeMode ?? 'system'}
              onChange={(event) =>
                setAppPreferences((prev) =>
                  prev
                    ? {
                        ...prev,
                        themeMode: event.target.value as AppPreferences['themeMode'],
                      }
                    : prev,
                )
              }
              disabled={!appPreferences}
            >
              <option value="system">{t('settings.theme.system')}</option>
              <option value="light">{t('settings.theme.light')}</option>
              <option value="dark">{t('settings.theme.dark')}</option>
            </select>
          </label>
          <p className="muted">
            {t('settings.theme.selected', {
              theme: getThemeModeLabel(appPreferences?.themeMode ?? 'system', language),
            })}
          </p>
          <div className="row-buttons">
            <button
              type="button"
              onClick={onSaveAppPreferences}
              disabled={!appPreferences || appPreferencesBusy}
            >
              {t('settings.saveUserPreferences')}
            </button>
          </div>
        </details>

        <details className="panel panel-subsection settings-section" open>
          <summary>{t('settings.ai')}</summary>
          <label>
            {t('settings.ai.provider')}
            <select
              value={aiSettings?.provider ?? 'ollama'}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        provider: event.target.value as 'openai_api' | 'ollama',
                        fallbackProvider:
                          prev.fallbackProvider === event.target.value
                            ? 'none'
                            : prev.fallbackProvider,
                      }
                    : prev,
                )
              }
              disabled={!aiSettings}
            >
              <option value="openai_api">OpenAI API</option>
              <option value="ollama">Ollama (locale)</option>
            </select>
          </label>
          <label>
            {t('settings.ai.fallback')}
            <select
              value={aiSettings?.fallbackProvider ?? 'none'}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        fallbackProvider: event.target.value as CodexSettings['fallbackProvider'],
                      }
                    : prev,
                )
              }
              disabled={!aiSettings}
            >
              {getAiFallbackOptions(aiSettings?.provider ?? 'ollama', language).map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            {t('settings.ai.primaryProvider', {
              provider: getAiProviderLabel(aiSettings?.provider ?? 'ollama'),
              fallback: getAiFallbackLabel(aiSettings?.fallbackProvider ?? 'none', language),
            })}{' '}
            {t('settings.ai.externalCalls', {
              status: aiSettings?.allowApiCalls
                ? language === 'en'
                  ? 'enabled'
                  : 'abilitate'
                : language === 'en'
                  ? 'disabled'
                  : 'disabilitate',
            })}{' '}
            {getAiMemorySharingLabel(aiSettings, language)}
          </p>
          <label>
            {t('settings.ai.apiModel')}
            <input
              value={aiSettings?.apiModel ?? DEFAULT_API_MODEL}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        apiModel: event.target.value,
                      }
                    : prev,
                )
              }
              placeholder={DEFAULT_API_MODEL}
              disabled={!aiSettings}
            />
          </label>
          <label>
            {t('settings.ai.imageModel')}
            <input
              value={
                aiSettings
                  ? normalizeCodexSettings(aiSettings).apiImageModel
                  : DEFAULT_API_IMAGE_MODEL
              }
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        apiImageModel: event.target.value,
                      }
                    : prev,
                )
              }
              placeholder={DEFAULT_API_IMAGE_MODEL}
              disabled={!aiSettings}
            />
          </label>
          <label>
            {t('settings.ai.ollamaModel')}
            <input
              value={
                aiSettings ? normalizeCodexSettings(aiSettings).ollamaModel : DEFAULT_OLLAMA_MODEL
              }
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        ollamaModel: event.target.value,
                      }
                    : prev,
                )
              }
              placeholder={DEFAULT_OLLAMA_MODEL}
              disabled={!aiSettings}
            />
          </label>
          {!currentProjectOpen ? <p className="muted">{t('settings.ai.noProject')}</p> : null}
          <div className="row-buttons">
            <button
              type="button"
              onClick={onSaveAiSettings}
              disabled={!aiSettings || aiSettingsBusy || !currentProjectOpen}
            >
              {t('settings.ai.save')}
            </button>
          </div>
        </details>

        <details className="panel panel-subsection settings-section" open>
          <summary>{t('settings.consents.title')}</summary>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={Boolean(aiSettings?.allowApiCalls)}
              disabled={!aiSettings}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        allowApiCalls: event.target.checked,
                      }
                    : prev,
                )
              }
            />
            <span>{t('settings.consents.allowApiCalls')}</span>
          </label>
          <p className="muted">{t('settings.consents.allowApiCallsHelp')}</p>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={Boolean(aiSettings?.enabled)}
              disabled={!aiSettings}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        enabled: event.target.checked,
                      }
                    : prev,
                )
              }
            />
            <span>{t('settings.consents.aiEnabled')}</span>
          </label>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={Boolean(aiSettings?.allowExternalMemorySharing)}
              disabled={!aiSettings}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        allowExternalMemorySharing: event.target.checked,
                      }
                    : prev,
                )
              }
            />
            <span>{t('settings.consents.memorySharing')}</span>
          </label>
          <label className="checkbox-inline">
            <input
              type="checkbox"
              checked={Boolean(aiSettings?.autoSummarizeDescriptions)}
              disabled={!aiSettings}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        autoSummarizeDescriptions: event.target.checked,
                      }
                    : prev,
                )
              }
            />
            <span>{t('settings.consents.autoSummary')}</span>
          </label>
          <p className="muted">{t('settings.consents.memoryHelp')}</p>
          <div className="row-buttons">
            <button
              type="button"
              onClick={onSaveAiSettings}
              disabled={!aiSettings || aiSettingsBusy || !currentProjectOpen}
            >
              {t('settings.consents.save')}
            </button>
          </div>
        </details>

        <details className="panel panel-subsection settings-section">
          <summary>{t('settings.secrets.title')}</summary>
          <label>
            {t('settings.secrets.apiKey')}
            <input
              type="password"
              value={aiApiKeyInput}
              onChange={(event) => {
                setAiApiKeyInput(event.target.value);
                if (event.target.value.trim()) {
                  setClearStoredApiKey(false);
                }
              }}
              placeholder="sk-..."
              disabled={!aiSettings}
            />
          </label>
          {aiSettings?.hasStoredApiKey && !clearStoredApiKey ? (
            <p className="muted">
              {t('settings.secrets.configured', {
                storage: getApiKeyStorageLabel(aiSettings.apiKeyStorage, language),
              })}
            </p>
          ) : null}
          {clearStoredApiKey ? (
            <p className="muted">{t('settings.secrets.removedOnSave')}</p>
          ) : null}
          <div className="row-buttons">
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                setAiApiKeyInput('');
                setClearStoredApiKey(true);
              }}
              disabled={!aiSettings?.hasStoredApiKey || aiSettingsBusy || !currentProjectOpen}
            >
              {t('settings.secrets.remove')}
            </button>
            <button
              type="button"
              onClick={onSaveAiSettings}
              disabled={!aiSettings || aiSettingsBusy || !currentProjectOpen}
            >
              {t('settings.secrets.save')}
            </button>
          </div>
        </details>
        <div className="row-buttons">
          <button type="button" onClick={onClose} className="button-secondary">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
