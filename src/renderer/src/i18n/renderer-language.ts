import type { AppLanguage } from './types';

export function resolveRendererLanguage(
  preferences?: { effectiveLanguage?: AppLanguage } | null,
): AppLanguage {
  return (
    preferences?.effectiveLanguage ??
    (navigator.language.toLowerCase().startsWith('it') ? 'it' : 'en')
  );
}
