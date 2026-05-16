import { describe, expect, it } from 'vitest';
import { resolveEffectiveLanguage } from '../../src/main/app-preferences';

describe('app preferences language resolution', () => {
  it('uses Italian automatically for Italian system locales', () => {
    expect(resolveEffectiveLanguage('auto', 'it')).toBe('it');
    expect(resolveEffectiveLanguage('auto', 'it-IT')).toBe('it');
    expect(resolveEffectiveLanguage('auto', 'it-CH')).toBe('it');
  });

  it('uses English automatically for non-Italian system locales', () => {
    expect(resolveEffectiveLanguage('auto', 'en-US')).toBe('en');
    expect(resolveEffectiveLanguage('auto', 'fr-FR')).toBe('en');
    expect(resolveEffectiveLanguage('auto', 'de-DE')).toBe('en');
  });

  it('lets manual language choices override the system locale', () => {
    expect(resolveEffectiveLanguage('it', 'en-US')).toBe('it');
    expect(resolveEffectiveLanguage('en', 'it-IT')).toBe('en');
  });
});
