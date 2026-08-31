# PLAN.md

Piano operativo e di sviluppo di The Novelist.

## Regole del piano

- Le milestone devono essere funzionali oppure descrivere una base tecnica necessaria a una funzionalita successiva.
- Ogni milestone o patch specifica obiettivo, branch, incremento versione, attivita, criteri di accettazione, test, documentazione e stato.
- Stati ammessi: `pianificata`, `in corso`, `in verifica`, `completata`, `bloccata`.
- Il merge su `main` richiede l'avallo esplicito del progettista, salvo istruzione contraria.
- Tag e GitHub Release sono separati dal bump di versione e seguono le regole di `AGENTS.md`.

## Baseline completata

### Versione 6.0.4 - Applicazione e distribuzione

- Stato: `completata`.
- Branch: `main`.
- Risultato: applicazione desktop Electron per pianificazione, scrittura, revisione, memoria Wiki, fonti esterne, export e assistenza AI opzionale.
- Piattaforme documentate: Windows e macOS.
- Documentazione esistente: README bilingue, manuali italiano/inglese, modello di sicurezza e mappa repository.

Questa voce registra la baseline esistente; non ricostruisce retroattivamente le checklist delle milestone precedenti.

## Patch attiva

### Versione 6.0.5 - Allineamento preferenze operative

- Stato: `in verifica`.
- Branch: `patch/6.0.5-startup-preferences`.
- Tipo incremento: `+0.0.1`.
- Obiettivo: adattare al repository la baseline `STARTUP_PREFERENCES.md` senza modificare il comportamento dell'applicazione.

Attivita principali:

- [x] Creare il branch patch dedicato.
- [x] Rendere esplicita la gerarchia tra `AGENTS.md`, `STARTUP_PREFERENCES.md`, `PLAN.md` e `SECURITY_MODEL.md`.
- [x] Integrare regole su identita Git/GitHub, branch, merge, versioning, release e uso proporzionato della CI.
- [x] Registrare `MAPS.md` come eccezione specifica al nome generico `MAP.md`.
- [x] Aggiungere un controllo locale e CI dei documenti obbligatori.
- [x] Sincronizzare versione e riferimenti documentali.
- [x] Eseguire i controlli applicabili e revisionare il diff.

Criteri di accettazione:

- `AGENTS.md` conserva tutte le istruzioni tecniche specifiche del progetto e incorpora le nuove regole di governance.
- `PLAN.md` descrive la baseline, la patch attiva e la checklist di chiusura.
- `README.md` e `MAPS.md` collegano i documenti di governance.
- Il controllo dei documenti obbligatori passa localmente ed e incluso nella CI esistente.
- Nessun comportamento runtime, dato utente o dipendenza applicativa viene modificato.
- L'identita Git locale prevista e verificata; le operazioni GitHub restano sospese se l'autenticazione non e valida.

Test richiesti:

- `npm run docs:check`
- `npm run lint`
- `npm run typecheck`

Test non richiesti per questa patch documentale:

- unit test, e2e browser ed e2e Electron, salvo modifiche impreviste a codice applicativo o configurazione runtime;
- packaging, perche non cambia il contenuto dell'app distribuita.

Esito verifica locale:

- `npm run docs:check`: superato.
- `npm run lint`: superato con 22 warning preesistenti e nessun errore.
- `npm run typecheck`: superato.
- Prettier mirato: i nuovi `PLAN.md` e `scripts/check-required-docs.mjs` sono conformi; il controllo sui sei file storici modificati richiederebbe una riscrittura formattante estesa, non eseguita per mantenere il diff circoscritto.
- Unit, e2e e packaging: non eseguiti perche la patch non modifica codice applicativo o configurazione runtime.
- GitHub CLI: autenticazione non valida durante la verifica; nessun push, PR, tag, release o workflow manuale eseguito.

Documentazione interessata:

- `AGENTS.md`
- `STARTUP_PREFERENCES.md`
- `PLAN.md`
- `README.md`
- `MAPS.md`

Decisione release:

- Il bump sorgente e `6.0.5`.
- Essendo una patch di governance/documentazione, tag e GitHub Release richiedono una decisione esplicita del progettista dopo merge e verifiche.

