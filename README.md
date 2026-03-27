# Premessa
Non sono un esperto nella scrittura di codice. Per lo meno così mi vedo. Ma non sono neppure una persona che ha scoperto che chatGPT può fare APP e subito ha avuto l'ambizione di fargli fare l'applicazione must have che tutti desiderano da una vita.
The Novelist nasce da diverse esigenze:

- Come Scrittore
Scrivo racconti e romanzi da quando ero ragazzino. C'è stato anche un periodo della mia vita in cui ho pubblicato qualche mio lavoro con piccoli editori, in cui ho vinto qualche concorso, in cui ho reso pubblica questa mia vocazione.
Per scrivere ho usato un po' di tutto. Partendo dal classico Microsoft Word, poi per un breve periodo ho usato Google Write, poi sono passato per altre app specializzate per la scrittura (come Scrivener), per poi tornare a Pages.
Ho sempre avuto la necessità di una applicazione che, sì, mi permettesse di scrivere le mie storie, ma che allo stesso tempo mi aiutasse a tenere traccia delle location, dei personaggi, del contenuto dei vari capitoli. Volevo un programma che mi permettesse di scrivere i singoli capitoli, e poi di organizzarli in un secondo momento, modificando la struttura del romanzo, per ottenere l'effetto migliore.
Ma non ho mai trovato l'app giusta. Perciò ho pensato di farmela da solo.

- Come appassionato di AI
L'intelligenza artificiale è uno strumento incredibile, e come avrete già visto con Coworker, non mi limito al semplice uso di un chatbot. Volevo quindi integrare la AI in questa app di scrittura. Volevo uno strumento che, partendo dalla descrizione di un personaggio, di un luogo, mi facesse il ritratto, o una immagine del luogo. Volevo che l'editor mi aiutasse in quei passaggi difficili, semplicemente selezionandoli. E volevo che ogni capitolo, mano a mano che veniva scritto, avesse corredato un piccolo riassunto, utile per poi costruire la struttura finale del romanzo.

- Come conseguenza naturale di altri progetti a cui sto lavorando 
Grazie all'esperienza che sto facendo con altri applicativi che sto sviluppando per vari scopi, ho pensato che fosse davvero giunto il momento per posare la prima pietra con The Novelist.
1. Volevo una struttura modulare: Perché non fare una interfaccia a blocchi e connessioni? Ogni blocco rappresenta un capitolo. Le connessioni mi permettono di scegliere come collegare l'uno all'altro.
2. Volevo poter gestire meglio le trame parallele: L'interfaccia a blocchi è perfetta. I blocchi di una trama hanno tutti lo stesso colore. Se genero un altro percorso narrativo, ho un colore differente.
3. Volevo le schede personaggi: Anche qui, interfaccia a blocchi. Ogni blocco è una scheda personaggio in stile identikit. Nella scheda e persino possibile indicare in quali capitoli il personaggio è presente. E con la AI posso persino generare una immagine del personaggio.
4. Volevo le schede paesaggi: Anche qui, interfaccia a blocchi. Identiche in tutto e per tutto a quelle dei personaggi, ma dedicate alle location.
5. Intervento della AI: Ho pensato di usare Codex CLI con chiamate a riga di comando. Ma per le funzionalità complete è necessario usare una API Key di OpenAI. E ho inserito anche la possibilità di usare una AI locale, con un connettore per Ollama. Unica pecca? Con Codex CLI e Ollama non è possibile generare le immagini in-app. Però si può generare un prompt ad hoc, darlo in pasto a un chatbot capace di generare immagini, scaricare l'immagine, e allegarla.

Tutto ciò ha portato a The Novelist. 

L'applicazione è stata interamente generata da Codex CLI. L'interfaccia è un po' 'techie', ma non mi dispiace, anche se avrei potuto insistere un po' di più per renderla maggiormente user-friendly.

E' perfetta?
Diciamo che funziona, e non mi pare che abbia bug evidenti. Da questa fase in poi il progetto viene mantenuto e distribuito solo per macOS, cosi da allineare supporto dichiarato e supporto realmente verificato.
Un Dev professionista potrebbe trovarci molti difetti, e qualche vulnerabilità che mi è scappata. Lascio a loro l'onere e l'onore di sistemare ciò che i miei occhi imberbi non hanno scovato.
Rimane comunque, e sempre, una app realizzata in vibe-coding.

# The Novelist - Manuale Utente (IT)

> Questa app è stata realizzata in vibecoding con codex CLI. Attualmente è da intendersi come alpha funzionante. Potrebbe necessitare di ottimizzazione, pulizia di codice orfano, interventi di sicurezza, e molto altro ancora...

