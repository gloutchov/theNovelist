# The Novelist 4.5 - Milestones strutturali

Roadmap tecnica per portare il progetto verso una base piu modulare, configurabile e sicura senza riscrivere l'app. Le milestone sono ordinate per ridurre il rischio: prima si centralizzano i parametri, poi si spostano responsabilita dietro contratti stabili, infine si rafforzano distribuzione e hardening.

## Obiettivi 4.5

- Ridurre i file monolitici senza cambiare comportamento utente.
- Rendere espliciti tutti i default oggi embeddati nel codice.
- Migliorare privacy e sicurezza Electron.
- Preparare AI, immagini e wiki a evoluzioni successive.
- Mantenere typecheck, unit test ed e2e come rete di sicurezza durante ogni estrazione.

## Milestone 1 - Configurazione applicativa centrale

Obiettivo: introdurre un singolo punto di verita per default, limiti e policy.

Interventi:

- creare `src/main/config/app-config.ts` con default statici;
- creare un modulo di runtime config per gli override da variabili ambiente;
- spostare nella config i default AI: provider, fallback, modelli testo, modello immagini, timeout;
- spostare nella config i limiti wiki: dimensione massima file, risultati ricerca, budget memoria;
- spostare nella config i limiti immagini: formati ammessi, dimensione massima, directory di import/generazione;
- spostare nella config autosave, nomi directory progetto e parametri snapshot;
- aggiungere test sui default critici, soprattutto AI e privacy.

Note:

- il primo passaggio non deve cambiare comportamento;
- dopo l'introduzione della config si possono cambiare i default sensibili in modo esplicito e testato.

## Milestone 2 - Privacy AI e consenso esplicito

Obiettivo: rendere piu chiaro quando contenuti del romanzo possono lasciare il dispositivo.

Interventi:

- cambiare il default di `allowExternalMemorySharing` a `false` per i nuovi progetti;
- impostare la migrazione della colonna su default `0`, senza sovrascrivere scelte gia salvate nei progetti esistenti;
- mostrare nel pannello AI un riepilogo chiaro: provider attivo, fallback, API esterne, memoria progetto;
- mantenere `allowApiCalls` separato da `allowExternalMemorySharing`;
- aggiungere test che verifichino che la memoria wiki non venga allegata a provider esterni senza consenso.

Valore:

- riduce il rischio di invio involontario di contenuti privati;
- rende difendibile il comportamento privacy del prodotto.

## Milestone 3 - Hardening immagini e CSP

Obiettivo: ridurre superficie di attacco e consumo memoria mantenendo compatibili upload utente e immagini generate via API.

Interventi:

- aggiungere un limite dimensionale configurabile prima di leggere immagini da disco;
- validare tipo e firma immagine anche nei percorsi di lettura preview, non solo in import;
- distinguere immagini interne al progetto da URL esterni;
- restringere la CSP rimuovendo sorgenti remote dagli asset immagine;
- mantenere `data:`, `blob:` e `file:` solo dove necessari;
- aggiungere test per file troppo grandi, estensioni non ammesse e path traversal.

Compatibilita:

- le immagini generate via API non dovrebbero avere problemi: vengono salvate in `assets/generated-images` e poi lette come asset locale;
- gli upload utente non dovrebbero avere problemi se il limite massimo e realistico, per esempio 15-25 MB;
- il limite deve essere configurabile, perche immagini PNG o BMP possono essere pesanti;
- la CSP non deve includere `http:` o `https:` per `img-src`, perche le immagini remote non sono supportate.

## Milestone 4 - Scomposizione IPC per dominio

Obiettivo: rendere il processo main piu mantenibile e ridurre regressioni tra feature non correlate.

Interventi:

- creare `src/main/ipc/index.ts` per la registrazione aggregata;
- spostare gli schemi Zod in `src/main/ipc/schemas.ts`;
- dividere gli handler in moduli: `project`, `story`, `chapter`, `character`, `location`, `scene`, `timeline`, `revision`, `codex`, `wiki`;
- mantenere invariati i nomi dei canali in `src/shared/ipc-channels.ts`;
- aggiungere test di registrazione per evitare canali mancanti.

Regola:

- nessun cambio funzionale durante questa milestone; solo estrazione e copertura test.

Stato:

