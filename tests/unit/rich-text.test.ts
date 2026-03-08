import { describe, expect, it } from 'vitest';
import {
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

  it('returns empty default document', () => {
    const empty = createEmptyRichTextDocument();
    expect(empty.type).toBe('doc');
    expect(Array.isArray(empty.content)).toBe(true);
  });
});
