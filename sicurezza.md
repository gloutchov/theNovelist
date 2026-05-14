# Sicurezza - The Novelist

Stato documentato al **12 maggio 2026**.

Questo documento riepiloga le misure di sicurezza implementate in The Novelist e i limiti residui noti. L'applicazione e una app desktop locale: non ha un backend proprietario remoto, ma puo comunicare con provider AI esterni se l'utente li abilita.

## 1. Modello operativo

- Applicazione desktop Electron con processi separati `main`, `preload` e `renderer`.
- Ogni progetto narrativo vive in una cartella locale con:
  - `project.db`: database SQLite principale;
  - `assets/`: immagini, export e allegati;
  - `.snapshots/`: snapshot DB per recovery;
  - `wiki/`: memoria Markdown locale derivata dal database.
- Dalla release 4.x il database include anche scene, timeline, revisioni delle entita, obiettivi di scrittura e sessioni di scrittura.
- Provider AI supportati:
  - `OpenAI API`;
  - `Ollama`.
- `project.db` resta la fonte di verita. La wiki e un artefatto derivato, app-managed e rigenerabile.

## 2. Isolamento Electron

- Il renderer gira con `sandbox: true`.
- `contextIsolation: true`.
- `nodeIntegration: false`.
- Il renderer non riceve accesso diretto a Node.js, filesystem o IPC grezzo.
- Le API privilegiate sono esposte solo tramite `window.novelistApi` nel preload.
- Navigazioni inattese e popup sono bloccati nel main process.
- La finestra di stampa usa HTML separato e CSP dedicata.

Riferimenti:

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`
- `src/main/chapters/exporters.ts`

## 3. Content Security Policy

- Il renderer principale usa una CSP esplicita in `src/renderer/index.html`.
- La policy limita gli script a `self`.
- `object-src` e bloccato.
- `connect-src` e limitato a `self` e agli endpoint necessari in sviluppo.
- Le viste di stampa non eseguono script e limitano le risorse a contenuto locale o data URL dove necessario.

Limite noto: la CSP del renderer e impostata via `meta`; direttive come `frame-ancestors` richiederebbero header HTTP se in futuro si introducesse una delivery HTTP.

## 4. IPC validato

- Ogni canale IPC passa da handler espliciti.
- I payload in ingresso e in uscita sono validati con `zod`.
- I canali sono centralizzati in `src/shared/ipc-channels.ts`.
- Il preload espone funzioni specifiche, non `ipcRenderer` generico.

Riferimenti:

- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`

## 5. Appartenenza al progetto

- Le operazioni su nodi, scene, timeline, revisioni, connessioni, personaggi, location, link e immagini verificano che gli ID appartengano al progetto aperto.
- Questo evita collegamenti o manipolazioni tra progetti diversi.
- Le immagini lette dal renderer devono appartenere agli asset del progetto aperto.
- Il ripristino di una revisione accetta solo snapshot appartenenti al progetto aperto e crea una revisione dello stato corrente prima di sovrascrivere l'entita.

Riferimento:

- `src/main/ipc.ts`

## 6. Persistenza e database

- SQLite e accessibile solo dal main process.
- Il repository usa statement preparati, evitando concatenazione SQL con input utente.
- `foreign_keys = ON`.
- Migrations versionate in `src/main/persistence/migrations.ts`.
- Vincoli `UNIQUE`, `CHECK` e `ON DELETE CASCADE` mantengono coerenza relazionale.
- Le tabelle introdotte per scene, timeline, revisioni e sessioni di scrittura sono legate al progetto tramite `project_id` e usano chiavi esterne o controlli applicativi di appartenenza.

Riferimenti:

- `src/main/persistence/database.ts`
- `src/main/persistence/repository.ts`
- `src/main/persistence/migrations.ts`

## 7. Gestione API key

