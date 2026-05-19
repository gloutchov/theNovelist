import type { RefObject } from 'react';
import type { Translate } from '../../i18n';

interface AiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'cli' | 'api' | 'fallback';
}

interface AiStatus {
  available: boolean;
}

interface AiChatSidebarProps {
  aiAssistantLabel: string;
  chatInput: string;
  chatMessages: AiChatMessage[];
  chatScrollRef: RefObject<HTMLDivElement | null>;
  codexBusy: boolean;
  codexEnabled: boolean;
  codexStatus: AiStatus | null;
  canClearChat: boolean;
  onCancelRequest: () => void;
  onChatInputChange: (value: string) => void;
  onClearChat: () => void;
  onSendChat: () => void;
  t: Translate;
}

export function AiChatSidebar({
  aiAssistantLabel,
  chatInput,
  chatMessages,
  chatScrollRef,
  codexBusy,
  codexEnabled,
  codexStatus,
  canClearChat,
  onCancelRequest,
  onChatInputChange,
  onClearChat,
  onSendChat,
  t,
}: AiChatSidebarProps) {
  return (
    <aside className="codex-sidebar">
      <div className="codex-status">
        <h4>{t('editor.ai.assistantTitle', { assistant: aiAssistantLabel })}</h4>
        <p>
          {t('editor.ai.status')}{' '}
          <strong>
            {codexStatus
              ? codexStatus.available
                ? t('editor.ai.statusAvailable')
                : t('editor.ai.statusFallback')
              : t('editor.ai.statusChecking')}
          </strong>
        </p>
      </div>

      <div className="codex-chat" ref={chatScrollRef}>
        {chatMessages.length === 0 ? <p className="muted">{t('editor.ai.emptyChat')}</p> : null}
        {chatMessages.map((message) => (
          <div key={message.id} className={`chat-msg chat-msg-${message.role}`}>
            <p>{message.content}</p>
            {message.mode ? <span className="chat-mode">{message.mode}</span> : null}
          </div>
        ))}
      </div>

      <div className="codex-chat-input">
        <textarea
          rows={4}
          value={chatInput}
          onChange={(event) => onChatInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
              event.preventDefault();
              onSendChat();
            }
          }}
          placeholder={t('editor.ai.placeholder', { assistant: aiAssistantLabel })}
        />
        <div className="codex-chat-actions">
          <button
            type="button"
            onClick={onSendChat}
            disabled={codexBusy || !chatInput.trim() || !codexEnabled}
            className={`codex-send-button${codexBusy ? ' ai-working' : ''}`}
          >
            {t('common.send')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onCancelRequest}
            disabled={!codexBusy}
          >
            {t('editor.ai.cancelRequest')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onClearChat}
            disabled={codexBusy || !canClearChat}
          >
            {t('editor.ai.clearChat')}
          </button>
        </div>
      </div>
    </aside>
  );
}
