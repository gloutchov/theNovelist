import { en } from './en';
import { it } from './it';
import type { AppLanguage, TranslationDictionary, TranslationParams } from './types';

export const dictionaries: Record<AppLanguage, TranslationDictionary> = {
  it,
  en,
};

export function interpolateTranslation(template: string, params?: TranslationParams): string {
  if (!params) {
    return template;
  }

  return template.replace(/\{(\w+)\}/g, (match, key: string) => {
    const value = params[key];
    return value === undefined ? match : String(value);
  });
}
