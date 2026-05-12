type BlockStyle = 'paragraph' | 'heading' | 'blockquote';
type TextAlignment = 'left' | 'center' | 'right' | 'justify';

interface EditorToolbarProps {
  activeFontFamily: string | null;
  activeFontSize: string | null;
  activeStyle: BlockStyle;
  canSearch: boolean;
  isBoldActive: boolean;
  isItalicActive: boolean;
  onBoldToggle: () => void;
  onFontFamilyChange: (value: string) => void;
  onFontSizeChange: (value: string) => void;
  onItalicToggle: () => void;
  onOpenFind: () => void;
  onOpenReplace: () => void;
  onStyleChange: (style: BlockStyle) => void;
  onTextAlignChange: (alignment: TextAlignment) => void;
}

export function EditorToolbar({
  activeFontFamily,
  activeFontSize,
  activeStyle,
  canSearch,
  isBoldActive,
  isItalicActive,
  onBoldToggle,
  onFontFamilyChange,
  onFontSizeChange,
  onItalicToggle,
  onOpenFind,
  onOpenReplace,
  onStyleChange,
  onTextAlignChange,
}: EditorToolbarProps) {
  return (
    <section className="editor-toolbar">
      <select
        className="toolbar-select toolbar-select-style"
        value={activeStyle}
        onChange={(event) => onStyleChange(event.target.value as BlockStyle)}
      >
        <option value="paragraph">Testo normale</option>
        <option value="heading">Sottotitolo</option>
        <option value="blockquote">Citazione</option>
      </select>

      <button type="button" onClick={onBoldToggle} className={isBoldActive ? 'is-active' : ''}>
        Grassetto
      </button>
      <button type="button" onClick={onItalicToggle} className={isItalicActive ? 'is-active' : ''}>
        Corsivo
      </button>

      <select
        className="toolbar-select toolbar-select-font"
        value={activeFontFamily ?? ''}
        onChange={(event) => onFontFamilyChange(event.target.value)}
      >
        <option value="">Font default</option>
        <option value="Georgia">Georgia</option>
        <option value="Times New Roman">Times New Roman</option>
        <option value="Arial">Arial</option>
        <option value="Verdana">Verdana</option>
      </select>

      <select
        className="toolbar-select toolbar-select-size"
        value={activeFontSize ?? ''}
        onChange={(event) => onFontSizeChange(event.target.value)}
      >
        <option value="">Dimensione</option>
        <option value="12">12</option>
        <option value="14">14</option>
        <option value="16">16</option>
        <option value="18">18</option>
        <option value="22">22</option>
      </select>

      <button type="button" onClick={() => onTextAlignChange('left')}>
        Sinistra
      </button>
      <button type="button" onClick={() => onTextAlignChange('center')}>
        Centro
      </button>
      <button type="button" onClick={() => onTextAlignChange('right')}>
        Destra
      </button>
      <button type="button" onClick={() => onTextAlignChange('justify')}>
        Giustifica
      </button>
      <button type="button" onClick={onOpenFind} disabled={!canSearch}>
        Trova
      </button>
      <button type="button" onClick={onOpenReplace} disabled={!canSearch}>
        Sostituisci
      </button>
    </section>
  );
}
