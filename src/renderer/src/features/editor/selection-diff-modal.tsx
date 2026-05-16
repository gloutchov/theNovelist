import type { Translate } from '../../i18n';

interface SelectionDiffChunks {
  prefix: string;
  removed: string;
  added: string;
  suffix: string;
  identical: boolean;
}

interface SelectionDiffModalProps {
  action: string;
  applying: boolean;
  chunks: SelectionDiffChunks;
  mode: string;
  onApply: () => void;
  onDiscard: () => void;
  t: Translate;
}

export function SelectionDiffModal({
  action,
  applying,
  chunks,
  mode,
  onApply,
  onDiscard,
  t,
}: SelectionDiffModalProps) {
  return (
    <div className="modal-overlay codex-diff-overlay">
      <div className="modal-card codex-diff-card">
        <h3>{t('editor.diff.title')}</h3>
        <p className="muted">
          {t('editor.diff.action')} <strong>{action}</strong> | {t('editor.diff.mode')}{' '}
          <strong>{mode}</strong>
        </p>
        <div className="codex-diff-grid">
          <div className="codex-diff-column">
            <h4>{t('editor.diff.original')}</h4>
            <pre className="codex-diff-text">
              {chunks.prefix}
              {chunks.removed ? <span className="codex-diff-removed">{chunks.removed}</span> : null}
              {chunks.suffix}
            </pre>
          </div>
          <div className="codex-diff-column">
            <h4>{t('editor.diff.proposed')}</h4>
            <pre className="codex-diff-text">
              {chunks.prefix}
              {chunks.added ? <span className="codex-diff-added">{chunks.added}</span> : null}
              {chunks.suffix}
            </pre>
          </div>
        </div>
        {chunks.identical ? <p className="muted">{t('editor.diff.identical')}</p> : null}
        <div className="row-buttons">
          <button type="button" onClick={onApply} disabled={applying}>
            {t('editor.diff.apply')}
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onDiscard}
            disabled={applying}
          >
            {t('editor.diff.discard')}
          </button>
        </div>
      </div>
    </div>
  );
}
