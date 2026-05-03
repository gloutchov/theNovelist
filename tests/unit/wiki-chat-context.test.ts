import { describe, expect, it } from 'vitest';
import { formatProjectMemoryContext } from '../../src/main/wiki/chat-context';

describe('formatProjectMemoryContext', () => {
  it('formats search results as cited project memory', () => {
    const context = formatProjectMemoryContext([
      {
        path: 'sources/chapters/chapter-1.md',
        title: 'Il magazzino',
        category: 'source',
        score: 12,
        snippet: 'Tizio firma il patto nel magazzino.',
      },
    ]);

    expect(context).toContain('[1] Il magazzino');
    expect(context).toContain('sources/chapters/chapter-1.md');
    expect(context).toContain('cita i riferimenti');
  });

  it('formats empty results as missing evidence guidance', () => {
    const context = formatProjectMemoryContext([]);

    expect(context).toContain('nessuna fonte rilevante');
    expect(context).toContain('non hai trovato conferma');
  });
});
