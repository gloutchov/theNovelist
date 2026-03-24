import { type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import {
  Extension,
  Node as TiptapNode,
  mergeAttributes,
  textInputRule,
  wrappingInputRule,
} from '@tiptap/core';
import BulletList from '@tiptap/extension-bullet-list';
import StarterKit from '@tiptap/starter-kit';
import { TextStyle } from '@tiptap/extension-text-style';
import FontFamily from '@tiptap/extension-font-family';
import TextAlign from '@tiptap/extension-text-align';
import { getNearbyCanvasPosition } from './canvas-position';
import {
  parseCharacterCreationSuggestion,
  parseLocationCreationSuggestion,
  splitCharacterName,
} from './card-extraction';

type ChapterDocumentRecord = Awaited<ReturnType<(typeof window.novelistApi)['getChapterDocument']>>;
type CodexTransformAction = 'correggi' | 'riscrivi' | 'espandi' | 'riduci';
type CodexStatus = Awaited<ReturnType<(typeof window.novelistApi)['codexStatus']>>;
type CodexSettings = Awaited<ReturnType<(typeof window.novelistApi)['codexGetSettings']>>;
type AppPreferences = Awaited<ReturnType<(typeof window.novelistApi)['getAppPreferences']>>;
type CodexChatHistoryRecord = Awaited<
  ReturnType<(typeof window.novelistApi)['codexGetChatHistory']>
>[number];
type CharacterCard = Awaited<ReturnType<(typeof window.novelistApi)['listCharacterCards']>>[number];
type LocationCard = Awaited<ReturnType<(typeof window.novelistApi)['listLocationCards']>>[number];
type StoryChapterNode = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>['nodes'][number];

type BlockStyle = 'paragraph' | 'heading' | 'blockquote';
type ReferenceType = 'character' | 'location';

interface RichTextNodeJson {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNodeJson[];
}

interface RichTextDocumentJson {
  type?: string;
  content?: RichTextNodeJson[];
}

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

interface MentionIds {
  characterIds: string[];
  locationIds: string[];
}

interface ReferenceOption {
  id: string;
  type: ReferenceType;
  label: string;
  searchText: string;
}

interface MentionMenuState {
  from: number;
  to: number;
  query: string;
  left: number;
  top: number;
  items: ReferenceOption[];
  selectedIndex: number;
}

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

interface CreateReferenceModalState extends TextSelectionSnapshot {
  type: ReferenceType;
  name: string;
  submitting: boolean;
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

const ReferenceMention = TiptapNode.create({
  name: 'referenceMention',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  addAttributes() {
    return {
      refId: {
        default: '',
      },
      refType: {
        default: 'character',
      },
      label: {
        default: '',
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-reference-mention]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const label = typeof HTMLAttributes['label'] === 'string' ? HTMLAttributes['label'] : '';
    const refId = typeof HTMLAttributes['refId'] === 'string' ? HTMLAttributes['refId'] : '';
    const refType =
      typeof HTMLAttributes['refType'] === 'string' ? HTMLAttributes['refType'] : 'character';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'reference-mention',
        contenteditable: 'false',
        'data-reference-mention': '',
        'data-ref-id': refId,
        'data-ref-type': refType,
        'data-label': label,
      }),
      `@${label}`,
    ];
  },

  renderText() {
    return '';
  },
});

