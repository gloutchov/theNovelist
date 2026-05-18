# MAPS.md

Repository map for The Novelist.

Mappa del repository The Novelist.

---

## Italiano

Questa mappa descrive la distribuzione dei file principali e le responsabilita dei moduli. E aggiornata a `main`, dopo la separazione dei manuali `ISTRUZIONI.md` e `INSTRUCTIONS.md`, la rimozione di `RELEASE_NOTES.md` e l'aggiunta del mini sito GitHub Pages.

### Vista generale

```text
theNovelist/
|-- .github/
|   `-- workflows/
|       |-- ci.yml
|       |-- pages.yml
|       `-- release.yml
|-- build/
|   |-- icon.ico
|   `-- icon.png
|-- checksums/
|   `-- SHA256SUMS-*.txt
|-- docs/
|   |-- assets/
|   |-- index.html
|   |-- site.js
|   `-- styles.css
|-- scripts/
|-- src/
|   |-- main/
|   |-- preload/
|   |-- renderer/
|   `-- shared/
|-- tests/
|   |-- e2e/
|   `-- unit/
|-- AGENTS.md
|-- INSTRUCTIONS.md
|-- ISTRUZIONI.md
|-- LICENSE
|-- MAPS.md
|-- README.md
|-- SECURITY_MODEL.md
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

### Cartelle principali

```text
.github/workflows/
|-- ci.yml          # CI automatica.
|-- pages.yml       # Pubblicazione GitHub Pages del mini sito statico.
`-- release.yml     # Build e pubblicazione release GitHub.

build/
|-- icon.ico        # Icona Windows.
`-- icon.png        # Icona PNG usata anche dal README.

checksums/
`-- *.txt           # Checksum storici o di supporto alle release.

docs/
|-- assets/         # Icona e anteprime visuali scure/chiare del mini sito.
|-- index.html      # Landing page bilingue pubblicabile via GitHub Pages.
|-- site.js         # Switch lingua italiano/inglese.
`-- styles.css      # Stili responsive del sito statico.

scripts/
|-- electron-builder-after-pack.cjs # Hook post-packaging Electron.
|-- generate-checksums.mjs          # Genera SHA256SUMS.
|-- rebuild-electron-native.mjs     # Rebuild moduli nativi per Electron.
|-- rebuild-node-native.mjs         # Rebuild moduli nativi per Node/Vitest.
|-- run-electron-e2e.mjs            # Wrapper e2e Electron.
|-- run-electron-package.mjs        # Wrapper packaging win/mac/dir.
|-- run-electron-smoke.mjs          # Smoke test Electron.
`-- serve-static.mjs                # Server statico per e2e browser.

tests/
|-- e2e/             # Test Playwright browser ed Electron.
`-- unit/            # Test Vitest su servizi, IPC, persistenza e utility.
```

### Sorgenti applicativi

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
`-- shared/
    `-- ipc-channels.ts
```

#### `src/main`

Processo principale Electron. Gestisce finestra, IPC, persistenza locale, servizi applicativi, sicurezza, filesystem di progetto, memoria Wiki e integrazioni AI.

```text
src/main/
|-- index.ts                 # Bootstrap main process e finestra Electron.
|-- app-preferences.ts       # Preferenze globali utente: autosave, lingua e tema.
|-- i18n.ts                  # Traduzioni lato main per dialoghi Electron.
|-- chapters/                # Rich text, conteggio parole, export e stampa.
|-- codex/                   # Client AI per OpenAI API e Ollama.
|-- config/                  # Configurazione applicativa centrale.
|-- images/                  # Generazione/import immagini.
|-- ipc/                     # Canali, schemi, registry, context e handler.
|-- network/                 # Wrapper HTTP.
|-- persistence/             # SQLite, migration, repository e tipi.
|-- projects/                # Sessione progetto, snapshot, asset e file.
|-- security/                # Storage sicuro e policy debug/devtools.
|-- services/                # Servizi di dominio sopra i repository.
`-- wiki/                    # Bootstrap, sync, ricerca, export e path safety Wiki.
```

#### `src/preload`

