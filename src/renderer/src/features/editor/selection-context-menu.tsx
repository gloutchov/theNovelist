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
}

export function SelectionContextMenu({
  allowSceneReferenceCreation,
  menu,
  onCreateReference,
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
        Crea personaggio
      </button>
      <button type="button" onClick={() => onCreateReference('location', menu)}>
        Crea location
      </button>
      {allowSceneReferenceCreation ? (
        <button type="button" onClick={() => onCreateReference('scene', menu)}>
          Crea scena
        </button>
      ) : null}
    </div>
  );
}