interface ChapterEditorProps {
  chapterNodeId: string;
  chapterTitle: string;
  onClose: () => void;
  onStatus: (message: string) => void;
  onChapterSaved?: () => void | Promise<void>;
  projectName?: string;
  autosaveSettings?: AppPreferences | null;
  onDirtyChange?: (dirty: boolean) => void;
  onRegisterFlush?: (handler: (() => Promise<boolean>) | null) => void;
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

function getImageGenerationMissingRequirements(settings: CodexSettings | null): string[] {
  const missing: string[] = [];
  if (!settings?.enabled) {
    missing.push('consenso AI');
  }
  if (settings?.provider !== 'openai_api') {
    missing.push('provider OpenAI API');
  }
  if (!settings?.allowApiCalls) {
    missing.push('chiamate API abilitate');
  }
  if (!settings?.hasRuntimeApiKey) {
    missing.push('API key disponibile');
  }
  return missing;
}

function normalizePromptText(text: string, maxLength = 900): string {
  const normalized = text.trim().replace(/\s+/g, ' ');
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, maxLength).trimEnd()}...`;
}

function buildCharacterAutoImagePrompt(input: {
  name: string;
  description: string;
  suggestion: ReturnType<typeof parseCharacterCreationSuggestion>;
}): string {
  const details = [
    input.suggestion.sex && `sesso: ${input.suggestion.sex}`,
    input.suggestion.age !== null && `eta: ${input.suggestion.age}`,
    input.suggestion.species && `specie: ${input.suggestion.species}`,
    input.suggestion.hairColor && `capelli: ${input.suggestion.hairColor}`,
    input.suggestion.bald ? 'calvo' : '',
    input.suggestion.beard && `barba: ${input.suggestion.beard}`,
    input.suggestion.physique && `corporatura: ${input.suggestion.physique}`,
    input.suggestion.job && `ruolo: ${input.suggestion.job}`,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `Ritratto narrativo realistico di ${input.name}.`,
    details ? `Dettagli personaggio: ${details}.` : '',
    `Usa questa descrizione narrativa come base visiva principale: ${normalizePromptText(input.description, 700)}.`,
    'Inquadratura mezzo busto, luce cinematografica, espressione coerente con la scena, dettagli del volto nitidi, sfondo discreto, alta qualita.',
  ]
    .filter(Boolean)
    .join(' ');
}

function buildLocationAutoImagePrompt(input: {
  name: string;
  description: string;
  suggestion: ReturnType<typeof parseLocationCreationSuggestion>;
}): string {
  return [
    `Illustrazione narrativa realistica della location ${input.name}.`,
    input.suggestion.locationType ? `Tipologia luogo: ${input.suggestion.locationType}.` : '',
    `Usa questo testo selezionato come riferimento principale per l'ambiente: ${normalizePromptText(
      input.description,
      800,
    )}.`,
    input.suggestion.description
      ? `Sintesi ambientale: ${normalizePromptText(input.suggestion.description, 500)}.`
      : '',
    'Vista esterna o establishing shot, luce cinematografica, atmosfera coerente con la scena, ricchezza di dettagli ambientali, alta qualita.',
  ]
    .filter(Boolean)
    .join(' ');
}

function getWordCountFromText(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) {
    return 0;
  }

  return trimmed.split(/\s+/).filter(Boolean).length;
}

function getCharacterLabel(card: CharacterCard): string {
  return `${card.firstName} ${card.lastName}`.trim();
}

function normalizeReferenceSearch(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('it')
    .trim();
}

function collectPlainTextFromNode(node: RichTextNodeJson | undefined): string {
  if (!node) {
    return '';
  }

  if (node.type === 'referenceMention') {
    return '';
  }

  if (typeof node.text === 'string') {
    return node.text;
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  return node.content.map(collectPlainTextFromNode).join('');
}

function getPlainTextFromDocument(document: RichTextDocumentJson): string {
  const blocks = Array.isArray(document.content) ? document.content : [];
  return blocks.map(collectPlainTextFromNode).join('\n');
}

function getWordCountFromDocument(document: RichTextDocumentJson): number {
  return getWordCountFromText(getPlainTextFromDocument(document));
}

function extractMentionIds(document: RichTextDocumentJson): MentionIds {
  const characterIds = new Set<string>();
  const locationIds = new Set<string>();

  function visit(node: RichTextNodeJson | undefined): void {
    if (!node) {
      return;
    }

    if (node.type === 'referenceMention') {
      const refId = typeof node.attrs?.['refId'] === 'string' ? node.attrs['refId'].trim() : '';
      const refType = node.attrs?.['refType'];
      if (refId && refType === 'character') {
        characterIds.add(refId);
      }
      if (refId && refType === 'location') {
        locationIds.add(refId);
      }
      return;
    }

    if (!Array.isArray(node.content)) {
      return;
    }

    for (const child of node.content) {
      visit(child);
    }
  }

  for (const node of Array.isArray(document.content) ? document.content : []) {
    visit(node);
  }

  return {
    characterIds: [...characterIds],
    locationIds: [...locationIds],
  };
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  if (left.length !== right.length) {
    return false;
  }

  return left.every((value, index) => value === right[index]);
}

function buildNextChapterLinks(
  currentLinks: string[],
  chapterNodeId: string,
  shouldIncludeChapter: boolean,
): string[] {
  const nextLinks = currentLinks.filter((id) => id !== chapterNodeId);
  if (shouldIncludeChapter) {
    nextLinks.push(chapterNodeId);
  }
  return nextLinks;
}

function buildMentionMenuState(
  editor: NonNullable<ReturnType<typeof useEditor>>,
  options: ReferenceOption[],
  previousSelectedId: string | null,
): MentionMenuState | null {
  const selection = editor.state.selection;
  if (!selection.empty) {
    return null;
  }

  const cursor = selection.from;
  const textBeforeCursor = editor.state.doc.textBetween(
    Math.max(1, cursor - 80),
    cursor,
    '\n',
    '\0',
  );
  const match = /(?:^|[\s([{'"«])@([^\s@]*)$/u.exec(textBeforeCursor);
  if (!match) {
    return null;
  }

  const query = match[1] ?? '';
  const normalizedQuery = normalizeReferenceSearch(query);
  const items = options
    .filter((option) => !normalizedQuery || option.searchText.includes(normalizedQuery))
    .slice(0, 8);
  const coords = editor.view.coordsAtPos(cursor);
  const selectedIndex = previousSelectedId
    ? Math.max(
        0,
        items.findIndex((item) => item.id === previousSelectedId),
      )
    : 0;

  return {
    from: cursor - query.length - 1,
    to: cursor,
    query,
    left: coords.left,
    top: coords.bottom + 8,
    items,
    selectedIndex,
  };
}

function getSelectedTextSnapshot(
  editor: NonNullable<ReturnType<typeof useEditor>>,
): TextSelectionSnapshot | null {
  const selection = editor.state.selection;
  if (selection.empty) {
    return null;
  }

  const text = editor.state.doc.textBetween(selection.from, selection.to, ' ').trim();
  if (!text) {
    return null;
  }

  return {
    text,
    range: {
      from: selection.from,
      to: selection.to,
    },
  };
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
  autosaveSettings,
  onDirtyChange,
  onRegisterFlush,
}: ChapterEditorProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [documentRecord, setDocumentRecord] = useState<ChapterDocumentRecord | null>(null);
  const [wordCount, setWordCount] = useState<number>(0);

  const [selectedText, setSelectedText] = useState<string>('');
  const [selectionRange, setSelectionRange] = useState<{ from: number; to: number } | null>(null);
  const [selectionBubble, setSelectionBubble] = useState<{ x: number; y: number } | null>(null);

  const [codexStatus, setCodexStatus] = useState<CodexStatus | null>(null);
  const [codexSettings, setCodexSettings] = useState<CodexSettings | null>(null);
  const [codexBusy, setCodexBusy] = useState<boolean>(false);
  const [codexSettingsBusy, setCodexSettingsBusy] = useState<boolean>(false);
  const [pendingSelectionDiff, setPendingSelectionDiff] = useState<PendingSelectionDiff | null>(
    null,
  );
  const [applyingSelectionDiff, setApplyingSelectionDiff] = useState<boolean>(false);

  const [chatInput, setChatInput] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [linkedCharacters, setLinkedCharacters] = useState<CharacterCard[]>([]);
  const [linkedLocations, setLinkedLocations] = useState<LocationCard[]>([]);
  const [availableCharacters, setAvailableCharacters] = useState<CharacterCard[]>([]);
  const [availableLocations, setAvailableLocations] = useState<LocationCard[]>([]);
  const [chapterRecord, setChapterRecord] = useState<StoryChapterNode | null>(null);
  const [mentionedIds, setMentionedIds] = useState<MentionIds>({
    characterIds: [],
    locationIds: [],
  });
  const [mentionMenu, setMentionMenu] = useState<MentionMenuState | null>(null);
  const [selectionContextMenu, setSelectionContextMenu] = useState<SelectionContextMenuState | null>(
    null,
  );
  const [createReferenceModal, setCreateReferenceModal] = useState<CreateReferenceModalState | null>(
    null,
  );

  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const wordCountTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveInFlightRef = useRef<boolean>(false);
  const editorRef = useRef<NonNullable<ReturnType<typeof useEditor>> | null>(null);
  const mentionMenuRef = useRef<MentionMenuState | null>(null);
  const referenceOptionsRef = useRef<ReferenceOption[]>([]);

  const scheduleWordCountUpdate = useCallback((nextWordCount: number): void => {
    if (wordCountTimeoutRef.current) {
      clearTimeout(wordCountTimeoutRef.current);
    }
    wordCountTimeoutRef.current = setTimeout(() => {
      setWordCount(nextWordCount);
      wordCountTimeoutRef.current = null;
    }, 120);
  }, []);

  const characterMap = useMemo(
    () => new Map(availableCharacters.map((card) => [card.id, card])),
    [availableCharacters],
  );
  const locationMap = useMemo(
    () => new Map(availableLocations.map((card) => [card.id, card])),
    [availableLocations],
  );
  const referenceOptions = useMemo<ReferenceOption[]>(
    () =>
      [
        ...availableCharacters
          .map((card) => {
            const label = getCharacterLabel(card);
            return {
              id: card.id,
              type: 'character' as const,
              label,
              searchText: normalizeReferenceSearch(label),
            };
          })
          .filter((item) => item.label),
        ...availableLocations
          .map((card) => ({
            id: card.id,
            type: 'location' as const,
            label: card.name.trim(),
            searchText: normalizeReferenceSearch(card.name),
          }))
          .filter((item) => item.label),
      ].sort((left, right) => left.label.localeCompare(right.label, 'it')),
    [availableCharacters, availableLocations],
  );
  const displayedCharacters = useMemo(() => {
    const ordered = new Map<string, CharacterCard>();
    for (const card of linkedCharacters) {
      ordered.set(card.id, card);
    }
    for (const id of mentionedIds.characterIds) {
      const card = characterMap.get(id);
      if (card && !ordered.has(id)) {
        ordered.set(id, card);
      }
    }
    return [...ordered.values()];
  }, [characterMap, linkedCharacters, mentionedIds.characterIds]);
  const displayedLocations = useMemo(() => {
    const ordered = new Map<string, LocationCard>();
    for (const card of linkedLocations) {
      ordered.set(card.id, card);
    }
    for (const id of mentionedIds.locationIds) {
      const card = locationMap.get(id);
      if (card && !ordered.has(id)) {
        ordered.set(id, card);
      }
    }
    return [...ordered.values()];
  }, [linkedLocations, locationMap, mentionedIds.locationIds]);

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
      ReferenceMention,
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
      handleKeyDown: (_view, event) => {
        const activeMenu = mentionMenuRef.current;
        if (!activeMenu) {
          return false;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          if (activeMenu.items.length === 0) {
            return true;
          }
          setMentionMenu((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex: (prev.selectedIndex + 1) % prev.items.length,
                }
              : prev,
          );
          return true;
        }

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          if (activeMenu.items.length === 0) {
            return true;
          }
          setMentionMenu((prev) =>
            prev
              ? {
                  ...prev,
                  selectedIndex: (prev.selectedIndex - 1 + prev.items.length) % prev.items.length,
                }
              : prev,
          );
          return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
          if (activeMenu.items.length === 0) {
            return false;
          }
          event.preventDefault();
          const selected = activeMenu.items[activeMenu.selectedIndex] ?? activeMenu.items[0];
          if (!selected) {
            return true;
          }
          const activeEditor = editorRef.current;
          if (!activeEditor) {
            return true;
          }
          activeEditor
            .chain()
            .focus()
            .insertContentAt({ from: activeMenu.from, to: activeMenu.to }, [
              {
                type: 'referenceMention',
                attrs: {
                  refId: selected.id,
                  refType: selected.type,
                  label: selected.label,
                },
              },
              {
                type: 'text',
                text: ' ',
              },
            ])
            .run();
          setMentionMenu(null);
          return true;
        }

        if (event.key === 'Escape') {
          event.preventDefault();
          setMentionMenu(null);
          return true;
        }

        return false;
      },
    },
  });

  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor]);

  useEffect(() => {
    mentionMenuRef.current = mentionMenu;
  }, [mentionMenu]);

  useEffect(() => {
    referenceOptionsRef.current = referenceOptions;
  }, [referenceOptions]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    setMentionMenu((previous) => {
      const previousSelectedId =
        previous && previous.items.length > 0
          ? (previous.items[previous.selectedIndex]?.id ?? null)
          : null;
      return buildMentionMenuState(editor, referenceOptions, previousSelectedId);
    });
  }, [editor, referenceOptions]);

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

    function syncMentionMenuFromEditor(
      activeEditor: NonNullable<ReturnType<typeof useEditor>>,
    ): void {
      setMentionMenu((previous) => {
        const previousSelectedId =
          previous && previous.items.length > 0
            ? (previous.items[previous.selectedIndex]?.id ?? null)
            : null;
        return buildMentionMenuState(activeEditor, referenceOptionsRef.current, previousSelectedId);
      });
    }

    function syncDocumentStateFromEditor(
      activeEditor: NonNullable<ReturnType<typeof useEditor>>,
    ): void {
      const document = activeEditor.getJSON() as RichTextDocumentJson;
      const nextMentionedIds = extractMentionIds(document);
      scheduleWordCountUpdate(getWordCountFromDocument(document));
      setMentionedIds((previous) =>
        areStringArraysEqual(previous.characterIds, nextMentionedIds.characterIds) &&
        areStringArraysEqual(previous.locationIds, nextMentionedIds.locationIds)
          ? previous
          : nextMentionedIds,
      );
      syncMentionMenuFromEditor(activeEditor);
    }

    const handleEditorUpdate = ({
      editor: activeEditor,
    }: {
      editor: NonNullable<ReturnType<typeof useEditor>>;
    }) => {
      syncDocumentStateFromEditor(activeEditor);
      if (!loading) {
        setIsDirty(true);
      }
    };

    editor.on('update', handleEditorUpdate);

    return () => {
      editor.off('update', handleEditorUpdate);
    };
  }, [editor, loading, scheduleWordCountUpdate]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    let isMounted = true;

    void (async () => {
      setLoading(true);
      setError(null);

      try {
        const [
          record,
          codex,
          settings,
          history,
          chapterCharacters,
          chapterLocations,
          allCharacters,
          allLocations,
          storyState,
        ] = await Promise.all([
          window.novelistApi.getChapterDocument({ chapterNodeId }),
          window.novelistApi.codexStatus(),
          window.novelistApi.codexGetSettings(),
          window.novelistApi.codexGetChatHistory({ chapterNodeId }),
          window.novelistApi.listChapterCharacters({ chapterNodeId }),
          window.novelistApi.listChapterLocations({ chapterNodeId }),
          window.novelistApi.listCharacterCards(),
          window.novelistApi.listLocationCards(),
          window.novelistApi.getStoryState(),
        ]);

        if (!isMounted) {
          return;
        }

        setCodexStatus(codex);
        setCodexSettings(settings);
        setChatMessages(history.map(mapHistoryMessageToChatMessage));
        setLinkedCharacters(chapterCharacters);
        setLinkedLocations(chapterLocations);
        setAvailableCharacters(allCharacters);
        setAvailableLocations(allLocations);
        setChapterRecord(storyState.nodes.find((node) => node.id === chapterNodeId) ?? null);
        setDocumentRecord(record);
        const content = JSON.parse(record.contentJson) as Record<string, unknown>;
        editor.commands.setContent(content);
        const document = content as RichTextDocumentJson;
        setMentionedIds(extractMentionIds(document));
        setWordCount(getWordCountFromDocument(document));
        setMentionMenu(null);
        setIsDirty(false);
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
      setMentionMenu((previous) => {
        const previousSelectedId =
          previous && previous.items.length > 0
            ? (previous.items[previous.selectedIndex]?.id ?? null)
            : null;
        return buildMentionMenuState(activeEditor, referenceOptionsRef.current, previousSelectedId);
      });

      if (selection.empty) {
        setSelectedText('');
        setSelectionRange(null);
        setSelectionBubble(null);
        setSelectionContextMenu(null);
        return;
      }

      const snapshot = getSelectedTextSnapshot(activeEditor);
      if (!snapshot) {
        setSelectedText('');
        setSelectionRange(null);
        setSelectionBubble(null);
        setSelectionContextMenu(null);
        return;
      }
      setSelectedText(snapshot.text);
      setSelectionRange(snapshot.range);
      setSelectionContextMenu(null);

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

  useEffect(() => {
    if (!selectionContextMenu) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        setSelectionContextMenu(null);
        return;
      }
      if (target.closest('.selection-context-menu')) {
        return;
      }
      setSelectionContextMenu(null);
    }

    function handleEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setSelectionContextMenu(null);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [selectionContextMenu]);

  async function refreshCodexHistory(): Promise<void> {
    const history = await window.novelistApi.codexGetChatHistory({ chapterNodeId });
    setChatMessages(history.map(mapHistoryMessageToChatMessage));
  }

  async function refreshCodexSettings(): Promise<CodexSettings> {
    const settings = await window.novelistApi.codexGetSettings();
    setCodexSettings(settings);
    return settings;
  }

  const refreshChapterReferences = useCallback(async (): Promise<void> => {
    const [chapterCharacters, chapterLocations, allCharacters, allLocations] = await Promise.all([
      window.novelistApi.listChapterCharacters({ chapterNodeId }),
      window.novelistApi.listChapterLocations({ chapterNodeId }),
      window.novelistApi.listCharacterCards(),
      window.novelistApi.listLocationCards(),
    ]);
    setLinkedCharacters(chapterCharacters);
    setLinkedLocations(chapterLocations);
    setAvailableCharacters(allCharacters);
    setAvailableLocations(allLocations);
  }, [chapterNodeId]);

  const syncChapterReferences = useCallback(
    async (document: RichTextDocumentJson): Promise<void> => {
      const references = extractMentionIds(document);
      const mentionedCharacterIds = new Set(references.characterIds);
      const mentionedLocationIds = new Set(references.locationIds);
      const [allCharacters, allLocations] = await Promise.all([
        window.novelistApi.listCharacterCards(),
        window.novelistApi.listLocationCards(),
      ]);

      await Promise.all([
        ...allCharacters.map(async (character) => {
          const currentLinks = await window.novelistApi.listCharacterChapterLinks({
            characterCardId: character.id,
          });
          const nextLinks = buildNextChapterLinks(
            currentLinks,
            chapterNodeId,
            mentionedCharacterIds.has(character.id),
          );
          if (areStringArraysEqual(currentLinks, nextLinks)) {
            return;
          }
          await window.novelistApi.setCharacterChapterLinks({
            characterCardId: character.id,
            chapterNodeIds: nextLinks,
          });
        }),
        ...allLocations.map(async (location) => {
          const currentLinks = await window.novelistApi.listLocationChapterLinks({
            locationCardId: location.id,
          });
          const nextLinks = buildNextChapterLinks(
            currentLinks,
            chapterNodeId,
            mentionedLocationIds.has(location.id),
          );
          if (areStringArraysEqual(currentLinks, nextLinks)) {
            return;
          }
          await window.novelistApi.setLocationChapterLinks({
            locationCardId: location.id,
            chapterNodeIds: nextLinks,
          });
        }),
      ]);
    },
    [chapterNodeId],
  );

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

  const handleSave = useCallback(
    async (options?: { successStatus?: string; silent?: boolean }): Promise<void> => {
      if (!editor) {
        return;
      }

      if (wordCountTimeoutRef.current) {
        clearTimeout(wordCountTimeoutRef.current);
        wordCountTimeoutRef.current = null;
      }

      const document = editor.getJSON() as RichTextDocumentJson;
      const currentWordCount = getWordCountFromDocument(document);
      setWordCount(currentWordCount);

      setSaving(true);
      setError(null);

      try {
        const contentJson = JSON.stringify(document);
        const saved = await window.novelistApi.saveChapterDocument({
          chapterNodeId,
          contentJson,
          wordCount: currentWordCount,
        });

        setDocumentRecord(saved);
        setIsDirty(false);
        let referenceSyncFailed = false;
        try {
          await syncChapterReferences(document);
          await refreshChapterReferences();
        } catch (caughtReferenceError) {
          referenceSyncFailed = true;
          const message =
            caughtReferenceError instanceof Error
              ? caughtReferenceError.message
              : 'Errore sincronizzazione riferimenti';
          setError(`Capitolo salvato, ma sincronizzazione riferimenti fallita: ${message}`);
          onStatus('Capitolo salvato, ma sincronizzazione riferimenti fallita');
        }
        await onChapterSaved?.();
        if (!referenceSyncFailed && !options?.silent) {
          onStatus(options?.successStatus ?? `Capitolo salvato (${saved.wordCount} parole)`);
        }
      } catch (caughtError) {
        const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
        setError(message);
        onStatus('Errore salvataggio capitolo');
      } finally {
        setSaving(false);
      }
    },
    [chapterNodeId, editor, onChapterSaved, onStatus, refreshChapterReferences, syncChapterReferences],
  );

  const flushDirtyDocument = useCallback(
    async (options?: { successStatus?: string; silent?: boolean }): Promise<boolean> => {
      if (!isDirty || saving || loading || !editor) {
        return false;
      }

      await handleSave(options);
      return true;
    },
    [editor, handleSave, isDirty, loading, saving],
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
    return () => {
      onDirtyChange?.(false);
    };
  }, [isDirty, onDirtyChange]);

  useEffect(() => {
    onRegisterFlush?.(() => flushDirtyDocument({ silent: true }));
    return () => {
      onRegisterFlush?.(null);
    };
  }, [flushDirtyDocument, onRegisterFlush]);

  useEffect(() => {
    if (autosaveTimeoutRef.current) {
      clearTimeout(autosaveTimeoutRef.current);
      autosaveTimeoutRef.current = null;
    }

    if (autosaveSettings?.autosaveMode !== 'auto' || !isDirty || loading || saving) {
      return;
    }

    autosaveTimeoutRef.current = setTimeout(() => {
      if (autosaveInFlightRef.current) {
        return;
      }

      autosaveInFlightRef.current = true;
      void flushDirtyDocument({ successStatus: 'Capitolo salvato automaticamente' }).finally(() => {
        autosaveInFlightRef.current = false;
      });
    }, 1200);

    return () => {
      if (autosaveTimeoutRef.current) {
        clearTimeout(autosaveTimeoutRef.current);
        autosaveTimeoutRef.current = null;
      }
    };
  }, [autosaveSettings?.autosaveMode, flushDirtyDocument, isDirty, loading, saving]);

  useEffect(() => {
    if (autosaveSettings?.autosaveMode !== 'interval' || loading) {
      return;
    }

    const intervalId = setInterval(() => {
      if (!isDirty || saving || autosaveInFlightRef.current) {
        return;
      }

      autosaveInFlightRef.current = true;
      void flushDirtyDocument({ successStatus: 'Capitolo salvato automaticamente' }).finally(() => {
        autosaveInFlightRef.current = false;
      });
    }, autosaveSettings.autosaveIntervalMinutes * 60_000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    autosaveSettings?.autosaveIntervalMinutes,
    autosaveSettings?.autosaveMode,
    flushDirtyDocument,
    isDirty,
    loading,
    saving,
  ]);

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
        chapterText: getPlainTextFromDocument(editor.getJSON() as RichTextDocumentJson).slice(
          0,
          12000,
        ),
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
    if (
      selectionRange.from < 1 ||
      selectionRange.to > maxPosition ||
      selectionRange.from >= selectionRange.to
    ) {
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
        chapterText: getPlainTextFromDocument(editor.getJSON() as RichTextDocumentJson).slice(
          0,
          12000,
        ),
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

  function insertReference(
    item: ReferenceOption,
    range?: { from: number; to: number },
    options?: { preserveSelectedContent?: boolean },
  ): void {
    if (!editor) {
      return;
    }

    const insertionRange =
      range ?? {
        from: editor.state.selection.from,
        to: editor.state.selection.to,
      };
    const preservedContent =
      options?.preserveSelectedContent && insertionRange.from < insertionRange.to
        ? (((editor.state.doc.slice(insertionRange.from, insertionRange.to).toJSON().content ??
            []) as RichTextNodeJson[]))
        : [];

    editor
      .chain()
      .focus()
      .insertContentAt(insertionRange, [
        {
          type: 'referenceMention',
          attrs: {
            refId: item.id,
            refType: item.type,
            label: item.label,
          },
        },
        {
          type: 'text',
          text: ' ',
        },
        ...preservedContent,
      ])
      .run();
    setMentionMenu(null);
    setSelectionContextMenu(null);
  }

  function insertCharacterReference(
    card: CharacterCard,
    range?: { from: number; to: number },
    options?: { preserveSelectedContent?: boolean },
  ): void {
    insertReference(
      {
        id: card.id,
        type: 'character',
        label: getCharacterLabel(card),
        searchText: normalizeReferenceSearch(getCharacterLabel(card)),
      },
      range,
      options,
    );
  }

  function insertLocationReference(
    card: LocationCard,
    range?: { from: number; to: number },
    options?: { preserveSelectedContent?: boolean },
  ): void {
    insertReference(
      {
        id: card.id,
        type: 'location',
        label: card.name,
        searchText: normalizeReferenceSearch(card.name),
      },
      range,
      options,
    );
  }

  function handleEditorContextMenu(event: ReactMouseEvent<HTMLDivElement>): void {
    if (!editor) {
      return;
    }

    const snapshot = getSelectedTextSnapshot(editor);
    if (!snapshot) {
      setSelectionContextMenu(null);
      return;
    }

    event.preventDefault();
    setMentionMenu(null);
    setSelectionBubble(null);
    setSelectionContextMenu({
      ...snapshot,
      left: event.clientX,
      top: event.clientY,
    });
  }

  async function requestCharacterSuggestion(
    name: string,
    description: string,
  ): Promise<ReturnType<typeof parseCharacterCreationSuggestion>> {
    if (!codexSettings?.enabled) {
      return parseCharacterCreationSuggestion('');
    }

    try {
      const response = await window.novelistApi.codexAssist({
        projectName,
        message:
          'Analizza questa descrizione di personaggio e restituisci solo JSON valido con le chiavi sex, age, sexualOrientation, species, hairColor, bald, beard, physique, job. Usa stringhe concise in italiano, null per age se ignota e true per bald solo se esplicito.',
        context: JSON.stringify({
          chapterTitle,
          characterName: name,
          description,
        }),
      });

      if (response.cancelled || !response.output.trim()) {
        return parseCharacterCreationSuggestion('');
      }

      return parseCharacterCreationSuggestion(response.output);
    } catch {
      return parseCharacterCreationSuggestion('');
    }
  }

  async function requestLocationSuggestion(
    name: string,
    description: string,
  ): Promise<ReturnType<typeof parseLocationCreationSuggestion>> {
    if (!codexSettings?.enabled) {
      return parseLocationCreationSuggestion('');
    }

    try {
      const response = await window.novelistApi.codexAssist({
        projectName,
        message:
          'Analizza questa descrizione di location e restituisci solo JSON valido con le chiavi locationType e description. locationType deve essere breve; description deve essere una sintesi narrativa di una o due frasi in italiano.',
        context: JSON.stringify({
          chapterTitle,
          locationName: name,
          description,
        }),
      });

      if (response.cancelled || !response.output.trim()) {
        return parseLocationCreationSuggestion('');
      }

      return parseLocationCreationSuggestion(response.output);
    } catch {
      return parseLocationCreationSuggestion('');
    }
  }

  async function handleSubmitReferenceCreation(): Promise<void> {
    if (!createReferenceModal) {
      return;
    }

    const name = createReferenceModal.name.trim();
    if (!name) {
      onStatus(
        createReferenceModal.type === 'character'
          ? 'Inserisci il nome del personaggio.'
          : 'Inserisci il nome della location.',
      );
      return;
    }

    setCreateReferenceModal((prev) => (prev ? { ...prev, submitting: true } : prev));
    setError(null);

    try {
      const currentCodexSettings = await refreshCodexSettings();
      const missingImageGenerationRequirements = getImageGenerationMissingRequirements(currentCodexSettings);
      const imageGenerationReady = missingImageGenerationRequirements.length === 0;
      let autoImageGenerated = false;
      let autoImageError: string | null = null;

      if (createReferenceModal.type === 'character') {
        const suggestion = await requestCharacterSuggestion(name, createReferenceModal.text);
        const { firstName, lastName } = splitCharacterName(name);
        const nextPosition = getNearbyCanvasPosition(
          availableCharacters.map((card) => ({
            x: card.positionX,
            y: card.positionY,
          })),
          {
            emptyPosition: { x: 120, y: 120 },
            minDistance: 210,
            radiusStep: 150,
          },
        );

        const created = await window.novelistApi.createCharacterCard({
          firstName,
          lastName,
          sex: suggestion.sex,
          age: suggestion.age,
          sexualOrientation: suggestion.sexualOrientation,
          species: suggestion.species,
          hairColor: suggestion.hairColor,
          bald: suggestion.bald,
          beard: suggestion.beard,
          physique: suggestion.physique,
          job: suggestion.job,
          notes: createReferenceModal.text,
          plotNumber: chapterRecord?.plotNumber ?? 1,
          positionX: nextPosition.x,
          positionY: nextPosition.y,
        });

        await window.novelistApi.setCharacterChapterLinks({
          characterCardId: created.id,
          chapterNodeIds: [chapterNodeId],
        });

        if (imageGenerationReady) {
          try {
            await window.novelistApi.generateCharacterImage({
              characterCardId: created.id,
              imageType: 'mezzo-busto',
              prompt: buildCharacterAutoImagePrompt({
                name,
                description: createReferenceModal.text,
                suggestion,
              }),
              size: '1024x1024',
            });
            autoImageGenerated = true;
          } catch (caughtError) {
            autoImageError =
              caughtError instanceof Error ? caughtError.message : 'Errore generazione immagine';
          }
        }

        insertCharacterReference(created, createReferenceModal.range, {
          preserveSelectedContent: true,
        });
      } else {
        const suggestion = await requestLocationSuggestion(name, createReferenceModal.text);
        const nextPosition = getNearbyCanvasPosition(
          availableLocations.map((card) => ({
            x: card.positionX,
            y: card.positionY,
          })),
          {
            emptyPosition: { x: 120, y: 120 },
            minDistance: 225,
            radiusStep: 155,
          },
        );

        const created = await window.novelistApi.createLocationCard({
          name,
          locationType: suggestion.locationType,
          description: suggestion.description,
          notes: createReferenceModal.text,
          plotNumber: chapterRecord?.plotNumber ?? 1,
          positionX: nextPosition.x,
          positionY: nextPosition.y,
        });

        await window.novelistApi.setLocationChapterLinks({
          locationCardId: created.id,
          chapterNodeIds: [chapterNodeId],
        });

        if (imageGenerationReady) {
          try {
            await window.novelistApi.generateLocationImage({
              locationCardId: created.id,
              imageType: 'esterno',
              prompt: buildLocationAutoImagePrompt({
                name,
                description: createReferenceModal.text,
                suggestion,
              }),
              size: '1024x1024',
            });
            autoImageGenerated = true;
          } catch (caughtError) {
            autoImageError =
              caughtError instanceof Error ? caughtError.message : 'Errore generazione immagine';
          }
        }

        insertLocationReference(created, createReferenceModal.range, {
          preserveSelectedContent: true,
        });
      }

      await refreshChapterReferences();
      setSelectionBubble(null);
      setSelectedText('');
      setSelectionRange(null);
      setCreateReferenceModal(null);
      const baseStatus =
        createReferenceModal.type === 'character'
          ? `Personaggio creato e inserito nel testo: @${name}`
          : `Location creata e inserita nel testo: @${name}`;
      if (autoImageGenerated) {
        onStatus(`${baseStatus} con immagine generata automaticamente`);
      } else if (autoImageError) {
        onStatus(`${baseStatus}. Immagine automatica non generata: ${autoImageError}`);
      } else if (missingImageGenerationRequirements.length > 0) {
        onStatus(
          `${baseStatus}. Generazione automatica non disponibile: manca ${missingImageGenerationRequirements.join(
            ', ',
          )}.`,
        );
      } else {
        onStatus(baseStatus);
      }
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      onStatus('Errore creazione scheda da selezione');
      setCreateReferenceModal((prev) => (prev ? { ...prev, submitting: false } : prev));
    }
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
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('center').run()}
          >
            Centro
          </button>
          <button type="button" onClick={() => editor?.chain().focus().setTextAlign('right').run()}>
            Destra
          </button>
          <button
            type="button"
            onClick={() => editor?.chain().focus().setTextAlign('justify').run()}
          >
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
                  <p className="muted">Personaggi collegati o citati</p>
                  {displayedCharacters.length === 0 ? (
                    <p className="muted">Nessun personaggio collegato.</p>
                  ) : null}
                  <div className="reference-chip-list">
                    {displayedCharacters.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className="reference-chip"
                        onClick={() => insertCharacterReference(card)}
                        disabled={!editor}
                      >
                        @{getCharacterLabel(card)}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="muted">Location collegate o citate</p>
                  {displayedLocations.length === 0 ? (
                    <p className="muted">Nessuna location collegata.</p>
                  ) : null}
                  <div className="reference-chip-list">
                    {displayedLocations.map((card) => (
                      <button
                        key={card.id}
                        type="button"
                        className="reference-chip"
                        onClick={() => insertLocationReference(card)}
                        disabled={!editor}
                      >
                        @{card.name}
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
            <div onContextMenu={handleEditorContextMenu}>
              {editor ? <EditorContent editor={editor} /> : null}
            </div>
            {mentionMenu ? (
              <div
                className="mention-menu"
                style={{
                  left: `${mentionMenu.left}px`,
                  top: `${mentionMenu.top}px`,
                }}
              >
                {mentionMenu.items.length === 0 ? (
                  <p className="muted">Nessun riferimento trovato.</p>
                ) : null}
                {mentionMenu.items.map((item, index) => (
                  <button
                    key={item.id}
                    type="button"
                    className={
                      index === mentionMenu.selectedIndex
                        ? 'mention-menu-item is-active'
                        : 'mention-menu-item'
                    }
                    onMouseDown={(event) => {
                      event.preventDefault();
                      insertReference(item, {
                        from: mentionMenu.from,
                        to: mentionMenu.to,
                      });
                    }}
                  >
                    <span>{`@${item.label}`}</span>
                    <small>{item.type === 'character' ? 'Personaggio' : 'Location'}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {selectionContextMenu ? (
              <div
                className="selection-context-menu"
                style={{
                  left: `${selectionContextMenu.left}px`,
                  top: `${selectionContextMenu.top}px`,
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectionContextMenu(null);
                    setCreateReferenceModal({
                      type: 'character',
                      text: selectionContextMenu.text,
                      range: selectionContextMenu.range,
                      name: '',
                      submitting: false,
                    });
                  }}
                >
                  Crea personaggio
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionContextMenu(null);
                    setCreateReferenceModal({
                      type: 'location',
                      text: selectionContextMenu.text,
                      range: selectionContextMenu.range,
                      name: '',
                      submitting: false,
                    });
                  }}
                >
                  Crea location
                </button>
              </div>
            ) : null}
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
                  Coda: {codexStatus.queuedRequests} | Attiva:{' '}
                  {codexStatus.activeRequest ? 'si' : 'no'}
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
              <p className="muted">
                Disattiva il consenso per bloccare ogni invio di testo allo strumento AI.
              </p>
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
                <p className="muted">
                  Chat pronta. Chiedi brainstorming, revisione o ricerche narrative.
                </p>
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
            {documentRecord
              ? ` | Ultimo salvataggio: ${new Date(documentRecord.updatedAt).toLocaleString()}`
              : ''}
          </p>
          <div className="row-buttons">
            <button type="button" onClick={() => void handleSave()} disabled={saving || !editor}>
              Salva
            </button>
            <button
              type="button"
              onClick={() => void handleExportDocx()}
              disabled={saving || !editor}
            >
              Esporta DOCX
            </button>
            <button
              type="button"
              onClick={() => void handleExportPdf()}
              disabled={saving || !editor}
            >
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
                    {pendingDiffChunks.added ? (
                      <span className="codex-diff-added">{pendingDiffChunks.added}</span>
                    ) : null}
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

        {createReferenceModal ? (
          <div
            className="modal-overlay"
            onClick={() => {
              if (!createReferenceModal.submitting) {
                setCreateReferenceModal(null);
              }
            }}
          >
            <div className="modal-card" onClick={(event) => event.stopPropagation()}>
              <h3>
                {createReferenceModal.type === 'character'
                  ? 'Crea Scheda Personaggio'
                  : 'Crea Scheda Location'}
              </h3>
              <label>
                {createReferenceModal.type === 'character' ? 'Nome personaggio' : 'Nome location'}
                <input
                  autoFocus
                  value={createReferenceModal.name}
                  onChange={(event) =>
                    setCreateReferenceModal((prev) =>
                      prev ? { ...prev, name: event.target.value } : prev,
                    )
                  }
                />
              </label>
              <label>
                Testo selezionato
                <textarea rows={6} value={createReferenceModal.text} readOnly />
              </label>
              <p className="muted">
                La descrizione verra salvata nelle note. Se l&apos;AI e disponibile, prova anche a
                compilare i campi deducibili.
              </p>
              <div className="row-buttons">
                <button
                  type="button"
                  className="button-secondary"
                  onClick={() => setCreateReferenceModal(null)}
                  disabled={createReferenceModal.submitting}
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={() => void handleSubmitReferenceCreation()}
                  disabled={createReferenceModal.submitting}
                  className={createReferenceModal.submitting ? 'ai-working' : undefined}
                >
                  {createReferenceModal.submitting ? 'Creazione...' : 'Crea e inserisci @'}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