## Patch pianificata

### Versione 6.0.6 - Hardening delle dipendenze

- Stato: `pianificata`.
- Branch previsto: `patch/6.0.6-dependency-security`.
- Tipo incremento: `+0.0.1`.
- Obiettivo: correggere o mitigare le vulnerabilita delle dipendenze con aggiornamenti controllati, verificando separatamente il rischio runtime e quello degli strumenti di sviluppo, test e packaging.

Baseline rilevata il 31 agosto 2026 con il lockfile della versione 6.0.5:

- audit completo: 28 vulnerabilita (`2 low`, `1 moderate`, `22 high`, `3 critical`);
- audit delle sole dipendenze di produzione: 3 vulnerabilita (`1 moderate`, `2 high`, `0 critical`);
- dipendenze dirette segnalate nell'audit completo: `@vitest/coverage-v8`, `vitest`, `electron`, `electron-builder` e `vite`;
- la severita dell'audit non dimostra da sola la raggiungibilita nell'app pacchettizzata: ogni advisory deve essere collegato al relativo percorso di dipendenza e alla superficie realmente distribuita.

Attivita principali:

- [ ] Acquisire e revisionare `npm audit --json` e `npm audit --omit=dev --json` senza includere credenziali o dati locali negli artifact.
- [ ] Classificare ogni advisory per dipendenza diretta/transitiva, ambiente runtime/build/test, raggiungibilita e disponibilita di una correzione compatibile.
- [ ] Aggiornare prima le dipendenze dirette entro range compatibili e rigenerare deterministicamente `package-lock.json`.
- [ ] Gestire separatamente eventuali upgrade major, con analisi delle breaking change e test mirati; non usare `npm audit fix --force` come sostituto della revisione.
- [ ] Verificare in particolare Electron, Vite, Vitest, coverage ed electron-builder con le rispettive catene transitive.
- [ ] Ricostruire i moduli nativi per Node ed Electron dopo gli aggiornamenti.
- [ ] Rieseguire entrambi gli audit e documentare eventuali vulnerabilita residue, motivazione, mitigazioni e decisione di accettazione.
- [ ] Sincronizzare versione e documentazione solo dopo che il nuovo lockfile e validato.

Criteri di accettazione:

- Nessuna vulnerabilita `critical` o `high` resta nel grafo di produzione quando esiste una correzione compatibile.
- Nessuna vulnerabilita `critical` resta nel grafo completo quando esiste una correzione compatibile.
- Ogni vulnerabilita residua e documentata in `SECURITY_MODEL.md` con ambiente interessato, raggiungibilita, mitigazione e motivo del rinvio.
- Installazione da lockfile, build, avvio Electron, persistenza SQLite, test e packaging continuano a funzionare.
- Non vengono introdotte dipendenze sostitutive o upgrade major senza una motivazione revisionabile.

Test richiesti:

