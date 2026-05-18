# Sicurezza / Security - The Novelist

Stato documentato al **18 maggio 2026**.

Documented status as of **May 18, 2026**.

---

## Italiano

Questo documento riepiloga le misure di sicurezza implementate in The Novelist e i limiti residui noti. L'applicazione e una app desktop locale: non ha un backend proprietario remoto, ma puo comunicare con provider AI esterni se l'utente li abilita.

### 1. Modello operativo

- App desktop Electron con processi separati `main`, `preload` e `renderer`.
- Ogni progetto vive in una cartella locale con:
  - `project.db`: database SQLite principale;
  - `assets/`: immagini, export e allegati;
  - `.snapshots/`: snapshot DB per recovery;
  - `wiki/`: memoria Markdown locale derivata dal database.
- `project.db` resta la fonte di verita. La wiki e un artefatto derivato, app-managed e rigenerabile.
- Provider AI supportati:
  - `OpenAI API`;
  - `Ollama`.
- L'interfaccia e bilingue italiano/inglese; la localizzazione non traduce automaticamente i contenuti dell'autore.

### 2. Isolamento Electron

- Il renderer gira con `sandbox: true`.
- `contextIsolation: true`.
- `nodeIntegration: false`.
- Il renderer non riceve accesso diretto a Node.js, filesystem o IPC grezzo.
- Le API privilegiate sono esposte solo tramite `window.novelistApi` nel preload.
- Navigazioni inattese e popup sono bloccati nel main process.
- Le finestre di stampa e lettura usano superfici controllate e contenuto generato dall'app.

Riferimenti:

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`
- `src/main/chapters/exporters.ts`

### 3. Content Security Policy

- Il renderer principale usa una CSP esplicita in `src/renderer/index.html`.
- `script-src` e limitato a `self`.
- `object-src` e bloccato.
- `connect-src` e limitato a `self` e agli endpoint locali necessari in sviluppo (`localhost`/`127.0.0.1`).
- `img-src` permette solo sorgenti locali, `data:`, `blob:` e `file:`, coerentemente con la gestione asset locali.
- Le viste di stampa non eseguono script e limitano le risorse a contenuto locale o data URL dove necessario.

Limite noto: la CSP del renderer e impostata via `meta`; direttive come `frame-ancestors` richiederebbero header HTTP se in futuro si introducesse una delivery HTTP.

### 4. IPC validato

- I canali IPC sono centralizzati in `src/shared/ipc-channels.ts`.
- Gli handler sono registrati tramite il layer `src/main/ipc/`.
- I payload in ingresso e in uscita sono validati con `zod`.
- Il preload espone funzioni specifiche, non `ipcRenderer` generico.
- I gruppi di canali IPC sono coperti da test dedicati.

Riferimenti:

- `src/main/ipc/`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`
- `tests/unit/ipc.test.ts`
- `tests/unit/ipc-channel-groups.test.ts`

### 5. Appartenenza al progetto

- Le operazioni su nodi, scene, timeline, revisioni, connessioni, personaggi, location, link e immagini verificano che gli ID appartengano al progetto aperto.
- Questo evita collegamenti o manipolazioni tra progetti diversi.
- Le immagini lette dal renderer devono appartenere agli asset del progetto aperto.
- Il ripristino di una revisione accetta solo snapshot appartenenti al progetto aperto e crea una revisione dello stato corrente prima di sovrascrivere l'entita.

Riferimenti:

- `src/main/services/`
- `src/main/ipc/handlers/`
- `tests/unit/entity-services.test.ts`
- `tests/unit/ipc.test.ts`

### 6. Persistenza e database

- SQLite e accessibile solo dal main process.
- Il repository usa statement preparati, evitando concatenazione SQL con input utente.
- `foreign_keys = ON`.
- Migrazioni versionate in `src/main/persistence/migrations.ts`.
- Vincoli `UNIQUE`, `CHECK` e `ON DELETE CASCADE` mantengono coerenza relazionale.
- Scene, timeline, revisioni, obiettivi, sessioni di scrittura e impostazioni AI sono legati al progetto tramite chiavi esterne o controlli applicativi.

Riferimenti:

- `src/main/persistence/database.ts`
- `src/main/persistence/repository.ts`
- `src/main/persistence/repositories/`
- `src/main/persistence/migrations.ts`
- `tests/unit/migrations.test.ts`
- `tests/unit/repository.test.ts`