```text
src/preload/
`-- index.ts                 # Espone window.novelistApi al renderer.
```

#### `src/renderer`

Interfaccia React. Contiene shell, dashboard, editor, board/canvas, modali, i18n e stili.

```text
src/renderer/
|-- index.html               # HTML + Content Security Policy.
`-- src/
    |-- main.tsx             # Entry point React.
    |-- App.tsx              # Shell principale.
    |-- AnalysisBoard.tsx    # Analisi AI e cleanup output.
    |-- ChapterEditor.tsx    # Editor rich text capitolo/scena.
    |-- CharacterBoard.tsx   # Canvas personaggi.
    |-- LocationBoard.tsx    # Canvas location.
    |-- RevisionBoard.tsx    # Revisioni.
    |-- SceneBoard.tsx       # Canvas scene.
    |-- TimelineBoard.tsx    # Timeline narrativa.
    |-- *FlowNode.tsx        # Nodi React Flow.
    |-- features/            # Moduli UI per area funzionale.
    |-- i18n/                # Dizionari e helper italiano/inglese.
    |-- shared/              # Utility renderer.
    |-- styles/              # CSS diviso per area.
    `-- styles.css           # Entrypoint CSS.
```

#### `src/renderer/src/features`

```text
features/
|-- ai/          # Stato e salvataggio impostazioni AI.
|-- dashboard/   # Stato e workspace dashboard.
|-- editor/      # Toolbar, chat AI, find/replace, riferimenti e modali.
|-- entities/    # Pannelli comuni per schede narrative.
|-- memory/      # Memoria Wiki, ricerca, risultati e sintesi.
|-- outline/     # Scaletta, vista lettura e parsing documento.
|-- plot/        # Flusso, modali e struttura trama.
|-- project/     # Sessione e modali progetto.
|-- settings/    # Preferenze utente e modale impostazioni.
`-- story/       # Modali nodi capitolo.
```

#### `src/renderer/src/i18n`

```text
i18n/
|-- dictionaries.ts          # Registro dizionari.
|-- en.ts                    # Dizionario inglese.
|-- it.ts                    # Dizionario italiano.
|-- i18n-provider.tsx        # Provider/hook React.
|-- renderer-language.ts     # Risoluzione lingua da preferenze e sistema.
|-- types.ts                 # Tipi i18n.
|-- use-translation.ts       # Hook di compatibilita.
`-- index.ts                 # Export pubblici del modulo.
```

### Test

```text
tests/e2e/
|-- canvas-selection-elevation.spec.ts
|-- electron-smoke.spec.ts
|-- electron-workflows.spec.ts
|-- performance.spec.ts
|-- plot-board-current-ui.spec.ts
|-- smoke.spec.ts
|-- visual-layout.spec.ts
|-- workflows.spec.ts
`-- helpers/

tests/unit/
|-- analysis-output.test.ts      # Cleanup offerte follow-up nei report analisi.
|-- app-config.test.ts
|-- app-preferences.test.ts
|-- asset-paths.test.ts
|-- card-extraction.test.ts
|-- chapter-exporters.test.ts
|-- codex-client.test.ts
|-- codex-service.test.ts
|-- entity-services.test.ts
|-- i18n.test.ts
|-- image-generation.test.ts
|-- image-path.test.ts
|-- ipc-channel-groups.test.ts
|-- ipc.test.ts
|-- main-i18n.test.ts
|-- migrations.test.ts
|-- network-http.test.ts
|-- production-security.test.ts
|-- project-*.test.ts
|-- repository.test.ts
|-- rich-text.test.ts
|-- session.test.ts
|-- snapshots.test.ts
|-- styles-entrypoint.test.ts
`-- wiki-*.test.ts
```

### Documentazione

```text
AGENTS.md         # Istruzioni operative per agenti sul repository.
README.md         # Pagina principale GitHub bilingue.
ISTRUZIONI.md     # Manuale utente completo in italiano.
INSTRUCTIONS.md   # Traduzione inglese completa del manuale.
SECURITY_MODEL.md # Note di sicurezza bilingue.
MAPS.md           # Questa mappa bilingue.
LICENSE           # Licenza Apache 2.0.
```

### Cartelle generate o locali

```text
node_modules/                # Dipendenze npm locali.
out/                         # Output build electron-vite.
release/                     # Artefatti packaging locali.
test-results/                # Output Playwright.
test-results-codex-smoke/    # Output smoke test locali.
.playwright-browsers/        # Browser Playwright locali al repo.
```

Queste cartelle sono output o dipendenze locali e non sono il punto di ingresso per modifiche sorgente ordinarie.

---

## English

This map describes the main file layout and module responsibilities. It is updated for `main`, after splitting the user manuals into `ISTRUZIONI.md` and `INSTRUCTIONS.md`, removing `RELEASE_NOTES.md`, and adding the GitHub Pages mini site.

### Overview

```text
theNovelist/
|-- .github/
|   `-- workflows/
|       |-- ci.yml
|       |-- pages.yml
|       `-- release.yml
|-- build/
|   |-- icon.ico
|   `-- icon.png
|-- checksums/
|   `-- SHA256SUMS-*.txt
|-- docs/
|   |-- assets/
|   |-- index.html
|   |-- site.js
|   `-- styles.css
|-- scripts/
|-- src/
|   |-- main/
|   |-- preload/
|   |-- renderer/
|   `-- shared/
|-- tests/
|   |-- e2e/
|   `-- unit/
|-- AGENTS.md
|-- INSTRUCTIONS.md
|-- ISTRUZIONI.md
|-- LICENSE
|-- MAPS.md
|-- README.md
|-- SECURITY_MODEL.md
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

### Main Directories

```text
.github/workflows/
|-- ci.yml          # Automated CI.
|-- pages.yml       # GitHub Pages publishing workflow for the static mini site.
`-- release.yml     # GitHub release build and publishing workflow.

build/
|-- icon.ico        # Windows icon.
`-- icon.png        # PNG icon also used by README.