## Sommario
- Introduzione
- Come iniziare
- L'interfaccia
- Come funziona
  - Creazione/Apertura di un progetto
  - Trame
  - Capitoli
  - Editor di Testo
  - Selezione
  - Canvas Personaggi/Location
- Impostazioni


## Introduzione
The Novelist è un progetto sperimentale pensato per gli scrittori. L'applicazione ha una dotazione di tool utili per strutturare una narrativa complessa, e gestirne le singole parti.
Attualmente il progetto viene mantenuto e distribuito ufficialmente solo per macOS.

Funzionalità principali:
- Struttura a Nodi per definire la traccia del romanzo/racconto.
- Schede personaggio.
- Schede Location.
- Ogni blocco narrativo (capitolo) è dotato di un editor assistito da AI.
- Ogni Scheda Personaggio, e Scheda Location, è dotata di un assistente AI.
- Possibilità di stampare il singolo blocco narrativo (capitolo).
- Possibilità di stampare l'intero romanzo.   
- Possibilità di export in formato Docx e PDF.

Funzionalità secondarie:
- Abbinamento a Codex CLI
- Abbinamento a modelli cloud tramite API Key
- Abbinamento a modelli locali con Ollama

## Come iniziare
### Avvio di The Novelist
Su macOS è sufficiente fare doppioclick sull'icona del programma.

## L'interfaccia
L'interfaccia principale è divisa in due aree distinte.

### Area Comandi (sinistra)
Il lato sinistro dell'applicazione ha una serie di sezioni così ordinate:
- Creazione/Apertura di un progetto.
- Creazione di una Trama.
- Creazione di un Capitolo.
- Pulsanti di Stampa ed Export del documento intero.
- Area oggetto selezionato.
- Area di stato.

### Canvas (destra)
Il lato destro è il foglio di lavoro. Si tratta di una lavagna su cui appoggiare i blocchi (ogni blocco rappresenta un capitolo), e decidere come connettere l'uno all'altro.

### Menù 
Nell'intestazione del programma c'è un piccolo menù composto da quattro tasti.
- Struttura Storia: che è l'area principale di lavoro.
- Trame: è l'area di lavoro per creare trame (principale e secondarie).
- Personaggi: è l'area di lavoro per creare personaggi.
- Location: è l'area di lavoro per creare le location.
- Impostazioni: Qui viene scelto che tipo di interazione con la AI sarà usato.

## Come Funziona
Il programma, di per sé è molto semplice da usare.
E' sufficiente:
- Creare un progetto.
- Creare una Trama.
- Caricare i capitoli sul canvas.
- Collegare i capitoli tra loro.
- Creare le schede personaggio.
- Creare le schede location.
- Scrivere i singoli capitoli.

### Creazione/Apertura di un progetto
Per creare un progetto è sufficiente scegliere una cartella sul vostro computer. Tenete conto che non è un classico documento word, per cui l'intera cartella dovrà essere dedicata a quel solo progetto. Conviene chiamare la cartella col nome del vostro progetto.
Una volta inserito anche il nome del progetto, è sufficiente cliccare su Crea e puntare a quella cartella. Il programma farà tutto da solo e vi aprirà il progetto.
Se il progetto già esiste, per accedervi, sarà necessario cliccare su Apri.
Il tasto chiudi servirà per chiudere un progetto quando si è finito di lavorare.

### Trame
Il programma può gestire più filoni narrativi, qui chiamati semplicemente 'trame'.
Per creare una trama è sufficiente dargli una etichetta ('Trama Principale', 'Storia del personaggio x', etc), e cliccare su Crea Trama.
Ogni trama ha assegnato un numero. E i capitoli assegnati alla trama scelta, avranno un colore che li distinguerà dagl'altri.
E' presente anche un'area di testo in cui è possibile abbozzare la storia nelle sue parti. Grazie a questo testo, se invece di cliccare su Crea Trama, si clicca su Crea Struttura, la AI ipotizzerà una struttura divisa in blocchi (capitoli) collegati tra loro, con tanto di riassunto, da cui si può partire con la stesura della storia vera e propria.

### Capitoli
Il programma vede i capitoli come dei blocchi da caricare sul canvas. E' sufficiente inserire il titolo e una breve descrizione. Poi si clicca su 'Crea Blocco', e il capitolo apparirà sul canvas.
Con un doppioclick sul blocco che rappresenta il capitolo si aprirà una finestra riassuntiva, e cliccando su 'Apri Editor di Testo' si potrà iniziare a scrivere.

#### Editor di Testo
L'editor di testo è molto semplice. Anche in questo caso è diviso in due aree distinte:

