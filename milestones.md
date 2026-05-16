# The Novelist 5.0 - Milestones

Obiettivo: rendere The Novelist bilingue italiano/inglese, con lingua automatica basata sul sistema e scelta manuale nelle Impostazioni.

## Principi

- Italiano se la lingua di sistema inizia con `it`, inglese in tutti gli altri casi.
- Preferenza utente: `Automatico`, `Italiano`, `English`.
- La scelta manuale prevale sempre sulla lingua di sistema.
- I contenuti dei progetti non vengono tradotti automaticamente.
- I prompt AI devono seguire la lingua dell'interfaccia solo per istruzioni, messaggi e risposte operative; testo narrativo e memoria progetto restano nella lingua originale dell'utente.
- La migrazione deve essere incrementale, con test a ogni blocco.

## Milestone 1 - Fondazione preferenze lingua

- Aggiungere `languageMode: auto | it | en` alle preferenze utente.
- Calcolare `effectiveLanguage: it | en` da `app.getLocale()` quando `languageMode` e `auto`.
- Esporre la preferenza via IPC/preload.
- Aggiungere il selettore in Impostazioni: `Automatico / Italiano / English`.
- Mantenere italiano come lingua effettiva su sistemi `it-*`, inglese altrove.
- Verificare typecheck e test mirati.

Stato: completata in questo branch.

## Milestone 2 - Infrastruttura i18n renderer

- Creare un modulo i18n renderer senza dipendenze pesanti.
- Struttura proposta:
  - `src/renderer/src/i18n/types.ts`
  - `src/renderer/src/i18n/it.ts`
  - `src/renderer/src/i18n/en.ts`
  - `src/renderer/src/i18n/i18n-provider.tsx`
  - `src/renderer/src/i18n/use-translation.ts`
- Definire helper `t(key, params?)`.
- Definire fallback rigoroso: se manca una chiave in inglese, fallire nei test o almeno segnalarla.
- Evitare ternari sparsi nei componenti.

Stato: completata in questo branch.

## Milestone 3 - Migrazione shell e Impostazioni

- Tradurre navigazione principale, sidebar, dashboard e stati vuoti.
- Tradurre Impostazioni, preferenze utente, consensi e impostazioni AI.
- Rimuovere testi duplicati e centralizzare label comuni:
  - Salva / Save
  - Annulla / Cancel
  - Crea / Create
  - Elimina / Delete
  - Modifica / Edit
  - Errore sconosciuto / Unknown error
- Aggiornare i test e2e che selezionano elementi tramite testo italiano.

Stato: completata in questo branch.

## Milestone 4 - Editor e workflow narrativo

- Tradurre editor capitolo, modali blocchi, conferme chiusura e messaggi autosave.
- Tradurre board trame, scene, timeline e revisioni.
- Gestire label dinamiche come `Trama 1`, `Capitolo`, `Scena`.
- Verificare che export, stampa e lettura documento non traducano i contenuti utente.

Stato: completata in questo branch.

## Milestone 5 - Schede e memoria progetto

- Tradurre Personaggi, Location, pannelli collegamenti e modali di creazione da selezione editor.
- Tradurre vista Memoria, ricerca wiki, risultati, fonti e stati sync.
- Tradurre messaggi di errore e status collegati alla wiki locale.
- Verificare che la memoria progetto resti nella lingua originale delle fonti.

Stato: completata in questo branch.

## Milestone 6 - Main process, dialoghi ed export

- Tradurre dialoghi Electron nel main process:
  - uscita app con salvataggi pendenti;
  - errori stampa;
  - messaggi export documento.
- Valutare se localizzare metadati e intestazioni generate negli export.
- Tradurre errori IPC user-facing senza cambiare errori tecnici utili al debug.

Stato: completata in questo branch.

## Milestone 7 - AI e prompt

- Rendere i prompt di sistema dipendenti da `effectiveLanguage`.
- In italiano: mantenere comportamento attuale.
- In inglese: chiedere risposte operative in inglese.
- Non tradurre automaticamente capitoli, sinossi, schede, memoria o testo selezionato.
- Aggiornare status e fallback AI.
- Verificare OpenAI API e Ollama.

## Milestone 8 - Test e qualita release

- Aggiungere test unitari per:
  - risoluzione lingua automatica;
  - completezza dizionari `it`/`en`;
  - interpolazione parametri i18n.
- Aggiornare e2e browser per lingua italiana.
- Aggiungere almeno uno smoke e2e in inglese.
- Eseguire:
  - `npm run typecheck`
  - `npm run test`
  - `npm run test:e2e`
  - `npm run test:e2e:electron`
  - `npm run pack`

## Milestone 9 - Rifinitura 5.0

- Revisione copy inglese con terminologia coerente:
  - Plot, Chapter, Scene, Character, Location, Memory, Revisions.
- Controllo overflow su desktop e mobile per stringhe inglesi piu lunghe.
- Aggiornare README e note release.
- Preparare build macOS e Windows.

## Fuori scope per 5.0

- Traduzione automatica dei progetti.
- Traduzione dei file wiki gia generati.
- Supporto a piu lingue oltre italiano e inglese.
