import { getAiFallbackLabel, getAiProviderLabel, type CodexSettings } from '../ai/ai-settings';
import { formatAutosaveLabel, type AppPreferences } from '../settings/app-preferences';
import { formatDate, formatDateTime, formatInteger } from '../../shared/formatters';
import {
  DeliveryBars,
  ProgressPie,
  SessionBars,
  type DashboardGoalMetrics,
  type DashboardState,
  type ProjectRecord,
} from './dashboard-state';
import type { WikiStatus } from '../memory/wiki-state';

interface DashboardWorkspaceProps {
  aiSettings: CodexSettings | null;
  appPreferences: AppPreferences | null;
  busy: boolean;
  canCloseProject: boolean;
  canOpenProject: boolean;
  canSaveProject: boolean;
  currentProject: ProjectRecord;
  dashboard: DashboardState;
  dashboardGoalMetrics: DashboardGoalMetrics | null;
  error: string | null;
  hasUnsavedChanges: boolean;
  onCloseProject: () => void;
  onCreateProject: () => void;
  onExportDocx: () => void;
  onExportEpub: () => void;
  onOpenProject: () => void;
  onOpenProjectTargets: () => void;
  onPrintManuscript: () => void;
  onRefreshDashboard: () => void;
  onSaveProject: () => void;
  onWikiSync: () => void;
  plotsCount: number;
  status: string;
  statusTone: string;
  wikiBusy: boolean;
  wikiStatus: WikiStatus | null;
  workspaceNotice: string | null;
}

