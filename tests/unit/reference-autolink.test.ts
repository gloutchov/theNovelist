import { describe, expect, it } from 'vitest';
import { autoLinkEntityReferences } from '../../src/shared/reference-autolink';

describe('reference autolink', () => {
  it('adds missing character and location mentions after textual matches', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Mario entra nella Piazza Grande.' }],
        },
      ],
    };

    const result = autoLinkEntityReferences(
      document,
      [{ id: 'char-1', firstName: 'Mario', lastName: 'Rossi' }],
      [{ id: 'loc-1', name: 'Piazza Grande' }],
    );

    expect(result.changed).toBe(true);
    expect(result.insertedCharacterIds).toEqual(['char-1']);
    expect(result.insertedLocationIds).toEqual(['loc-1']);
    expect(result.document).toEqual({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Mario' },
            {
              type: 'referenceMention',
              attrs: { refId: 'char-1', refType: 'character', label: 'Mario Rossi' },
            },
            { type: 'text', text: ' entra nella Piazza Grande' },
            {
              type: 'referenceMention',
              attrs: { refId: 'loc-1', refType: 'location', label: 'Piazza Grande' },
            },
            { type: 'text', text: '.' },
          ],
        },
      ],
    });
  });

  it('matches last names and keeps existing mentions untouched', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Rossi osserva la scena. ' },
            {
              type: 'referenceMention',
              attrs: { refId: 'loc-1', refType: 'location', label: 'Piazza Grande' },
            },
            { type: 'text', text: ' Piazza Grande resta sullo sfondo.' },
          ],
        },
      ],
    };

    const result = autoLinkEntityReferences(
      document,
      [{ id: 'char-1', firstName: 'Mario', lastName: 'Rossi' }],
      [{ id: 'loc-1', name: 'Piazza Grande' }],
    );

    expect(result.insertedCharacterIds).toEqual(['char-1']);
    expect(result.insertedLocationIds).toEqual([]);
    expect(JSON.stringify(result.document)).toContain('"refId":"char-1"');
    expect(JSON.stringify(result.document).match(/"refId":"loc-1"/gu)).toHaveLength(1);
  });

  it('does not link ambiguous first names or partial words', () => {
    const document = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Anna e Annalisa restano nella stanza.' }],
        },
      ],
    };

    const result = autoLinkEntityReferences(
      document,
      [
        { id: 'char-1', firstName: 'Anna', lastName: '' },
        { id: 'char-2', firstName: 'Anna', lastName: 'Verdi' },
        { id: 'char-3', firstName: 'Lia', lastName: '' },
      ],
      [],
    );

    expect(result.changed).toBe(false);
    expect(result.document).toBe(document);
  });
});