- La API key non viene mai restituita in chiaro al renderer: le risposte IPC espongono `apiKey: null`.
- Quando disponibile, Electron `safeStorage` cifra la chiave in un file sotto `app.getPath('userData')`.
- Se `safeStorage` non e disponibile, il salvataggio di nuove chiavi viene rifiutato con errore esplicito.
- E supportato l'uso di `OPENAI_API_KEY` come variabile ambiente runtime.
- E supportata la cancellazione della chiave salvata.
- Le vecchie chiavi legacy nel database possono essere migrate verso storage sicuro quando disponibile.

Riferimenti:

- `src/main/security/secure-settings.ts`
- `src/main/ipc.ts`

## 8. Consensi AI

- Le funzioni AI testuali richiedono consenso generale `enabled`.
- Le chiamate API esterne richiedono `allowApiCalls`.
- La generazione immagini in-app richiede:
  - consenso AI attivo;
  - provider `openai_api`;
  - chiamate API esterne abilitate;
  - API key disponibile.
- La memoria progetto viene allegata alla chat solo se:
  - il consenso AI generale e attivo;
  - e, se provider o fallback possono uscire dal computer, `allowExternalMemorySharing` e attivo.
- Se `allowExternalMemorySharing` e disattivato, la chat puo continuare a funzionare, ma senza allegare la wiki a provider esterni.
- Il consenso memoria esterna e salvato per progetto ed e default-on per mantenere il comportamento precedente.

Riferimenti:

- `src/main/persistence/migrations.ts`
- `src/main/persistence/repository.ts`
- `src/main/ipc.ts`
- `src/preload/index.ts`
- `src/renderer/src/App.tsx`

## 9. Memoria progetto e wiki locale

- Ogni progetto puo avere una directory `wiki/` locale.
- La wiki e derivata da `project.db`: non sostituisce il database e non diventa fonte autoritativa.
- Le fonti deterministic-first vengono esportate in `wiki/sources/`.
- Le fonti includono anche scene e timeline (`sources/cards/scenes.md` e `sources/cards/timeline.md`), oltre a capitoli, trame, personaggi, location e chat AI.
- La ricerca locale nella tab `Memoria` legge Markdown locali e non richiede provider esterni.
- Le pagine app-managed (`AGENTS.md`, `index.md`, `log.md` e `sources/`) possono essere riscritte o aggiornate dal sync.
- Le modifiche manuali alla wiki non sono considerate fonte di verita e possono essere sovrascritte.
- Le scritture generated sono atomiche: file temporaneo nella stessa directory e `rename` finale.
- I file temporanei lasciati da sync interrotti vengono ripuliti al bootstrap della wiki.
- I path wiki controllati devono restare dentro la directory `wiki/`; traversal, path assoluti e segmenti `..` sono rifiutati.
- Il sync alla chiusura progetto ha timeout breve, circa 12 secondi. Se non termina, la chiusura prosegue e la wiki resta recuperabile alla riapertura.
- La AI non scrive file della wiki. La wiki viene mantenuta dall'app con export e sync deterministici.

Riferimenti:

- `src/main/wiki/`
- `src/main/projects/session.ts`
- `tests/unit/project-wiki.test.ts`
- `tests/unit/wiki-path-safety.test.ts`
- `tests/unit/wiki-search.test.ts`
- `tests/unit/wiki-chat-context.test.ts`

## 10. AI runtime, timeout e cancellazione

- Le richieste AI passano dal main process.
- Le chiamate OpenAI API e Ollama usano timeout configurabile tramite `NOVELIST_CODEX_TIMEOUT_MS`.
- E disponibile cancellazione della richiesta AI attiva.
- Provider fallback configurabile, incluso `none`.
- In caso di errore AI, i flussi principali di scrittura non devono dipendere dalla riuscita della wiki o del provider.

Riferimento:

- `src/main/codex/client.ts`
- `src/main/ipc.ts`

## 11. Immagini e file progetto

- Le immagini associate vengono copiate in `assets/img/...`.
- Le immagini generate vengono salvate in `assets/generated-images/...`.
- La lettura immagini verso renderer e limitata a raster interni ad `assets/` del progetto aperto.
- L'import di immagini associate e validato lato main process prima della copia:
  - sono accettate solo estensioni raster previste (`png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`);
  - i primi byte del file devono corrispondere alla signature/magic number del formato dichiarato;
  - file con estensione non supportata, estensione falsa o contenuto non immagine vengono rifiutati con errore esplicito.
