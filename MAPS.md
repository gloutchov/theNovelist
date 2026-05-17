# MAPS.md

Mappa ASCII della distribuzione dei file del repository e descrizione sintetica delle responsabilita.

## Vista generale

```text
theNovelist/
|-- .github/
|   `-- workflows/
|       |-- ci.yml
|       `-- release.yml
|-- build/
|   |-- icon.ico
|   `-- icon.png
|-- checksums/
|   `-- SHA256SUMS-*.txt
|-- scripts/
|   |-- electron-builder-after-pack.cjs
|   |-- generate-checksums.mjs
|   |-- rebuild-electron-native.mjs
|   |-- rebuild-node-native.mjs
|   |-- run-electron-e2e.mjs
|   |-- run-electron-package.mjs
|   |-- run-electron-smoke.mjs
|   `-- serve-static.mjs
|-- src/
|   |-- main/
|   |-- preload/
|   |-- renderer/
|   `-- shared/
|-- tests/
|   |-- e2e/
|   `-- unit/
|-- AGENTS.md
|-- MAPS.md
|-- README.md
|-- RELEASE_NOTES.md
|-- sicurezza.md
|-- package.json
|-- package-lock.json
|-- electron.vite.config.ts
|-- eslint.config.mjs
|-- playwright.config.ts
|-- playwright.electron.config.ts
|-- playwright.perf.config.ts
|-- tsconfig.json
`-- vitest.config.ts
```

## Cartelle principali

```text
.github/workflows/
|-- ci.yml          # Workflow CI per controlli automatici.
`-- release.yml     # Workflow di build e pubblicazione release GitHub.

build/
|-- icon.ico        # Icona Windows usata dal packaging Electron.
`-- icon.png        # Icona PNG usata dal packaging, in particolare macOS.

checksums/
`-- *.txt           # Checksum storici o di supporto alle release.

scripts/
|-- electron-builder-after-pack.cjs # Hook post-packaging Electron.
|-- generate-checksums.mjs          # Generazione SHA256SUMS per gli artefatti.
|-- rebuild-electron-native.mjs     # Rebuild moduli nativi per Electron.
|-- rebuild-node-native.mjs         # Rebuild moduli nativi per Node/Vitest.
|-- run-electron-e2e.mjs            # Wrapper per e2e Electron.
|-- run-electron-package.mjs        # Wrapper packaging win/mac/dir.
|-- run-electron-smoke.mjs          # Smoke test Electron.
`-- serve-static.mjs                # Server statico per e2e browser.

tests/
|-- e2e/             # Test Playwright browser ed Electron.
`-- unit/            # Test Vitest su servizi, IPC, persistenza e utility.
```

## Sorgenti applicativi

```text
src/
|-- main/
|   |-- index.ts
|   |-- app-preferences.ts
|   |-- i18n.ts
|   |-- chapters/
|   |-- codex/
|   |-- config/
|   |-- images/
|   |-- ipc/
|   |-- network/
|   |-- persistence/
|   |-- projects/
|   |-- security/
|   |-- services/
|   `-- wiki/
|-- preload/
|   `-- index.ts
|-- renderer/
|   |-- index.html
|   `-- src/
|       |-- App.tsx
|       |-- main.tsx
|       |-- ChapterEditor.tsx
|       |-- *Board.tsx
|       |-- *FlowNode.tsx
|       |-- features/
|       |-- i18n/
|       |-- shared/
|       |-- styles/
|       `-- styles.css
`-- shared/
    `-- ipc-channels.ts
```

### `src/main`

Processo principale Electron. Gestisce finestra, IPC, persistenza locale, servizi applicativi, sicurezza, filesystem di progetto, wiki/memoria e integrazioni AI.

```text
src/main/
|-- index.ts                 # Bootstrap main process, finestra Electron e registrazione IPC.
|-- app-preferences.ts       # Preferenze applicative persistenti.
|-- i18n.ts                  # Risoluzione lingua lato main process.
|-- chapters/                # Rich text e export dei capitoli.
|-- codex/                   # Client per funzionalita AI/Codex.
|-- config/                  # Configurazione applicativa caricata dal main.
|-- images/                  # Generazione immagini e gestione runtime correlata.
|-- ipc/                     # Registry IPC, schema, context e handler per dominio.
|-- network/                 # Wrapper HTTP e policy di rete.
|-- persistence/             # Database SQLite, migrazioni, repository e tipi.
|-- projects/                # Sessione progetto, snapshot, path asset e file progetto.
|-- security/                # Impostazioni sicure e policy debug.
|-- services/                # Servizi di dominio sopra i repository.
`-- wiki/                    # Indicizzazione, ricerca, sync e path safety della wiki progetto.
```

### `src/preload`

Ponte sicuro tra renderer e main process.

