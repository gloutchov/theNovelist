import type { Translate } from '../../i18n';

interface ReferencePanelProps<
  TCharacter extends { id: string },
  TLocation extends { id: string; name: string },
  TScene extends { id: string; name: string },
> {
  allowSceneReferenceCreation: boolean;
  canInsert: boolean;
  characters: TCharacter[];
  getCharacterLabel: (card: TCharacter) => string;
  isSceneEditor: boolean;
  locations: TLocation[];
  onInsertCharacter: (card: TCharacter) => void;
  onInsertLocation: (card: TLocation) => void;
  onInsertScene: (card: TScene) => void;
  onRefresh: () => void;
  scenes: TScene[];
  t: Translate;
  title: string;
}

export function ReferencePanel<
  TCharacter extends { id: string },
  TLocation extends { id: string; name: string },
  TScene extends { id: string; name: string },
>({
  allowSceneReferenceCreation,
  canInsert,
  characters,
  getCharacterLabel,
  isSceneEditor,
  locations,
  onInsertCharacter,
  onInsertLocation,
  onInsertScene,
  onRefresh,
  scenes,
  t,
  title,
}: ReferencePanelProps<TCharacter, TLocation, TScene>) {
  return (
    <div
      className={
        isSceneEditor ? 'chapter-reference-panel scene-reference-panel' : 'chapter-reference-panel'
      }
    >
      <h4>{title}</h4>
      <div
        className={
          isSceneEditor
            ? 'chapter-reference-columns scene-reference-columns'
            : 'chapter-reference-columns'
        }
      >
        <div>
          <p className="muted">{t('editor.references.characters')}</p>
          {characters.length === 0 ? (
            <p className="muted">{t('editor.references.emptyCharacters')}</p>
          ) : null}
          <div className="reference-chip-list">
            {characters.map((card) => (
              <button
                key={card.id}
                type="button"
                className="reference-chip"
                onClick={() => onInsertCharacter(card)}
                disabled={!canInsert}
              >
                @{getCharacterLabel(card)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="muted">{t('editor.references.locations')}</p>
          {locations.length === 0 ? (
            <p className="muted">{t('editor.references.emptyLocations')}</p>
          ) : null}
          <div className="reference-chip-list">
            {locations.map((card) => (
              <button
                key={card.id}
                type="button"
                className="reference-chip"
                onClick={() => onInsertLocation(card)}
                disabled={!canInsert}
              >
                @{card.name}
              </button>
            ))}
          </div>
        </div>
        {allowSceneReferenceCreation ? (
          <div>
            <p className="muted">{t('editor.references.scenes')}</p>
            {scenes.length === 0 ? (
              <p className="muted">{t('editor.references.emptyScenes')}</p>
            ) : null}
            <div className="reference-chip-list">
              {scenes.map((card) => (
                <button
                  key={card.id}
                  type="button"
                  className="reference-chip"
                  onClick={() => onInsertScene(card)}
                  disabled={!canInsert}
                >
                  #{card.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
      <div className="row-buttons">
        <button type="button" onClick={onRefresh}>
          {t('editor.references.refresh')}
        </button>
      </div>
    </div>
  );
}