- La lettura immagini verso renderer resta limitata a raster interni ad `assets/` del progetto aperto.
- Le immagini generate derivano da byte prodotti o scaricati dal provider immagini e sono salvate con estensione controllata.

Riferimenti:

- `src/main/images/generation.ts`
- `src/main/ipc.ts`
- `src/main/projects/asset-paths.ts`

## 12. Menzioni, export e privacy editoriale

- Le menzioni `@personaggio`, `@location` e `#scena` usano identificatori strutturati.
- In lettura/salvataggio il main process normalizza riferimenti e label verso entita canoniche.
- Menzioni malformate o riferite a entita non piu esistenti vengono scartate.
- Le menzioni non vengono incluse in:
  - conteggio parole;
  - export DOCX;
  - stampa HTML.
- Questo evita leakage di metadati interni nel manoscritto esportato.
- Le scene possono essere sincronizzate dal contenuto del capitolo, ma `project.db` resta la fonte autoritativa e le entita richiamate sono normalizzate dal main process.

Riferimenti:

- `src/main/chapters/rich-text.ts`
- `src/main/chapters/exporters.ts`
- `src/main/ipc.ts`
- `src/renderer/src/ChapterEditor.tsx`

## 13. Snapshot e recovery

- Snapshot manuali e autosave del database.
- Recovery dell'ultimo snapshot disponibile.
- Revisioni applicative per capitoli, scene, personaggi e location, con snapshot JSON e testo indicizzato per consultazione/ripristino.
- Packaging e test ricostruiscono `better-sqlite3` per il runtime corretto, riducendo mismatch ABI tra Node locale ed Electron.

Riferimenti:

- `src/main/projects/snapshots.ts`
- `src/main/projects/session.ts`
- `scripts/rebuild-node-native.mjs`
- `scripts/rebuild-electron-native.mjs`
- `scripts/run-electron-package.mjs`

## 14. Superfici esterne

Endpoint possibili:

- OpenAI Responses API: `https://api.openai.com/v1/responses`
- OpenAI Images API: `https://api.openai.com/v1/images/generations`
- Ollama: `${OLLAMA_HOST}/api/*`, default `http://127.0.0.1:11434`

Variabili ambiente rilevanti:

- `OPENAI_API_KEY`
- `NOVELIST_CODEX_TIMEOUT_MS`
- `NOVELIST_IMAGE_MODEL`
- `NOVELIST_ENABLE_DEVTOOLS`
- `OLLAMA_HOST`

## 15. Limiti residui noti

1. Le build locali non sono firmate o notarizzate.
2. `project.db` non e cifrato a riposo.
3. La wiki e leggibile su disco per scelta progettuale; privacy e demandata alla sicurezza del filesystem/profilo utente.
4. L'app e single-user locale e non implementa autenticazione o ruoli.
5. Provider esterni possono ricevere testo del progetto solo con consenso, ma la garanzia finale dipende anche dalla configurazione utente e dal provider scelto.
6. Ollama puo puntare a host non locali tramite `OLLAMA_HOST`; in quel caso il traffico non e necessariamente locale.
7. Le release non firmate possono generare warning di sistema operativo e non offrono garanzia forte di provenienza.

## 16. Verifiche consigliate prima di release

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run test:e2e:electron`
- `npm run test:smoke:electron`
- `npm run pack`
- `npm run release:checksums`

Per modifiche UI o Electron reali, verificare anche visivamente l'app pacchettizzata o l'ambiente Electron reale.

## 17. File principali da controllare

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`
- `src/main/ipc.ts`
- `src/main/security/secure-settings.ts`
- `src/main/codex/client.ts`
- `src/main/wiki/`
- `src/main/images/generation.ts`
- `src/main/persistence/`
- `src/main/projects/session.ts`
