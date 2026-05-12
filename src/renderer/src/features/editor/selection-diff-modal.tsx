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
}

export function SelectionDiffModal({
  action,
  applying,
  chunks,
  mode,
  onApply,
  onDiscard,
}: SelectionDiffModalProps) {
  return (
    <div className="modal-overlay codex-diff-overlay">
      <div className="modal-card codex-diff-card">
        <h3>Anteprima modifica AI</h3>
        <p className="muted">
          Azione: <strong>{action}</strong> | Modalita: <strong>{mode}</strong>
        </p>
        <div className="codex-diff-grid">
          <div className="codex-diff-column">
            <h4>Originale</h4>
            <pre className="codex-diff-text">
              {chunks.prefix}
              {chunks.removed ? <span className="codex-diff-removed">{chunks.removed}</span> : null}
              {chunks.suffix}
            </pre>
          </div>
          <div className="codex-diff-column">
            <h4>Proposto</h4>
            <pre className="codex-diff-text">
              {chunks.prefix}
              {chunks.added ? <span className="codex-diff-added">{chunks.added}</span> : null}
              {chunks.suffix}
            </pre>
          </div>
        </div>
        {chunks.identical ? (
          <p className="muted">La proposta coincide con il testo originale.</p>
        ) : null}
        <div className="row-buttons">
          <button type="button" onClick={onApply} disabled={applying}>
            Applica
          </button>
          <button
            type="button"
            className="button-secondary"
            onClick={onDiscard}
            disabled={applying}
          >
            Scarta
          </button>
        </div>
      </div>
    </div>
  );
}
