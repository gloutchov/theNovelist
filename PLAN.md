# Piano di sviluppo: dettatura negli editor

Stato al 26 settembre 2026: C1 pubblicata come tag `v6.1.0`; C2 pubblicata come tag e GitHub Release [`v6.2.0`](https://github.com/gloutchov/theNovelist/releases/tag/v6.2.0). Il branch `milestone/6.2.0-whisper-fallback` e stato integrato in `main`; la versione sorgente e `6.2.0`. La prova del microfono fisico su Windows rimane un limite noto, registrato in P1.

## Regole di esecuzione

- `C1` e `C2` registrano le milestone accettate e rilasciate. Dopo la checklist di chiusura, rinomina una voce `M` completata in `C`, mantenendo il numero. Eventuali idee future vanno in voci `P1`, `P2`, ecc. e non si eseguono senza riclassificazione esplicita del progettista.
- Ciascuna milestone parte da `main` aggiornato su un branch dedicato, cambia la versione sorgente e prevede un tag `vX.Y.Z`. Non riutilizzare o spostare tag esistenti.
- Al completamento di **ogni** milestone, presentare al progettista diff, risultati dei test, documentazione, versione/tag e costo previsto della CI. **Fermarsi prima di commit, merge, creazione del tag, push e rimozione del branch**; eseguire questi passaggi solo dopo avallo esplicito. L'approvazione di questo piano non autorizza automaticamente tali operazioni future.
- Eseguire localmente le verifiche applicabili prima di ogni push. Evitare push intermedi e workflow manuali non necessari. Le verifiche multipiattaforma restano obbligatorie quando microfono, motore locale o packaging non possono essere validati in modo affidabile su una sola piattaforma.

## Situazione tecnica e scelte iniziali

- Capitoli e scene usano gia lo stesso componente TipTap, `ChapterEditor.tsx`. La dettatura dovra riusare un unico controllo e una sola logica di inserimento nei due contesti.
- Le impostazioni AI attuali sono legate al progetto: `provider` e `fallbackProvider` gestiscono l'assistenza testuale con OpenAI API e Ollama; `apiImageModel` configura il modello immagini OpenAI. Ollama non e attualmente un provider di trascrizione e le immagini non hanno un fallback Ollama. La dettatura richiede impostazioni distinte per provider primario, modello remoto, modello locale e fallback.
- La [guida OpenAI Realtime transcription](https://developers.openai.com/api/docs/guides/realtime-transcription) consiglia `gpt-live-transcribe` per audio live dal microfono. Anche [`gpt-realtime-whisper`](https://developers.openai.com/api/docs/models/gpt-realtime-whisper) e un modello Realtime remoto; `gpt-transcribe` e un'opzione diversa per turni confermati. Il menu deve offrire almeno due modelli remoti verificati. Nessuno di questi equivale al fallback Whisper offline.
- [Whisper open source](https://github.com/openai/whisper) puo funzionare sul computer dell'utente. [`whisper.cpp`](https://github.com/ggml-org/whisper.cpp) e il candidato per l'integrazione locale Windows/macOS; motore, modello e distribuzione vanno validati prima di fissare le dipendenze. Il modello API `whisper-1` non e il fallback offline ed e [deprecato](https://developers.openai.com/api/docs/deprecations).
- Esperienza proposta: trascrizione parziale in anteprima, inserimento del solo testo finale nel punto del cursore con un'azione annullabile, senza tradurre la lingua dell'autore. Il testo gia presente non deve cambiare se registrazione o trascrizione falliscono.
- Nessun audio parte verso OpenAI senza avvio esplicito della dettatura, consenso remoto dedicato, `enabled`, `allowApiCalls` e chiave valida. L'audio non usa la memoria del progetto; `allowExternalMemorySharing` resta un consenso separato. Nessun audio o testo trascritto nei log.

## Decisioni registrate e verifiche aperte

1. M1 usa anteprima live e inserimento del solo testo finale dopo **Termina e inserisci**. **Annulla** o chiusura dell'editor elimina il turno senza inserimento. Non e prevista pausa in M1: un nuovo turno richiede un nuovo avvio.
2. Il menu C1 offre `gpt-live-transcribe` e `gpt-realtime-whisper`, documentati come modelli Realtime remoti. `gpt-transcribe` resta escluso perche usa un flusso a turno confermato diverso. Entrambi i modelli hanno prodotto un testo finale coerente con una breve frase sintetica italiana tramite l'API reale e la chiave gia salvata. Restano da verificare microfono fisico, inglese, latenza/accuratezza in uso reale e disponibilita su Windows; il progettista ha accettato la consegna con queste verifiche ancora aperte.
3. Le impostazioni sono per progetto, distinte da provider testuale e immagini: attivazione e consenso audio remoto dedicato inizialmente disattivati, lingua `auto/it/en`, primario OpenAI, fallback `nessuno`. La chiave protetta esistente viene riusata; `enabled` e `allowApiCalls` restano prerequisiti.
4. M2 usa `whisper.cpp` v1.9.4 tramite `whisper-cli` esterno e modello GGML multilingue. Il pacchetto dell'app non incorpora binario o modello: l'utente indica percorsi assoluti nelle impostazioni. Uno script opzionale scarica il modello tiny (circa 75 MiB) da Hugging Face con SHA-1 verificato. L'adapter usa la CPU per evitare un crash Metal osservato nel test macOS. Restano da validare Windows, microfono fisico e distribuzione dell'eseguibile per gli utenti finali.
5. Il fallback locale elabora un turno remoto fallito solo se l'audio e ancora disponibile entro limiti in memoria e senza duplicare il testo. La modalita locale non attiva mai un invio remoto implicito.

## C1 - Dettatura OpenAI negli editor

- **Stato:** implementazione accettata dal progettista; prove API reali dei due modelli superate su macOS con audio sintetico. Microfono fisico e Windows non verificati in questa milestone.
- **Branch:** `milestone/6.1.0-openai-dictation`.
- **Versione/tag:** `6.0.5` → `6.1.0` (`+0.1.0`), tag `v6.1.0` autorizzato dopo merge e verifiche.
- **Obiettivo:** dettare testo con OpenAI in capitoli e scene, con modello selezionabile e flusso completo di consenso, registrazione, anteprima e inserimento. Il fallback resta `nessuno` finche M2 non e completata.

Attivita principali:

- Registrare le decisioni iniziali sopra e la baseline aggiornata delle API ufficiali.
- Aggiungere configurazione validata e persistita per dettatura, separata dai modelli di testo e immagine: abilitazione, provider remoto, modello, lingua `auto/it/en`, limiti, timeout e consenso audio remoto. Conservare la chiave API nello storage protetto esistente.
- Implementare acquisizione microfono su richiesta, permessi Electron/macOS/Windows, stati `inattiva`, `permesso`, `registrazione`, `trascrizione`, `completata`, `annullata`, `errore`, e rilascio delle risorse a stop/chiusura editor.
- Instradare l'audio dal renderer al main process tramite IPC validato. Il main gestisce la sessione OpenAI Realtime e i segreti; imporre limiti di durata, dimensione e frequenza dei chunk, timeout e cancellazione.
- Offrire nel menu almeno `gpt-live-transcribe` e `gpt-realtime-whisper` dopo prove reali di entrambi; aggiungere `gpt-transcribe` solo se il modo a turno e implementato e verificato. Rendere chiara la differenza tra testo parziale e finale.
- Integrare un controllo condiviso nei due editor: anteprima del parlato, lingua configurabile, stop/annulla e inserimento del testo finale nella selezione/cursore TipTap con undo/redo e autosave coerenti.
- Aggiungere testi italiano/inglese e documentare permessi, dati inviati, costi e risoluzione dei problemi.
- Separare il push del tag dalla pubblicazione automatica modificando il workflow `Release` in modo che la build multipiattaforma parta solo su avvio manuale approvato. Il workflow attuale parte su ogni push di tag `v*`: verificare questa modifica prima del primo tag della milestone.

Criteri di accettazione:

- Capitolo e scena presentano lo stesso flusso; il testo finale entra una sola volta nella posizione prevista ed e annullabile. Chiusura editor, cambio scena, timeout, permesso negato o risposta invalida non alterano il testo preesistente.
- La dettatura parte solo per iniziativa dell'utente; audio remoto bloccato senza consenso e impostazioni AI necessarie. Nessuna chiave API arriva al renderer; audio e anteprime non sono salvati in log, crash report o file progetto. Solo il testo finale inserito dall'utente entra nel documento.
- Almeno due modelli remoti sono selezionabili e corrispondono a modi realmente implementati e verificati; se cio non e possibile, rivalutare la milestone con il progettista prima di dichiararla completata. Impostazioni invalide o modelli non disponibili producono un errore chiaro.
- UI e manuali sono completi in italiano e inglese; controlli leggibili nei temi chiaro/scuro e su layout desktop/mobile.

Test e verifiche:

- Unit test per macchina a stati, configurazione/consensi, limiti, cancellazione e inserimento TipTap con undo/redo.
- Integration test IPC con provider e microfono finti; test negativi per chunk malformati o eccessivi e assenza di log sensibili.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run test:e2e:electron`, `npm run build` e smoke test dell'app pacchettizzata. Verifica manuale del microfono su macOS e Windows o test multipiattaforma mirato se una piattaforma non e disponibile localmente.
- Verificare in locale la modifica del workflow; usare CI GitHub solo per il controllo che non puo essere sostituito localmente e dopo un push approvato.

Documentazione da aggiornare: `README.md`, `ISTRUZIONI.md`, `INSTRUCTIONS.md`, `SECURITY_MODEL.md`, `MAPS.md`, `PLAN.md`, `AGENTS.md` se cambiano regole, e note sul workflow di release.

Decisione release: il tag `v6.1.0` e autorizzato; la GitHub Release intermedia non e automatica e non e inclusa nell'avallo a commit, merge, tag, push e rimozione del branch. Il workflow `Release` resta manuale.

Verifica locale del 26 settembre 2026: `typecheck`, `lint` (solo warning preesistenti), 111 unit test, 41 test e2e browser, 3 test e2e Electron e build passano. Il pacchetto macOS arm64 e stato creato, avviato, verificato con `codesign` e controllato per le descrizioni localizzate del permesso microfono quando l'output e in `/private/tmp`. `npm run pack` nella cartella del progetto si ferma invece su attributi Finder/FileProvider durante `codesign`; non e un errore di compilazione dell'app. La cross-build Windows x64 locale non puo completarsi perche il download del runtime Electron da GitHub e bloccato dal DNS dell'ambiente. Nessuna CI GitHub e stata usata prima dell'avallo al push.

Verifica API reale del 26 settembre 2026: aperta soltanto una copia temporanea del progetto di test dell'utente nella build macOS pacchettizzata. La chiave gia protetta dall'app e risultata disponibile senza leggerla o copiarla. Una frase sintetica italiana di circa 3,5 secondi ha prodotto testo finale con parole attese sia con `gpt-live-transcribe` sia con `gpt-realtime-whisper`. Anche il pulsante dell'editor capitolo ha inserito una sola volta il testo finale tramite API reale e flusso audio sintetico. Il permesso macOS per il microfono fisico risulta ancora `not-determined`; quella prova richiedera un consenso di sistema. Restano la prova del microfono fisico e la verifica su Windows. La copia temporanea e stata eliminata dopo i test; nessuna trascrizione o chiave e stata stampata nei log di verifica.

Identita per il gate Git: account GitHub autenticato `gloutchov`, tag `v6.1.0` assente in locale e su `origin` prima dell'integrazione. Il progettista ha scelto `Gloutchov <gloutchov@gmail.com>` per commit, merge e tag, coerente con `AGENTS.md` e con l'ultima release `v6.0.5`.

## C2 - Whisper offline e fallback selezionabile

- **Stato:** implementazione accettata e release multipiattaforma pubblicata; prova del microfono fisico Windows registrata come limite residuo in P1.
- **Branch:** `milestone/6.2.0-whisper-fallback`, integrato in `main`.
- **Versione/tag:** `6.1.0` → `6.2.0` (`+0.1.0`), tag e release `v6.2.0` pubblicati.
- **Obiettivo:** completare la dettatura con modalita solo locale e fallback automatico OpenAI → Whisper locale selezionabile, funzionanti su macOS e Windows.

Attivita principali:

- Implementare un adapter per il motore Whisper locale scelto, isolato dal renderer e dal provider OpenAI, con gestione del modello multilingue selezionato, stato di installazione, cancellazione, timeout e pulizia di eventuali file temporanei.
- Aggiungere al menu provider primario `OpenAI` o `Whisper locale`, modello remoto e modello locale, fallback `nessuno` o `Whisper locale` quando il primario e OpenAI. Bloccare combinazioni uguali, non disponibili o capaci di inviare audio remoto senza consenso.
- Bufferizzare solo il turno audio necessario e con limite; se OpenAI fallisce, ritrascriverlo localmente una sola volta, mostrare il passaggio di provider e inserire un solo testo finale. Se Whisper non e pronto, lasciare il testo esistente intatto e spiegare come attivarlo.
- Verificare il funzionamento offline reale, anche con rete scollegata, e impedire che una sessione locale apra connessioni OpenAI. Ollama resta indipendente dalla trascrizione.
- Integrare binario/modello o download opzionale verificato secondo la decisione registrata, con percorsi confinati alle directory applicative, licenze, checksum e aggiornamenti documentati.
- Rifinire accessibilita, ergonomia, inserimento in presenza di selezioni, auto-save e comportamento con pause, nomi propri e frasi lunghe.

Criteri di accettazione:

- La dettatura locale produce testo in capitoli e scene senza rete. Il fallback configurato si attiva solo nei casi documentati, e l'utente vede quale provider ha prodotto il testo.
- Nessun audio passa a OpenAI in modalita locale; nessun fallback remoto implicito. Errori, annullamento e chiusura editor non lasciano processi o file audio residui e non duplicano testo.
- Installazione e funzionamento sono verificati negli artifact macOS/Windows; requisiti hardware, dimensione del modello, licenze e comportamento offline sono documentati.

Test e verifiche:

- Unit/integration test per scelta provider, fallback, deduplicazione, limiti, errori, cleanup, preferenze migrate e assenza di rete remota nella modalita locale.
- E2E browser con provider e microfono simulati; E2E Electron e prove manuali con microfono reale su macOS e Windows, incluso offline e un errore OpenAI durante un turno.
- `npm run lint`, `npm run typecheck`, `npm run test`, `npm run test:e2e`, `npm run test:e2e:electron`, `npm run build`, `npm run pack` e smoke test degli artifact reali. Ricostruire i moduli nativi per Electron/Node se l'adapter ne aggiunge e ripristinare il target Node dopo i test Electron.
- Un solo ciclo CI/packaging multipiattaforma dopo i controlli locali e l'avallo al push, con verifica dei risultati e degli SHA-256 prima della release.

Documentazione da aggiornare: `README.md`, `ISTRUZIONI.md`, `INSTRUCTIONS.md`, `SECURITY_MODEL.md`, `MAPS.md`, `PLAN.md`, `AGENTS.md` se cambiano regole, licenze dei componenti locali e istruzioni di packaging.

Decisione release: il progettista ha autorizzato commit, merge, tag, push, release per macOS e Windows e rimozione del branch. Il workflow `Release` e stato avviato una volta sul tag `v6.2.0` dopo la CI verde; la GitHub Release e pubblicata.

Verifiche C2 del 26 settembre 2026: typecheck, lint (solo 22 warning preesistenti), 118 test unitari, 45 e2e browser e 5 e2e Electron passano in locale. Altri 2 smoke test unitari con `whisper-cli` Homebrew v1.9.4 e modello tiny multilingue verificato passano, compresa la cancellazione senza WAV residui. Un turno reale con audio sintetico italiano passa tramite adapter, IPC e app macOS pacchettizzata senza chiave o consenso remoto. Il progettista riferisce una prova manuale positiva della dettatura e del fallback sul proprio Mac. Il download opzionale del modello ha verificato il checksum ufficiale. `npm run pack` nella cartella sincronizzata resta impedito dagli attributi Finder/FileProvider durante `codesign`; una copia temporanea pulita produce invece un'app macOS arm64 valida. La landing bilingue e stata aggiornata con screenshot reali dell'editor e verificata su desktop e mobile; GitHub Pages ha pubblicato la pagina. La CI su `main` e verde. Il workflow Release ha costruito macOS arm64 e Windows x64 e pubblicato nove asset con SHA-256 corrispondenti ai digest GitHub. La prova del microfono fisico su Windows resta aperta ed e stata accettata come limite noto del rilascio.

## C3 - Electron 45.4.1

- **Stato:** chiusa. PR #18 integrata in `main`. Tag `milestone/C3` e `v6.3.0` pubblicati su `b3303534`. GitHub Release `v6.3.0` pubblicata.
- **Branch:** `milestone/3-electron-45-4-1`, da `main` `871bbf2`.
- **Versione/tag:** `6.2.0` → `6.3.0` (`+0.1.0`). Tag `v6.3.0` e `milestone/C3` pubblicati su `b3303534`. GitHub Release `v6.3.0` pubblicata.
- **Obiettivo:** sostituire Electron 40, fuori supporto dal 1 luglio 2026, con il pin esatto `45.4.1`, assorbendo la PR di sicurezza Dependabot #14. Le PR #15, #16 e #17 non restano nel lockfile: i pacchetti non sono piu dipendenze dopo questo aggiornamento.

Attivita principali:

- Fissare `electron` a `45.4.1` senza `^` o `~`, aggiornare il lockfile e le dipendenze di sicurezza del gruppo #14 (`zod`, `vite`, `vitest`, `electron-builder`, `electron-vite` e transitive elencate nella PR). Non assorbire la major di `eslint` 9 → 10.
- Portare `better-sqlite3` da `12.6.2` a `13.2.0`: la serie 12 non compila contro il V8 di Electron 45 (`GetPrototypeV2` e `External::Value`).
- Passare `safeStorage` alle API asincrone, deprecate in forma sincrona dalla 45 e rimosse nella 46. Se la rotazione chiede `shouldReEncrypt`, la riscrittura della chiave e atomica (file temporaneo e `rename`). `setStoredCodexApiKey` resta una scrittura diretta: limite residuo, non modificato.
- Verificare le breaking change Electron 41-45: il preload sandboxed non usa `Buffer`, `setImmediate` o `require` di `events`/`timers`/`url`; non ci sono protocolli custom, `clearStorageData({ quotas })` o cattura schermo.

Criteri di accettazione:

- `package.json` e il lockfile risolvono Electron `45.4.1` esatto.
- Le versioni del gruppo di sicurezza #14 sono presenti, o il pacchetto non e piu nel lockfile.
- Lint, typecheck, unit, e2e browser, e2e Electron, build e smoke del pacchetto locale passano, oppure l'omissione e motivata.
- Documentazione IT/EN allineata: versione sorgente `6.3.0`, requisito macOS 13.

Test richiesti: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:e2e`, `npm run test:e2e:electron`, `npm run build`, `npm run pack` e avvio dello smoke sul pacchetto.

Documentazione: `README.md`, `ISTRUZIONI.md`, `INSTRUCTIONS.md`, `SECURITY_MODEL.md`, `MAPS.md`, `PLAN.md`, `docs/index.html`.

Decisione release: eseguita. Tag `v6.3.0` e GitHub Release `v6.3.0` pubblicati.

Verifiche locali del 23 novembre 2026: lint (0 errori, 22 warning preesistenti), typecheck, 120 test unitari (2 smoke Whisper gia saltati), 45 e2e browser, 3 e2e Electron (2 Whisper saltati). Il primo giro Electron senza `LANG=it_IT.UTF-8` non trovava il pulsante `Crea` perche il locale della macchina e inglese. `npm run build` e `npm run pack` producono `release/linux-unpacked` con Electron 45.4.1; il binario parte e, chiuso, non lascia processi. `dist:mac` e `dist:win` non eseguiti: questa macchina e Linux. La CI della PR #18 su `a3241fe0` e verde (`quality` e Electron Smoke macOS).

Limiti residui di questa milestone: `minimatch` (PR Dependabot #147) non e chiuso, la correzione e solo in `11.0.1` ed e una dipendenza di sviluppo; `flatted` e a `3.4.4` e `picomatch` a `4.0.7`. La landing in `docs/index.html` e stata portata a `6.3.0` con la PR #21 dopo la release.

### English

- **Status:** closed. PR #18 is in `main`. Tags `milestone/C3` and `v6.3.0` are published on `b3303534`. GitHub Release `v6.3.0` is published.
- **Version/tag:** `6.2.0` → `6.3.0` (`+0.1.0`). Tags `v6.3.0` and `milestone/C3` are published on `b3303534`. GitHub Release `v6.3.0` is published.
- **Goal:** replace unsupported Electron 40 with exact `45.4.1` and absorb Dependabot security PR #14. PRs #15, #16, and #17 do not remain in the lockfile: those packages are no longer dependencies after this update. Key rotation rewrites the ciphertext atomically. `minimatch` (Dependabot PR #147) stays open: the fix exists only in `11.0.1` and it is a development dependency. `flatted` is `3.4.4` and `picomatch` is `4.0.7`. `setStoredCodexApiKey` still writes directly. The landing page was later set to `6.3.0` by PR #21.

### Checklist di chiusura

- [x] Branch dedicato da `main` aggiornato; worktree e identita verificati.
- [x] Electron `45.4.1` esatto, lockfile e PR #14 assorbiti; eslint 9 non portato a 10.
- [x] Test automatici, build e smoke Linux eseguiti; `dist:mac` e `dist:win` omessi perche il workflow `Release` parte solo da un tag.
- [x] Versione sorgente `6.3.0` allineata. `docs/index.html` e stato pubblicato a `6.3.0` con la PR #21 dopo la release. Documentazione e modello di sicurezza aggiornati.
- [x] Prima approvazione ricevuta: voce rinominata da `M3` a `C3`.
- [x] Diff, test, tag previsto `v6.3.0` e CI della PR #18 su `a3241fe0` presentati.
- [x] Merge della PR #18, tag `milestone/C3` e `v6.3.0`, e GitHub Release `v6.3.0` pubblicati.

## Patch 6.3.1 - Dipendenze dev e runtime

- **Stato:** pubblicata come PR #22, approvata da Glauco il 23/11 per merge, tag e release v6.3.1.
- **Branch:** `patch/6.3.1-deps`, da `main` `6faaace`.
- **Versione/tag:** `6.3.0` → `6.3.1` (`+0.0.1`). Tag previsto `v6.3.1`, non creato. La release e prevista perche il gruppo runtime cambia, e resta al progettista. `docs/index.html` resta `6.3.0` fino a quella release.
- **Obiettivo:** assorbire le PR Dependabot #19 (dev, 6 pacchetti) e #20 (runtime minor/patch) senza cambiare il comportamento. La major `eslint` 10 della PR #12 non entra: con `eslint-plugin-react-hooks` 7.1.1 il peer accetta gia `eslint` 10, quindi il conflitto di peer di prima non c'e piu; resta una decisione separata.

Correzioni: 13 `react-hooks/set-state-in-effect` dopo il plugin 7.1.1, e il tipo `OnNodeDrag` al posto di `NodeMouseHandler` per `onPlotNodeDragStop` con `@xyflow/react` 12.12.1. `@tiptap/core` e `@tiptap/pm` scendono da `3.35.0` a `3.34.0`, allineati agli altri pacchetti TipTap `3.34.0`.

### English

- **Status:** published as PR #22, approved by Glauco on 23/11 for the merge, the tag, and release v6.3.1.
- **Version/tag:** `6.3.0` → `6.3.1` (`+0.0.1`). Proposed tag `v6.3.1`, not created. A release is expected because runtime dependencies change, and it stays with the designer. `docs/index.html` stays `6.3.0` until that release.
- **Goal:** absorb Dependabot PRs #19 and #20 without changing behavior. ESLint 10 from PR #12 is not included. `eslint-plugin-react-hooks` 7.1.1 already accepts ESLint 10, so the previous peer conflict is gone; moving to ESLint 10 remains a separate decision. `@tiptap/core` and `@tiptap/pm` move down from `3.35.0` to `3.34.0`, aligned with the other TipTap `3.34.0` packages.

## Patch 2026-11-24 - GitHub Actions (PR #9)

### Italiano

- **Stato:** PR #9 integrata in `main` su `59659e8` dopo CI #126 verde; la verifica post-merge include la correzione Pages descritta sotto. Merge dopo le verifiche e rimozione dei branch autorizzati dal progettista.
- **Branch:** `dependabot/github_actions/github-actions-0b0ffa02fd`, aggiornato con `main` `982bbb6` dopo la richiesta di rebase a Dependabot.
- **Versione/tag/release:** versione sorgente invariata (`6.3.1`); nessun nuovo tag o rilascio dell'app.
- **Modifiche:** `checkout` e `setup-node` v7, `upload-pages-artifact` v5, `download-artifact` v8. Pages mantiene i file nascosti di `docs`, compreso `.nojekyll`, tramite `include-hidden-files: true`. Il download degli artifact di release mantiene il controllo digest bloccante predefinito.
- **Verifiche locali:** actionlint senza errori sui tre workflow; YAML e input confrontati con le definizioni ufficiali delle Actions; archivio Pages creato con lo script ufficiale e confrontato con tutti i 62 file di `docs`, inclusi `.nojekyll` e `CNAME`. Contratti degli artifact di release e avvio esclusivamente manuale di Release verificati staticamente. I test applicativi restano affidati alla CI della PR: le dipendenze locali non sono installate e il codice dell'app non cambia.
- **Gate di integrazione:** CI verde sulla PR aggiornata prima del merge; verifica di CI e Pages su `main` prima della rimozione del branch. Nessun workflow Release avviato.
- **Correzione post-merge:** il run Pages `45376871191` ha caricato l'artifact ma il deploy non lo ha trovato immediatamente, comportamento coerente con [actions/deploy-pages#451](https://github.com/actions/deploy-pages/issues/451). Il branch `patch/pages-artifact-deployment` separa preparazione/upload nel job `build` dalla pubblicazione nel job `deploy`, con `needs: build`; mantiene archivio, permessi e dominio esistenti. Nessun ritardo fisso o nuovo tentativo cieco aggiunto al workflow.

### English

- **Status:** PR #9 merged into `main` at `59659e8` after successful CI #126; post-merge validation includes the Pages correction below. The designer authorized merging after validation and removing the branches.
- **Branch:** `dependabot/github_actions/github-actions-0b0ffa02fd`, updated with `main` `982bbb6` after requesting a Dependabot rebase.
- **Version/tag/release:** source version unchanged (`6.3.1`); no new tag or app release.
- **Changes:** `checkout` and `setup-node` v7, `upload-pages-artifact` v5, `download-artifact` v8. Pages preserves hidden files in `docs`, including `.nojekyll`, using `include-hidden-files: true`. Release artifact downloads retain the default blocking digest check.
- **Local validation:** actionlint reports no errors on all three workflows; YAML and inputs checked against official Action definitions; the Pages archive was built with the official script and compared with all 62 files in `docs`, including `.nojekyll` and `CNAME`. Release artifact contracts and the manual-only Release trigger were checked statically. Application tests remain covered by PR CI: local dependencies are not installed and app code is unchanged.
- **Integration gate:** green CI on the updated PR before merging; verify CI and Pages on `main` before deleting the branch. No Release workflow dispatched.
- **Post-merge correction:** Pages run `45376871191` uploaded the artifact, but deployment could not find it immediately, consistent with [actions/deploy-pages#451](https://github.com/actions/deploy-pages/issues/451). Branch `patch/pages-artifact-deployment` separates preparation/upload in the `build` job from publication in the `deploy` job, with `needs: build`; it preserves the archive, permissions, and domain. No fixed delay or blind retry was added to the workflow.

## Patch 2026-11-24 - ESLint 10 (PR #12)

### Italiano

- **Stato:** migrazione della PR #12 richiesta dal progettista; integrazione subordinata alla CI verde sulla PR aggiornata e su `main`.
- **Branch:** `dependabot/npm_and_yarn/eslint-10.13.0`, aggiornato con `main` `fc214ed`.
- **Versione/tag/release:** versione sorgente invariata (`6.3.1`); aggiornamento dei soli strumenti di sviluppo, senza nuovo tag o release dell'app.
- **Modifiche:** ESLint `9.39.4` → `10.15.0`, lockfile e requisito Node `^22.13.0 || >=24.0.0` allineati. La versione `10.13.0` proposta originariamente usa `minimatch` vulnerabile; `10.15.0` risolve a `minimatch` `11.0.9`. Le modifiche al grafo riguardano 41 pacchetti di sviluppo; dipendenze runtime, sorgenti e script dell'app restano invariati.
- **Regole lint:** configurazione flat esistente e profilo `@eslint/js` `9.39.4` conservati per mantenere le regole attuali. `typescript-eslint`, React Hooks e React Refresh dichiarano supporto a ESLint 10.
- **Verifiche locali:** ESLint `10.15.0` e plugin installati in ambiente isolato: 0 errori e 21 warning. Controllati coerenza del lockfile, requisito Node e assenza di variazioni runtime. Audit confrontato con `main`: stesso insieme di 6 segnalazioni moderate, nessuna nuova segnalazione per ESLint; il limite `minimatch` del packaging resta aperto.
- **Limite ambiente:** l'installazione completa su Windows e interrotta da `ECONNRESET` nel download di `electron-winstaller` `5.4.0`, dipendenza preesistente di packaging. Typecheck, unit test, build, e2e browser e smoke Electron sono quindi affidati alla CI sulla PR aggiornata; nessun workflow Release necessario.

### English

- **Status:** the designer requested the migration in PR #12; integration requires successful CI on the updated PR and on `main`.
- **Branch:** `dependabot/npm_and_yarn/eslint-10.13.0`, updated with `main` `fc214ed`.
- **Version/tag/release:** source version unchanged (`6.3.1`); development tooling update, with no new tag or app release.
- **Changes:** ESLint `9.39.4` → `10.15.0`, synchronized lockfile and Node requirement `^22.13.0 || >=24.0.0`. The originally proposed `10.13.0` uses vulnerable `minimatch`; `10.15.0` resolves to `minimatch` `11.0.9`. The graph changes affect 41 development packages; runtime dependencies, application sources, and scripts are unchanged.
- **Lint rules:** the existing flat configuration and `@eslint/js` `9.39.4` profile preserve the current rules. `typescript-eslint`, React Hooks, and React Refresh declare ESLint 10 support.
- **Local validation:** ESLint `10.15.0` and plugins installed in an isolated environment: 0 errors and 21 warnings. Lockfile consistency, Node requirements, and unchanged runtime dependencies checked. Audit compared with `main`: the same set of 6 moderate reports, with no new ESLint report; the packaging `minimatch` limitation remains open.
- **Environment limitation:** full installation on Windows is interrupted by `ECONNRESET` while downloading `electron-winstaller` `5.4.0`, an existing packaging dependency. Typecheck, unit tests, build, browser e2e, and Electron smoke are therefore covered by CI on the updated PR; no Release workflow is needed.

## P1 - Verifica della dettatura con microfono fisico su Windows

- **Stato:** da pianificare; nessuna esecuzione prevista senza riclassificazione esplicita.
- **Obiettivo:** provare sull'installer e sulla build portable Windows x64 la dettatura OpenAI, Whisper locale, fallback e permessi microfono con un dispositivo fisico.
- **Esito atteso:** documentare risultati e eventuali correzioni in una successiva milestone o patch dedicata.

## Patch 2026-11-23 - Configurazione Dependabot standard

Patch di sola configurazione. Versione sorgente invariata (`6.2.0`). Nessun tag e nessuna GitHub Release: la modifica non cambia il comportamento dell'app.

### Italiano

- **Stato:** completata: PR #8 integrata in main, nessun tag e nessuna release.
- **Branch:** `patch/dependabot-standard`, creato da `main`.
- **Versione/tag:** nessuna variazione (`6.2.0`). Nessun tag.
- **Release:** no.
- **Contesto:** il 23 novembre 2026 il progettista ha dichiarato di nuovo attivo il progetto. Vale il modello Dependabot completo, non la variante per repository inattivi: npm in `/` (`package.json`) e GitHub Actions per `ci.yml`, `pages.yml` e `release.yml`.
- **Electron:** la dipendenza resta `^40.8.0` (risolta a `40.8.0`). Lo standard ignora le major di `electron`; con questo ignore il repository resta sulla 40 fino a una milestone dedicata. La decisione di aggiornare la major resta al progettista e non fa parte di questa patch.
- **File:** `.github/dependabot.yml`. Cadenza mensile alle 08:00 Europe/Rome. Gruppi npm `electron`, `runtime-minor-patch`, `dev-minor-patch` e `security`; gruppo unico `github-actions`.
- **Verifiche locali:** `npm run lint` (0 errori, 22 warning preesistenti), `npm run typecheck` e `npm test` (118 passati, 2 smoke Whisper gia saltati). Non eseguiti e2e, build e smoke Electron: la patch non tocca codice, IPC o layout.

### English

- **Status:** completed: PR #8 integrated into main, no tag and no release.
- **Branch:** `patch/dependabot-standard`, created from `main`.
- **Version/tag:** unchanged (`6.2.0`). No tag.
- **Release:** no.
- **Context:** on 23 November 2026 the designer declared the project active again. The full Dependabot model applies, not the inactive-repository variant: npm at `/` (`package.json`) and GitHub Actions for `ci.yml`, `pages.yml`, and `release.yml`.
- **Electron:** the dependency stays `^40.8.0` (resolved to `40.8.0`). The standard ignores `electron` major updates; with this ignore the repository stays on 40 until a dedicated milestone. Moving to a new major remains the designer's decision and is outside this patch.
- **Files:** `.github/dependabot.yml`. Monthly schedule at 08:00 Europe/Rome. npm groups `electron`, `runtime-minor-patch`, `dev-minor-patch`, and `security`; a single `github-actions` group.
- **Local checks:** `npm run lint` (0 errors, 22 pre-existing warnings), `npm run typecheck`, and `npm test` (118 passed, 2 Whisper smoke tests already skipped). E2E, build, and Electron smoke were not run: the patch does not touch code, IPC, or layout.

## Checklist di chiusura per ogni milestone

- [ ] Branch dedicato creato dalla baseline prevista; worktree e identita Git/GitHub verificati.
- [ ] Criteri di accettazione soddisfatti; diff e nuove dipendenze revisionati.
- [ ] Test automatici, manuali, sicurezza e packaging richiesti eseguiti; test omessi motivati.
- [ ] Versione allineata nei file canonici; README, manuali, modello di sicurezza, mappa e piano aggiornati secondo l'impatto.
- [ ] Assenza di segreti, audio e anteprime nei log, nei file progetto e nelle fixture verificata; solo il testo finale accettato dall'utente viene persistito nel documento.
- [ ] Stato della milestone aggiornato da `M` a `C` solo quando la checklist e realmente soddisfatta.
- [ ] Diff, test, tag previsto, operazioni Git e costo CI presentati al progettista; lavoro fermo prima di commit, merge, tag, push e rimozione del branch.
- [ ] Dopo avallo: commit e merge approvati, tag verificato e creato/pushato se approvato, CI o release necessaria verificata, branch rimosso solo se approvato e non piu necessario.
