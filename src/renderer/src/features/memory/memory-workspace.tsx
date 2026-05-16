import { formatWikiCategoryLabel, formatWikiResultTitle } from './wiki-formatters';
import type { WikiSearchResult, WikiStatus } from './wiki-state';
import type { Translate } from '../../i18n';

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
  t: Translate;
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
  t,
}: MemoryWorkspaceProps) {
  if (!currentProjectOpen) {
    return (
      <section className="panel">
        <p>{t('memory.emptyProject')}</p>
      </section>
    );
  }

  return (
    <section className="memory-workspace">
      <div className="panel memory-hero">
        <div>
          <p className="eyebrow">{t('memory.title')}</p>
          <h2>{t('memory.storySummary.title')}</h2>
          <p className="muted memory-story-summary">
            {memoryStorySummaryBusy
              ? t('memory.storySummary.busy')
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
            <strong>
              {wikiStatus?.derivedPending ? t('memory.status.pending') : t('memory.status.updated')}
            </strong>
            <p>
              {wikiStatus
                ? t('memory.status.indexedSources', { count: wikiStatus.sourceCount })
                : t('memory.status.notAvailable')}
            </p>
            <small>
              {wikiStatus?.updatedAt
                ? t('memory.lastSync', { date: new Date(wikiStatus.updatedAt).toLocaleString() })
                : t('memory.noSync')}
            </small>
            <div className="memory-status-actions">
              <button type="button" onClick={onWikiSync} disabled={wikiBusy}>
                {t('common.refresh')}
              </button>
              <button
                type="button"
                className="button-secondary"
                onClick={onRefreshWikiStatus}
                disabled={wikiBusy}
              >
                {t('memory.status.refresh')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {wikiError ? (
        <section className="panel memory-error-panel">
          <h2>{t('memory.errorTitle')}</h2>
          <p>{wikiError}</p>
        </section>
      ) : null}

      <section className="panel memory-search-panel">
        <h2>{t('memory.search.title')}</h2>
        <form
          className="memory-search-form"
          onSubmit={(event) => {
            event.preventDefault();
            onWikiSearch();
          }}
        >
          <label>
            {t('memory.search.label')}
            <input
              type="search"
              value={wikiSearchQuery}
              onChange={(event) => setWikiSearchQuery(event.target.value)}
              placeholder={t('memory.search.placeholder')}
              disabled={wikiBusy}
            />
          </label>
          <button type="submit" disabled={wikiBusy || !wikiSearchQuery.trim()}>
            {t('memory.search.button')}
          </button>
        </form>
      </section>

      <details className="panel memory-results-panel memory-collapsible-panel" open>
        <summary>{t('memory.results.title')}</summary>
        {wikiSearchResults.length > 0 ? (
          <div className="memory-results">
            {wikiSearchResults.map((result, index) => (
              <button
                type="button"
                className="memory-result-card memory-answer-card memory-result-button"
                key={`${result.path}-${index}`}
                onClick={() => onOpenWikiSearchResult(result)}
              >
                <strong>{formatWikiResultTitle(result, t)}</strong>
                <p>{result.snippet}</p>
              </button>
            ))}
          </div>
        ) : (
          <p className="muted">{t('memory.results.empty')}</p>
        )}
      </details>

      <details className="panel memory-results-panel memory-collapsible-panel" open>
        <summary>{t('memory.resultSources.title')}</summary>
        {wikiSearchResults.length > 0 ? (
          <div className="memory-results">
            {wikiSearchResults.map((result) => (
              <article className="memory-result-card" key={`search-source-${result.path}`}>
                <div className="memory-result-header">
                  <strong>{formatWikiResultTitle(result, t)}</strong>
                  <span>{formatWikiCategoryLabel(result.category, t)}</span>
                </div>
                <code>{result.path}</code>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">{t('memory.resultSources.empty')}</p>
        )}
      </details>

      <details className="panel memory-results-panel memory-collapsible-panel" open>
        <summary>{t('memory.aiSources.title')}</summary>
        {lastAiMemorySources.length > 0 ? (
          <div className="memory-results">
            {lastAiMemorySources.map((source) => (
              <article className="memory-result-card" key={`last-ai-${source.path}`}>
                <div className="memory-result-header">
                  <strong>{source.title}</strong>
                  <span>{formatWikiCategoryLabel(source.category, t)}</span>
                </div>
                <code>{source.path}</code>
                <p>{source.snippet}</p>
              </article>
            ))}
          </div>
        ) : (
          <p className="muted">{t('memory.aiSources.empty')}</p>
        )}
      </details>
    </section>
  );
}