```text
src/preload/
`-- index.ts                 # Espone API IPC controllate al renderer.
```

### `src/renderer`

Interfaccia React. Contiene shell, dashboard, editor, board/canvas a nodi, modali e stili.

```text
src/renderer/
|-- index.html
`-- src/
    |-- main.tsx             # Entry point React.
    |-- App.tsx              # Shell principale dell'app.
    |-- ChapterEditor.tsx    # Editor rich text dei capitoli.
    |-- AnalysisBoard.tsx    # Vista analisi.
    |-- CharacterBoard.tsx   # Canvas personaggi.
    |-- LocationBoard.tsx    # Canvas luoghi.
    |-- RevisionBoard.tsx    # Vista revisioni.
    |-- SceneBoard.tsx       # Canvas scene.
    |-- TimelineBoard.tsx    # Timeline narrativa.
    |-- *FlowNode.tsx        # Nodi React Flow per entita diverse.
    |-- features/            # Funzionalita divise per area UI.
    |-- i18n/                # Dizionari e helper di localizzazione renderer.
    |-- shared/              # Utility condivise nel renderer.
    |-- styles/              # CSS diviso per area funzionale.
    `-- styles.css           # Entrypoint CSS del renderer.
```

### `src/renderer/src/features`

Moduli UI per mantenere separate le funzionalita e ridurre la crescita dei file principali.

```text
features/
|-- ai/          # Impostazioni AI lato renderer.
|-- dashboard/   # Stato e workspace dashboard.
|-- editor/      # Toolbar, sidebar AI, find/replace, riferimenti e modali editor.
|-- entities/    # Pannelli comuni per entita narrative.
|-- memory/      # Workspace memoria/wiki, risultati e formattazione.
|-- outline/     # Vista lettura e stato outline.
|-- plot/        # Flusso, modali e struttura della trama.
|-- project/     # Sessione progetto e modali progetto.
|-- settings/    # Preferenze e modal impostazioni.
`-- story/       # Modali dei nodi story.
```

### `src/renderer/src/i18n`

Dizionari e helper per localizzazione renderer italiano/inglese.

```text
i18n/
|-- dictionaries.ts          # Registro dei dizionari disponibili.
|-- en.ts                    # Dizionario inglese.
|-- it.ts                    # Dizionario italiano.
|-- i18n-provider.tsx        # Provider/hook React per traduzioni.
|-- renderer-language.ts     # Risoluzione lingua da preferenze e sistema.
|-- types.ts                 # Tipi condivisi per chiavi e parametri.
`-- index.ts                 # Barrel export del modulo i18n.
```

### `src/shared`

Codice condiviso tra main, preload, renderer e test.

```text
src/shared/
`-- ipc-channels.ts          # Nomi e gruppi dei canali IPC.
```

## Test

```text
tests/
|-- e2e/
|   |-- helpers/
|   |-- smoke.spec.ts
|   |-- workflows.spec.ts
|   |-- electron-smoke.spec.ts
|   |-- electron-workflows.spec.ts
|   |-- visual-layout.spec.ts
|   |-- performance.spec.ts
|   |-- plot-board-current-ui.spec.ts
|   `-- canvas-selection-elevation.spec.ts
`-- unit/
    |-- app-config.test.ts
    |-- app-preferences.test.ts
    |-- asset-paths.test.ts
    |-- card-extraction.test.ts
    |-- chapter-exporters.test.ts
    |-- ipc*.test.ts
    |-- i18n.test.ts
    |-- main-i18n.test.ts
    |-- network-http.test.ts
    |-- production-security.test.ts
    |-- repository.test.ts
    |-- migrations.test.ts
    |-- rich-text.test.ts
    |-- project-*.test.ts
    |-- wiki-*.test.ts
    |-- codex-*.test.ts
    |-- image-*.test.ts
    `-- altri test mirati per servizi e utility
```

I test `e2e` coprono workflow utente e smoke visivi/browser/Electron. I test `unit` coprono servizi, repository, migrazioni, IPC, sicurezza, AI e utility.

## File di configurazione

```text
package.json                 # Script npm, dipendenze e configurazione electron-builder.
package-lock.json            # Lockfile npm.
electron.vite.config.ts      # Configurazione electron-vite.
tsconfig.json                # Configurazione TypeScript.
eslint.config.mjs            # Configurazione ESLint.
vitest.config.ts             # Configurazione Vitest.
playwright.config.ts         # E2E browser.
playwright.electron.config.ts# E2E Electron.
playwright.perf.config.ts    # Test performance.
.prettierrc.json             # Configurazione Prettier.
.gitignore                   # File e cartelle ignorate da Git.
```

## Documentazione

```text
AGENTS.md                    # Istruzioni operative per agenti sul repository.
README.md                    # Documentazione principale del progetto.
RELEASE_NOTES.md             # Note operative per la release corrente.
sicurezza.md                 # Note e controlli di sicurezza.
LICENSE                      # Licenza Apache 2.0.
MAPS.md                      # Questa mappa del repository.
```

## Cartelle generate o locali

```text
node_modules/                # Dipendenze npm installate localmente.
out/                         # Output build electron-vite.
release/                     # Artefatti packaging e release scaricati/generati.
test-results/                # Output Playwright.
test-results-codex-smoke/    # Output smoke test locali.
.playwright-browsers/        # Browser Playwright locali al repo.
```

Queste cartelle sono output o dipendenze locali e non sono il punto di ingresso per modifiche sorgente ordinarie.
