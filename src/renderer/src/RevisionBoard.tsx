import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Translate } from './i18n';
import { getStatusTone } from './status-tone';

type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type CharacterCard = Awaited<ReturnType<(typeof window.novelistApi)['listCharacterCards']>>[number];
type LocationCard = Awaited<ReturnType<(typeof window.novelistApi)['listLocationCards']>>[number];
type SceneCard = Awaited<ReturnType<(typeof window.novelistApi)['listSceneCards']>>[number];
type RevisionCurrent = Awaited<ReturnType<(typeof window.novelistApi)['getRevisionCurrent']>>;
type RevisionRecord = Awaited<ReturnType<(typeof window.novelistApi)['listRevisions']>>[number];
type RevisionEntityType = 'chapter' | 'scene' | 'character' | 'location';

interface RevisionEntity {
  id: string;
  type: RevisionEntityType;
  title: string;
  subtitle: string;
}

interface RevisionBoardProps {
  currentProject: NonNullable<ProjectRecord>;
  statusMessage: string;
  workspaceNotice?: string | null;
  onStatus: (message: string) => void;
  t: Translate;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function characterName(card: CharacterCard, t: Translate): string {
  return `${card.firstName} ${card.lastName}`.trim() || t('common.unavailable');
}

function reasonLabel(reason: RevisionRecord['reason'], t: Translate): string {
  if (reason === 'manual') {
    return t('revision.reasonManual');
  }
  if (reason === 'restore') {
    return t('revision.reasonRestore');
  }
  return t('revision.reasonAutomatic');
}

function buildEntityGroups(input: {
  storyState: StoryState;
  characters: CharacterCard[];
  locations: LocationCard[];
  scenes: SceneCard[];
  t: Translate;
}): Array<{ title: string; entities: RevisionEntity[] }> {
  const chaptersById = new Map(input.storyState.nodes.map((chapter) => [chapter.id, chapter]));

  return [
    {
      title: input.t('shell.tabs.chapters'),
      entities: input.storyState.nodes.map((chapter) => ({
        id: chapter.id,
        type: 'chapter',
        title: chapter.title,
        subtitle: `${input.t('common.plot')} ${chapter.plotNumber} · ${input.t(
          'timeline.itemChapter',
        )} ${chapter.blockNumber}`,
      })),
    },
    {
      title: input.t('shell.tabs.scenes'),
      entities: input.scenes.map((scene) => ({
        id: scene.id,
        type: 'scene',
        title: `#${scene.name}`,
        subtitle:
          chaptersById.get(scene.chapterNodeId)?.title ??
          `${input.t('common.plot')} ${scene.plotNumber}`,
      })),
    },
    {
      title: input.t('shell.tabs.characters'),
      entities: input.characters.map((card) => ({
        id: card.id,
        type: 'character',
        title: characterName(card, input.t),
        subtitle: card.job || `${input.t('common.plot')} ${card.plotNumber}`,
      })),
    },
    {
      title: input.t('shell.tabs.locations'),
      entities: input.locations.map((card) => ({
        id: card.id,
        type: 'location',
        title: card.name,
        subtitle: card.locationType || `${input.t('common.plot')} ${card.plotNumber}`,
      })),
    },
  ];
}

export default function RevisionBoard({
  currentProject,
  statusMessage,
  workspaceNotice,
  onStatus,
  t,
}: RevisionBoardProps) {
  const [entityGroups, setEntityGroups] = useState<
    Array<{ title: string; entities: RevisionEntity[] }>
  >([]);
  const [selectedEntity, setSelectedEntity] = useState<RevisionEntity | null>(null);
  const [currentVersion, setCurrentVersion] = useState<RevisionCurrent | null>(null);
  const [revisions, setRevisions] = useState<RevisionRecord[]>([]);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [restoring, setRestoring] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const statusTone = getStatusTone(statusMessage);

  const selectedRevision = useMemo(
    () => revisions.find((revision) => revision.id === selectedRevisionId) ?? null,
    [revisions, selectedRevisionId],
  );

  const loadEntities = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const [storyState, characters, locations, scenes] = await Promise.all([
        window.novelistApi.getStoryState(),
        window.novelistApi.listCharacterCards(),
        window.novelistApi.listLocationCards(),
        window.novelistApi.listSceneCards(),
      ]);
      const groups = buildEntityGroups({ storyState, characters, locations, scenes, t });
      setEntityGroups(groups);
      setSelectedEntity(groups.find((group) => group.entities.length > 0)?.entities[0] ?? null);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      onStatus('Errore caricamento revisioni');
    } finally {
      setLoading(false);
    }
  }, [onStatus, t]);

  const loadSelectedEntity = useCallback(
    async (entity: RevisionEntity | null): Promise<void> => {
      if (!entity) {
        setCurrentVersion(null);
        setRevisions([]);
        setSelectedRevisionId('');
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const [current, history] = await Promise.all([
          window.novelistApi.getRevisionCurrent({
            entityType: entity.type,
            entityId: entity.id,
          }),
          window.novelistApi.listRevisions({
            entityType: entity.type,
            entityId: entity.id,
          }),
        ]);
        setCurrentVersion(current);
        setRevisions(history);
        setSelectedRevisionId(history[0]?.id ?? '');
        onStatus(`Revisioni caricate: ${entity.title}`);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
        setError(message);
        onStatus('Errore caricamento revisioni');
      } finally {
        setLoading(false);
      }
    },
    [onStatus, t],
  );

  async function restoreSelectedRevision(): Promise<void> {
    if (!selectedRevision || restoring) {
      return;
    }

    const confirmed = window.confirm(
      t('revision.confirmRestore'),
    );
    if (!confirmed) {
      return;
    }

    setRestoring(true);
    setError(null);
    try {
      const restored = await window.novelistApi.restoreRevision({
        revisionId: selectedRevision.id,
      });
      setCurrentVersion(restored);
      await loadEntities();
      await loadSelectedEntity({
        id: restored.entityId,
        type: restored.entityType,
        title: restored.title,
        subtitle: restored.subtitle,
      });
      onStatus(`Versione ripristinata: ${restored.title}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      onStatus('Errore ripristino versione');
    } finally {
      setRestoring(false);
    }
  }

  useEffect(() => {
    void loadEntities();
  }, [currentProject.rootPath, loadEntities]);

  useEffect(() => {
    void loadSelectedEntity(selectedEntity);
  }, [loadSelectedEntity, selectedEntity]);

  return (
    <section className="revision-workspace">
      <aside className="sidebar revision-sidebar">
        <div className="sidebar-action-group">
          <button
            type="button"
            className="sidebar-action-button"
            onClick={() => void loadEntities()}
          >
            {t('revision.actions.refresh')}
          </button>
        </div>

        <div className="panel revision-entity-panel">
          <h2>{t('revision.entities')}</h2>
          {entityGroups.map((group) => (
            <div className="revision-entity-group" key={group.title}>
              <h3>{group.title}</h3>
              {group.entities.length > 0 ? (
                <div className="revision-entity-list">
                  {group.entities.map((entity) => (
                    <button
                      type="button"
                      key={`${entity.type}:${entity.id}`}
                      className={
                        selectedEntity?.id === entity.id && selectedEntity.type === entity.type
                          ? 'revision-entity-active'
                          : ''
                      }
                      onClick={() => setSelectedEntity(entity)}
                    >
                      <strong>{entity.title}</strong>
                      <span>{entity.subtitle}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="muted">{t('revision.emptyEntity')}</p>
              )}
            </div>
          ))}
        </div>
      </aside>

      <section className="revision-main">
        <div className="revision-compare-grid">
          <article className="panel revision-pane">
            <header>
              <div>
                <p className="eyebrow">{t('revision.current')}</p>
                <h2>{currentVersion?.title ?? t('revision.noSelection')}</h2>
                <p className="muted">
                  {currentVersion
                    ? `${currentVersion.subtitle} · ${formatDateTime(currentVersion.updatedAt)}`
                    : '-'}
                </p>
              </div>
            </header>
            <pre>{currentVersion?.textContent || t('revision.selectEntity')}</pre>
          </article>

          <article className="panel revision-pane">
            <header>
              <div>
                <p className="eyebrow">{t('revision.oldVersions')}</p>
                <h2>
                  {selectedRevision
                    ? (selectedRevision.label ?? reasonLabel(selectedRevision.reason, t))
                    : '-'}
                </h2>
                <p className="muted">
                  {selectedRevision
                    ? `${reasonLabel(selectedRevision.reason, t)} · ${formatDateTime(
                        selectedRevision.createdAt,
                      )}`
                    : t('revision.noRevision')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void restoreSelectedRevision()}
                disabled={!selectedRevision || restoring}
              >
                {t('common.restore')}
              </button>
            </header>

            {revisions.length > 0 ? (
              <select
                value={selectedRevisionId}
                onChange={(event) => setSelectedRevisionId(event.target.value)}
              >
                {revisions.map((revision) => (
                  <option key={revision.id} value={revision.id}>
                    {formatDateTime(revision.createdAt)} ·{' '}
                    {revision.label ?? reasonLabel(revision.reason, t)}
                  </option>
                ))}
              </select>
            ) : null}
            <pre>{selectedRevision?.textContent ?? t('revision.emptyPrevious')}</pre>
          </article>
        </div>

        <section className="panel status-panel">
          <p className={`status status-${statusTone}`}>
            <span>{loading ? t('revision.loading') : statusMessage}</span>
            {workspaceNotice ? (
              <span className="status-inline-notice">{workspaceNotice}</span>
            ) : null}
          </p>
          {error ? <p className="error">{error}</p> : null}
        </section>
      </section>
    </section>
  );
}
