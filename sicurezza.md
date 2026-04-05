# Sicurezza - The Novelist

Stato documentato al **5 aprile 2026**.

Questo documento descrive le misure di sicurezza **attualmente implementate** nell'applicazione, con limiti noti.

## 1) Modello operativo
- App desktop locale (Electron), senza backend remoto proprietario.
- Dati del progetto salvati in filesystem locale (`project.db`, `assets/`, `.snapshots/`).
- Funzioni AI opzionali via:
  - `Codex CLI` locale
  - `OpenAI API` (cloud)
  - `Ollama` (tipicamente locale, host configurabile)

## 2) Misure implementate

### 2.1 Isolamento renderer/main
- `contextIsolation: true` nel `BrowserWindow` principale.
- `nodeIntegration: false` nel renderer.
- `sandbox: true` nel `BrowserWindow` principale e nella finestra di stampa.
- API esposte al renderer solo tramite `preload` + `contextBridge` (`window.novelistApi`).
- Il `preload` usa canali IPC condivisi definiti in un modulo separato, senza dipendenze dal codice `main` che richieda moduli nativi o privilegi del main process. Questo evita rotture del bridge in ambiente sandboxato.
- Navigazioni inattese e popup (`window.open`) bloccati nel `BrowserWindow` principale.
- Riferimenti:
  - `src/main/index.ts`
  - `src/preload/index.ts`
  - `src/shared/ipc-channels.ts`

### 2.1-bis Content Security Policy
- CSP esplicita nel renderer principale via `meta http-equiv="Content-Security-Policy"`.
- Policy restrittiva per:
  - bloccare `object-src`
  - limitare `script-src` a `self`
  - confinare `connect-src` a `self` e agli endpoint locali necessari per il dev server Vite
- Nota: essendo una CSP via `meta`, alcune direttive come `frame-ancestors` non sono applicabili e andrebbero eventualmente imposte via header se in futuro si introducesse una catena di delivery HTTP.
- Le viste HTML usate per la stampa includono una CSP dedicata minimale, senza script e con soli stili inline/immagini locali o data URL.
- Riferimenti:
  - `src/renderer/index.html`
  - `src/main/chapters/exporters.ts`

### 2.2 IPC con validazione input/output
- Ogni canale IPC usa schemi `zod` per parsing/validazione payload.
- Riduce errori e input fuori specifica (lunghezze, enum, min/max, tipi).
- Riferimento:
  - `src/main/ipc.ts`

### 2.3 Controlli di appartenenza al progetto
- Per operazioni su capitoli/schede/link viene verificato che gli ID appartengano al progetto aperto.
- Esempi: `assertChapterNodeIdsBelongToProject`, check su `projectId` di card/location.
- Riferimento:
  - `src/main/ipc.ts`

### 2.4 Query DB parametrizzate + vincoli relazionali
- Repository SQLite con statement preparati (no concatenazione SQL utente).
- `foreign_keys = ON`, vincoli `UNIQUE`, `CHECK`, `ON DELETE CASCADE`.
- Riferimenti:
  - `src/main/persistence/repository.ts`
  - `src/main/persistence/database.ts`
  - `src/main/persistence/migrations.ts`

### 2.5 Gestione API key
- La chiave API non viene restituita in chiaro al renderer (`apiKey` in risposta è `null`).
- Salvataggio in storage cifrato di sistema (`safeStorage`) quando disponibile.
- Cancellazione chiave supportata.
- Migrazione legacy: vecchie chiavi DB possono essere spostate in storage sicuro.
- Riferimenti:
  - `src/main/security/secure-settings.ts`
  - `src/main/ipc.ts` (`resolveCodexRuntime`, `toCodexSettingsResponse`, `codexUpdateSettings`)

### 2.6 Consenso esplicito per uso AI
- Le funzioni AI testuali (`assist`, `chat`, `transform`) richiedono `enabled = true`.
- Le chiamate API esterne richiedono `allowApiCalls = true`.
- Generazione immagini in-app richiede anche provider `openai_api` e chiave disponibile.
- Riferimento:
  - `src/main/ipc.ts`

### 2.7 Import immagini in area progetto
- Le immagini associate vengono copiate dentro `assets/img/...` del progetto.
- Le immagini generate in-app vengono salvate in `assets/generated-images/...`.
- Evita dipendenza da path esterni volatili.
- La lettura immagini verso il renderer (`read-image-data-url`) e ora limitata a file raster interni a `assets/` del progetto aperto.
- Riferimento:
  - `src/main/images/generation.ts`
  - `src/main/ipc.ts`

