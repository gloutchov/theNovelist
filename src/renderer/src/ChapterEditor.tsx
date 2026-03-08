import { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { Extension, textInputRule, wrappingInputRule } from '@tiptap/core';
import BulletList from '@tiptap/extension-bullet-list';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';

type ChapterDocumentRecord = Awaited<ReturnType<(typeof window.novelistApi)['getChapterDocument']>>;
type CodexTransformAction = 'correggi' | 'riscrivi' | 'espandi' | 'riduci';
type CodexStatus = Awaited<ReturnType<(typeof window.novelistApi)['codexStatus']>>;
type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;
type CodexChatHistoryRecord = Awaited<ReturnType<(typeof window.novelistApi)['codexGetChatHistory']>>[number];
type CharacterCard = Awaited<ReturnType<(typeof window.novelistApi)['listChapterCharacters']>>[number];
type LocationCard = Awaited<ReturnType<(typeof window.novelistApi)['listChapterLocations']>>[number];

type BlockStyle = 'paragraph' | 'heading' | 'blockquote';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'cli' | 'api' | 'fallback';
}

interface PendingSelectionDiff {
  action: CodexTransformAction;
  mode: 'cli' | 'api' | 'fallback';
  originalText: string;
  transformedText: string;
  selectionRange: {
    from: number;
    to: number;
  };
}

interface DiffChunks {
  prefix: string;
  removed: string;
  added: string;
  suffix: string;
  identical: boolean;
}

function mapHistoryMessageToChatMessage(message: CodexChatHistoryRecord): ChatMessage {
  return {
    id: message.id,
    role: message.role,
    content: message.content,
    mode: message.mode ?? undefined,
  };
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (fontSize: string) => ReturnType;
      unsetFontSize: () => ReturnType;
    };
  }
}

const FontSize = Extension.create({
  name: 'fontSize',

  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (element: HTMLElement) => element.style.fontSize?.replace('px', ''),
            renderHTML: (attributes: { fontSize?: string }) => {
              if (!attributes.fontSize) {
                return {};
              }

              return {
                style: `font-size: ${attributes.fontSize}px`,
              };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontSize:
        (fontSize: string) =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize }).run();
        },
      unsetFontSize:
        () =>
        ({ chain }) => {
          return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
        },
    };
  },
});

const AsteriskBulletList = BulletList.extend({
  addInputRules() {
    return [
      wrappingInputRule({
        find: /^\*\s$/,
        type: this.type,
      }),
    ];
  },
});

const DialogueTypography = Extension.create({
  name: 'dialogueTypography',
  addInputRules() {
    return [
      textInputRule({
        find: /<<$/,
        replace: '«',
      }),
      textInputRule({
        find: />>$/,
        replace: '»',
      }),
    ];
  },
});

interface ChapterEditorProps {
  chapterNodeId: string;
  chapterTitle: string;
  onClose: () => void;
  onStatus: (message: string) => void;
  onChapterSaved?: () => void | Promise<void>;
  projectName?: string;
}

function getAiAssistantLabel(settings: CodexSettings | null): string {
  if (settings?.provider === 'ollama') {
    return 'Ollama';
  }
  if (settings?.provider === 'openai_api') {
    return 'OpenAI';
  }
  return 'Codex';
}

function getWordCountFromText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

function styleFromEditor(editor: NonNullable<ReturnType<typeof useEditor>>): BlockStyle {
  if (editor.isActive('heading')) {
    return 'heading';
  }

  if (editor.isActive('blockquote')) {
    return 'blockquote';
  }

  return 'paragraph';
}

function getSharedPrefixLength(left: string, right: string): number {
  const limit = Math.min(left.length, right.length);
  let index = 0;
  while (index < limit && left[index] === right[index]) {
    index += 1;
  }
  return index;
}

function getSharedSuffixLength(left: string, right: string, maxLength: number): number {
  const leftRemaining = left.length - maxLength;
  const rightRemaining = right.length - maxLength;
  const limit = Math.min(leftRemaining, rightRemaining);
  let index = 0;
  while (index < limit && left[left.length - 1 - index] === right[right.length - 1 - index]) {
    index += 1;
  }
  return index;
}