### 7. Gestione API key

- La API key non viene mai restituita in chiaro al renderer: le risposte IPC espongono `apiKey: null`.
- Quando disponibile, Electron `safeStorage` cifra la chiave in un file sotto `app.getPath('userData')`.
- Se `safeStorage` non e disponibile, il salvataggio di nuove chiavi viene rifiutato con errore esplicito.
- E supportato l'uso di `OPENAI_API_KEY` come variabile ambiente runtime.
- E supportata la cancellazione della chiave salvata.
- Le vecchie chiavi legacy nel database possono essere migrate verso storage sicuro quando disponibile.

Riferimenti:

- `src/main/security/secure-settings.ts`
- `src/main/services/codex-runtime.ts`
- `src/main/ipc/handlers/codex.ts`

### 8. Consensi AI

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
- Le impostazioni AI sono salvate per progetto. Le preferenze autosave/lingua sono preferenze utente globali.

Riferimenti:

- `src/main/persistence/repositories/codex-repository.ts`
- `src/main/services/codex-runtime.ts`
- `src/main/codex/client.ts`
- `src/renderer/src/features/ai/ai-settings.ts`
- `src/renderer/src/features/settings/app-preferences.ts`

### 9. Memoria progetto e wiki locale

- Ogni progetto puo avere una directory `wiki/` locale.
- La wiki e derivata da `project.db`: non sostituisce il database e non diventa fonte autoritativa.
- Le fonti deterministic-first vengono esportate in `wiki/sources/`.
- Le fonti includono capitoli, scene, timeline, trame, personaggi, location e chat AI.
- La ricerca locale nella tab `Memoria` legge Markdown locali e non richiede provider esterni.
- Le pagine app-managed (`AGENTS.md`, `index.md`, `log.md` e `sources/`) possono essere riscritte o aggiornate dal sync.
- Le modifiche manuali alla wiki non sono considerate fonte di verita e possono essere sovrascritte.
- Le scritture generate sono atomiche: file temporaneo nella stessa directory e `rename` finale.
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

### 10. AI runtime, timeout, cancellazione e output

- Le richieste AI passano dal main process.
- Le chiamate OpenAI API e Ollama usano timeout configurabile tramite `NOVELIST_CODEX_TIMEOUT_MS`.
- E disponibile cancellazione della richiesta AI attiva.
- Provider fallback configurabile, incluso `none`.
- I prompt di analisi e assistenza seguono la lingua effettiva dell'interfaccia.
- I report di analisi rimuovono offerte finali di follow-up del modello, ad esempio frasi del tipo "If you want, I can..." o "Se vuoi, posso...".
- In caso di errore AI, i flussi principali di scrittura non devono dipendere dalla riuscita della wiki o del provider.

Riferimenti:

- `src/main/codex/client.ts`
- `src/main/services/codex-service.ts`
- `src/renderer/src/AnalysisBoard.tsx`
- `tests/unit/analysis-output.test.ts`
- `tests/unit/codex-client.test.ts`

### 11. Immagini e file progetto

- Le immagini associate vengono copiate in `assets/img/...`.
- Le immagini generate vengono salvate in `assets/generated-images/...`.
- La lettura immagini verso renderer e limitata a raster interni ad `assets/` del progetto aperto.
- L'import di immagini associate e validato lato main process prima della copia:
  - sono accettate solo estensioni raster previste (`png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`);
  - i primi byte del file devono corrispondere alla signature/magic number del formato dichiarato;
  - file con estensione non supportata, estensione falsa o contenuto non immagine vengono rifiutati con errore esplicito.
- Le immagini generate derivano da byte prodotti o scaricati dal provider immagini e sono salvate con estensione controllata.

Riferimenti:

- `src/main/images/generation.ts`
- `src/main/projects/asset-paths.ts`
- `src/main/services/image-runtime.ts`
- `tests/unit/image-generation.test.ts`
- `tests/unit/asset-paths.test.ts`

### 12. Menzioni, export e privacy editoriale

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
- `src/main/services/chapter-service.ts`
- `src/renderer/src/ChapterEditor.tsx`
- `tests/unit/rich-text.test.ts`
- `tests/unit/chapter-exporters.test.ts`