### 2.8 Timeout e cancellazione richieste AI
- Timeout configurabile per Codex CLI.
- Supporto abort/cancel di richieste in corso.
- Riferimento:
  - `src/main/codex/client.ts`

### 2.9 Snapshot e recovery
- Snapshot periodici/manuali del DB e recovery dell'ultimo snapshot.
- Migliora resilienza/integrità operativa.
- Riferimento:
  - `src/main/projects/snapshots.ts`
  - `src/main/projects/session.ts`

### 2.10 Menzioni capitolo con validazione canonica
- Personaggi e location possono essere citati nel capitolo con menzioni `@`.
- Il collegamento capitolo-personaggio/location viene derivato dal contenuto del capitolo e non più da checkbox manuali nelle schede.
- Le menzioni salvano come identificatore affidabile solo `refId`; la label visibile viene ricalcolata da record canonici.
- In lettura e in salvataggio, il main process normalizza le menzioni:
  - corregge label incoerenti rispetto all'entità reale
  - scarta menzioni malformate
  - scarta menzioni verso entità non più esistenti
- Questo riduce il rischio di documenti alterati che mostrino un nome ma colleghino in realtà un'altra entità.
- Riferimenti:
  - `src/renderer/src/ChapterEditor.tsx`
  - `src/main/chapters/rich-text.ts`
  - `src/main/ipc.ts`
  - `tests/unit/rich-text.test.ts`

### 2.11 Export e stampa privi di metadati di menzione
- Le menzioni restano interne all'editor ma vengono escluse da:
  - conteggio parole
  - export DOCX/PDF
  - stampa HTML
- Evita leakage di metadati editoriali nel manoscritto esportato.
- Riferimenti:
  - `src/main/chapters/rich-text.ts`
  - `src/main/chapters/exporters.ts`

## 3) Superfici esterne

### 3.1 Endpoint di rete usati
- OpenAI Responses API: `https://api.openai.com/v1/responses`
- OpenAI Images API: `https://api.openai.com/v1/images/generations`
- Ollama: `${OLLAMA_HOST}/api/*` (default `http://127.0.0.1:11434`)

### 3.2 Variabili ambiente rilevanti
- `OPENAI_API_KEY`
- `NOVELIST_CODEX_COMMAND`
- `NOVELIST_CODEX_TIMEOUT_MS`
- `NOVELIST_IMAGE_MODEL`
- `OLLAMA_HOST`

## 4) Limiti noti (stato attuale)

1. Build distribuita localmente non firmata/notarizzata (`identity: null` in `electron-builder`).
2. Database progetto (`project.db`) non cifrato nativamente a riposo.
3. L'app è single-user locale: non ha autenticazione/ruoli.
4. Se `safeStorage` non è disponibile, la chiave nuova non viene salvata in secure storage; resta possibile uso via variabile ambiente.
5. Le menzioni sono validate lato main process, ma la sincronizzazione dei link capitolo è ancora avviata dal renderer; il modello è robusto per un'app locale, ma un futuro spostamento completo della sincronizzazione nel main process ridurrebbe ulteriormente la superficie di fiducia del renderer.

## 5) Raccomandazioni pratiche (priorità)

1. Firmare e notarizzare le build macOS/Windows di distribuzione.
2. Valutare cifratura del DB progetto o almeno delle sezioni sensibili.
3. Aggiungere hardening release (dipendenze, SCA, audit periodico, CI security checks).
4. Valutare lo spostamento della sincronizzazione link capitolo-personaggi/location interamente nel main process.

## 6) File principali da verificare
- `src/main/index.ts`
- `src/preload/index.ts`
- `src/shared/ipc-channels.ts`
- `src/main/ipc.ts`
- `src/main/security/secure-settings.ts`
- `src/main/codex/client.ts`
- `src/main/images/generation.ts`
- `src/main/persistence/*`

## 7) Verifiche consigliate
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:smoke:electron:codex`
- Nota pratica per macOS: alcuni rebuild nativi e test che passano da `npm test` richiedono anche toolchain Xcode configurata e licenza accettata.
- Questo requisito riguarda sviluppo, CI locale e debug del repository sorgente; non riguarda l'utente finale che installa una build gia pacchettizzata.
