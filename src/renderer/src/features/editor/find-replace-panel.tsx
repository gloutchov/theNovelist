import type { RefObject } from 'react';
import type { Translate } from '../../i18n';

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
  t: Translate;
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
  t,
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
          {t('editor.toolbar.find')}
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
            placeholder={t('editor.toolbar.findPlaceholder')}
          />
        </label>
        {mode === 'replace' ? (
          <label>
            {t('editor.toolbar.replaceWith')}
            <input
              value={replaceQuery}
              onChange={(event) => onReplaceQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                  event.preventDefault();
                  onReplaceCurrent();
                }
              }}
              placeholder={t('editor.toolbar.replacePlaceholder')}
            />
          </label>
        ) : null}
        <div className="find-replace-actions">
          <span className="find-replace-count">{matchCounter}</span>
          <button type="button" onClick={() => onFindSubmit('previous')}>
            {t('common.previous')}
          </button>
          <button type="submit">{t('editor.toolbar.next')}</button>
          {mode === 'replace' ? (
            <>
              <button type="button" onClick={onReplaceCurrent}>
                {t('editor.toolbar.replace')}
              </button>
              <button type="button" onClick={onReplaceAll}>
                {t('editor.toolbar.replaceAll')}
              </button>
            </>
          ) : (
            <button type="button" onClick={() => onModeChange('replace')}>
              {t('editor.toolbar.showReplace')}
            </button>
          )}
          <button type="button" className="button-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </form>
    </section>
  );
}