- chiusa: il registro principale IPC ora aggrega moduli per dominio e non contiene piu logica applicativa diretta;
- avviata con manifest dei canali IPC per dominio in `src/main/ipc/channel-groups.ts`;
- aggiunto registro tecnico in `src/main/ipc/registry.ts` per usare lo stesso inventario durante la pulizia degli handler;
- aggiunti test per garantire che nessun canale dichiarato in `src/shared/ipc-channels.ts` resti fuori dalla registrazione.
- spostati gli schemi Zod in `src/main/ipc/schemas.ts`, mantenendo i type export dal punto di ingresso IPC;
- estratto il primo modulo handler, `src/main/ipc/handlers/app.ts`, per ping e preferenze applicative.
- estratto `src/main/ipc/handlers/wiki.ts` per status, sync, ricerca e lettura sorgenti wiki.
- aggiunto `src/main/ipc/context.ts` ed estratto `src/main/ipc/handlers/timeline.ts`.
- estratto `src/main/ipc/handlers/story.ts` per trame, nodi narrativi e archi.
- estratto `src/main/ipc/revision-content.ts` per la costruzione degli snapshot di revisione.
- estratto `src/main/ipc/handlers/scene.ts` per le schede scena.
- estratto `src/main/ipc/handlers/revision.ts` per lettura, creazione, lista e restore revisioni.
- estratti `src/main/ipc/handlers/character.ts` e `src/main/ipc/handlers/location.ts` per schede, link capitoli e immagini locali/generate.
- estratto `src/main/ipc/handlers/project.ts` per ciclo progetto, snapshot, sessioni scrittura e lettura immagini locali.
- estratto `src/main/ipc/handlers/chapter.ts` per documenti capitolo, riferimenti, export/stampa capitoli e manoscritto.
- estratti `src/main/ipc/codex-runtime.ts` e `src/main/ipc/handlers/codex.ts` per runtime AI, impostazioni, chat, cronologia e cancellazione richieste.

## Milestone 5 - Service layer tra IPC e repository

Obiettivo: togliere logica applicativa dagli handler IPC.

Interventi:

- introdurre service per progetto, manoscritto, wiki, AI, immagini e revisioni;
- lasciare agli handler solo validazione input, chiamata service e validazione output;
- spostare helper come riepiloghi, snapshot revisioni e import immagini nei rispettivi service;
- mantenere errori utente in italiano vicino al service che conosce il dominio.

Valore:

- gli handler diventano sottili;
- la logica diventa testabile senza Electron.

Stato:

- chiusa: gli handler IPC ora restano sul ruolo di boundary Electron, con validazione input/output, dialog/stampa dove necessario e chiamate ai service;
- avviata con `src/main/services/project-context.ts`, punto condiviso per contesto progetto e sync wiki best effort;
- spostati gli snapshot/revision helper in `src/main/services/revision-content.ts`;
- introdotti `src/main/services/character-service.ts` e `src/main/services/location-service.ts` per schede, link capitoli e immagini;
- assottigliati gli handler IPC di personaggi e location: parse input, chiamata service, validazione output;
- spostati runtime e policy AI in `src/main/services/codex-runtime.ts` e `src/main/services/codex-service.ts`;
- assottigliato l'handler IPC Codex: impostazioni, status, assist, transform, chat, history e cancel passano dal service;
- introdotti `src/main/services/story-service.ts`, `src/main/services/scene-service.ts` e `src/main/services/timeline-service.ts`;
- assottigliati gli handler IPC di story, scene e timeline mantenendo invariati sync wiki, revisioni e validazioni progetto;
- introdotto `src/main/services/project-service.ts` per ciclo progetto, planning, snapshot, sessioni scrittura e lettura immagini locali;
- assottigliato l'handler IPC progetto lasciando nel layer IPC solo i dialog di sistema Electron;
- introdotto `src/main/services/wiki-service.ts` per status, sync, ricerca, lettura sorgenti e memoria progetto;
- assottigliato l'handler IPC wiki mantenendo solo parse input e validazione output;
- introdotto `src/main/services/chapter-service.ts` per documenti capitolo, autosummary, riferimenti e raccolta manoscritto;
- assottigliato l'handler IPC capitoli mantenendo nel layer IPC dialog, export e stampa;
- introdotto `src/main/services/revision-service.ts` per current snapshot, creazione, lista e restore revisioni;
- assottigliato l'handler IPC revisioni mantenendo solo validazione input/output;
- aggiunti test unitari diretti sui service in `tests/unit/entity-services.test.ts`.
- aggiunti test unitari AI in `tests/unit/codex-service.test.ts`, inclusa la protezione della memoria progetto verso provider esterni senza consenso.

## Milestone 6 - Repository SQLite per aggregati

