import { describe, expect, it } from 'vitest';
import { isSafeWikiRelativePath } from '../../src/main/wiki/path-safety';

describe('wiki path safety', () => {
  it('accepts normal relative wiki paths', () => {
    expect(isSafeWikiRelativePath('sources/chapters/chapter-1.md')).toBe(true);
    expect(isSafeWikiRelativePath('sources/cards/characters.md')).toBe(true);
  });

  it('rejects traversal, absolute and empty paths', () => {
    expect(isSafeWikiRelativePath('../project.db')).toBe(false);
    expect(isSafeWikiRelativePath('sources/../../project.db')).toBe(false);
    expect(isSafeWikiRelativePath('/tmp/project.db')).toBe(false);
    expect(isSafeWikiRelativePath('')).toBe(false);
    expect(isSafeWikiRelativePath('sources\\..\\project.db')).toBe(false);
  });
});
