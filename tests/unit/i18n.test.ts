import { describe, expect, it } from 'vitest';
import {
  dictionaries,
  interpolateTranslation,
  type AppLanguage,
  type TranslationKey,
} from '../../src/renderer/src/i18n';

describe('renderer i18n dictionaries', () => {
  it('keeps Italian and English dictionaries aligned', () => {
    const languages = Object.keys(dictionaries) as AppLanguage[];
    const canonicalKeys = Object.keys(dictionaries.it).sort();

    for (const language of languages) {
      expect(Object.keys(dictionaries[language]).sort()).toEqual(canonicalKeys);
    }
  });

  it('contains a non-empty translation for every key', () => {
    for (const dictionary of Object.values(dictionaries)) {
      for (const key of Object.keys(dictionaries.it) as TranslationKey[]) {
        expect(dictionary[key].trim(), key).not.toBe('');
      }
    }
  });

  it('interpolates named translation parameters', () => {
    expect(interpolateTranslation('Lingua effettiva: {language}.', { language: 'Italiano' })).toBe(
      'Lingua effettiva: Italiano.',
    );
  });
});