function buildDiffChunks(originalText: string, transformedText: string): DiffChunks {
  if (originalText === transformedText) {
    return {
      prefix: originalText,
      removed: '',
      added: '',
      suffix: '',
      identical: true,
    };
  }

  const prefixLength = getSharedPrefixLength(originalText, transformedText);
  const suffixLength = getSharedSuffixLength(originalText, transformedText, prefixLength);
  const originalDiffEnd = originalText.length - suffixLength;
  const transformedDiffEnd = transformedText.length - suffixLength;

  return {
    prefix: originalText.slice(0, prefixLength),
    removed: originalText.slice(prefixLength, originalDiffEnd),
    added: transformedText.slice(prefixLength, transformedDiffEnd),
    suffix: originalText.slice(originalDiffEnd),
    identical: false,
  };
}

export default function ChapterEditor({
  chapterNodeId,
  chapterTitle,
  onClose,
  onStatus,
  onChapterSaved,
  projectName,
}: ChapterEditorProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [documentRecord, setDocumentRecord] = useState<ChapterDocumentRecord | null>(null);
  const [wordCount, setWordCount] = useState<number>(0);

  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<{ x: number; y: number } | null>(null);

  const [codexStatus, setCodexStatus] = useState<CodexStatus | null>(null);
  const [codexSettings, setCodexSettings] = useState<CodexSettings | null>(null);
  const [codexBusy, setCodexBusy] = useState<boolean>(false);
  const [codexSettingsBusy, setCodexSettingsBusy] = useState<boolean>(false);
  const [pendingSelectionDiff, setPendingSelectionDiff] = useState<PendingSelectionDiff | null>(null);
  const [applyingSelectionDiff, setApplyingSelectionDiff] = useState<boolean>(false);

  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [linkedCharacters, setLinkedCharacters] = useState<CharacterCard[]>([]);
  const [linkedLocations, setLinkedLocations] = useState<LocationCard[]>([]);

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const wordCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleWordCountUpdate = useCallback((nextWordCount: number): void => {
    if (wordCountTimeoutRef.current) {
      clearTimeout(wordCountTimeoutRef.current);
    }
    wordCountTimeoutRef.current = setTimeout(() => {
      setWordCount(nextWordCount);
      wordCountTimeoutRef.current = null;
    }, 120);
  }, []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        bulletList: false,
      }),
      AsteriskBulletList,
      TextStyle,
      FontFamily.configure({ types: ['textStyle'] }),
      FontSize,
      DialogueTypography,
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
    ],
    content: {
      type: 'doc',
      content: [{ type: 'paragraph', content: [] }],
    },
    editorProps: {
      attributes: {
        class: 'novelist-editor-content',
      },
    },
    onUpdate: ({ editor: activeEditor }) => {
      scheduleWordCountUpdate(getWordCountFromText(activeEditor.getText()));
    },
  });

  useEffect(() => {
    return () => {
      if (wordCountTimeoutRef.current) {
        clearTimeout(wordCountTimeoutRef.current);
        wordCountTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!editor) {
      return;
    }

    let isMounted = true;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const [record, codex, settings, history, chapterCharacters, chapterLocations] = await Promise.all([
          window.novelistApi.getChapterDocument({ chapterNodeId }),
          window.novelistApi.codexStatus(),
          window.novelistApi.codexGetSettings(),
          window.novelistApi.codexGetChatHistory({ chapterNodeId }),
          window.novelistApi.listChapterCharacters({ chapterNodeId }),
          window.novelistApi.listChapterLocations({ chapterNodeId }),
        ]);

        if (!isMounted) {
          return;
        }

        setCodexStatus(codex);
        setCodexSettings(settings);
        setChatMessages(history.map(mapHistoryMessageToChatMessage));
        setLinkedCharacters(chapterCharacters);
        setLinkedLocations(chapterLocations);
        setDocumentRecord(record);
        const content = JSON.parse(record.contentJson) as Record<string, unknown>;
        editor.commands.setContent(content);
        setWordCount(record.wordCount);
        onStatus(`Editor aperto: ${chapterTitle}`);
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        if (isMounted) {
          setError(message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [chapterNodeId, chapterTitle, editor, onStatus]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const activeEditor = editor;

    function syncSelectionFromEditor(): void {
      const selection = activeEditor.state.selection;
      if (selection.empty) {
        setSelectedText('');
        setSelectionRange(null);
        setSelectionBubble(null);
        return;
      }

      const text = activeEditor.state.doc.textBetween(selection.from, selection.to, ' ').trim();
      setSelectedText(text);
      setSelectionRange({ from: selection.from, to: selection.to });

      const nativeSelection = window.getSelection();
      if (!nativeSelection || nativeSelection.rangeCount === 0 || nativeSelection.isCollapsed) {
        setSelectionBubble(null);
        return;
      }

      const rect = nativeSelection.getRangeAt(0).getBoundingClientRect();
      if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
        setSelectionBubble(null);
        return;
      }

      setSelectionBubble({
        x: rect.left + rect.width / 2,
        y: rect.top + window.scrollY - 12,
      });
    }

    activeEditor.on('selectionUpdate', syncSelectionFromEditor);

    return () => {
      activeEditor.off('selectionUpdate', syncSelectionFromEditor);
    };
  }, [editor]);

  useEffect(() => {
    const container = chatScrollRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [chatMessages]);

  async function refreshCodexHistory(): Promise<void> {
    const history = await window.novelistApi.codexGetChatHistory({ chapterNodeId });
    setChatMessages(history.map(mapHistoryMessageToChatMessage));
  }

  async function refreshChapterReferences(): Promise<void> {
    const [chapterCharacters, chapterLocations] = await Promise.all([
      window.novelistApi.listChapterCharacters({ chapterNodeId }),
      window.novelistApi.listChapterLocations({ chapterNodeId }),
    ]);
    setLinkedCharacters(chapterCharacters);
    setLinkedLocations(chapterLocations);
  }

  async function handleToggleCodexConsent(enabled: boolean): Promise<void> {
    setCodexSettingsBusy(true);
    setError(null);

    try {
      const updated = await window.novelistApi.codexUpdateSettings({ enabled });
      setCodexSettings(updated);
      onStatus(enabled ? 'Consenso Codex abilitato' : 'Consenso Codex disabilitato');
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore aggiornamento consenso Codex');
    } finally {
      setCodexSettingsBusy(false);
    }
  }

  async function handleCancelCodexRequest(): Promise<void> {
    try {
      const response = await window.novelistApi.codexCancelActiveRequest();
      if (response.cancelled) {
        onStatus('Richiesta Codex annullata');
      } else {
        onStatus('Nessuna richiesta Codex attiva');
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore annullamento richiesta Codex');
    }
  }

  async function handleSave(): Promise<void> {
    if (!editor) {
      return;
    }

    if (wordCountTimeoutRef.current) {
      clearTimeout(wordCountTimeoutRef.current);
      wordCountTimeoutRef.current = null;
    }

    const currentWordCount = getWordCountFromText(editor.getText());
    setWordCount(currentWordCount);

    setSaving(true);
    setError(null);

    try {
      const contentJson = JSON.stringify(editor.getJSON());
      const saved = await window.novelistApi.saveChapterDocument({
        chapterNodeId,
        contentJson,
        wordCount: currentWordCount,
      });

      setDocumentRecord(saved);
      await onChapterSaved?.();
      onStatus(`Capitolo salvato (${saved.wordCount} parole)`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore salvataggio capitolo');
    } finally {
      setSaving(false);
    }
  }

  function applyBlockStyle(style: BlockStyle): void {
    if (!editor) {
      return;
    }

    if (style === 'heading') {
      editor.chain().focus().toggleHeading({ level: 2 }).run();
      return;
    }

    if (style === 'blockquote') {
      editor.chain().focus().toggleBlockquote().run();
      return;
    }

    editor.chain().focus().setParagraph().run();
  }

  async function handleSelectionAction(action: CodexTransformAction): Promise<void> {
    if (!editor || !selectedText || !selectionRange) {
      onStatus('Seleziona prima del testo nel capitolo.');
      return;
    }

    if (!codexSettings?.enabled) {
      onStatus('Abilita prima il consenso Codex per usare le azioni su selezione.');
      return;
    }

    const selectedTextSnapshot = selectedText;
    const selectionRangeSnapshot = {
      from: selectionRange.from,
      to: selectionRange.to,
    };

    setCodexBusy(true);
    setError(null);

    try {
      const result = await window.novelistApi.codexTransformSelection({
        action,
        selectedText: selectedTextSnapshot,
        chapterTitle,
        projectName,
        chapterText: editor.getText().slice(0, 12000),
      });

      if (result.cancelled || !result.output.trim()) {
        onStatus('Richiesta Codex annullata');
        return;
      }

      setSelectionBubble(null);
      setPendingSelectionDiff({
        action,
        mode: result.mode,
        originalText: selectedTextSnapshot,
        transformedText: result.output,
        selectionRange: selectionRangeSnapshot,
      });
      onStatus(`Anteprima ${action} pronta (${result.mode}). Scegli Applica o Scarta.`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore richiesta Codex su selezione');
    } finally {
      setCodexBusy(false);
    }
  }

  async function handleApplySelectionDiff(): Promise<void> {
    if (!editor || !pendingSelectionDiff) {
      return;
    }

    const { selectionRange, transformedText, action, mode } = pendingSelectionDiff;
    const maxPosition = editor.state.doc.content.size + 1;
    if (selectionRange.from < 1 || selectionRange.to > maxPosition || selectionRange.from >= selectionRange.to) {
      setPendingSelectionDiff(null);
      onStatus('Anteprima non applicabile: selezione non piu valida, ripeti l’azione Codex.');
      return;
    }

    setApplyingSelectionDiff(true);
    setError(null);
    try {
      editor
        .chain()
        .focus()
        .setTextSelection({ from: selectionRange.from, to: selectionRange.to })
        .insertContent(transformedText)
        .run();

      setPendingSelectionDiff(null);
      setSelectionBubble(null);
      setSelectedText('');
      setSelectionRange(null);
      onStatus(`Azione ${action} applicata (${mode})`);
      await handleSave();
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore applicazione anteprima Codex');
    } finally {
      setApplyingSelectionDiff(false);
    }
  }

  function handleDiscardSelectionDiff(): void {
    if (!pendingSelectionDiff) {
      return;
    }

    setPendingSelectionDiff(null);
    onStatus('Anteprima Codex scartata');
  }

  async function handlePrint(): Promise<void> {
    if (!editor) {
      return;
    }

    setError(null);
    try {
      await handleSave();
      const result = await window.novelistApi.printChapter({ chapterNodeId });
      if (result) {
        onStatus('Stampa capitolo inviata');
      } else {
        onStatus('Stampa capitolo annullata');
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore stampa capitolo');
    }
  }

  async function handleExportDocx(): Promise<void> {
    setError(null);
    try {
      await handleSave();
      const result = await window.novelistApi.exportChapterDocx({ chapterNodeId });
      if (result) {
        onStatus(`DOCX esportato: ${result.filePath}`);
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    }
  }

  async function handleExportPdf(): Promise<void> {
    setError(null);
    try {
      await handleSave();
      const result = await window.novelistApi.exportChapterPdf({ chapterNodeId });
      if (result) {
        onStatus(`PDF esportato: ${result.filePath}`);
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
    }
  }

  async function handleSendChat(): Promise<void> {
    const message = chatInput.trim();
    if (!message || !editor) {
      return;
    }

    if (!codexSettings?.enabled) {
      onStatus('Abilita prima il consenso Codex per usare la chat.');
      return;
    }

    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
    };

    setChatMessages((prev) => [...prev, userMessage]);
    setChatInput('');
    setCodexBusy(true);
    setError(null);

    try {
      const result = await window.novelistApi.codexChat({
        message,
        chapterNodeId,
        chapterTitle,
        projectName,
        chapterText: editor.getText().slice(0, 12000),
      });

      if (result.cancelled) {
        setChatMessages((prev) => [
          ...prev,
          {
            id: `a-${Date.now()}`,
            role: 'assistant',
            content: 'Richiesta annullata.',
            mode: 'fallback',
          },
        ]);
        onStatus('Richiesta Codex annullata');
        return;
      }

      await refreshCodexHistory();
      onStatus(`Risposta Codex ricevuta (${result.mode})`);
    } catch (caughtError) {
      const messageText = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(messageText);
      onStatus('Errore chat Codex');
    } finally {
      setCodexBusy(false);
    }
  }

  function insertCharacterReference(card: CharacterCard): void {
    if (!editor) {
      return;
    }
    const name = `${card.firstName} ${card.lastName}`.trim();
    editor.chain().focus().insertContent(`${name} `).run();
  }

  function insertLocationReference(card: LocationCard): void {
    if (!editor) {
      return;
    }
    editor.chain().focus().insertContent(`${card.name} `).run();
  }

  const activeStyle = editor ? styleFromEditor(editor) : 'paragraph';
  const activeFontFamily = editor?.getAttributes('textStyle')['fontFamily'] as string | undefined;
  const activeFontSize = editor?.getAttributes('textStyle')['fontSize'] as string | undefined;
  const codexEnabled = Boolean(codexSettings?.enabled);
  const aiAssistantLabel = getAiAssistantLabel(codexSettings);
  const pendingDiffChunks = pendingSelectionDiff
    ? buildDiffChunks(pendingSelectionDiff.originalText, pendingSelectionDiff.transformedText)
    : null;

  return (
    <div className="editor-overlay">
      <div className="editor-shell">
        <header className="editor-header">
          <div>
            <h3>Editor Capitolo</h3>
            <p>{chapterTitle}</p>
          </div>
          <button type="button" onClick={onClose}>
            Chiudi
          </button>
        </header>

        <section className="editor-toolbar">
          <select
            className="toolbar-select toolbar-select-style"
            value={activeStyle}
            onChange={(event) => applyBlockStyle(event.target.value as BlockStyle)}
          >
            <option value="paragraph">Testo normale</option>
            <option value="heading">Sottotitolo</option>
            <option value="blockquote">Citazione</option>
          </select>

          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={editor?.isActive('bold') ? 'is-active' : ''}
          >
            Grassetto
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={editor?.isActive('italic') ? 'is-active' : ''}
          >
            Corsivo
          </button>

          <select
            className="toolbar-select toolbar-select-font"
            value={activeFontFamily ?? ''}
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                editor?.chain().focus().unsetFontFamily().run();
                return;
              }
              editor?.chain().focus().setFontFamily(value).run();
            }}
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
            onChange={(event) => {
              const value = event.target.value;
              if (!value) {
                editor?.chain().focus().unsetFontSize().run();
                return;
              }
              editor?.chain().focus().setFontSize(value).run();
            }}
          >
            <option value="">Dimensione</option>
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="22">22</option>
          </select>

          <button type="button" onClick={() => editor?.chain().focus().setTextAlign('left').run()}>
            Sinistra
          </button>
          <button type="button" onClick={() => editor?.chain().focus().setTextAlign('center').run()}>
            Centro
          </button>
          <button type="button" onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
            Destra
          </button>
          <button type="button" onClick={() => editor?.chain().focus().setTextAlign('justify').run()}>
            Giustifica
          </button>
        </section>

        <section className="editor-main">
          <div className="editor-body">
            {loading ? <p>Caricamento capitolo...</p> : null}
            <div className="chapter-reference-panel">
              <h4>Riferimenti Capitolo</h4>
              <div className="chapter-reference-columns">
                <div>
                  <p className="muted">Personaggi collegati</p>
                  {linkedCharacters.length === 0 ? <p className="muted">Nessun personaggio collegato.</p> : null}
                  <div className="reference-chip-list">
                    {linkedCharacters.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className="reference-chip"
                        onClick={() => insertCharacterReference(card)}
                        disabled={!editor}
                      >
                        {`${card.firstName} ${card.lastName}`.trim()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="muted">Location collegate</p>
                  {linkedLocations.length === 0 ? <p className="muted">Nessuna location collegata.</p> : null}
                  <div className="reference-chip-list">
                    {linkedLocations.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className="reference-chip"
                        onClick={() => insertLocationReference(card)}
                        disabled={!editor}
                      >
                        {card.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="row-buttons">
                <button type="button" onClick={() => void refreshChapterReferences()}>
                  Aggiorna Riferimenti
                </button>
              </div>
            </div>
            {editor ? <EditorContent editor={editor} /> : null}
          </div>

          <aside className="codex-sidebar">
            <div className="codex-status">
              <h4>{`Assistente AI (${aiAssistantLabel})`}</h4>
              <p>
                Stato:{' '}
                <strong>
                  {codexStatus
                    ? codexStatus.available
                      ? `Disponibile (${codexStatus.command})`
                      : `Fallback (${codexStatus.command})`
                    : 'Verifica...'}
                </strong>
              </p>
              {codexStatus ? (
                <p className="muted">
                  Coda: {codexStatus.queuedRequests} | Attiva: {codexStatus.activeRequest ? 'si' : 'no'}
                </p>
              ) : null}
              {codexStatus?.reason ? <p className="muted">{codexStatus.reason}</p> : null}
              <label className="codex-consent">
                <input
                  type="checkbox"
                  checked={codexEnabled}
                  disabled={codexSettingsBusy}
                  onChange={(event) => void handleToggleCodexConsent(event.target.checked)}
                />
                <span>{`Invia testo a ${aiAssistantLabel} per assistenza AI`}</span>
              </label>
              <p className="muted">Disattiva il consenso per bloccare ogni invio di testo allo strumento AI.</p>
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => void handleCancelCodexRequest()}
                  disabled={!codexBusy}
                  className={codexBusy ? 'ai-working' : undefined}
                >
                  Annulla richiesta
                </button>
              </div>
            </div>

            <div className="codex-chat" ref={chatScrollRef}>
              {chatMessages.length === 0 ? (
                <p className="muted">Chat pronta. Chiedi brainstorming, revisione o ricerche narrative.</p>
              ) : null}
              {chatMessages.map((message) => (
                <div key={message.id} className={`chat-msg chat-msg-${message.role}`}>
                  <p>{message.content}</p>
                  {message.mode ? <span className="chat-mode">{message.mode}</span> : null}
                </div>
              ))}
            </div>

            <div className="codex-chat-input">
              <textarea
                rows={4}
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                placeholder={`Chiedi a ${aiAssistantLabel}: brainstorming, revisioni, idee di trama...`}
              />
              <button
                type="button"
                onClick={() => void handleSendChat()}
                disabled={codexBusy || !chatInput.trim() || !codexEnabled}
                className={codexBusy ? 'ai-working' : undefined}
              >
                Invia
              </button>
            </div>
          </aside>
        </section>

        <footer className="editor-footer">
          <p>
            Parole: <strong>{wordCount}</strong>
            {documentRecord ? ` | Ultimo salvataggio: ${new Date(documentRecord.updatedAt).toLocaleString()}` : ''}
          </p>
          <div className="row-buttons">
            <button type="button" onClick={() => void handleSave()} disabled={saving || !editor}>
              Salva
            </button>
            <button type="button" onClick={() => void handleExportDocx()} disabled={saving || !editor}>
              Esporta DOCX
            </button>
            <button type="button" onClick={() => void handleExportPdf()} disabled={saving || !editor}>
              Esporta PDF
            </button>
            <button type="button" onClick={() => void handlePrint()} disabled={!editor}>
              Stampa
            </button>
          </div>
          {error ? <p className="error">{error}</p> : null}
        </footer>

        {selectionBubble && !pendingSelectionDiff ? (
          <div
            className="selection-bubble"
            style={{
              left: `${selectionBubble.x}px`,
              top: `${selectionBubble.y}px`,
            }}
          >
            <button
              type="button"
              onClick={() => void handleSelectionAction('correggi')}
              disabled={codexBusy || !codexEnabled}
              className={codexBusy ? 'ai-working' : undefined}
            >
              Correggi
            </button>
            <button
              type="button"
              onClick={() => void handleSelectionAction('riscrivi')}
              disabled={codexBusy || !codexEnabled}
              className={codexBusy ? 'ai-working' : undefined}
            >
              Riscrivi
            </button>
            <button
              type="button"
              onClick={() => void handleSelectionAction('espandi')}
              disabled={codexBusy || !codexEnabled}
              className={codexBusy ? 'ai-working' : undefined}
            >
              Espandi
            </button>
            <button
              type="button"
              onClick={() => void handleSelectionAction('riduci')}
              disabled={codexBusy || !codexEnabled}
              className={codexBusy ? 'ai-working' : undefined}
            >
              Riduci
            </button>
          </div>
        ) : null}

        {pendingSelectionDiff && pendingDiffChunks ? (
          <div className="modal-overlay codex-diff-overlay">
            <div className="modal-card codex-diff-card">
              <h3>Anteprima modifica Codex</h3>
              <p className="muted">
                Azione: <strong>{pendingSelectionDiff.action}</strong> | Modalita:{' '}
                <strong>{pendingSelectionDiff.mode}</strong>
              </p>
              <div className="codex-diff-grid">
                <div className="codex-diff-column">
                  <h4>Originale</h4>
                  <pre className="codex-diff-text">
                    {pendingDiffChunks.prefix}
                    {pendingDiffChunks.removed ? (
                      <span className="codex-diff-removed">{pendingDiffChunks.removed}</span>
                    ) : null}
                    {pendingDiffChunks.suffix}
                  </pre>
                </div>
                <div className="codex-diff-column">
                  <h4>Proposto</h4>
                  <pre className="codex-diff-text">
                    {pendingDiffChunks.prefix}
                    {pendingDiffChunks.added ? <span className="codex-diff-added">{pendingDiffChunks.added}</span> : null}
                    {pendingDiffChunks.suffix}
                  </pre>
                </div>
              </div>
              {pendingDiffChunks.identical ? (
                <p className="muted">La proposta coincide con il testo originale.</p>
              ) : null}
              <div className="row-buttons">
                <button
                  type="button"
                  onClick={() => void handleApplySelectionDiff()}
                  disabled={applyingSelectionDiff}
                >
                  Applica
                </button>
                <button
                  type="button"
                  className="button-secondary"
                  onClick={handleDiscardSelectionDiff}
                  disabled={applyingSelectionDiff}
                >
                  Scarta
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
