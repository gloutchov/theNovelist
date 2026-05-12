type ReferenceType = 'character' | 'location' | 'scene';

interface MentionMenuItem {
  id: string;
  type: ReferenceType;
  label: string;
  trigger: '@' | '#';
}

interface MentionMenuState<TItem extends MentionMenuItem> {
  from: number;
  to: number;
  left: number;
  top: number;
  items: TItem[];
  selectedIndex: number;
}

interface MentionMenuProps<TItem extends MentionMenuItem> {
  menu: MentionMenuState<TItem>;
  onSelect: (item: TItem, range: { from: number; to: number }) => void;
}

function getMentionTypeLabel(type: ReferenceType): string {
  if (type === 'character') {
    return 'Personaggio';
  }

  if (type === 'location') {
    return 'Location';
  }

  return 'Scena';
}

export function MentionMenu<TItem extends MentionMenuItem>({
  menu,
  onSelect,
}: MentionMenuProps<TItem>) {
  return (
    <div
      className="mention-menu"
      style={{
        left: `${menu.left}px`,
        top: `${menu.top}px`,
      }}
    >
      {menu.items.length === 0 ? <p className="muted">Nessun riferimento trovato.</p> : null}
      {menu.items.map((item, index) => (
        <button
          key={item.id}
          type="button"
          className={
            index === menu.selectedIndex ? 'mention-menu-item is-active' : 'mention-menu-item'
          }
          onMouseDown={(event) => {
            event.preventDefault();
            onSelect(item, {
              from: menu.from,
              to: menu.to,
            });
          }}
        >
          <span>{`${item.trigger}${item.label}`}</span>
          <small>{getMentionTypeLabel(item.type)}</small>
        </button>
      ))}
    </div>
  );
}