### 13. Snapshot, revisioni e recovery

- Snapshot manuali e autosave del database.
- Recovery dell'ultimo snapshot disponibile.
- Revisioni applicative per capitoli, scene, personaggi e location, con snapshot JSON e testo indicizzato per consultazione/ripristino.
- Packaging e test ricostruiscono `better-sqlite3` per il runtime corretto, riducendo mismatch ABI tra Node locale ed Electron.

Riferimenti:

- `src/main/projects/snapshots.ts`
- `src/main/projects/session.ts`
- `src/main/services/revision-service.ts`
- `scripts/rebuild-node-native.mjs`
- `scripts/rebuild-electron-native.mjs`
- `scripts/run-electron-package.mjs`

### 14. Superfici esterne

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

### 15. Limiti residui noti

1. Le build locali non sono firmate o notarizzate.
2. `project.db` non e cifrato a riposo.
3. La wiki e leggibile su disco per scelta progettuale; privacy e demandata alla sicurezza del filesystem/profilo utente.
4. L'app e single-user locale e non implementa autenticazione o ruoli.
5. Provider esterni possono ricevere testo del progetto solo con consenso, ma la garanzia finale dipende anche dalla configurazione utente e dal provider scelto.
6. Ollama puo puntare a host non locali tramite `OLLAMA_HOST`; in quel caso il traffico non e necessariamente locale.
7. Le release non firmate possono generare warning di sistema operativo e non offrono garanzia forte di provenienza.
8. La CSP via `meta` non sostituisce header HTTP completi in eventuali scenari futuri serviti via rete.

### 16. Verifiche consigliate prima di release

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run test:e2e:electron`
- `npm run test:smoke:electron`
- `npm run pack`
- `npm run release:checksums`

Per modifiche UI o Electron reali, verificare anche visivamente l'app pacchettizzata o l'ambiente Electron reale.

---

## English

This document summarizes the security measures implemented in The Novelist and the known residual limits. The application is a local desktop app: it has no proprietary remote backend, but it can communicate with external AI providers if the user enables them.

### 1. Operating Model

- Electron desktop app with separate `main`, `preload`, and `renderer` processes.
- Each project lives in a local folder with:
  - `project.db`: main SQLite database;
  - `assets/`: images, exports, and attachments;
  - `.snapshots/`: database snapshots for recovery;
  - `wiki/`: local Markdown memory derived from the database.
- `project.db` remains the source of truth. The wiki is a derived, app-managed, regenerable artifact.
- Supported AI providers:
  - `OpenAI API`;
  - `Ollama`.
- The interface is bilingual Italian/English; localization does not automatically translate author content.

### 2. Electron Isolation

- The renderer runs with `sandbox: true`.
- `contextIsolation: true`.
- `nodeIntegration: false`.
- The renderer does not receive direct access to Node.js, the filesystem, or raw IPC.
- Privileged APIs are exposed only through `window.novelistApi` in preload.
- Unexpected navigation and popups are blocked in the main process.
- Print and reading windows use controlled surfaces and app-generated content.

References:

- `src/main/index.ts`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`
- `src/main/chapters/exporters.ts`

### 3. Content Security Policy

- The main renderer uses an explicit CSP in `src/renderer/index.html`.
- `script-src` is limited to `self`.
- `object-src` is blocked.
- `connect-src` is limited to `self` and local development endpoints (`localhost`/`127.0.0.1`).
- `img-src` allows local sources, `data:`, `blob:`, and `file:`, matching the local asset model.
- Print views do not execute scripts and limit resources to local content or data URLs where needed.

Known limit: the renderer CSP is set through a `meta` tag; directives such as `frame-ancestors` would require HTTP headers if an HTTP delivery model is introduced in the future.

### 4. Validated IPC

- IPC channels are centralized in `src/shared/ipc-channels.ts`.
- Handlers are registered through the `src/main/ipc/` layer.
- Incoming and outgoing payloads are validated with `zod`.
- Preload exposes specific functions, not generic `ipcRenderer`.
- IPC channel groups are covered by dedicated tests.

References:

