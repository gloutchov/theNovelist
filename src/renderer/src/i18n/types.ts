export type AppLanguage = 'it' | 'en';

export type TranslationKey = string;

export type TranslationDictionary = Record<string, string>;

export type TranslationParams = Record<string, string | number>;

export type Translate = (key: TranslationKey, params?: TranslationParams) => string;
