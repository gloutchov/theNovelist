import { getAiFallbackLabel, getAiProviderLabel, type CodexSettings } from '../ai/ai-settings';
import { formatAutosaveLabel, type AppPreferences } from '../settings/app-preferences';
import { createTranslator, resolveRendererLanguage } from '../../i18n';
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
  const language = resolveRendererLanguage(appPreferences);
  const t = createTranslator(language);

  return (
    <section className="dashboard-workspace">
      <section className="panel dashboard-project-panel">
        <div>
          <h2>{t('dashboard.title')}</h2>
          <p className="muted project-summary">
            {currentProject ? (
              <>
                {t('dashboard.project.openPrefix')} <strong>{currentProject.name}</strong>
              </>
            ) : (
              t('dashboard.project.none')
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
            {t('dashboard.actions.create')}
          </button>
          <button
            type="button"
            className="sidebar-action-button"
            onClick={onOpenProject}
            disabled={!canOpenProject}
          >
            {t('dashboard.actions.open')}
          </button>
          <button
            type="button"
            className="sidebar-action-button"
            onClick={onSaveProject}
            disabled={!canSaveProject || !hasUnsavedChanges}
          >
            {t('dashboard.actions.save')}
          </button>
          <button
            type="button"
            className="export-action-button"
            onClick={onExportEpub}
            disabled={!currentProject || busy}
          >
            {t('dashboard.actions.exportEpub')}
          </button>
          <button
            type="button"
            className="export-action-button"
            onClick={onExportDocx}
            disabled={!currentProject || busy}
          >
            {t('dashboard.actions.exportDocx')}
          </button>
          <button
            type="button"
            className="export-action-button"
            onClick={onPrintManuscript}
            disabled={!currentProject || busy}
          >
            {t('dashboard.actions.print')}
          </button>
          <button
            type="button"
            className="sidebar-action-button"
            onClick={onCloseProject}
            disabled={!canCloseProject}
          >
            {t('dashboard.actions.close')}
          </button>
        </div>
      </section>

      {!currentProject ? (
        <section className="panel dashboard-empty-panel">
          <h2>{t('dashboard.empty.title')}</h2>
          <p className="muted">{t('dashboard.empty.body')}</p>
          <p className={`status status-${statusTone}`}>
            <span>{status}</span>
          </p>
          {error ? <p className="error">{error}</p> : null}
        </section>
      ) : (
        <>
          <section className="dashboard-summary-grid">
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">{t('dashboard.cards.totalWords')}</span>
              <strong>{dashboard.totalWords}</strong>
              <span className="muted">
                {dashboard.chapterMetrics.length} {t('dashboard.cards.chapters').toLowerCase()}
              </span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">{t('dashboard.cards.plots')}</span>
              <strong>{plotsCount}</strong>
              <span className="muted">
                {dashboard.disconnectedChapters.length} {t('dashboard.check.chaptersDisconnected')}
              </span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">{t('dashboard.cards.chapters')}</span>
              <strong>{dashboard.chapterMetrics.length}</strong>
              <span className="muted">
                {dashboard.chaptersWithoutDescription.length} {t('dashboard.check.noDescription')}
              </span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">{t('dashboard.cards.scenes')}</span>
              <strong>{dashboard.sceneCount}</strong>
              <span className="muted">
                {dashboard.scenesWithoutText.length} {t('dashboard.check.noText')}
              </span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">{t('dashboard.cards.characters')}</span>
              <strong>{dashboard.characterCount}</strong>
              <span className="muted">
                {dashboard.unusedCharacters.length} {language === 'en' ? 'unused' : 'non usati'}
              </span>
            </article>
            <article className="panel dashboard-stat-card">
              <span className="dashboard-stat-label">{t('dashboard.cards.locations')}</span>
              <strong>{dashboard.locationCount}</strong>
              <span className="muted">
                {dashboard.unusedLocations.length} {language === 'en' ? 'unused' : 'non usate'}
              </span>
            </article>
          </section>

          {dashboardGoalMetrics ? (
            <section className="panel dashboard-goals-panel">
              <header>
                <div>
                  <h2>{t('dashboard.goals.title')}</h2>
                  <p className="muted">{t('dashboard.goals.subtitle')}</p>
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
                    {dashboard.loading
                      ? t('dashboard.actions.refreshDashboardBusy')
                      : t('dashboard.actions.refreshDashboard')}
                  </button>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={onWikiSync}
                    disabled={!wikiStatus?.derivedPending || wikiBusy || busy}
                  >
                    {wikiBusy
                      ? t('dashboard.actions.refreshMemoryBusy')
                      : t('dashboard.actions.refreshMemory')}
                  </button>
                </div>
              </header>

              <div className="dashboard-goals-grid">
                <article className="dashboard-goal-metric">
                  <span>{t('dashboard.goals.projectTarget')}</span>
                  <strong>{formatInteger(dashboardGoalMetrics.targetWordCount)}</strong>
                  <small>{t('common.words')}</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>{t('dashboard.goals.chapterTarget')}</span>
                  <strong>{formatInteger(dashboardGoalMetrics.targetChapterWordCount)}</strong>
                  <small>{t('common.words')}</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>{t('dashboard.goals.completion')}</span>
                  <strong>{formatDate(dashboardGoalMetrics.plannedCompletionDate)}</strong>
                  <small>{t('dashboard.goals.plannedDate')}</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>{t('dashboard.goals.editorialFolders')}</span>
                  <strong>{formatInteger(dashboardGoalMetrics.editorialFolders)}</strong>
                  <small>{t('dashboard.goals.foldersEstimate')}</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>{t('dashboard.goals.requiredPace')}</span>
                  <strong>{formatInteger(dashboardGoalMetrics.requiredWordsPerDay)}</strong>
                  <small>{t('dashboard.goals.wordsPerDay')}</small>
                </article>
                <article className="dashboard-goal-metric">
                  <span>{t('dashboard.goals.remaining')}</span>
                  <strong>{formatInteger(dashboardGoalMetrics.remainingWords)}</strong>
                  <small>{t('common.words')}</small>
                </article>
              </div>

              <div className="dashboard-chart-grid">
                <article className="dashboard-chart-card">
                  <h3>{t('dashboard.goals.progress')}</h3>
                  <ProgressPie percent={dashboardGoalMetrics.progressPercent} />
                </article>
                <article className="dashboard-chart-card">
                  <h3>{t('dashboard.goals.sessionWords')}</h3>
                  <SessionBars sessions={dashboard.writingSessions} />
                </article>
                <article className="dashboard-chart-card">
                  <h3>{t('dashboard.goals.delivery')}</h3>
                  <DeliveryBars metrics={dashboardGoalMetrics} />
                  <p className="muted">
                    {t('dashboard.goals.estimated', {
                      date: dashboardGoalMetrics.estimatedCompletionDate
                        ? formatDate(dashboardGoalMetrics.estimatedCompletionDate)
                        : '-',
                    })}
                  </p>
                </article>
              </div>
            </section>
          ) : null}

          <section className="dashboard-grid">
            <article className="panel dashboard-section dashboard-section-wide">
              <h2>{t('dashboard.sections.summary')}</h2>
              <dl className="dashboard-detail-list">
                <div>
                  <dt>{t('dashboard.summary.lastChapter')}</dt>
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
                  <dt>{t('dashboard.summary.lastSnapshot')}</dt>
                  <dd>
                    {dashboard.latestSnapshot ? (
                      <>
                        <strong>{dashboard.latestSnapshot.fileName}</strong>
                        <span>{formatDateTime(dashboard.latestSnapshot.createdAt)}</span>
                      </>
                    ) : (
                      t('dashboard.summary.noSnapshot')
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('dashboard.summary.wikiMemory')}</dt>
                  <dd>
                    {wikiStatus ? (
                      <>
                        <strong>
                          {wikiStatus.derivedPending
                            ? t('dashboard.memory.needsUpdate')
                            : t('dashboard.memory.updated')}
                        </strong>
                        <span>{formatDateTime(wikiStatus.updatedAt)}</span>
                      </>
                    ) : (
                      t('common.unavailable')
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{t('dashboard.summary.autosave')}</dt>
                  <dd>{formatAutosaveLabel(appPreferences, language)}</dd>
                </div>
                <div>
                  <dt>{t('dashboard.summary.ai')}</dt>
                  <dd>
                    {aiSettings?.enabled
                      ? t('dashboard.ai.summary', {
                          provider: getAiProviderLabel(aiSettings.provider),
                          fallback: getAiFallbackLabel(aiSettings.fallbackProvider, language),
                        })
                      : t('dashboard.ai.disabled')}
                  </dd>
                </div>
              </dl>
              {dashboard.error ? <p className="error">{dashboard.error}</p> : null}
            </article>

            <article className="panel dashboard-section">
              <h2>{t('dashboard.sections.chapterWords')}</h2>
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
                <p className="muted">{t('dashboard.wordStats.noChapters')}</p>
              )}
            </article>

            <article className="panel dashboard-section">
              <h2>{t('dashboard.sections.chapterChecks')}</h2>
              <ul className="dashboard-check-list">
                <li>
                  <strong>{dashboard.chaptersWithoutDescription.length}</strong>{' '}
                  {t('dashboard.check.noDescription')}
                </li>
                <li>
                  <strong>{dashboard.chaptersWithStaleDescription.length}</strong>{' '}
                  {t('dashboard.check.chaptersPotentiallyStale')}
                </li>
                <li>
                  <strong>{dashboard.chaptersWithoutCharacters.length}</strong>{' '}
                  {t('dashboard.check.noCharacters')}
                </li>
                <li>
                  <strong>{dashboard.chaptersWithoutLocations.length}</strong>{' '}
                  {t('dashboard.check.noLocations')}
                </li>
                <li>
                  <strong>{dashboard.chaptersWithoutScenes.length}</strong>{' '}
                  {t('dashboard.check.noScenes')}
                </li>
                <li>
                  <strong>{dashboard.disconnectedChapters.length}</strong>{' '}
                  {t('dashboard.check.chaptersDisconnected')}
                </li>
              </ul>
            </article>

            <article className="panel dashboard-section">
              <h2>{t('dashboard.sections.sceneWords')}</h2>
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
                <p className="muted">{t('dashboard.wordStats.noScenes')}</p>
              )}
            </article>

            <article className="panel dashboard-section">
              <h2>{t('dashboard.sections.sceneChecks')}</h2>
              <ul className="dashboard-check-list">
                <li>
                  <strong>{dashboard.scenesWithoutText.length}</strong>{' '}
                  {t('dashboard.check.noText')}
                </li>
                <li>
                  <strong>{dashboard.unusedScenes.length}</strong>{' '}
                  {t('dashboard.check.withoutValidChapter')}
                </li>
                <li>
                  <strong>{dashboard.disconnectedScenes.length}</strong>{' '}
                  {t('dashboard.check.scenesDisconnected')}
                </li>
              </ul>
            </article>

            <article className="panel dashboard-section dashboard-section-wide">
              <h2>{t('dashboard.sections.unusedCards')}</h2>
              <div className="dashboard-unused-grid">
                <div>
                  <h3>{t('dashboard.cards.characters')}</h3>
                  {dashboard.unusedCharacters.length > 0 ? (
                    <ul>
                      {dashboard.unusedCharacters.slice(0, 8).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">{t('dashboard.unused.noCharacters')}</p>
                  )}
                </div>
                <div>
                  <h3>{t('dashboard.cards.locations')}</h3>
                  {dashboard.unusedLocations.length > 0 ? (
                    <ul>
                      {dashboard.unusedLocations.slice(0, 8).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">{t('dashboard.unused.noLocations')}</p>
                  )}
                </div>
                <div>
                  <h3>{t('dashboard.cards.scenes')}</h3>
                  {dashboard.unusedScenes.length > 0 ? (
                    <ul>
                      {dashboard.unusedScenes.slice(0, 8).map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                  ) : dashboard.scenesWithoutText.length > 0 ? (
                    <ul>
                      {dashboard.scenesWithoutText.slice(0, 8).map((name) => (
                        <li key={name}>
                          {name} {t('dashboard.check.noText')}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="muted">{t('dashboard.unused.noScenes')}</p>
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
