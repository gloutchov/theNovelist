import { formatWikiCategoryLabel, formatWikiResultTitle } from './wiki-formatters';
import type { WikiSearchResult, WikiStatus } from './wiki-state';

interface MemorySource {
  title: string;
  path: string;
  category: WikiSearchResult['category'];
  snippet: string;
}

interface MemoryWorkspaceProps {
  currentProjectOpen: boolean;
  lastAiMemorySources: MemorySource[];
  memoryStorySummary: string;
  memoryStorySummaryBusy: boolean;
  memoryStorySummaryFallback: string;
  onOpenWikiSearchResult: (result: WikiSearchResult) => void;
  onRefreshWikiStatus: () => void;
  onWikiSearch: () => void;
  onWikiSync: () => void;
  setWikiSearchQuery: (query: string) => void;
  wikiBusy: boolean;
  wikiError: string | null;
  wikiSearchQuery: string;
  wikiSearchResults: WikiSearchResult[];
  wikiStatus: WikiStatus | null;
}

export function MemoryWorkspace({
  currentProjectOpen,
  lastAiMemorySources,
  memoryStorySummary,
  memoryStorySummaryBusy,
  memoryStorySummaryFallback,
  onOpenWikiSearchResult,
  onRefreshWikiStatus,
  onWikiSearch,
  onWikiSync,
  setWikiSearchQuery,
  wikiBusy,
  wikiError,
  wikiSearchQuery,
  wikiSearchResults,
  wikiStatus,
}: MemoryWorkspaceProps) {
  if (!currentProjectOpen) {
    return (
      <section className="panel">
        <p>Apri o crea un progetto nella scheda "Struttura Storia" per usare la memoria.</p>
      </section>
    );
  }

  return (
    <section className="memory-workspace">
      <div className="panel memory-hero">
        <div>
          <p className="eyebrow">Memoria progetto</p>
          <h2>Riassunto storia</h2>
          <p className="muted memory-story-summary">
            {memoryStorySummaryBusy
              ? 'Sintesi AI in corso...'
              : memoryStorySummary || memoryStorySummaryFallback}
          </p>
        </div>
        <div className="memory-status-card">
          <span
            className={
              wikiStatus?.derivedPending ? 'memory-status-dot pending' : 'memory-status-dot'
            }
          />
          <div>
            <strong>{wikiStatus?.derivedPending ? 'Da aggiornare' : 'Aggiornata'}</strong>
            <p>
              {wikiStatus
                ? `${wikiStatus.sourceCount} fonti indicizzate`
                : 'Stato memoria non disponibile'}
            </p>
            <small>
              {wikiStatus?.updatedAt
                ? `Ultimo sync: ${new Date(wikiStatus.updatedAt).toLocaleString()}`
                : 'Nessun sync registrato'}
            </small>
            <div className="memory-status-actions">
              <button type="button" onClick={onWikiSync} disabled={wikiBusy}>
                Aggiorna
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={onRefreshWikiStatus}
                disabled={wikiBusy}
              >
                Rileggi stato
              </button>
            </div>
          </div>
        </div>
      </div>

      {wikiError ? (
        <section className="panel memory-error-panel">
          <h2>Errore memoria</h2>
          <p>{wikiError}</p>
        </section>
      ) : null}

      <section className="panel memory-search-panel">
        <h2>Ricerca</h2>
        <form
          className="memory-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            onWikiSearch();
          }}
        >
          <label>
            Cerca nella wiki locale
            <input
              type="search"
              value={wikiSearchQuery}
              onChange={(event) => setWikiSearchQuery(event.target.value)}
              placeholder="es. magazzino, patto, Tizio..."
              disabled={wikiBusy}
            />
          </label>
          <button type="submit" disabled={wikiBusy || !wikiSearchQuery.trim()}>
            Cerca
          </button>
        </form>
      </section>

      <details className="panel memory-results-panel memory-collapsible-panel" open>
        <summary>Risultati</summary>
        {wikiSearchResults.length > 0 ? (
          <div className="memory-results">
            {wikiSearchResults.map((result, index) => (
              <button
                type="button"
                className="memory-result-card memory-answer-card memory-result-button"
                key={`${result.path}-${index}`}
                onClick={() => onOpenWikiSearchResult(result)}
              >
                <strong>{formatWikiResultTitle(result)}</strong>
                <p>{result.snippet}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">
            Nessun risultato da mostrare. Esegui una ricerca per verificare cosa vede la AI.
          </p>
        )}
      </details>

      <details className="panel memory-results-panel memory-collapsible-panel" open>
        <summary>Fonti ricerca</summary>
        {wikiSearchResults.length > 0 ? (
          <div className="memory-results">
            {wikiSearchResults.map((result) => (
              <article className="memory-result-card" key={`search-source-${result.path}`}>
                <div className="memory-result-header">
                  <strong>{formatWikiResultTitle(result)}</strong>
                  <span>{formatWikiCategoryLabel(result.category)}</span>
                </div>
                <code>{result.path}</code>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">Le fonti della ricerca appariranno dopo una ricerca.</p>
        )}
      </details>

      <details className="panel memory-results-panel memory-collapsible-panel" open>
        <summary>Fonti ultima risposta AI</summary>
        {lastAiMemorySources.length > 0 ? (
          <div className="memory-results">
            {lastAiMemorySources.map((source) => (
              <article className="memory-result-card" key={`last-ai-${source.path}`}>
                <div className="memory-result-header">
                  <strong>{source.title}</strong>
                  <span>{formatWikiCategoryLabel(source.category)}</span>
                </div>
                <code>{source.path}</code>
                <p>{source.snippet}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">
            Nessuna fonte registrata per l'ultima risposta AI in questa sessione.
          </p>
        )}
      </details>
    </section>
  );
}
