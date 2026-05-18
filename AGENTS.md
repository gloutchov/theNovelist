# AGENTS.md

Istruzioni per agenti che lavorano su questo repository.

## Progetto

The Novelist e una app desktop Electron + React + TypeScript per la scrittura narrativa. Usa:

- `electron-vite` per build/dev.
- React 19 nel renderer.
- `@xyflow/react` per canvas a nodi.
- TipTap per editor rich text.
- `better-sqlite3` per persistenza locale.
- Playwright per e2e browser ed Electron.
- Vitest per test unitari.

## Regole operative

- Prima di modificare, controlla lo stato del worktree con `git status --short`.
- Non revertire modifiche non tue. Il repo puo essere sporco per lavoro utente in corso.
- Mantieni gli interventi piccoli e coerenti con i pattern esistenti.
- Usa `apply_patch` per edit manuali.
- Non introdurre dipendenze senza una ragione concreta.
- Evita refactor non richiesti, soprattutto nei file grandi come `src/renderer/src/App.tsx` e `src/renderer/src/ChapterEditor.tsx`.
- Quando tocchi UI, verifica anche layout mobile/desktop se il cambiamento puo alterare overflow o modali.
- Aggiorna la documentazione collegata quando cambi comportamento utente, sicurezza, packaging, i18n o struttura del repository.

## Architettura e manutenibilita

- Evita soluzioni monolitiche: nuove funzionalita non devono essere accumulate in file gia grandi se possono essere isolate in moduli, componenti, hook o helper dedicati.
- Mantieni i file leggibili e di dimensioni ragionevoli. Quando una modifica rende un file difficile da seguire, estrai responsabilita coese in file separati.
- Separa logica di dominio, accesso ai dati, stato UI e presentazione quando la separazione riduce complessita o duplicazione.
- Non creare astrazioni premature: estrai solo quando migliora concretamente manutenzione, testabilita o chiarezza del codice.

## Comandi principali

```powershell
npm run typecheck
npm run test
npm run test:e2e
npm run test:e2e:electron
npm run build
```

Playwright usa browser locali nel repo:

```powershell
npm run test:e2e:install
```

## Note importanti su native modules

`better-sqlite3` viene rebuildato per target diversi:

- `npm run rebuild:electron-native` prepara i moduli per Electron.
- `npm run rebuild:node-native` ripristina i moduli per Node/Vitest.
- `npm run test:e2e:electron` deve fare entrambi: Electron prima dei test, Node nel finally.

Dopo test Electron o packaging, se devi eseguire unit test o tool Node, assicurati che sia stato eseguito `npm run rebuild:node-native`.

## Test e2e

Suite browser:

```powershell
npm run test:e2e
```

Questa suite:

- esegue `npm run build`;
- avvia `scripts/serve-static.mjs out/renderer 4173`;
- esclude test Electron e performance via `playwright.config.ts`.

Suite Electron:

```powershell
npm run test:e2e:electron
```

Questa suite:

- usa `scripts/run-electron-e2e.mjs`;
- fa rebuild native per Electron;
- esegue build;
- lancia Playwright con `playwright.electron.config.ts`;
- ripristina native modules per Node.

Non usare direttamente `npm run test:e2e:electron:run` se non hai gia rebuildato per Electron.

## Convenzioni test

- Per scorciatoie cross-platform usa `ControlOrMeta+A`, non `Meta+A`.
- Nei test React Flow, quando il doppio click reale e flaky, preferisci `dispatchEvent('dblclick')` se il test sta verificando il comportamento del handler, non il gesto fisico.
- Nei test Electron evita dipendenze da CLI esterne come `sqlite3`; preferisci verifiche via IPC/API dell'app o helper interni gia disponibili.
- Per fake provider AI nei test, usa helper IPC/API locali e isola eventuale stato applicativo temporaneo.

## UI e frontend

- L'app deve aprire direttamente l'esperienza, non landing page.
- Usa componenti e stile esistenti: sidebar, panel, modal, canvas, status panel.
- Evita card annidate e decorazioni gratuite.
- Mantieni testi e pulsanti entro i contenitori su desktop e mobile.
- Se modifichi layout o CSS globali, esegui almeno `npm run test:e2e` per i visual smoke.

## i18n e testi utente

- L'interfaccia e bilingue italiano/inglese. Ogni nuovo testo user-facing deve passare dai dizionari renderer `src/renderer/src/i18n/it.ts` e `src/renderer/src/i18n/en.ts`, oppure da `src/main/i18n.ts` per dialoghi main process.
- Non inserire nuove stringhe hardcoded in `setStatus`, `onStatus`, modali, bottoni, label o messaggi di errore se devono essere visibili all'utente.
- Mantieni allineati i dizionari: ogni chiave aggiunta in italiano deve esistere anche in inglese.
- I contenuti dei progetti dell'utente non devono essere tradotti automaticamente: capitoli, scene, trame, schede, wiki e testo selezionato restano nella lingua dell'autore.
- Per prompt e output AI user-facing, rispetta la lingua effettiva dell'interfaccia. I report di analisi non devono includere offerte finali di follow-up del modello.

## AI e privacy

Le funzionalita AI supportano OpenAI API e Ollama. Rispetta le impostazioni di consenso gia presenti:

- `enabled`
- `provider`
- `fallbackProvider`
- `allowApiCalls`
- `allowExternalMemorySharing`

Non inviare contenuti esterni o introdurre nuove chiamate di rete senza passare dalle impostazioni esistenti.

## Documentazione

- `README.md`: pagina principale GitHub bilingue, con riepilogo prodotto, distribuzione, sviluppo e release corrente.
- `ISTRUZIONI.md`: manuale utente completo in italiano.
- `INSTRUCTIONS.md`: traduzione inglese completa del manuale.
- `SECURITY_MODEL.md`: modello di sicurezza bilingue e limiti residui.
- `MAPS.md`: mappa bilingue della struttura del repository.
- `AGENTS.md`: queste istruzioni operative.
- Non ricreare `RELEASE_NOTES.md`: le note sintetiche della release corrente sono integrate nel README.

## Packaging

Comandi disponibili:

```powershell
npm run pack
npm run dist:win
npm run dist:mac
```

Le build non sono firmate. Su Windows `signAndEditExecutable` e disabilitato.

## Checklist prima di chiudere un task

- `npm run typecheck`
- Test mirati legati alla modifica.
- `npm run test:e2e` se tocchi renderer, layout, editor, canvas o workflow browser.
- `npm run test:e2e:electron` se tocchi IPC, main process, persistenza, packaging runtime, native modules o wrapper Electron.
- Riporta sempre eventuali test non eseguiti e il motivo.