- `src/main/ipc/`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`
- `tests/unit/ipc.test.ts`
- `tests/unit/ipc-channel-groups.test.ts`

### 5. Project Ownership

- Operations on nodes, scenes, timeline, revisions, connections, characters, locations, links, and images verify that involved IDs belong to the open project.
- This prevents cross-project links or manipulation.
- Images read by the renderer must belong to assets of the open project.
- Revision restore accepts only snapshots belonging to the open project and creates a revision of the current state before overwriting the entity.

References:

- `src/main/services/`
- `src/main/ipc/handlers/`
- `tests/unit/entity-services.test.ts`
- `tests/unit/ipc.test.ts`

### 6. Persistence and Database

- SQLite is accessible only from the main process.
- Repositories use prepared statements, avoiding SQL string concatenation with user input.
- `foreign_keys = ON`.
- Versioned migrations live in `src/main/persistence/migrations.ts`.
- `UNIQUE`, `CHECK`, and `ON DELETE CASCADE` constraints preserve relational consistency.
- Scenes, timeline, revisions, goals, writing sessions, and AI settings are tied to the project through foreign keys or application-level ownership checks.

References:

- `src/main/persistence/database.ts`
- `src/main/persistence/repository.ts`
- `src/main/persistence/repositories/`
- `src/main/persistence/migrations.ts`
- `tests/unit/migrations.test.ts`
- `tests/unit/repository.test.ts`

### 7. API Key Handling

- The API key is never returned in plaintext to the renderer: IPC responses expose `apiKey: null`.
- When available, Electron `safeStorage` encrypts the key in a file under `app.getPath('userData')`.
- If `safeStorage` is unavailable, saving new keys is rejected with an explicit error.
- `OPENAI_API_KEY` is supported as a runtime environment variable.
- Stored keys can be removed.
- Legacy database keys can be migrated to secure storage when available.

References:

- `src/main/security/secure-settings.ts`
- `src/main/services/codex-runtime.ts`
- `src/main/ipc/handlers/codex.ts`

### 8. AI Consents

- Text AI features require the general `enabled` consent.
- External API calls require `allowApiCalls`.
- In-app image generation requires:
  - enabled AI consent;
  - `openai_api` provider;
  - external API calls enabled;
  - available API key.
- Project memory is attached to chat only if:
  - the general AI consent is enabled;
  - and, when provider or fallback may leave the computer, `allowExternalMemorySharing` is enabled.
- If `allowExternalMemorySharing` is disabled, chat can continue to work, but without attaching the wiki to external providers.
- AI settings are saved per project. Autosave/language preferences are global user preferences.

References:

- `src/main/persistence/repositories/codex-repository.ts`
- `src/main/services/codex-runtime.ts`
- `src/main/codex/client.ts`
- `src/renderer/src/features/ai/ai-settings.ts`
- `src/renderer/src/features/settings/app-preferences.ts`

### 9. Project Memory and Local Wiki

- Each project can have a local `wiki/` directory.
- The wiki is derived from `project.db`: it does not replace the database and does not become authoritative.
- Deterministic-first sources are exported to `wiki/sources/`.
- Sources include chapters, scenes, timeline, plots, characters, locations, and AI chat.
- Local search in the Memory tab reads local Markdown and does not require external providers.
- App-managed pages (`AGENTS.md`, `index.md`, `log.md`, and `sources/`) can be rewritten or updated by sync.
- Manual wiki edits are not treated as the source of truth and can be overwritten.
- Generated writes are atomic: temporary file in the same directory followed by final `rename`.
- Temporary files left by interrupted syncs are cleaned during wiki bootstrap.
- Checked wiki paths must stay inside the `wiki/` directory; traversal, absolute paths, and `..` segments are rejected.
- Project-close sync has a short timeout, around 12 seconds. If it does not finish, closing continues and the wiki remains recoverable on next launch.
- AI does not write wiki files. The app maintains the wiki through deterministic exports and sync.

References:

- `src/main/wiki/`
- `src/main/projects/session.ts`
- `tests/unit/project-wiki.test.ts`
- `tests/unit/wiki-path-safety.test.ts`
- `tests/unit/wiki-search.test.ts`
- `tests/unit/wiki-chat-context.test.ts`

### 10. AI Runtime, Timeout, Cancellation, and Output

- AI requests pass through the main process.
- OpenAI API and Ollama calls use a timeout configurable through `NOVELIST_CODEX_TIMEOUT_MS`.
- Active AI requests can be cancelled.
- Fallback provider is configurable, including `none`.
- Analysis and assistance prompts follow the effective interface language.
- Analysis reports remove final model follow-up offers, such as "If you want, I can..." or "Se vuoi, posso...".
- On AI errors, core writing flows should not depend on the success of the wiki or provider.

References:

- `src/main/codex/client.ts`
- `src/main/services/codex-service.ts`
- `src/renderer/src/AnalysisBoard.tsx`
- `tests/unit/analysis-output.test.ts`
- `tests/unit/codex-client.test.ts`

### 11. Images and Project Files

- Associated images are copied to `assets/img/...`.
- Generated images are saved to `assets/generated-images/...`.
- Image reads toward the renderer are limited to raster files inside the open project's `assets/`.
- Associated image import is validated in the main process before copy:
  - only expected raster extensions are accepted (`png`, `jpg`, `jpeg`, `webp`, `gif`, `bmp`);
  - first bytes must match the signature/magic number of the declared format;
  - unsupported extension, fake extension, or non-image content is rejected with an explicit error.
- Generated images come from bytes produced or downloaded from the image provider and are saved with a controlled extension.

References:

- `src/main/images/generation.ts`
- `src/main/projects/asset-paths.ts`
- `src/main/services/image-runtime.ts`
- `tests/unit/image-generation.test.ts`
- `tests/unit/asset-paths.test.ts`

### 12. Mentions, Export, and Editorial Privacy

- `@character`, `@location`, and `#scene` mentions use structured identifiers.
- On read/save, the main process normalizes references and labels to canonical entities.
- Malformed mentions or mentions pointing to deleted entities are dropped.
- Mentions are not included in:
  - word count;
  - DOCX export;
  - HTML print.
