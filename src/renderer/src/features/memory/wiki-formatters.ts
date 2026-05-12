import type { WikiSearchResult } from './wiki-state';

export function formatWikiCategoryLabel(category: WikiSearchResult['category']): string {
  if (category === 'source') {
    return 'fonte';
  }

  if (category === 'index') {
    return 'indice';
  }

  return 'wiki';
}

export function formatWikiResultTitle(result: Pick<WikiSearchResult, 'path' | 'title'>): string {
  if (result.path === 'sources/cards/plot.md') {
    return 'Trame';
  }

  if (result.path === 'sources/cards/characters.md') {
    return 'Personaggi';
  }

  if (result.path === 'sources/cards/locations.md') {
    return 'Location';
  }

  return result.title.replace(/\s+Sources$/i, '');
}
