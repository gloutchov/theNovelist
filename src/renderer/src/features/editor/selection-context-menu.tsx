import type { Translate } from '../../i18n';

type ReferenceType = 'character' | 'location' | 'scene';

interface TextSelectionSnapshot {
  text: string;
  range: {
    from: number;
    to: number;
  };
}

interface SelectionContextMenuState extends TextSelectionSnapshot {
  left: number;
  top: number;
}

interface SelectionContextMenuProps {
  allowSceneReferenceCreation: boolean;
  menu: SelectionContextMenuState;
  onCreateReference: (type: ReferenceType, selection: TextSelectionSnapshot) => void;
  t: Translate;
}

export function SelectionContextMenu({
  allowSceneReferenceCreation,
  menu,
  onCreateReference,
  t,
}: SelectionContextMenuProps) {
  return (
    <div
      className="selection-context-menu"
      style={{
        left: `${menu.left}px`,
        top: `${menu.top}px`,
      }}
    >
      <button type="button" onClick={() => onCreateReference('character', menu)}>
        {t('editor.selection.createCharacter')}
      </button>
      <button type="button" onClick={() => onCreateReference('location', menu)}>
        {t('editor.selection.createLocation')}
      </button>
      {allowSceneReferenceCreation ? (
        <button type="button" onClick={() => onCreateReference('scene', menu)}>
          {t('editor.selection.createScene')}
        </button>
      ) : null}
    </div>
  );
}