- Sul lato sinistro è presente l'editor di scrittura. E' possibile scegliere lo stile, il tipo di font, la giustificazione e la dimensione del font. La scrittura è snella. Riconosce il '-' e i baffi '<<' '>>' per i dialoghi. Mentre se vi serve un elenco puntato (sul serio?) vi basta usare l'asterisco. L'editor mostrerà anche la location associata, e i personaggi. Se si seleziona un testo, è possibile ritoccarlo direttamente tramite la AI.
- Sul lato destro c'è una interfaccia in stile chatbot per consultare l'AI in caso di bisogno.
L'editor consente inoltre di esportare il capitolo in formato DOCX, PDF, o di stamparlo.
Quando si esce dall'editor, la AI farà un riassunto di quanto scritto e lo metterà in descrizione al blocco.

Per richiamare un personaggio, o una location, è sufficiente digitare '@' e scegliere dall'elenco. Il richiamo non sarà visibile in fase di export, ma permetterà di avere una correlazione tra gli elementi, visibile sia nell'editor, sia nelle schede personaggio e nelle schede paesaggio. 
Se si vuole creare un nuovo personaggio, o una nuova location, senza passare ai Canvas Personaggi/Location (vedi capitoli successivi), è sufficiente scrivere nell'editor la descrizione, selezionare il testo, e cliccarci sopra col tasto destro. Si aprirà un menù ad hoc per generare direttamente ciò che si desidera. Una volta confermato, il programma creerà direttamente la scheda al posto dell'utente, andando a compilare gli attributi grazie alla AI, che cercherà nel testo evidenziato i dati, e li riporterà al posto giusto. Nel caso poi siano attive le API, verrà anche generata una immagine in automatico, sempre basata sulla descrizione.
Nell'editor di testo, ovviamente, il testo selezionato rimarrà presente, ed apparirà il badge relativo al personaggio, o alla location, appena creata.

### Selezione
Quando si seleziona un oggetto sul canvas, in quest'area vengono attivati dei tasti con le possibili azioni che si possono fare. Per cancellare un oggetto è possibile anche usare la scorciatoia, e una volta selezionato, basta premere 'Canc'.

### Canvas Trame/Personaggi/Location
Le due aree non sono molto differenti da quelle già viste. Sia il blocco personaggio, sia il blocco paesaggio permette di inserire delle caratteristiche specifiche, ed eventualmente generare una immagine del personaggio/paesaggio.
Il Canvas Trame non differisce dagli altri due, ma offre le funzionalità già descritte nell'interfaccia principale, alla pressione del tasto Nuove Trame.

Nota: Nel caso si usino le API KEY, sarà possibile generare e associare direttamente l'immagine col tasto 'Genera In-App', altrimenti sarà necessario creare il prompt, copiarlo su un chatbot in cloud, generare l'immagine, scaricarla, e associarla col tasto 'Associa'.

## Impostazioni
Il menù impostazioni serve principalmente per:
- Impostare l'autosave.
- Impostare il servizio AI da usare.

### Autosave
Il programma permette di scegliere tra:
1. Salvataggio manuale.
2. Salvataggio ogni N Minuti.
3. Salvataggio automatico, a ogni modifica fatta dall'utente.

### Impostazioni AI
Il programma prevede tre possibilità:
1. Chiamare a riga di comando Codex CLI (installato in locale)
2. Usare una API KEY e i servizi cloud
3. Usare una AI locale (o cloud) tramite Ollama.

#### Codex CLI
Codex CLI è il command line interface di OpenAI. Viene installato localmente, ma utilizza i modelli di OpenAI, di conseguenza è necessario un abbonamento a chatGPT (minimo il Plus), o una API KEY da associare.

#### API KEY
Questo è l'unico sistema che permette di generare le immagini In-App, sempre che il servizio associato alla vostra chiave API lo permetta. E' prevista la compatibilità alle API KEY di OpenAI, che sono un po' uno standard de facto.

#### Ollama
Ollama è un tool che, una volta installato sul proprio computer, permette di scaricare dei modelli AI locali (misurati sulle prestazioni del PC), o di usare dei modelli Open Source in Cloud. Questa soluzione è utile per chi vuole la massima tutela della privacy, a scapito delle prestazioni dei modelli.

Attenzione: le soluzioni Codex CLI e Ollama prevedono che sul computer siano installati i programmi. In caso contrario il servizio AI non sarà attivo.

Il menù impostazioni presenta anche tre check box importanti:
1. Consenso invio testo a strumenti AI: Senza questo consenso non si potranno usare i servizi AI.
2. Abilita chiamate API esterne: Senza questo consenso non potrà funzionare il servizio tramite API KEY.
3. Auto-riassunto della descrizione blocco al salvataggio: Senza questo consenso non si avrà il riassunto automatico dei capitoli in descrizione al blocco.

