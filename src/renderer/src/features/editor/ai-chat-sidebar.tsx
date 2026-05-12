import type { RefObject } from 'react';

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
  onCancelRequest: () => void;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
}

export function AiChatSidebar({
  aiAssistantLabel,
  chatInput,
  chatMessages,
  chatScrollRef,
  codexBusy,
  codexEnabled,
  codexStatus,
  onCancelRequest,
  onChatInputChange,
  onSendChat,
}: AiChatSidebarProps) {
  return (
    <aside className="codex-sidebar">
      <div className="codex-status">
        <h4>{`Assistente AI (${aiAssistantLabel})`}</h4>
        <p>
          Stato:{' '}
          <strong>
            {codexStatus ? (codexStatus.available ? 'Disponibile' : 'Fallback') : 'Verifica...'}
          </strong>
        </p>
      </div>

      <div className="codex-chat" ref={chatScrollRef}>
        {chatMessages.length === 0 ? (
          <p className="muted">
            Chat pronta. Chiedi brainstorming, revisione o ricerche narrative.
          </p>
        ) : null}
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
          placeholder={`Chiedi a ${aiAssistantLabel}: brainstorming, revisioni, idee di trama...`}
        />
        <div className="codex-chat-actions">
          <button
            type="button"
            onClick={onSendChat}
            disabled={codexBusy || !chatInput.trim() || !codexEnabled}
            className={codexBusy ? 'ai-working' : undefined}
          >
            Invia
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onCancelRequest}
            disabled={!codexBusy}
          >
            Annulla richiesta
          </button>
        </div>
      </div>
    </aside>
  );
}
