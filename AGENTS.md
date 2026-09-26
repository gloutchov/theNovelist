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

## Regole del progetto

- Leggi `AGENTS.md`, `STARTUP_PREFERENCES.md`, `PLAN.md` e, per le aree pertinenti, `SECURITY_MODEL.md` prima di avviare una milestone.
- `STARTUP_PREFERENCES.md` e un file di regole applicabile allo sviluppo di questa app. Adattane le direttive generali all'architettura esistente; le eccezioni specifiche documentate qui prevalgono solo dove i due file differiscono.
- Il nome della mappa del repository resta `MAPS.md` al posto del generico `MAP.md` indicato nelle preferenze.
- La Wiki attuale e derivata dal database e dalle fonti del progetto. Le direttive sulla Wiki mantenuta da LLM valgono solo per un'eventuale funzionalita futura, dopo decisione progettuale, consenso e aggiornamento del modello di sicurezza.
- Le istruzioni esplicite dell'utente per il task corrente prevalgono sulle regole operative dei file.

## Regole operative

- Prima di modificare, controlla lo stato del worktree con `git status --short`.
- Prima di commit, push, PR, tag, release o workflow manuali verifica identita Git, remote e account GitHub autenticato; la predefinita e `Gloutchov <gloutchov@gmail.com>` sull'account privato `gloutchov`. Se l'identita non e verificabile o non coincide, fermati prima dell'operazione e chiedi indicazioni.
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
- Centralizza default, modelli, timeout, limiti e policy configurabili in `src/main/config/app-config.ts` o nella configurazione persistita appropriata; valida i valori ai confini IPC, filesystem e rete.
- Mantieni segreti e operazioni privilegiate nel main process, usando lo storage protetto gia previsto. Il renderer non deve ricevere API key o accesso diretto al filesystem privilegiato.

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

Per la dettatura, tratta l'audio come contenuto sensibile: microfono solo su richiesta, consenso dedicato prima dell'invio remoto, limiti di durata e dimensione, cancellazione effettiva e nessun audio o trascrizione nei log. Il fallback locale non puo attivare un invio remoto senza consenso. Ollama e il fallback attuale per l'assistenza testuale; non va considerato automaticamente un motore di trascrizione. Mantieni separate le impostazioni della dettatura da quelle dei provider testuali e delle immagini.
Il motore `whisper-cli` locale e un eseguibile esterno scelto dall'utente: non avviarlo all'apertura di un progetto e non includere audio, modelli o binari nei commit. Il modello tiny si installa opzionalmente tramite `scripts/install-whisper-model.mjs` con checksum verificato. Quando tocchi questo percorso, prova cancellazione, pulizia dei WAV temporanei e assenza di chiamate OpenAI nella modalita solo locale.

## Documentazione

- `README.md`: pagina principale GitHub bilingue, con riepilogo prodotto, distribuzione, sviluppo e release corrente.
- `ISTRUZIONI.md`: manuale utente completo in italiano.
- `INSTRUCTIONS.md`: traduzione inglese completa del manuale.
- `SECURITY_MODEL.md`: modello di sicurezza bilingue e limiti residui.
- `MAPS.md`: mappa bilingue della struttura del repository.
- `STARTUP_PREFERENCES.md`: regole generali del progettista applicate a questa app.
- `PLAN.md`: milestone ordinate, branch, versioni, criteri di accettazione e stato.
- `AGENTS.md`: queste istruzioni operative.
- Mantieni sempre aggiornati questi file quando cambi comportamento utente, struttura del repository, sicurezza, release, packaging, i18n, test o workflow operativi.
- Non ricreare `RELEASE_NOTES.md`: le note sintetiche della release corrente sono integrate nel README.

## Packaging

Comandi disponibili:

```powershell
npm run pack
npm run dist:win
npm run dist:mac
```

Le build non sono firmate. Su Windows `signAndEditExecutable` e disabilitato.

## Milestone e branch

- Registra in `PLAN.md` le milestone esecutive come `M1`, `M2`, ecc. e svolgile in ordine. Rinomina una milestone completata `C1`, `C2`, ecc. solo dopo la checklist di chiusura; usa `P1`, `P2`, ecc. per idee future non eseguibili senza una decisione esplicita del progettista.
- Ogni milestone usa un branch dedicato `milestone/<versione>-<slug>` creato da `main` aggiornato. Una patch autonoma usa `patch/<versione>-<slug>`.
- Per ogni milestone definisci in anticipo incremento SemVer, versione sorgente e tag previsto `vX.Y.Z`. Usa `+0.0.1` per patch circoscritte, `+0.1.0` per funzionalita minori e `+1.0.0` per cambi maggiori. Quando cambi versione, allinea `package.json`, `package-lock.json`, README, mappa, piano e ogni altro riferimento canonico.
- Al termine di **ogni** milestone, fermati prima di commit, merge, creazione del tag, push e rimozione del branch. Presenta diff, test, documentazione, versione/tag previsti e impatto CI; attendi l'avallo esplicito del progettista per procedere. Non anticipare queste operazioni in base a un'approvazione generica del piano.
- Non spostare tag pubblicati e non eliminare un branch prima di merge e verifiche previsti, salvo richiesta esplicita del progettista.

## CI e budget GitHub

- Esegui prima in locale test, lint, typecheck, build e controlli di sicurezza pertinenti. Raggruppa le modifiche in push revisionabili ed evita run intermedi, manuali o ripetuti senza una verifica necessaria.
- Usa CI multipiattaforma e packaging quando il rischio della milestone lo richiede; non ridurre le verifiche necessarie per microfono, moduli nativi, IPC o distribuzione. Dopo un push approvato che avvia CI necessaria, controllane l'esito.
- Il workflow `Release` parte solo su `workflow_dispatch` con un tag esplicito: il push di un tag `v*` non avvia build o pubblicazione. Avvialo solo dopo l'avallo previsto e quando serve una release scaricabile.

## Rilascio

- Versione sorgente, tag e GitHub Release sono passaggi distinti. Prevedi il tag per ogni milestone, ma esegui commit, merge, tag e push solo dopo l'avallo richiesto sopra e dopo aver verificato che il tag non esista gia in locale o sul remoto.
- Pubblica una GitHub Release per una versione funzionale quando serve distribuire la nuova funzione o una correzione di sicurezza grave. Per patch minori o documentali chiedi se pubblicarla. Verifica artifact macOS/Windows applicabili, checksum SHA-256 e limiti delle build non firmate.

## Checklist prima di chiudere un task

- `npm run typecheck`
- Test mirati legati alla modifica.
- `npm run lint` e `npm run build` quando pertinenti al cambiamento.
- `npm run test:e2e` se tocchi renderer, layout, editor, canvas o workflow browser.
- `npm run test:e2e:electron` se tocchi IPC, main process, persistenza, packaging runtime, native modules o wrapper Electron.
- Verifica e aggiorna `README.md`, `ISTRUZIONI.md`, `INSTRUCTIONS.md`, `SECURITY_MODEL.md`, `MAPS.md`, `PLAN.md`, `STARTUP_PREFERENCES.md` e `AGENTS.md` quando il task cambia contenuti che li riguardano.
- Se il task chiude una milestone, presenta la verifica e fermati prima delle operazioni Git indicate sopra.
- Riporta sempre eventuali test non eseguiti e il motivo.
