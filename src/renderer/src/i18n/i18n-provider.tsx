import { createContext, useContext, useMemo, type PropsWithChildren } from 'react';
import { dictionaries, interpolateTranslation } from './dictionaries';
import type { AppLanguage, Translate, TranslationKey } from './types';

interface I18nContextValue {
  language: AppLanguage;
  t: Translate;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function createTranslator(language: AppLanguage): Translate {
  const dictionary = dictionaries[language];
  const fallbackDictionary = dictionaries.it;

  return (key: TranslationKey, params) =>
    interpolateTranslation(dictionary[key] ?? fallbackDictionary[key] ?? key, params);
}

export function I18nProvider({ children, language }: PropsWithChildren<{ language: AppLanguage }>) {
  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      t: createTranslator(language),
    }),
    [language],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useTranslation(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useTranslation must be used inside I18nProvider');
  }

  return context;
}
