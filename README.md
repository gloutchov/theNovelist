# The Novelist

App desktop Electron per progettare e scrivere romanzi: canvas narrativo, editor capitoli, schede personaggi/location, export e assistenza AI.

## Funzionalita principali
- Gestione progetto locale con apertura/creazione da path e salvataggio snapshot.
- Canvas storia con trame, capitoli, connessioni e ordinamento narrativo.
- Editor capitolo con formattazione ricca, riferimenti rapidi a personaggi/location e azioni AI su selezione.
- Chat AI contestuale al capitolo.
- Canvas Personaggi e Location con collegamenti ai capitoli.
- Gestione immagini per personaggi/location:
  - associazione file locale;
  - anteprima e visualizzazione completa;
  - generazione in-app (solo via OpenAI API).
- Export e stampa:
  - singolo capitolo: `DOCX`, `PDF`, `Stampa`;
  - manoscritto completo: `DOCX`, `PDF`, `Stampa`.

## Requisiti
- Node.js 22+
- npm 10+

## Avvio rapido
1. Installa dipendenze:
   - `npm install`
2. Avvia in sviluppo:
   - `npm run dev`

## Comandi utili
- `npm run dev`: avvio sviluppo Electron + renderer.
- `npm run build`: build main/preload/renderer in `out/`.
- `npm run pack`: crea app unpacked locale in `release/`.
- `npm run dist`: crea artefatti per la piattaforma corrente.
- `npm run dist:mac`: crea artefatti macOS (`dmg`, `zip`).
- `npm run dist:win`: crea artefatti Windows (`nsis`).
- `npm run dist:linux`: crea artefatti Linux (`AppImage`).
- `npm run rebuild:electron-native`: rebuild moduli nativi (es. `better-sqlite3`) per Electron.
- `npm run rebuild:node-native`: rebuild moduli nativi per runtime Node locale.
- `npm run lint`: lint.
- `npm run typecheck`: type check TypeScript.
- `npm run test`: test unitari Vitest.
- `npm run test:e2e:install`: installa Chromium locale per Playwright.
- `npm run test:e2e`: suite e2e renderer.
- `npm run test:perf`: benchmark e2e performance.
- `npm run test:e2e:electron`: suite e2e Electron reale (IPC + DB).

## AI: provider e comportamento
Nelle Impostazioni AI puoi scegliere il provider:
- `Codex CLI (locale)`
- `OpenAI API`
- `Ollama (locale)`

Note operative:
- Prompt/suggerimenti/chat usano il provider selezionato.
- La generazione immagini in-app usa OpenAI Images API, quindi richiede:
  - consenso AI attivo;
  - provider `OpenAI API`;
  - chiamate API abilitate;
  - API key disponibile.

## Variabili ambiente
- `NOVELIST_CODEX_COMMAND`: comando CLI (default: `codex`).
- `NOVELIST_CODEX_TIMEOUT_MS`: timeout richieste CLI in ms (default: `45000`).
- `OPENAI_API_KEY`: chiave OpenAI usata come fallback se non salvata in-app.
- `NOVELIST_IMAGE_MODEL`: override modello immagini (default runtime: `gpt-image-1`).
- `OLLAMA_HOST`: endpoint Ollama (default: `http://127.0.0.1:11434`).

## Build macOS
1. Esegui:
   - `npm run dist:mac`
2. Troverai gli artefatti in `release/`:
   - `The Novelist-<version>-arm64.dmg`
   - `The Novelist-<version>-arm64-mac.zip`
3. Installa aprendo il `.dmg` e trascinando `The Novelist.app` in `Applicazioni`.

Nota:
- la build locale e non firmata/notarizzata; al primo avvio potrebbe essere necessario `tasto destro > Apri`.

## Struttura repository
- `src/main`: processo main Electron + IPC.
- `src/preload`: bridge sicuro `contextBridge`.
- `src/renderer`: app React.
- `src/main/persistence`: SQLite migration + repository.
- `src/main/projects`: gestione progetto su disco + snapshot/recovery.
- `tests/unit`: test unitari.
- `tests/e2e`: test end-to-end.

## Struttura progetto narrativo su disco
- `project.db`: database SQLite del progetto.
- `assets/`: immagini, export e allegati.
- `.snapshots/`: snapshot DB per recovery.

## IPC (selezione)
- Progetto: `project:create`, `project:open`, `project:inspect-path`, `project:select-directory`, `project:save-snapshot`.
- Storia: `story:get-state`, `story:create-node`, `story:update-node`, `story:create-edge`, `story:delete-edge`.
- Capitoli: `chapter:get-document`, `chapter:save-document`, `chapter:export-docx`, `chapter:export-pdf`, `chapter:print`.
- Manoscritto: `manuscript:export-docx`, `manuscript:export-pdf`, `manuscript:print`.
- Personaggi/Location: CRUD schede, link capitoli, immagini (lista/associazione/generazione/eliminazione).
- AI: `codex:get-settings`, `codex:update-settings`, `codex:assist`, `codex:transform-selection`, `codex:chat`, `codex:cancel-active-request`.

## Licenza
Questo progetto e distribuito sotto licenza Apache 2.0. Vedi [LICENSE](./LICENSE).
