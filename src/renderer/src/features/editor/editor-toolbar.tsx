import type { Translate } from '../../i18n';

type BlockStyle = 'paragraph' | 'heading' | 'blockquote';
type TextAlignment = 'left' | 'center' | 'right' | 'justify';

interface EditorToolbarProps {
  activeFontFamily: string | null;
  activeFontSize: string | null;
  activeStyle: BlockStyle;
  canRedo: boolean;
  canSearch: boolean;
  canUndo: boolean;
  isBoldActive: boolean;
  isItalicActive: boolean;
  onBoldToggle: () => void;
  onFontFamilyChange: (value: string) => void;
  onFontSizeChange: (value: string) => void;
  onItalicToggle: () => void;
  onOpenFind: () => void;
  onOpenReplace: () => void;
  onRedo: () => void;
  onStyleChange: (style: BlockStyle) => void;
  onTextAlignChange: (alignment: TextAlignment) => void;
  onUndo: () => void;
  t: Translate;
}

export function EditorToolbar({
  activeFontFamily,
  activeFontSize,
  activeStyle,
  canRedo,
  canSearch,
  canUndo,
  isBoldActive,
  isItalicActive,
  onBoldToggle,
  onFontFamilyChange,
  onFontSizeChange,
  onItalicToggle,
  onOpenFind,
  onOpenReplace,
  onRedo,
  onStyleChange,
  onTextAlignChange,
  onUndo,
  t,
}: EditorToolbarProps) {
  return (
    <section className="editor-toolbar">
      <button type="button" onClick={onUndo} disabled={!canUndo}>
        {t('editor.toolbar.undo')}
      </button>
      <button type="button" onClick={onRedo} disabled={!canRedo}>
        {t('editor.toolbar.redo')}
      </button>
      <span className="toolbar-divider" aria-hidden="true" />

      <select
        className="toolbar-select toolbar-select-style"
        value={activeStyle}
        onChange={(event) => onStyleChange(event.target.value as BlockStyle)}
      >
        <option value="paragraph">{t('editor.toolbar.normalText')}</option>
        <option value="heading">{t('editor.toolbar.heading')}</option>
        <option value="blockquote">{t('editor.toolbar.blockquote')}</option>
      </select>

      <button type="button" onClick={onBoldToggle} className={isBoldActive ? 'is-active' : ''}>
        {t('editor.toolbar.bold')}
      </button>
      <button type="button" onClick={onItalicToggle} className={isItalicActive ? 'is-active' : ''}>
        {t('editor.toolbar.italic')}
      </button>

      <select
        className="toolbar-select toolbar-select-font"
        value={activeFontFamily ?? ''}
        onChange={(event) => onFontFamilyChange(event.target.value)}
      >
        <option value="">{t('editor.toolbar.defaultFont')}</option>
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
        <option value="">{t('editor.toolbar.fontSize')}</option>
        <option value="12">12</option>
        <option value="14">14</option>
        <option value="16">16</option>
        <option value="18">18</option>
        <option value="22">22</option>
      </select>
      <span className="toolbar-divider" aria-hidden="true" />

      <button type="button" onClick={() => onTextAlignChange('left')}>
        {t('editor.toolbar.alignLeft')}
      </button>
      <button type="button" onClick={() => onTextAlignChange('center')}>
        {t('editor.toolbar.alignCenter')}
      </button>
      <button type="button" onClick={() => onTextAlignChange('right')}>
        {t('editor.toolbar.alignRight')}
      </button>
      <button type="button" onClick={() => onTextAlignChange('justify')}>
        {t('editor.toolbar.alignJustify')}
      </button>
      <span className="toolbar-divider" aria-hidden="true" />
      <button type="button" onClick={onOpenFind} disabled={!canSearch}>
        {t('editor.toolbar.find')}
      </button>
      <button type="button" onClick={onOpenReplace} disabled={!canSearch}>
        {t('editor.toolbar.replace')}
      </button>
    </section>
  );
}
