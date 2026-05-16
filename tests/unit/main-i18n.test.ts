import { afterEach, describe, expect, it } from 'vitest';
import { setMainLanguage, translateMain } from '../../src/main/i18n';

describe('main process i18n', () => {
  afterEach(() => {
    setMainLanguage('en');
  });

  it('translates Electron dialog copy with interpolation', () => {
    setMainLanguage('it');
    expect(translateMain('dialog.unsaved.title')).toBe('Modifiche non salvate');
    expect(translateMain('error.print', { error: 'printer offline' })).toBe(
      'Errore stampa: printer offline',
    );

    setMainLanguage('en');
    expect(translateMain('dialog.unsaved.title')).toBe('Unsaved Changes');
    expect(translateMain('error.print', { error: 'printer offline' })).toBe(
      'Print error: printer offline',
    );
  });
});
