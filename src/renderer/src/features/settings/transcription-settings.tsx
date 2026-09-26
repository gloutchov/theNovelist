import type { Dispatch, SetStateAction } from 'react';
import type { Translate } from '../../i18n';
import type { CodexSettings } from '../ai/ai-settings';

export function TranscriptionSettings({
  settings,
  busy,
  projectOpen,
  setSettings,
  onSave,
  t,
}: {
  settings: CodexSettings | null;
  busy: boolean;
  projectOpen: boolean;
  setSettings: Dispatch<SetStateAction<CodexSettings | null>>;
  onSave: () => void;
  t: Translate;
}) {
  return (
    <details className="panel panel-subsection settings-section">
      <summary>{t('settings.dictation.title')}</summary>
      <p className="muted">{t('settings.dictation.description')}</p>
      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={Boolean(settings?.transcriptionEnabled)}
          disabled={!settings}
          onChange={(event) =>
            setSettings((previous) =>
              previous ? { ...previous, transcriptionEnabled: event.target.checked } : previous,
            )
          }
        />
        <span>{t('settings.dictation.enabled')}</span>
      </label>
      <label>
        {t('settings.dictation.provider')}
        <select value="openai_api" disabled>
          <option value="openai_api">OpenAI API</option>
        </select>
      </label>
      <label>
        {t('settings.dictation.model')}
        <select
          value={settings?.transcriptionModel ?? 'gpt-live-transcribe'}
          disabled={!settings}
          onChange={(event) =>
            setSettings((previous) =>
              previous
                ? {
                    ...previous,
                    transcriptionModel: event.target.value as CodexSettings['transcriptionModel'],
                  }
                : previous,
            )
          }
        >
          <option value="gpt-live-transcribe">gpt-live-transcribe</option>
          <option value="gpt-realtime-whisper">gpt-realtime-whisper</option>
        </select>
      </label>
      <label>
        {t('settings.dictation.language')}
        <select
          value={settings?.transcriptionLanguage ?? 'auto'}
          disabled={!settings}
          onChange={(event) =>
            setSettings((previous) =>
              previous
                ? {
                    ...previous,
                    transcriptionLanguage: event.target
                      .value as CodexSettings['transcriptionLanguage'],
                  }
                : previous,
            )
          }
        >
          <option value="auto">{t('settings.dictation.languageAuto')}</option>
          <option value="it">{t('settings.language.italian')}</option>
          <option value="en">{t('settings.language.english')}</option>
        </select>
      </label>
      <label>
        {t('settings.dictation.fallback')}
        <select value="none" disabled>
          <option value="none">{t('common.none')}</option>
        </select>
      </label>
      <label className="checkbox-inline">
        <input
          type="checkbox"
          checked={Boolean(settings?.transcriptionAllowRemoteAudio)}
          disabled={!settings}
          onChange={(event) =>
            setSettings((previous) =>
              previous
                ? { ...previous, transcriptionAllowRemoteAudio: event.target.checked }
                : previous,
            )
          }
        />
        <span>{t('settings.dictation.audioConsent')}</span>
      </label>
      <p className="muted">{t('settings.dictation.audioConsentHelp')}</p>
      <div className="row-buttons">
        <button type="button" onClick={onSave} disabled={!settings || busy || !projectOpen}>
          {t('settings.ai.save')}
        </button>
      </div>
    </details>
  );
}
