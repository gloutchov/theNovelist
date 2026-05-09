import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { searchProjectWiki } from '../../src/main/wiki/search';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('searchProjectWiki', () => {
  it('searches markdown files with ranking, snippets and categories', async () => {
    const wikiPath = await createTempDir('novelist-wiki-search-');
    await mkdir(path.join(wikiPath, 'sources', 'chapters'), { recursive: true });
    await mkdir(path.join(wikiPath, 'characters'), { recursive: true });
    await mkdir(path.join(wikiPath, 'maintenance'), { recursive: true });

    await writeFile(
      path.join(wikiPath, 'index.md'),
      '# Project Wiki Index\n\n- [Capitolo](sources/chapters/chapter-1.md)\n',
      'utf8',
    );
    await writeFile(
      path.join(wikiPath, 'sources', 'chapters', 'chapter-1.md'),
      '# Il magazzino\n\nTizio firma il patto nel magazzino vicino al porto.',
      'utf8',
    );
    await writeFile(
      path.join(wikiPath, 'characters', 'tizio.md'),
      '# Tizio\n\nCustodisce un segreto sul patto.',
      'utf8',
    );
    await writeFile(
      path.join(wikiPath, 'maintenance', 'ignored.md'),
      '# Ignored\n\nmagazzino patto',
      'utf8',
    );

    const results = await searchProjectWiki(wikiPath, 'magazzino patto', { limit: 2 });

    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      path: 'sources/chapters/chapter-1.md',
      title: 'Il magazzino',
      category: 'source',
    });
    expect(results[0]?.snippet).toContain('Tizio firma');
    expect(results[0]?.content).toContain('Tizio firma il patto nel magazzino vicino al porto.');
    expect(results.map((result) => result.path)).not.toContain('maintenance/ignored.md');
  });

  it('normalizes accents in queries and content', async () => {
    const wikiPath = await createTempDir('novelist-wiki-search-accents-');
    await writeFile(
      path.join(wikiPath, 'notes.md'),
      '# Note\n\nCaio scopre la verità sulla città.',
      'utf8',
    );

    const results = await searchProjectWiki(wikiPath, 'verita citta');

    expect(results[0]).toMatchObject({
      path: 'notes.md',
      title: 'Note',
      category: 'wiki',
    });
  });
});