Obiettivo: sostituire il repository unico con repository piu piccoli senza rompere i chiamanti.

Interventi:

- creare repository separati: project, plot, chapter, character, location, scene, timeline, codex, revision;
- mantenere temporaneamente `NovelistRepository` come facciata compatibile;
- spostare prima i metodi meno rischiosi, poi quelli con transazioni;
- aggiungere test per transazioni distruttive: delete plot, delete chapter, restore revision;
- documentare quali repository possiedono quali tabelle.

Valore:

- meno conflitti durante lo sviluppo;
- ownership piu chiara delle query.

Stato:

- avviata mantenendo un solo `project.db`: la divisione riguarda il codice, non i file SQLite;
- aggiunto `src/main/persistence/repositories/shared.ts` per mapper e helper comuni;
- estratti `ProjectRepository`, `StoryRepository`, `CharacterRepository`, `LocationRepository`, `SceneRepository`, `TimelineRepository`, `CodexRepository` e `RevisionRepository`;
- `NovelistRepository` resta la facciata compatibile e delega i domini estratti senza esporre SQL ai service.

Ownership tabelle:

- `ProjectRepository`: `projects`, riparazione path in `character_images` e `location_images`;
- `StoryRepository`: `plots`, `chapter_nodes`, `story_edges`, `chapter_documents`, `writing_sessions` e cleanup collegati su `timeline_items`;
- `CharacterRepository`: `character_cards`, `character_images`, `character_chapter_links`;
- `LocationRepository`: `location_cards`, `location_images`, `location_chapter_links`;
- `SceneRepository`: `scene_cards` e cleanup `timeline_items` delle scene;
- `TimelineRepository`: `timeline_settings`, `timeline_items`;
- `CodexRepository`: `codex_settings`, `codex_chat_messages`;
- `RevisionRepository`: `entity_revisions`.

## Milestone 7 - Refactor frontend incrementale

Obiettivo: ridurre la dimensione di `App.tsx` e dei componenti principali senza cambiare la UX.

Interventi:

- estrarre hook: sessione progetto, impostazioni AI, wiki status, dashboard, outline;
- estrarre modali progetto, target progetto, impostazioni AI e conferma chiusura;
- creare feature folder: dashboard, outline, memory, settings, plot;
- lasciare `App.tsx` come shell di navigazione e orchestrazione;
- spezzare `ChapterEditor.tsx` in toolbar, chat AI, find/replace, references, diff selection.

Regola:

- ogni estrazione deve essere piccola e verificata con typecheck e test mirati.

## Milestone 8 - CSS e componenti UI

Obiettivo: ridurre il rischio di regressioni visive causate da un CSS globale troppo grande.

Interventi:

- separare stili per aree: shell, editor, boards, modali, timeline, immagini;
- introdurre token CSS per colori, spaziature e stati;
- eliminare duplicazioni tra CharacterBoard e LocationBoard dove possibile;
- aggiungere screenshot e2e per schermate principali.

## Milestone 9 - Sicurezza Electron produzione

Obiettivo: rendere la build adatta a distribuzione reale.

Interventi:

- disabilitare DevTools, reload e force reload in produzione;
- mantenere DevTools disponibili solo in dev o con flag esplicito;
- verificare CSP finale con build pacchettizzata;
- aggiungere firma Windows;
- aggiungere firma e notarizzazione macOS;
- documentare prerequisiti dei certificati e workflow release.

## Milestone 10 - Verifica finale 4.5

Obiettivo: chiudere la release con controlli ripetibili.

Checklist:

- `npm run typecheck`;
- `npx vitest run tests/unit`;
- e2e principali su app buildata;
- smoke test Electron pacchettizzato;
- controllo manuale: creazione progetto, apertura progetto, editor capitolo, import immagine, generazione immagine, export DOCX/ePUB, AI con memoria disabilitata e abilitata;
- verifica che nessuna API key venga restituita al renderer in chiaro;
- verifica che i default privacy siano quelli documentati.

## Decisioni aperte

- Repository: mantenere una facciata a lungo termine o migrare i service direttamente ai repository specifici.

## Decisioni chiuse

- Immagini remote non supportate: le immagini devono essere locali nella cartella del progetto. La CSP puo quindi essere irrigidita rimuovendo sorgenti remote per gli asset immagine.
- Limite massimo immagini: 20 MB configurabili in `APP_CONFIG.images.maxUploadBytes`.
- Memoria progetto verso provider esterni disabilitata di default: l'utente deve abilitarla esplicitamente nelle Impostazioni AI.
