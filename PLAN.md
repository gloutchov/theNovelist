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
