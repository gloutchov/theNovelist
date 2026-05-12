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
import { normalizeIntervalMinutes, type AppPreferences } from './app-preferences';

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
  return (
    <div className="modal-overlay">
      <div className="modal-card settings-modal-card">
        <h3>Impostazioni</h3>
        <details className="panel panel-subsection settings-section" open>
          <summary>Salvataggio Automatico</summary>
          <label>
            Modalità autosave
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
              <option value="manual">Manuale</option>
              <option value="interval">Ogni N minuti</option>
              <option value="auto">Auto (a ogni modifica)</option>
            </select>
          </label>
          <label>
            Intervallo minuti
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
          <p className="muted">
            In modalità auto le modifiche persistenti vengono salvate con debounce. Le bozze di
            creazione restano manuali.
          </p>
          <div className="row-buttons">
            <button
              type="button"
              onClick={onSaveAppPreferences}
              disabled={!appPreferences || appPreferencesBusy}
            >
              Salva Preferenze Utente
            </button>
          </div>
        </details>

        <details className="panel panel-subsection settings-section" open>
          <summary>Impostazioni AI</summary>
          <label>
            Provider
            <select
              value={aiSettings?.provider ?? 'codex_cli'}
              onChange={(event) =>
                setAiSettings((prev) =>
                  prev
                    ? {
                        ...prev,
                        provider: event.target.value as 'codex_cli' | 'openai_api' | 'ollama',
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
              <option value="codex_cli">Codex CLI (locale)</option>
              <option value="openai_api">OpenAI API (opzionale)</option>
              <option value="ollama">Ollama (locale)</option>
            </select>
          </label>
          <label>
            Fallback se il provider non risponde
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
              {getAiFallbackOptions(aiSettings?.provider ?? 'codex_cli').map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <p className="muted">
            Provider primario: {getAiProviderLabel(aiSettings?.provider ?? 'codex_cli')}. Fallback:{' '}
            {getAiFallbackLabel(aiSettings?.fallbackProvider ?? 'none')}. Chiamate API esterne:{' '}
            {aiSettings?.allowApiCalls ? 'abilitate' : 'disabilitate'}.
            {getAiMemorySharingLabel(aiSettings)}
          </p>
          <label>
            Modello API
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
            Modello API immagini
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
            Modello Ollama
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
          {!currentProjectOpen ? (
            <p className="muted">
              Le impostazioni AI restano legate al progetto aperto e sono disabilitate finché non ne
              apri uno.
            </p>
          ) : null}
          <div className="row-buttons">
            <button
              type="button"
              onClick={onSaveAiSettings}
              disabled={!aiSettings || aiSettingsBusy || !currentProjectOpen}
            >
              Salva Impostazioni AI
            </button>
          </div>
        </details>

        <details className="panel panel-subsection settings-section" open>
          <summary>Consensi</summary>
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
            <span>Abilita chiamate API esterne</span>
          </label>
          <p className="muted">Richiesto per OpenAI API e per l'endpoint HTTP locale di Ollama.</p>
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
            <span>Consenso invio testo a strumenti AI</span>
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
            <span>Consenso invio memoria progetto a provider esterni</span>
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
            <span>Auto-riassunto descrizione blocco al salvataggio</span>
          </label>
          <p className="muted">
            Se disattivato, la chat AI non allega la wiki del progetto quando il provider o il
            fallback possono inviare il prompt fuori dal computer.
          </p>
          <div className="row-buttons">
            <button
              type="button"
              onClick={onSaveAiSettings}
              disabled={!aiSettings || aiSettingsBusy || !currentProjectOpen}
            >
              Salva Consensi
            </button>
          </div>
        </details>

        <details className="panel panel-subsection settings-section">
          <summary>Segreti</summary>
          <label>
            API Key
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
              Chiave API configurata in:{' '}
              <strong>{getApiKeyStorageLabel(aiSettings.apiKeyStorage)}</strong>.
            </p>
          ) : null}
          {clearStoredApiKey ? (
            <p className="muted">La chiave salvata verrà rimossa al prossimo salvataggio.</p>
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
              Rimuovi API key salvata
            </button>
            <button
              type="button"
              onClick={onSaveAiSettings}
              disabled={!aiSettings || aiSettingsBusy || !currentProjectOpen}
            >
              Salva Segreti
            </button>
          </div>
        </details>
        <div className="row-buttons">
          <button type="button" onClick={onClose} className="button-secondary">
            Chiudi
          </button>
        </div>
      </div>
    </div>
  );
}
