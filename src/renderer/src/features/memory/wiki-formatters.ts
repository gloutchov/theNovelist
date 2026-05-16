import type { WikiSearchResult } from './wiki-state';
import type { Translate } from '../../i18n';

export function formatWikiCategoryLabel(
  category: WikiSearchResult['category'],
  t: Translate,
): string {
  if (category === 'source') {
    return t('memory.category.source');
  }

  if (category === 'index') {
    return t('memory.category.index');
  }

  return t('memory.category.wiki');
}

export function formatWikiResultTitle(
  result: Pick<WikiSearchResult, 'path' | 'title'>,
  t: Translate,
): string {
  if (result.path === 'sources/cards/plot.md') {
    return t('memory.wiki.cardsPlots');
  }

  if (result.path === 'sources/cards/characters.md') {
    return t('memory.wiki.cardsCharacters');
  }

  if (result.path === 'sources/cards/locations.md') {
    return t('memory.wiki.cardsLocations');
  }

  return result.title.replace(/\s+Sources$/i, '');
}
