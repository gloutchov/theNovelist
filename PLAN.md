# Piano di sviluppo: dettatura negli editor

Stato al 26 settembre 2026: C1 approvata dal progettista per la versione sorgente `6.1.0`; M2 resta pianificata. Il progettista ha autorizzato commit, merge, tag, push e rimozione del branch `milestone/6.1.0-openai-dictation`. Le verifiche non eseguite sono registrate sotto C1.

## Regole di esecuzione

- `C1` registra la milestone accettata e `M2` e la prossima milestone esecutiva. Dopo la checklist di chiusura, rinomina una voce `M` completata in `C`, mantenendo il numero. Eventuali idee future vanno in voci `P1`, `P2`, ecc. e non si eseguono senza riclassificazione esplicita del progettista.
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
4. Motore Whisper locale, modello, distribuzione, licenze e requisiti hardware sono decisioni di M2 e richiedono prova macOS/Windows prima dell'integrazione.
5. Il futuro fallback locale potra elaborare un turno remoto fallito solo se l'audio e ancora disponibile entro limiti in memoria e senza duplicare il testo. Il fallback locale non attivera mai un invio remoto implicito.

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

## M2 - Whisper offline e fallback selezionabile

- **Stato:** pianificata, dopo C1.
- **Branch:** `milestone/6.2.0-whisper-fallback`, da `main` aggiornato dopo M1.
- **Versione/tag:** `6.1.0` → `6.2.0` (`+0.1.0`), tag previsto `v6.2.0` dopo avallo, merge e verifiche.
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

Decisione release: dopo verifica completa, proporre GitHub Release `v6.2.0` con artifact macOS/Windows e checksum. Avvio manuale solo dopo approvazione esplicita.

## Checklist di chiusura per ogni milestone

- [ ] Branch dedicato creato dalla baseline prevista; worktree e identita Git/GitHub verificati.
- [ ] Criteri di accettazione soddisfatti; diff e nuove dipendenze revisionati.
- [ ] Test automatici, manuali, sicurezza e packaging richiesti eseguiti; test omessi motivati.
- [ ] Versione allineata nei file canonici; README, manuali, modello di sicurezza, mappa e piano aggiornati secondo l'impatto.
- [ ] Assenza di segreti, audio e anteprime nei log, nei file progetto e nelle fixture verificata; solo il testo finale accettato dall'utente viene persistito nel documento.
- [ ] Stato della milestone aggiornato da `M` a `C` solo quando la checklist e realmente soddisfatta.
- [ ] Diff, test, tag previsto, operazioni Git e costo CI presentati al progettista; lavoro fermo prima di commit, merge, tag, push e rimozione del branch.
- [ ] Dopo avallo: commit e merge approvati, tag verificato e creato/pushato se approvato, CI o release necessaria verificata, branch rimosso solo se approvato e non piu necessario.