export function DashboardWorkspace({
  aiSettings,
  appPreferences,
  busy,
  canCloseProject,
  canOpenProject,
  canSaveProject,
  currentProject,
  dashboard,
  dashboardGoalMetrics,
  error,
  hasUnsavedChanges,
  onCloseProject,
  onCreateProject,
  onExportDocx,
  onExportEpub,
  onOpenProject,
  onOpenProjectTargets,
  onPrintManuscript,
  onRefreshDashboard,
  onSaveProject,
  onWikiSync,
  plotsCount,
  status,
  statusTone,
  wikiBusy,
  wikiStatus,
  workspaceNotice,
}: DashboardWorkspaceProps) {
  return (
    <section className="dashboard-workspace">
      <section className="panel dashboard-project-panel">
        <div>
          <h2>Cruscotto</h2>
          <p className="muted project-summary">
            {currentProject ? (
              <>
                Progetto aperto: <strong>{currentProject.name}</strong>
              </>
            ) : (
              'Nessun progetto aperto.'
            )}
          </p>
        </div>
        <div className="dashboard-project-actions">
          <button
            type="button"
            className="sidebar-action-button"
            onClick={onCreateProject}
            disabled={Boolean(currentProject) || busy}
          >
            Crea
          </button>
          <button
            type="button"
            className="sidebar-action-button"
            onClick={onOpenProject}
            disabled={!canOpenProject}
          >
            Apri
          </button>
          <button
            type="button"
            className="sidebar-action-button"
            onClick={onSaveProject}
            disabled={!canSaveProject || !hasUnsavedChanges}
          >
            Salva
          </button>
          <button
            type="button"
            className="export-action-button"
            onClick={onExportEpub}
            disabled={!currentProject || busy}
          >
            Esporta ePUB
          </button>
          <button
            type="button"
            className="export-action-button"
            onClick={onExportDocx}
            disabled={!currentProject || busy}
          >
            Esporta DOCX
          </button>
          <button
            type="button"
            className="export-action-button"
            onClick={onPrintManuscript}
            disabled={!currentProject || busy}
          >
            Stampa
          </button>
          <button
            type="button"
            className="sidebar-action-button"
            onClick={onCloseProject}
            disabled={!canCloseProject}
          >
            Chiudi
          </button>
        </div>
      </section>

      {!currentProject ? (
        <section className="panel dashboard-empty-panel">
          <h2>Nessun progetto aperto</h2>
          <p className="muted">
            Crea un nuovo progetto o aprine uno esistente per vedere stato manoscritto, capitoli,
            schede, memoria, snapshot e impostazioni.
          </p>
          <p className={`status status-${statusTone}`}>
            <span>{status}</span>
          </p>
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : (
        <>
          <section className="dashboard-summary-grid">
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">Parole totali</span>
              <strong>{dashboard.totalWords}</strong>
              <span className="muted">{dashboard.chapterMetrics.length} capitoli</span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">Trame</span>
              <strong>{plotsCount}</strong>
              <span className="muted">
                {dashboard.disconnectedChapters.length} capitoli non collegati
              </span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">Capitoli</span>
              <strong>{dashboard.chapterMetrics.length}</strong>
              <span className="muted">
                {dashboard.chaptersWithoutDescription.length} senza descrizione
              </span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">Scene</span>
              <strong>{dashboard.sceneCount}</strong>
              <span className="muted">{dashboard.scenesWithoutText.length} senza testo</span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">Personaggi</span>
              <strong>{dashboard.characterCount}</strong>
              <span className="muted">{dashboard.unusedCharacters.length} non usati</span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">Location</span>
              <strong>{dashboard.locationCount}</strong>
              <span className="muted">{dashboard.unusedLocations.length} non usate</span>
            </article>
          </section>

          {dashboardGoalMetrics ? (
            <section className="panel dashboard-goals-panel">
              <header>
                <div>
                  <h2>Obiettivi</h2>
                  <p className="muted">
                    Target e proiezioni calcolati sui salvataggi del manoscritto.
                  </p>
                </div>
                <div className="dashboard-goals-actions">
                  <button
                    type="button"
                    className={`dashboard-delivery-status ${dashboardGoalMetrics.deliveryTone}`}
                    onClick={onOpenProjectTargets}
                    disabled={!currentProject || busy}
                  >
                    {dashboardGoalMetrics.deliveryStatus}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={onRefreshDashboard}
                    disabled={dashboard.loading || busy}
                  >
                    {dashboard.loading ? 'Aggiorno...' : 'Aggiorna Cruscotto'}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={onWikiSync}
                    disabled={!wikiStatus?.derivedPending || wikiBusy || busy}
                  >
                    {wikiBusy ? 'Aggiorno Memoria...' : 'Aggiorna Memoria'}
                  </button>
                </div>
              </header>

              <div className="dashboard-goals-grid">
                <article className="dashboard-goal-metric">
                  <span>Target progetto</span>
                  <strong>{formatInteger(dashboardGoalMetrics.targetWordCount)}</strong>
                  <small>parole</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>Target capitolo</span>
                  <strong>{formatInteger(dashboardGoalMetrics.targetChapterWordCount)}</strong>
                  <small>parole</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>Completamento</span>
                  <strong>{formatDate(dashboardGoalMetrics.plannedCompletionDate)}</strong>
                  <small>data prevista</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>Cartelle editoriali</span>
                  <strong>{formatInteger(dashboardGoalMetrics.editorialFolders)}</strong>
                  <small>stima 1.800 battute</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>Ritmo richiesto</span>
                  <strong>{formatInteger(dashboardGoalMetrics.requiredWordsPerDay)}</strong>
                  <small>parole/giorno</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>Restanti</span>
                  <strong>{formatInteger(dashboardGoalMetrics.remainingWords)}</strong>
                  <small>parole</small>
                </article>
              </div>

              <div className="dashboard-chart-grid">
                <article className="dashboard-chart-card">
                  <h3>Avanzamento</h3>
                  <ProgressPie percent={dashboardGoalMetrics.progressPercent} />
                </article>
                <article className="dashboard-chart-card">
                  <h3>Parole per sessione</h3>
                  <SessionBars sessions={dashboard.writingSessions} />
                </article>
                <article className="dashboard-chart-card">
                  <h3>Consegna</h3>
                  <DeliveryBars metrics={dashboardGoalMetrics} />
                  <p className="muted">
                    Stima:{' '}
                    {dashboardGoalMetrics.estimatedCompletionDate
                      ? formatDate(dashboardGoalMetrics.estimatedCompletionDate)
                      : '-'}
                  </p>
                </article>
              </div>
            </section>
          ) : null}

          <section className="dashboard-grid">
            <article className="panel dashboard-section dashboard-section-wide">
              <h2>Riepilogo</h2>
              <dl className="dashboard-detail-list">
                <div>
                  <dt>Ultimo capitolo modificato</dt>
                  <dd>
                    {dashboard.lastModifiedChapter ? (
                      <>
                        <strong>{dashboard.lastModifiedChapter.title}</strong>
                        <span>{formatDateTime(dashboard.lastModifiedChapter.updatedAt)}</span>
                      </>
                    ) : (
                      '-'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Ultimo snapshot</dt>
                  <dd>
                    {dashboard.latestSnapshot ? (
                      <>
                        <strong>{dashboard.latestSnapshot.fileName}</strong>
                        <span>{formatDateTime(dashboard.latestSnapshot.createdAt)}</span>
                      </>
                    ) : (
                      'Nessuno snapshot'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Memoria Wiki</dt>
                  <dd>
                    {wikiStatus ? (
                      <>
                        <strong>
                          {wikiStatus.derivedPending ? 'Da aggiornare' : 'Aggiornata'}
                        </strong>
                        <span>{formatDateTime(wikiStatus.updatedAt)}</span>
                      </>
                    ) : (
                      'Non disponibile'
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Autosave</dt>
                  <dd>{formatAutosaveLabel(appPreferences)}</dd>
                </div>
                <div>
                  <dt>AI</dt>
                  <dd>
                    {aiSettings?.enabled
                      ? `${getAiProviderLabel(aiSettings.provider)} con fallback ${getAiFallbackLabel(
                          aiSettings.fallbackProvider,
                        )}`
                      : 'Disattivata'}
                  </dd>
                </div>
              </dl>
              {dashboard.error ? <p className="error">{dashboard.error}</p> : null}
            </article>

            <article className="panel dashboard-section">
              <h2>Parole per Capitolo</h2>
              {dashboard.chapterMetrics.length > 0 ? (
                <div className="dashboard-chapter-list">
                  {dashboard.chapterMetrics.map((chapter) => (
                    <div className="dashboard-chapter-row" key={chapter.id}>
                      <span>
                        {chapter.plotNumber}.{chapter.blockNumber} {chapter.title}
                      </span>
                      <strong>{chapter.wordCount}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Nessun capitolo creato.</p>
              )}
            </article>

            <article className="panel dashboard-section">
              <h2>Capitoli da controllare</h2>
              <ul className="dashboard-check-list">
                <li>
                  <strong>{dashboard.chaptersWithoutDescription.length}</strong> senza descrizione
                </li>
                <li>
                  <strong>{dashboard.chaptersWithStaleDescription.length}</strong> con descrizione
                  potenzialmente vecchia
                </li>
                <li>
                  <strong>{dashboard.chaptersWithoutCharacters.length}</strong> senza personaggi
                  collegati
                </li>
                <li>
                  <strong>{dashboard.chaptersWithoutLocations.length}</strong> senza location
                  collegate
                </li>
                <li>
                  <strong>{dashboard.chaptersWithoutScenes.length}</strong> senza scene collegate
                </li>
                <li>
                  <strong>{dashboard.disconnectedChapters.length}</strong> non collegati nel canvas
                </li>
              </ul>
            </article>

            <article className="panel dashboard-section">
              <h2>Parole per Scena</h2>
              {dashboard.sceneMetrics.length > 0 ? (
                <div className="dashboard-chapter-list">
                  {dashboard.sceneMetrics.map((scene) => (
                    <div className="dashboard-chapter-row" key={scene.id}>
                      <span>
                        {scene.plotNumber} · {scene.name}
                        <small>{scene.chapterTitle}</small>
                      </span>
                      <strong>{scene.wordCount}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="muted">Nessuna scena creata.</p>
              )}
            </article>

            <article className="panel dashboard-section">
              <h2>Scene da controllare</h2>
              <ul className="dashboard-check-list">
                <li>
                  <strong>{dashboard.scenesWithoutText.length}</strong> senza testo
                </li>
                <li>
                  <strong>{dashboard.unusedScenes.length}</strong> senza capitolo valido
                </li>
                <li>
                  <strong>{dashboard.disconnectedScenes.length}</strong> non collegate nel canvas
                </li>
              </ul>
            </article>

            <article className="panel dashboard-section dashboard-section-wide">
              <h2>Schede non usate</h2>
              <div className="dashboard-unused-grid">
                <div>
                  <h3>Personaggi</h3>
                  {dashboard.unusedCharacters.length > 0 ? (
                    <ul>
                      {dashboard.unusedCharacters.slice(0, 8).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nessuna scheda personaggio isolata.</p>
                  )}
                </div>
                <div>
                  <h3>Location</h3>
                  {dashboard.unusedLocations.length > 0 ? (
                    <ul>
                      {dashboard.unusedLocations.slice(0, 8).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nessuna scheda location isolata.</p>
                  )}
                </div>
                <div>
                  <h3>Scene</h3>
                  {dashboard.unusedScenes.length > 0 ? (
                    <ul>
                      {dashboard.unusedScenes.slice(0, 8).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : dashboard.scenesWithoutText.length > 0 ? (
                    <ul>
                      {dashboard.scenesWithoutText.slice(0, 8).map((name) => (
                        <li key={name}>{name} senza testo</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">Nessuna scheda scena isolata.</p>
                  )}
                </div>
              </div>
            </article>
          </section>

          <section className="panel status-panel">
            <p className={`status status-${statusTone}`}>
              <span>{status}</span>
              {workspaceNotice ? (
                <span className="status-inline-notice">{workspaceNotice}</span>
              ) : null}
            </p>
            {error ? <p className="error">{error}</p> : null}
          </section>
        </>
      )}
    </section>
  );
}