checksums/
`-- *.txt           # Historical or release-support checksums.

docs/
|-- assets/         # Icon and dark/light visual previews for the mini site.
|-- index.html      # Bilingual landing page publishable through GitHub Pages.
|-- site.js         # Italian/English language switcher.
`-- styles.css      # Responsive styles for the static site.

scripts/
|-- electron-builder-after-pack.cjs # Electron post-packaging hook.
|-- generate-checksums.mjs          # SHA256SUMS generation.
|-- rebuild-electron-native.mjs     # Native module rebuild for Electron.
|-- rebuild-node-native.mjs         # Native module rebuild for Node/Vitest.
|-- run-electron-e2e.mjs            # Electron e2e wrapper.
|-- run-electron-package.mjs        # win/mac/dir packaging wrapper.
|-- run-electron-smoke.mjs          # Electron smoke test.
`-- serve-static.mjs                # Static server for browser e2e.

tests/
|-- e2e/             # Playwright browser and Electron tests.
`-- unit/            # Vitest tests for services, IPC, persistence, and utilities.
```

### Application Sources

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
`-- shared/
    `-- ipc-channels.ts
```

#### `src/main`

Electron main process. Owns the application window, IPC, local persistence, application services, security, project filesystem, Wiki memory, and AI integrations.

```text
src/main/
|-- index.ts                 # Main process and Electron window bootstrap.
|-- app-preferences.ts       # Global user preferences: autosave, language, and theme.
|-- i18n.ts                  # Main-process translations for Electron dialogs.
|-- chapters/                # Rich text, word count, export, and print.
|-- codex/                   # AI client for OpenAI API and Ollama.
|-- config/                  # Central application configuration.
|-- images/                  # Image generation/import.
|-- ipc/                     # Channels, schemas, registry, context, and handlers.
|-- network/                 # HTTP wrapper.
|-- persistence/             # SQLite, migrations, repositories, and types.
|-- projects/                # Project session, snapshots, assets, and files.
|-- security/                # Secure storage and debug/devtools policy.
|-- services/                # Domain services above repositories.
`-- wiki/                    # Wiki bootstrap, sync, search, export, and path safety.
```

#### `src/preload`

```text
src/preload/
`-- index.ts                 # Exposes window.novelistApi to the renderer.
```

#### `src/renderer`