- `npm ci`
- `npm audit --json`
- `npm audit --omit=dev --json`
- `npm run docs:check`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run test:e2e:electron`
- `npm run build`
- `npm run pack`
- `npm run test:smoke:electron`

Documentazione interessata:

- `PLAN.md`
- `SECURITY_MODEL.md`
- `README.md`
- `MAPS.md` e `AGENTS.md` solo se cambiano struttura, comandi o regole operative.

Decisione release:

- Tag e GitHub Release saranno valutati dopo la classificazione delle vulnerabilita corrette e residue.
- Una correzione di sicurezza con impatto concreto sugli artifact distribuiti rende raccomandabile una release; modifiche limitate agli strumenti di sviluppo richiedono conferma esplicita del progettista.

## Milestone pianificata

### Versione 6.1.0 - Dettatura negli editor capitolo e scena

- Stato: `pianificata`.
- Branch previsto: `milestone/6.1-editor-dictation`.
- Tipo incremento: `+0.1.0`.
- Obiettivo: permettere all'autore di dettare testo nell'editor dei capitoli e nell'editor delle scene, con un provider remoto OpenAI e una strategia locale/offline da scegliere dopo una valutazione tecnica e progettuale esplicita.

#### Gate di decisione progettuale obbligatorio

La soluzione non deve essere scelta implicitamente durante l'implementazione. Prima di modificare il runtime, preparare un confronto breve e ottenere l'avallo del progettista sui seguenti punti:

- OpenAI remoto: confrontare trascrizione di segmenti registrati e trascrizione realtime/streaming, verificando modelli disponibili, latenza, accuratezza, costi, limiti e formati supportati al momento dell'implementazione.
- Whisper locale: confrontare almeno un motore locale mantenuto, per esempio `whisper.cpp` o un servizio compatibile, valutando CPU/GPU, memoria, velocita, dimensione dei modelli, licenza, aggiornamenti e packaging Windows/macOS.
- Ollama: verificare se la versione e i modelli concretamente supportati offrono una funzione speech-to-text adatta. Non assumere che l'attuale integrazione testuale Ollama possa trascrivere audio; valutare se debba restare estranea al flusso oppure coordinare un motore Whisper separato.
- Strategia provider: decidere se distribuire entrambi i provider nella prima versione, procedere per fasi o offrire un adapter locale configurabile.
- Esperienza di dettatura: scegliere tra inserimento progressivo, registrazione a segmenti con trascrizione finale oppure anteprima modificabile prima dell'inserimento.
- Fallback: stabilire quando sia manuale o automatico. Un errore del provider locale non deve mai inviare audio a OpenAI senza consenso remoto esplicito e visibile.
- Distribuzione del modello locale: decidere tra modello incluso, download opzionale verificato con checksum o installazione esterna documentata.

Criteri della decisione:

- accuratezza in italiano e inglese, inclusi punteggiatura, pause, nomi propri e prosa narrativa;
- latenza percepita e qualita delle trascrizioni parziali/finali;
- funzionamento offline e comportamento in assenza di rete;
- privacy, consenso, conservazione audio e dati inviati al provider;
- costo OpenAI e controllo dei consumi;
- requisiti CPU, memoria, GPU e spazio disco del provider locale;
- complessita di dipendenze native, supply chain, licenze, aggiornamento e firma degli artifact;
- supporto reale e testabile su Windows e macOS;
- accessibilita e coerenza con i flussi esistenti dell'editor.

Riferimento OpenAI da rivalidare all'avvio della milestone:

- [API ufficiale per la creazione di trascrizioni](https://developers.openai.com/api/reference/resources/audio/subresources/transcriptions/methods/create).

Attivita principali:

- [ ] Produrre il confronto tecnico e registrare la decisione approvata prima dell'implementazione.
- [ ] Definire un'interfaccia condivisa `TranscriptionProvider` indipendente dagli editor e dai provider concreti.
- [ ] Aggiungere configurazione centrale per provider, modello, lingua, timeout, durata massima, formato audio, limiti payload e fallback.
- [ ] Implementare acquisizione microfono con stati espliciti: inattiva, richiesta permesso, registrazione, trascrizione, completata, annullata ed errore.
- [ ] Gestire start, stop e annullamento dall'editor capitolo e dall'editor scena tramite componenti e logica condivisi.
- [ ] Inserire il testo nella posizione corrente del cursore TipTap senza sovrascrivere contenuti non selezionati e mantenendo undo/redo coerente.
- [ ] Integrare il provider OpenAI nel main process, riusando chiave protetta, timeout, cancellazione, sanitizzazione errori e consenso alle chiamate esterne.
- [ ] Integrare il provider locale scelto o la prima fase approvata, isolando processo, modelli e file temporanei dall'interfaccia.
- [ ] Rendere lingua di dettatura e provider configurabili, con default coerente con la lingua effettiva dell'interfaccia e override manuale.
- [ ] Aggiungere testi italiano/inglese, stati accessibili, scorciatoie non conflittuali e resa corretta nei temi chiaro/scuro.
- [ ] Documentare permessi microfono, dati inviati, requisiti locali, costi remoti, fallback e troubleshooting.

Vincoli di sicurezza e privacy:

- La dettatura deve essere disattivata finche l'utente non la avvia esplicitamente; nessuna registrazione in background.
- L'invio remoto richiede consenso esplicito e deve rispettare `enabled`, provider, `allowApiCalls` e una policy dedicata ai contenuti audio se necessaria.
- Audio e trascrizioni non devono comparire in log, crash report o telemetria.
- L'audio deve restare in memoria quando possibile; eventuali file temporanei devono avere scope limitato, nome non sensibile, cancellazione garantita e testata anche su errore o arresto.
- API key, accesso rete e processi locali privilegiati restano nel main process; il renderer riceve solo stato e testo risultante tramite IPC validato.
- Limiti di durata e dimensione devono essere applicati prima dell'invio o dell'elaborazione locale.
- Il fallback da locale a remoto non puo aggirare consenso, indicatore UI o scelta del provider.

Criteri di accettazione:

- Capitoli e scene espongono lo stesso flusso di dettatura, senza duplicazione sostanziale della logica.
- Il testo trascritto viene inserito nel punto previsto ed e annullabile con il normale undo dell'editor.
- Negazione del permesso microfono, assenza di dispositivo, timeout, cancellazione, provider indisponibile e risposta invalida non causano perdita del testo esistente.
- Il provider remoto non riceve audio senza consenso; il provider locale scelto funziona senza rete secondo i requisiti approvati.
- Il comportamento del fallback e sempre visibile e verificabile dall'utente.
- UI, messaggi e documentazione sono completi in italiano e inglese e leggibili in entrambi i temi.
- Le build Windows e macOS includono o individuano correttamente gli eventuali componenti locali approvati.

Test richiesti:

- unit test per macchina a stati, selezione provider, fallback, limiti, cancellazione e inserimento TipTap;
- integration test IPC con provider finti, senza microfono, rete o credenziali reali;
- test negativi per permessi negati, audio vuoto/corrotto, payload eccessivo, timeout, cleanup e assenza di leak nei log;
- e2e browser con acquisizione e trascrizione simulate per entrambi gli editor;
- e2e Electron e verifica manuale con microfono reale su Windows e macOS;
- smoke test degli artifact pacchettizzati, soprattutto se includono binari o modelli locali;
- `npm run docs:check`;
- `npm run lint`;
- `npm run typecheck`;
- `npm run test`;
- `npm run test:e2e`;
- `npm run test:e2e:electron`;
- `npm run build`;
- `npm run pack`;
- `npm run test:smoke:electron`.

Documentazione interessata:

- `README.md`
- `ISTRUZIONI.md`
- `INSTRUCTIONS.md`
- `SECURITY_MODEL.md`
- `MAPS.md`
- `AGENTS.md` se vengono introdotte nuove regole operative per audio, modelli o processi locali;
- `PLAN.md` con decisione provider, risultati dei test e stato finale.

Decisione release:

- La milestone e candidata a una release `6.1.0` dopo avallo, merge, CI necessaria, verifica artifact Windows/macOS e checksum SHA-256.
- Tag e pubblicazione restano operazioni separate e richiedono conferma esplicita del progettista.

## Milestone future

Le prossime milestone funzionali saranno aggiunte solo dopo una decisione progettuale esplicita. Non vengono introdotte roadmap speculative in questa patch.

## Checklist di chiusura milestone o patch

- [ ] Worktree e branch controllati.
- [ ] Identita Git/GitHub verificata per le operazioni previste.
- [ ] Implementazione completata e diff revisionato.
- [ ] Test automatici richiesti eseguiti.
- [ ] Smoke test o verifica manuale eseguiti quando necessari.
- [ ] Versione sincronizzata nei punti canonici quando prevista.
- [ ] README e manuali aggiornati quando cambia il comportamento utente.
- [ ] `SECURITY_MODEL.md` aggiornato quando cambia la superficie di rischio.
- [ ] `MAPS.md` aggiornato quando cambia la struttura.
- [ ] `AGENTS.md` aggiornato quando cambiano regole operative.
- [ ] `PLAN.md` aggiornato con risultati e stato.
- [ ] Avallo esplicito del progettista ottenuto prima del merge.
- [ ] Commit finale creato.
- [ ] PR o merge verso `main` eseguito solo dopo l'avallo.
- [ ] CI verificata quando prevista e necessaria.
- [ ] Tag, release, artifact e checksum completati solo quando previsti.
- [ ] Branch obsoleto eliminato solo dopo merge e verifiche.
