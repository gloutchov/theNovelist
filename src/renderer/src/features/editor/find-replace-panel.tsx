import type { RefObject } from 'react';

type FindReplaceMode = 'find' | 'replace';

interface FindReplacePanelProps {
  activeFindIndex: number;
  findInputRef: RefObject<HTMLInputElement | null>;
  findMatchCount: number;
  findQuery: string;
  mode: FindReplaceMode;
  onClose: () => void;
  onFindQueryChange: (value: string) => void;
  onFindSubmit: (direction: 'next' | 'previous') => void;
  onModeChange: (mode: FindReplaceMode) => void;
  onReplaceAll: () => void;
  onReplaceCurrent: () => void;
  onReplaceQueryChange: (value: string) => void;
  replaceQuery: string;
}

export function FindReplacePanel({
  activeFindIndex,
  findInputRef,
  findMatchCount,
  findQuery,
  mode,
  onClose,
  onFindQueryChange,
  onFindSubmit,
  onModeChange,
  onReplaceAll,
  onReplaceCurrent,
  onReplaceQueryChange,
  replaceQuery,
}: FindReplacePanelProps) {
  const matchCounter = findQuery.trim()
    ? `${activeFindIndex >= 0 ? activeFindIndex + 1 : 0}/${findMatchCount}`
    : '0/0';

  return (
    <section className="find-replace-panel">
      <form
        className="find-replace-form"
        onSubmit={(event) => {
          event.preventDefault();
          onFindSubmit('next');
        }}
      >
        <label>
          Trova
          <input
            ref={findInputRef}
            value={findQuery}
            onChange={(event) => onFindQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') {
                return;
              }
              event.preventDefault();
              onFindSubmit(event.shiftKey ? 'previous' : 'next');
            }}
            placeholder="Testo da cercare"
          />
        </label>
        {mode === 'replace' ? (
          <label>
            Sostituisci con
            <input
              value={replaceQuery}
              onChange={(event) => onReplaceQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  onReplaceCurrent();
                }
              }}
              placeholder="Nuovo testo"
            />
          </label>
        ) : null}
        <div className="find-replace-actions">
          <span className="find-replace-count">{matchCounter}</span>
          <button type="button" onClick={() => onFindSubmit('previous')}>
            Precedente
          </button>
          <button type="submit">Successivo</button>
          {mode === 'replace' ? (
            <>
              <button type="button" onClick={onReplaceCurrent}>
                Sostituisci
              </button>
              <button type="button" onClick={onReplaceAll}>
                Sostituisci tutto
              </button>
            </>
          ) : (
            <button type="button" onClick={() => onModeChange('replace')}>
              Mostra sostituzione
            </button>
          )}
          <button type="button" className="button-secondary" onClick={onClose}>
            Chiudi
          </button>
        </div>
      </form>
    </section>
  );
}