React UI. Contains the shell, dashboard, editor, boards/canvases, modals, i18n, and styles.

```text
src/renderer/
|-- index.html               # HTML + Content Security Policy.
`-- src/
    |-- main.tsx             # React entry point.
    |-- App.tsx              # Main app shell.
    |-- AnalysisBoard.tsx    # AI analysis and output cleanup.
    |-- ChapterEditor.tsx    # Chapter/scene rich text editor.
    |-- CharacterBoard.tsx   # Character canvas.
    |-- LocationBoard.tsx    # Location canvas.
    |-- RevisionBoard.tsx    # Revisions.
    |-- SceneBoard.tsx       # Scene canvas.
    |-- TimelineBoard.tsx    # Narrative timeline.
    |-- *FlowNode.tsx        # React Flow nodes.
    |-- features/            # UI modules by functional area.
    |-- i18n/                # Italian/English dictionaries and helpers.
    |-- shared/              # Renderer utilities.
    |-- styles/              # CSS by area.
    `-- styles.css           # CSS entrypoint.
```

#### `src/renderer/src/features`

```text
features/
|-- ai/          # Renderer-side AI settings state.
|-- dashboard/   # Dashboard state and workspace.
|-- editor/      # Toolbar, AI chat, find/replace, references, and modals.
|-- entities/    # Common panels for narrative entities.
|-- memory/      # Wiki memory, search, results, and summary.
|-- outline/     # Outline, reading view, and document parsing.
|-- plot/        # Plot flow, modals, and structure generation.
|-- project/     # Project session and modals.
|-- settings/    # User preferences and settings modal.
`-- story/       # Chapter node modals.
```

#### `src/renderer/src/i18n`

```text
i18n/
|-- dictionaries.ts          # Dictionary registry.
|-- en.ts                    # English dictionary.
|-- it.ts                    # Italian dictionary.
|-- i18n-provider.tsx        # React provider/hook.
|-- renderer-language.ts     # Language resolution from preferences and system.
|-- types.ts                 # i18n types.
|-- use-translation.ts       # Compatibility hook.
`-- index.ts                 # Public exports.
```

### Tests

```text
tests/e2e/
|-- canvas-selection-elevation.spec.ts
|-- electron-smoke.spec.ts
|-- electron-workflows.spec.ts
|-- performance.spec.ts
|-- plot-board-current-ui.spec.ts
|-- smoke.spec.ts
|-- visual-layout.spec.ts
|-- workflows.spec.ts
`-- helpers/

tests/unit/
|-- analysis-output.test.ts      # Removes follow-up offers from analysis reports.
|-- app-config.test.ts
|-- app-preferences.test.ts
|-- asset-paths.test.ts
|-- card-extraction.test.ts
|-- chapter-exporters.test.ts
|-- codex-client.test.ts
|-- codex-service.test.ts
|-- entity-services.test.ts
|-- i18n.test.ts
|-- image-generation.test.ts
|-- image-path.test.ts
|-- ipc-channel-groups.test.ts
|-- ipc.test.ts
|-- main-i18n.test.ts
|-- migrations.test.ts
|-- network-http.test.ts
|-- production-security.test.ts
|-- project-*.test.ts
|-- repository.test.ts
|-- rich-text.test.ts
|-- session.test.ts
|-- snapshots.test.ts
|-- styles-entrypoint.test.ts
`-- wiki-*.test.ts
```

### Documentation

```text
AGENTS.md         # Operational instructions for agents working on the repository.
README.md         # Main bilingual GitHub-facing page.
ISTRUZIONI.md     # Complete Italian user manual.
INSTRUCTIONS.md   # Complete English translation of the manual.
SECURITY_MODEL.md # Bilingual security notes.
MAPS.md           # This bilingual repository map.
LICENSE           # Apache 2.0 license.
```

### Generated or Local Directories

```text
node_modules/                # Local npm dependencies.
out/                         # electron-vite build output.
release/                     # Local packaging artifacts.
test-results/                # Playwright output.
test-results-codex-smoke/    # Local smoke test output.
.playwright-browsers/        # Playwright browsers local to the repo.
```

These directories are local outputs or dependencies and are not the normal entry point for source edits.