*Nota:* Le impostazioni AI sono salvate all'interno dei singoli progetti. Le preferenze di autosave invece sono globali utente, quindi restano valide anche quando si apre o si crea un altro progetto.

---

# The Novelist - Tech Notes

App desktop Electron per progettare e scrivere romanzi: canvas narrativo, canvas trame/personaggi/location, editor capitoli, export e assistenza AI.

## Funzionalita principali
- Gestione progetto locale con `Crea`, `Apri`, `Salva`, `Chiudi` e snapshot DB.
- Canvas storia con trame, capitoli, connessioni e ordinamento narrativo.
- Canvas Trame dedicato con creazione/modifica/eliminazione trame e generazione AI di una bozza struttura a blocchi.
- Editor capitolo con formattazione ricca, riferimenti rapidi a personaggi/location e azioni AI su selezione.
- Chat AI contestuale al capitolo.
- Canvas Personaggi e Location con collegamenti ai capitoli.
- Autosave configurabile lato utente (`manuale`, `a intervallo`, `automatico`).
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
- `npm run dist`: crea gli artefatti macOS ufficiali.
- `npm run dist:mac`: crea artefatti macOS (`dmg`, `zip`).
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
- Prompt/suggerimenti/chat/creazione struttura trama usano il provider selezionato.
- La generazione immagini in-app usa OpenAI Images API, quindi richiede:
  - consenso AI attivo;
  - provider `OpenAI API`;
  - chiamate API abilitate;
  - API key disponibile.

## Preferenze e impostazioni
- `Autosave`: preferenza utente globale salvata fuori dal progetto.
- `Impostazioni AI`: salvate per singolo progetto.
- Quando apri o crei un progetto nuovo, le impostazioni AI vengono caricate dal progetto corrente; l'autosave mantiene invece l'ultima preferenza utente salvata.

## Variabili ambiente
- `NOVELIST_CODEX_COMMAND`: comando CLI (default: `codex`).
- `NOVELIST_CODEX_TIMEOUT_MS`: timeout richieste CLI in ms (default: `45000`).
- `OPENAI_API_KEY`: chiave OpenAI usata come fallback se non salvata in-app.
- `NOVELIST_IMAGE_MODEL`: override modello immagini (default runtime: `gpt-image-1`).
- `OLLAMA_HOST`: endpoint Ollama (default: `http://127.0.0.1:11434`).

## Build release
Nota pratica: il progetto e distribuito ufficialmente solo per macOS. La scelta serve a mantenere una base di codice e una pipeline che tu possa verificare davvero, senza promettere supporto su piattaforme che non riesci a testare con continuita. La build include anche moduli nativi Electron, come `better-sqlite3`, quindi ha senso generare i pacchetti sul sistema operativo di destinazione.

### Build macOS
1. Esegui:
   - `npm run dist`
   - oppure `npm run dist:mac`
2. Troverai gli artefatti in `release/`:
   - `The Novelist-<version>-arm64.dmg`
   - `The Novelist-<version>-arm64-mac.zip`
3. Installa aprendo il `.dmg` e trascinando `The Novelist.app` in `Applicazioni`.

### Release GitHub macOS
Nel repository e presente anche un workflow GitHub Actions di release che costruisce in automatico la sola versione macOS su `macos-latest`.

Flusso consigliato:
1. aggiorna la versione in `package.json`
2. crea e pubblica il tag, ad esempio `v2.2.3`
3. lascia che GitHub Actions produca gli artifact e li alleghi alla release

Il workflow supporta anche avvio manuale (`workflow_dispatch`) passando il tag da rilasciare.

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
- App: `app:get-preferences`, `app:update-preferences`.
- Progetto: `project:create`, `project:open`, `project:close`, `project:inspect-path`, `project:select-directory`, `project:save-snapshot`.
- Storia: `story:get-state`, `story:create-plot`, `story:update-plot`, `story:delete-plot`, `story:create-node`, `story:update-node`, `story:delete-node`, `story:create-edge`, `story:delete-edge`.
- Capitoli: `chapter:get-document`, `chapter:save-document`, `chapter:export-docx`, `chapter:export-pdf`, `chapter:print`.
- Manoscritto: `manuscript:export-docx`, `manuscript:export-pdf`, `manuscript:print`.
- Personaggi/Location: CRUD schede, link capitoli, immagini (lista/associazione/generazione/eliminazione).
- AI: `codex:get-settings`, `codex:update-settings`, `codex:assist`, `codex:transform-selection`, `codex:chat`, `codex:cancel-active-request`.

## Licenza
Questo progetto e distribuito sotto licenza Apache 2.0. Vedi [LICENSE](./LICENSE).
