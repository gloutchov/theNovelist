import type { AppPreferencesRecord } from './app-preferences';

export type MainLanguage = AppPreferencesRecord['effectiveLanguage'];
export type MainTranslationKey = keyof (typeof mainDictionaries)['it'];

const mainDictionaries = {
  it: {
    'about.title': 'Info',
    'about.version': 'Versione {version}',
    'dialog.directory.button': 'Seleziona',
    'dialog.directory.title': 'Seleziona cartella progetto',
    'dialog.export.chapterDocx.title': 'Esporta capitolo DOCX',
    'dialog.export.manuscriptDocx.title': 'Esporta documento completo DOCX',
    'dialog.export.manuscriptEpub.title': 'Esporta documento completo ePUB',
    'dialog.export.save': 'Esporta',
    'dialog.filter.images': 'Immagini',
    'dialog.filter.wordDocument': 'Documento Word',
    'dialog.imageFile.button': 'Apri',
    'dialog.imageFile.title': 'Seleziona immagine',
    'dialog.unsaved.buttons.cancel': 'Annulla',
    'dialog.unsaved.buttons.exit': 'Esci',
    'dialog.unsaved.detail': 'Se chiudi ora, le modifiche locali ancora in bozza andranno perse.',
    'dialog.unsaved.message': 'Sono presenti modifiche non ancora persistite.',
    'dialog.unsaved.title': 'Modifiche non salvate',
    'error.manuscriptExport.empty':
      'Nessun blocco disponibile per esportare il documento completo.',
    'error.manuscriptPrint.empty':
      'Nessun blocco disponibile per la stampa del documento completo.',
    'error.print': 'Errore stampa: {error}',
  },
  en: {
    'about.title': 'About',
    'about.version': 'Version {version}',
    'dialog.directory.button': 'Select',
    'dialog.directory.title': 'Select project folder',
    'dialog.export.chapterDocx.title': 'Export chapter DOCX',
    'dialog.export.manuscriptDocx.title': 'Export full document DOCX',
    'dialog.export.manuscriptEpub.title': 'Export full document ePUB',
    'dialog.export.save': 'Export',
    'dialog.filter.images': 'Images',
    'dialog.filter.wordDocument': 'Word Document',
    'dialog.imageFile.button': 'Open',
    'dialog.imageFile.title': 'Select image',
    'dialog.unsaved.buttons.cancel': 'Cancel',
    'dialog.unsaved.buttons.exit': 'Exit',
    'dialog.unsaved.detail': 'If you close now, local draft changes will be lost.',
    'dialog.unsaved.message': 'There are changes that have not been persisted yet.',
    'dialog.unsaved.title': 'Unsaved Changes',
    'error.manuscriptExport.empty': 'No blocks available to export the full document.',
    'error.manuscriptPrint.empty': 'No blocks available to print the full document.',
    'error.print': 'Print error: {error}',
  },
} as const;

let currentMainLanguage: MainLanguage = 'en';

export function getMainLanguage(): MainLanguage {
  return currentMainLanguage;
}

export function setMainLanguage(language: MainLanguage): void {
  currentMainLanguage = language;
}

export function translateMain(
  key: MainTranslationKey,
  params: Record<string, string | number> = {},
  language = currentMainLanguage,
): string {
  const template: string = mainDictionaries[language][key] ?? mainDictionaries.it[key] ?? key;
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    template,
  );
}
