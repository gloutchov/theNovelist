import { describe, expect, it } from 'vitest';
import {
  canonicalizeRichTextDocumentMentions,
  createEmptyRichTextDocument,
  extractRichTextBlocks,
  getWordCountFromDocument,
} from '../../src/main/chapters/rich-text';

describe('rich-text helpers', () => {
  it('extracts paragraph, heading and blockquote blocks', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Capitolo 1' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Inizio della storia.' }],
        },
        {
          type: 'blockquote',
          content: [{ type: 'text', text: 'Una frase importante.' }],
        },
      ],
    };

    const blocks = extractRichTextBlocks(document);

    expect(blocks).toHaveLength(3);
    expect(blocks[0]).toMatchObject({ type: 'heading', text: 'Capitolo 1', level: 2 });
    expect(blocks[1]).toMatchObject({ type: 'paragraph', text: 'Inizio della storia.' });
    expect(blocks[2]).toMatchObject({ type: 'blockquote', text: 'Una frase importante.' });
  });

  it('computes word count from rich text document', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Tre parole qui' }],
        },
      ],
    };

    expect(getWordCountFromDocument(document)).toBe(3);
  });

  it('ignores inline reference mentions in extracted blocks and word count', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mario entra in scena. ' },
            {
              type: 'referenceMention',
              attrs: {
                refId: 'char-1',
                refType: 'character',
                label: 'Mario Rossi',
              },
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'La piazza e pronta. ' },
            {
              type: 'referenceMention',
              attrs: {
                refId: 'loc-1',
                refType: 'location',
                label: 'Piazza Grande',
              },
            },
          ],
        },
      ],
    };

    expect(extractRichTextBlocks(document)).toEqual([
      { type: 'paragraph', text: 'Mario entra in scena.' },
      { type: 'paragraph', text: 'La piazza e pronta.' },
    ]);
    expect(getWordCountFromDocument(document)).toBe(8);
  });

  it('canonicalizes mention labels from trusted entity resolvers', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'referenceMention',
              attrs: {
                refId: 'char-1',
                refType: 'character',
                label: 'Nome Falso',
              },
            },
            {
              type: 'referenceMention',
              attrs: {
                refId: 'loc-1',
                refType: 'location',
                label: 'Luogo Falso',
              },
            },
          ],
        },
      ],
    };

    const normalized = canonicalizeRichTextDocumentMentions(document, {
      getLabel: (type, id) => {
        if (type === 'character' && id === 'char-1') {
          return 'Mario Rossi';
        }
        if (type === 'location' && id === 'loc-1') {
          return 'Piazza Grande';
        }
        return null;
      },
    });

    expect(normalized).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            {
              type: 'referenceMention',
              attrs: {
                refId: 'char-1',
                refType: 'character',
                label: 'Mario Rossi',
              },
            },
            {
              type: 'referenceMention',
              attrs: {
                refId: 'loc-1',
                refType: 'location',
                label: 'Piazza Grande',
              },
            },
          ],
        },
      ],
    });
  });

  it('drops malformed or unresolved mention nodes during canonicalization', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Testo ' },
            {
              type: 'referenceMention',
              attrs: {
                refId: '',
                refType: 'character',
                label: 'Vuoto',
              },
            },
            {
              type: 'referenceMention',
              attrs: {
                refId: 'char-2',
                refType: 'location',
                label: 'Tipo errato',
              },
            },
            {
              type: 'referenceMention',
              attrs: {
                refId: 'char-3',
                refType: 'character',
                label: 'Eliminato',
              },
            },
          ],
        },
      ],
    };

    const normalized = canonicalizeRichTextDocumentMentions(document, {
      getLabel: () => null,
    });

    expect(normalized).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Testo ' }],
        },
      ],
    });
  });

  it('returns empty default document', () => {
    const empty = createEmptyRichTextDocument();
    expect(empty.type).toBe('doc');
    expect(Array.isArray(empty.content)).toBe(true);
  });
});
