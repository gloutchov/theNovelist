import { formatWikiCategoryLabel, formatWikiResultTitle } from './wiki-formatters';
import type { SelectedWikiSearchResult } from './wiki-state';
import type { Translate } from '../../i18n';

interface MemoryResultModalProps {
  result: SelectedWikiSearchResult;
  onClose: () => void;
  t: Translate;
}

export function MemoryResultModal({ result, onClose, t }: MemoryResultModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal-card large-modal-card memory-result-modal-card">
        <div className="memory-result-modal-header">
          <div>
            <h3>{formatWikiResultTitle(result, t)}</h3>
            <code>{result.path}</code>
          </div>
          <span>{formatWikiCategoryLabel(result.category, t)}</span>
        </div>
        <pre className="memory-result-full-text">{result.content}</pre>
        <div className="row-buttons modal-actions">
          <button type="button" className="button-secondary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
}