- This avoids leaking internal metadata into exported manuscripts.
- Scenes can be synchronized from chapter content, but `project.db` remains authoritative and referenced entities are normalized by the main process.

References:

- `src/main/chapters/rich-text.ts`
- `src/main/chapters/exporters.ts`
- `src/main/services/chapter-service.ts`
- `src/renderer/src/ChapterEditor.tsx`
- `tests/unit/rich-text.test.ts`
- `tests/unit/chapter-exporters.test.ts`

### 13. Snapshots, Revisions, and Recovery

- Manual and autosave database snapshots.
- Recovery of the latest available snapshot.
- Application revisions for chapters, scenes, characters, and locations, with JSON snapshots and indexed text for review/restore.
- Packaging and tests rebuild `better-sqlite3` for the correct runtime, reducing ABI mismatch between local Node and Electron.

References:

- `src/main/projects/snapshots.ts`
- `src/main/projects/session.ts`
- `src/main/services/revision-service.ts`
- `scripts/rebuild-node-native.mjs`
- `scripts/rebuild-electron-native.mjs`
- `scripts/run-electron-package.mjs`

### 14. External Surfaces

Possible endpoints:

- OpenAI Responses API: `https://api.openai.com/v1/responses`
- OpenAI Images API: `https://api.openai.com/v1/images/generations`
- Ollama: `${OLLAMA_HOST}/api/*`, default `http://127.0.0.1:11434`

Relevant environment variables:

- `OPENAI_API_KEY`
- `NOVELIST_CODEX_TIMEOUT_MS`
- `NOVELIST_IMAGE_MODEL`
- `NOVELIST_ENABLE_DEVTOOLS`
- `OLLAMA_HOST`

### 15. Known Residual Limits

1. Local builds are not signed or notarized.
2. `project.db` is not encrypted at rest.
3. The wiki is readable on disk by design; privacy depends on filesystem/user-profile security.
4. The app is local single-user software and does not implement authentication or roles.
5. External providers can receive project text only with consent, but the final guarantee also depends on user configuration and the selected provider.
6. Ollama can point to non-local hosts through `OLLAMA_HOST`; in that case traffic is not necessarily local.
7. Unsigned releases can trigger operating-system warnings and do not provide a strong provenance guarantee.
8. CSP through `meta` does not replace full HTTP headers in possible future network-served scenarios.

### 16. Recommended Release Checks

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`
- `npm run test:e2e:electron`
- `npm run test:smoke:electron`
- `npm run pack`
- `npm run release:checksums`

For real UI or Electron changes, also visually verify the packaged app or the real Electron environment.
