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
Diciamo che funziona, e non mi pare che abbia bug evidenti. Al momento il progetto viene mantenuto con build verificate localmente su macOS e Windows, cosi da allineare supporto dichiarato e supporto realmente verificato.
Un Dev professionista potrebbe trovarci molti difetti, e qualche vulnerabilità che mi è scappata. Lascio a loro l'onere e l'onore di sistemare ciò che i miei occhi imberbi non hanno scovato.
Rimane comunque, e sempre, una app realizzata in vibe-coding.

# The Novelist - Manuale Utente (IT)

> Questa app è stata realizzata in vibecoding con codex CLI. Attualmente è da intendersi come alpha funzionante. Potrebbe necessitare di ottimizzazione, pulizia di codice orfano, interventi di sicurezza, e molto altro ancora...

Nota aggiornata: il renderer gira con `sandbox: true`, `contextIsolation: true` e CSP esplicita. Il bridge `window.novelistApi` passa solo dal preload Electron.

## Sommario
- Introduzione
- Come iniziare
- L'interfaccia
- Canvas Capitoli/Scene: Come funziona l'editor di testo
- Canvas Trame/Personaggi/Location
- Memoria
- Impostazioni


## Introduzione
The Novelist è un progetto sperimentale pensato per gli scrittori. L'applicazione ha una dotazione di tool utili per strutturare una narrativa complessa, e gestirne le singole parti.
Attualmente il progetto viene mantenuto e distribuito con pacchetti verificati localmente su macOS e Windows.

Funzionalità principali:
- Cruscotto con tutte le informazioni sul romanzo/racconto.
- Timeline Grafica della storia.
- Struttura a Nodi per definire la traccia del romanzo/racconto.
- Schede trama.
- Schede personaggio.
- Schede Location.
- Ogni blocco narrativo (scena/capitolo) è dotato di un editor assistito da AI.
- Ogni Scheda Personaggio, e Scheda Location, è dotata di un assistente AI.
- Strumento per la gestione delle revisioni di ogni scena/capitolo/personaggio/location.
- Strumento per l'analisi del romanzo/racconto con l'assistenza della AI.
- Strumento di consultazione della 'memoria' del romanzo/racconto.
- Possibilità di stampare il singolo blocco narrativo (capitolo).
- Possibilità di stampare l'intero romanzo.   
- Possibilità di export in formato Docx e PDF.

Funzionalità secondarie:
- Abbinamento a Codex CLI
- Abbinamento a modelli cloud tramite API Key
- Abbinamento a modelli locali con Ollama

## Come iniziare
### Avvio di The Novelist
Sia su macOS. sia su Windows, è sufficiente fare doppioclick sull'icona del programma.

### Creazione di un romanzo/racconto
Cliccare su Crea.
Inserire il direttorio dove posizionare il progetto.
Indicare il titolo del progetto.
Inserire un target di parole per l'intero romanzo/racconto, e per i singoli capitoli (opzionale, ma utile).
Inserire una data prevista di conclusione del progetto (opzionale, ma utile).

### Definire una o più trame
Cliccare su Trame.
Cliccare su Nuova Trama.
Definire il numero di trama. Il programma può gestire più trame parallele. Ad esempio si può creare una trama principale, più altre trame secondarie legate a singoli personaggi. Scegliere il numero subito successivo all'ultimo usato. Nel caso della trama principale, usare 1.
Definire un nome della trama (Trama Principale, Storia del personaggio, etc).
Scrivere una bozza, un idea, una struttura, o un breve riassunto della trama che si vuole definire.
Cliccare su Crea Trama. 
Verrà creato un 'box' relativo alla trama. La trama sarà definita per titolo, numero, e colore. Cliccando sul box è possibile rivedere quanto scritto, ed eventualmente modificarlo.
In alternativa si può cliccare su Crea Capitoli. In questo caso, oltre alla generazione del box legato alla trama, vengono prodotti dalla AI un certo numero di capitoli, con una indicazione del tema di cui dovranno parlare, per completare l'opera. Questa generazione è solamente propositiva, e l'autore può modificarla in ogni momento, e anche cancellarla.

### Iniziare a scrivere
A seconda di come intenda lavorare l'autore, è possibile partire direttamente scrivendo un capitolo del libro, o semplicemente scrivendo una delle scene che saranno incluse nei capitoli.
La scelta è puramente personale. Dalla stesura dei capitoli è possibile definire successivamente le varie scene. Oppure, dopo aver scritto le singole scene, è possibile aprire un capitolo vuoto e richiamare le scene nell'ordine che si preferisce.
L'editor è semplice ma possiede tutto ciò che serve, ovvero:
- Giustificazione del Testo.
- Formattazione del testo e del font.
- Sistema di ricerca.
- Sistema di ricerca e sostituzione.
- Sistemi di correzione di un testo selezionato (tramite AI).
- Chatbot AI per la consultazione/ricerca.
L'editor riconosce il '<<', e il '>>' come 'baffi' per i dialoghi e li converte nei simboli tipografici corretti.
Sia che si scriva una scena, sia che si scriva un capitolo, è possibile selezionare un testo e definirlo come descrizione di un personaggio, o di una location. Con la definizione, l'app genererà in automatico una scheda personaggio (volendo anche compresa di foto), o una scheda location (volendo anche compresa di foto).
Per avere una correlazione tra personaggi/paesaggi e i capitoli/scene, è sufficiente richiamarli con la @. Questo permetterà all'autore di sapere sempre dove è presente un personaggio o quali capitoli si svolgono in una determinata location.
Tutte le informazioni saranno utilizzate per creare una 'memoria' del progetto, e per compilare sia il cruscotto, sia la timeline. Le informazioni saranno anche fondamentali affinché la AI sappia su cosa si sta lavorando.

### Timeline
La timeline viene utile per dare ordine cronologico agli eventi raccontati. La sua costruzione è manuale, ma ogni volta che si entra nella vista timeline, questa mostrerà gli elementi già posizionati, e quelli nuovi ancora da posizionare. 
L'autore può anche indicare date precise, sia di inizio, sia di fine, della timeline. E definire anche date specifiche per ogni singolo elemento connesso ad essa.

### Scaletta
La scaletta è uno strumento di drag and drop verticale in cui l'autore può disporre i capitoli come meglio preferisce. La stampa, o l'export del romanzo/racconto avverrà in base all'ordinamento scelto in questa vista. Il pulsante Apri permette di leggere il capitolo, o l'intero documento, in una finestra a zero-fastidi, pensata per non affaticare gli occhi.

### Revisioni
Il programma tiene memoria di ogni modifica fatta nei capitoli e nelle scene, così come nelle schede personaggio e location. Nel caso si voglia tornare indietro, è possibile andare sulla vista Revisioni, cercare quella desiderata, e ripristinarla. 
Attenzione però: una volta ripristinata una vecchia stesura, non sarà più possibile tornare all'ultima generata.

### Analisi
Il programma offre una serie di strumenti, che grazie alla AI, sono in grado di valutare il tasto scritto e individuarne i potenziali difetti, o le eventuali mancanze.

## L'interfaccia
L'interfaccia principale è divisa in tre aree distinte.

### Centro di controllo
Sotto al logo, sono presenti diversi tasti che permettono di spostarsi tra le varie viste.

### Area Comandi (sinistra)
Il lato sinistro dell'applicazione, solitamente, ha una serie di opzioni utili per la vista scelta. Solitamente tasti per creare nuovi elementi, per avere informazioni su quelli selezionati, ed eventualmente cancellarli.

### Canvas (destra)
Il lato destro è il foglio di lavoro. Si tratta di una lavagna su cui appoggiare i blocchi (ogni blocco rappresenta un elemento relativo alla vista scelta), e decidere come connettere l'uno all'altro. Nelle pagine di analisi, così come nel cruscotto e nella memoria, saranno mostrate le informazioni relative alle specificità della vista scelta.

## Canvas Capitoli/Scene: Come Funziona l'editor di testo
L'editor di testo è molto semplice. Anche in questo caso è diviso in due aree distinte:

- Sul lato sinistro è presente l'editor di scrittura. E' possibile scegliere lo stile, il tipo di font, la giustificazione e la dimensione del font. La scrittura è snella. Riconosce il '-' e i baffi '<<' '>>' per i dialoghi. Mentre se vi serve un elenco puntato (sul serio?) vi basta usare l'asterisco. L'editor mostrerà anche la location associata, e i personaggi. Se si seleziona un testo, è possibile ritoccarlo direttamente tramite la AI.
- Sul lato destro c'è una interfaccia in stile chatbot per consultare l'AI in caso di bisogno.
L'editor consente inoltre di esportare il capitolo in formato DOCX, PDF, o di stamparlo.
Quando si esce dall'editor, la AI farà un riassunto di quanto scritto e lo metterà in descrizione al blocco.

Per richiamare un personaggio, o una location, è sufficiente digitare '@' e scegliere dall'elenco. Il richiamo non sarà visibile in fase di export, ma permetterà di avere una correlazione tra gli elementi, visibile sia nell'editor, sia nelle schede personaggio e nelle schede paesaggio. 
Se si vuole creare un nuovo personaggio, o una nuova location, senza passare ai Canvas Personaggi/Location (vedi capitoli successivi), è sufficiente scrivere nell'editor la descrizione, selezionare il testo, e cliccarci sopra col tasto destro. Si aprirà un menù ad hoc per generare direttamente ciò che si desidera. Una volta confermato, il programma creerà direttamente la scheda al posto dell'utente, andando a compilare gli attributi grazie alla AI, che cercherà nel testo evidenziato i dati, e li riporterà al posto giusto. Nel caso poi siano attive le API, verrà anche generata una immagine in automatico, sempre basata sulla descrizione.
Nell'editor di testo, ovviamente, il testo selezionato rimarrà presente, ed apparirà il badge relativo al personaggio, o alla location, appena creata.
Allo stesso modo è possibile creare una scena. In questo caso la scena verrà evidenziata con il '#'.

Scorciatoie da tastiera nell'editor:

| Azione                           | Windows/Linux                      | macOS                             | 
| -------------------------------- | ---------------------------------- | --------------------------------- | 
| Salva capitolo                   | `Ctrl+S`                           | `Cmd+S`                           | 
| Stampa capitolo                  | `Ctrl+P`                           | `Cmd+P`                           | 
| Interlinea 1                     | `Ctrl+Enter`                       | `Cmd+Enter`                       | 
| Trova                            | `Ctrl+F`                           | `Cmd+F`                           | 
| Sostituisci                      | `Ctrl+H`                           | `Cmd+H`                           | 
| Risultato successivo             | `Enter` nella barra Trova          | `Enter` nella barra Trova         | 
| Risultato precedente             | `Shift+Enter` nella barra Trova    | `Shift+Enter` nella barra Trova   | 
| Sostituisci occorrenza corrente  | `Ctrl+Enter` nel campo Sostituisci | `Cmd+Enter` nel campo Sostituisci | 
| Chiudi Trova/Sostituisci         | `Esc`                              | `Esc`                             | 
| Invia messaggio AI               | `Ctrl+Enter` nella chat            | `Cmd+Enter` nella chat            | 
| Grassetto                        | `Ctrl+B`                           | `Cmd+B`                           | 
| Corsivo                          | `Ctrl+I`                           | `Cmd+I`                           | 
| Annulla                          | `Ctrl+Z`                           | `Cmd+Z`                           |
| Ripristina                       | `Ctrl+Shift+Z`                     | `Cmd+Shift+Z`                     | 

## Canvas Trame/Personaggi/Location
Le due aree non sono molto differenti da quelle già viste. Sia il blocco personaggio, sia il blocco paesaggio permette di inserire delle caratteristiche specifiche, ed eventualmente generare una immagine del personaggio/paesaggio.
Sia i blocchi personaggio, sia i blocchi location, sono dotati di 'maniglie', esattamente come avviene nel Canvas dells Struttura Progetto. Ciò permette di collegare tra loro personaggi che hanno un legame, o location legate tra loro. 
Il Canvas Trame non differisce dagli altri due, ma offre le funzionalità già descritte nell'interfaccia principale, alla pressione del tasto Nuove Trame.

Nota: Nel caso si usino le API KEY, sarà possibile generare e associare direttamente l'immagine col tasto 'Genera In-App', altrimenti sarà necessario creare il prompt, copiarlo su un chatbot in cloud, generare l'immagine, scaricarla, e associarla col tasto 'Associa'.

## Memoria
Ogni progetto di scrittura è stato dotato di una sorta di pagina Wiki che viene aggiornata a ogni salvataggio, e a cui la AI può accedere per aver maggiore consapevolezza del romanzo, e dare risposte più coerenti. La memoria Wiki contiene informazioni provenienti dall'Editor di Testo, dalle Trame, dai Personaggi, e dalle Location. I dati vengono aggiornati in automatico, ma è possibile anche eseguire aggiornamenti manuali. La memoria tiene traccia anche delle conversazioni avute con la AI nell'editor di testo, così che anche queste vadano ad arricchire la competenza della AI stessa, che deve essere vista come un assistente a 360°.

## Analisi
Il programma è dotato di una serie di servizi, svolti tramite AI, capaci di identificare potenziali problemi in questi ambiti:
- Coerenza Narrativa: Tempi, personaggi e location descritti in modo contradditorio, etc.
- Eventi non risolti: Vicende, promesse narrative e trame lasciate aperte.
- Stile: Tono, punteggiatura, ricorrenze, ripetizioni, e leggibilità del testo.
- Ritmo narrativo: Capitoli deboli, scene ridondanti, personaggi superficiali o assenti nella narrazione.
- Nomi e convenzioni: Nomi propri, terminologie, convenzioni, e coerenza interna.
Il report fornito è solamente indicativo, ma utile all'autore durante la fase di revisione del testo.

## Impostazioni
Il menù impostazioni serve principalmente per:
- Impostare l'autosave.
- Impostare il servizio AI da usare.
- Impostare il consenso alle AI di usare i dati conservati nella Wiki.

### Autosave
Il programma permette di scegliere tra:
1. Salvataggio manuale.
2. Salvataggio ogni N Minuti.
3. Salvataggio automatico, a ogni modifica fatta dall'utente.

### Impostazioni AI
Qui si può scegliere il modello AI da usare (Codex CLI, OperAI API KEY, Ollama), il fallback nel caso la AI scelta abbia problemi (tra cui anche No AI), e impostare i modelli a cui fare le richieste (prima di cambiare quelli di default, verificare i costi per token).

### Consensi
Qui sono presenti le box per abilitare le varie funzionalità AI previste dall'applicazione.

### Segreti
Qui va inserita la API KEY per i servizi cloud.

#### Codex CLI
Codex CLI è il command line interface di OpenAI. Viene installato localmente, ma utilizza i modelli di OpenAI, di conseguenza è necessario un abbonamento a chatGPT (minimo il Plus), o una API KEY da associare.

#### API KEY
Questo è l'unico sistema che permette di generare le immagini In-App, sempre che il servizio associato alla vostra chiave API lo permetta. E' prevista la compatibilità alle API KEY di OpenAI, che sono un po' uno standard de facto.

#### Ollama
Ollama è un tool che, una volta installato sul proprio computer, permette di scaricare dei modelli AI locali (misurati sulle prestazioni del PC), o di usare dei modelli Open Source in Cloud. Questa soluzione è utile per chi vuole la massima tutela della privacy, a scapito delle prestazioni dei modelli.

Attenzione: le soluzioni Codex CLI e Ollama prevedono che sul computer siano installati i programmi. In caso contrario il servizio AI non sarà attivo.

Il menù impostazioni presenta anche quattro check box importanti:
1. Consenso invio testo a strumenti AI: Senza questo consenso non si potranno usare i servizi AI.
2. Abilita chiamate API esterne: Senza questo consenso non potrà funzionare il servizio tramite API KEY.
3. Auto-riassunto della descrizione blocco al salvataggio: Senza questo consenso non si avrà il riassunto automatico dei capitoli in descrizione al blocco.
4. Consenso invio memoria progetto a provider esterni: se disattivato, la AI non riceverà la memoria Wiki quando il provider o il fallback possono inviare il prompt fuori dal computer.

E' inoltre presente un Fallback nel caso il servizio AI scelto non sia operativo per qualche motivo. Questo fallback può ridirigere le richieste a uno degli altri due modelli disponibili, o essere completamente 'Non AI'.

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
- Memoria progetto locale in Markdown con sorgenti deterministic-first, ricerca locale e contesto citabile per la chat AI.
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

Nota per chi usa il repository sorgente:
- il vincolo su toolchain/licenza Xcode riguarda sviluppo e test locali su macOS, non l'uso dell'app gia buildata;
- chi scarica una release `.dmg` non deve installare Xcode o ricompilare moduli nativi.

## Avvio rapido
1. Installa dipendenze:
   - `npm install`
2. Avvia in sviluppo:
   - `npm run dev`

## Nota sviluppo macOS
- `npm test` passa da `pretest` e lancia `npm run rebuild:node-native`.
- Questo step serve a chi sviluppa o testa il sorgente localmente e puo richiedere toolchain Xcode configurata e licenza accettata.
- Non impatta gli utenti finali che scaricano la build `.dmg` o l'app gia pacchettizzata.

## Comandi utili
- `npm run dev`: avvio sviluppo Electron + renderer.
- `npm run build`: build main/preload/renderer in `out/`.
- `npm run pack`: crea app unpacked locale in `release/`.
- `npm run dist`: crea gli artefatti macOS ufficiali.
- `npm run dist:mac`: crea artefatti macOS (`dmg`, `zip`).
- `npm run dist:win`: crea artefatti Windows (`installer .exe`, `portable .exe`).
- `npm run rebuild:electron-native`: rebuild moduli nativi (es. `better-sqlite3`) per Electron.
- `npm run rebuild:node-native`: rebuild moduli nativi per runtime Node locale.
- `npm run lint`: lint.
- `npm run typecheck`: type check TypeScript.
- `npm run test`: test unitari Vitest.
- `npm run test:e2e:install`: installa Chromium locale per Playwright.
- `npm run test:e2e`: suite e2e renderer.
- `npm run test:perf`: benchmark e2e performance.
- `npm run test:e2e:electron`: suite e2e Electron reale (IPC + DB).
- `npm run test:smoke:electron:codex`: smoke Electron reale su build pacchettizzata per verificare preload sandboxato, `Crea/Apri progetto` e rilevamento Codex CLI con `PATH` ridotto.

Nota su `pack`, `dist:mac` e `dist:win`:
- prima del packaging viene forzata una rebuild Electron-native di `better-sqlite3`;
- dopo il packaging viene ripristinata la rebuild Node-native per non sporcare l'ambiente di sviluppo locale;
- questo evita mismatch ABI tra app pacchettizzata ed esecuzione locale dei test/script Node.

## AI: provider e comportamento
Nelle Impostazioni AI puoi scegliere il provider:
- `Codex CLI (locale)`
- `OpenAI API`
- `Ollama (locale)`

Note operative:
- Prompt/suggerimenti/chat/creazione struttura trama usano il provider selezionato.
- La chat AI puo ricevere un blocco "Memoria progetto" costruito dalla wiki locale. Questo avviene solo se il consenso AI e attivo e, quando provider o fallback possono uscire dal computer, se e attivo anche il consenso "Invio memoria progetto a provider esterni".
- La generazione immagini in-app usa OpenAI Images API, quindi richiede:
  - consenso AI attivo;
  - provider `OpenAI API`;
  - chiamate API abilitate;
  - API key disponibile.

## Preferenze e impostazioni
- `Autosave`: preferenza utente globale salvata fuori dal progetto.
- `Impostazioni AI`: salvate per singolo progetto.
- `Consensi`: includono il consenso generale AI, le chiamate API esterne, l'auto-riassunto e l'invio della memoria progetto a provider esterni. Il consenso memoria esterna e attivo di default per mantenere il comportamento precedente, ma puo essere disattivato per usare la chat senza allegare la wiki a provider non locali.
- Quando apri o crei un progetto nuovo, le impostazioni AI vengono caricate dal progetto corrente; l'autosave mantiene invece l'ultima preferenza utente salvata.

## Memoria progetto locale
- Ogni progetto contiene una directory `wiki/` generata dall'app accanto a `project.db`.
- `project.db` resta la fonte di verita; la wiki e un artefatto derivato e recuperabile.
- `wiki/sources/` contiene export Markdown deterministici di capitoli, trame, personaggi, location e chat AI.
- `wiki/index.md` viene rigenerato dal sync deterministico; `wiki/log.md` registra le operazioni.
- La ricerca nella tab `Memoria` legge la wiki locale e non richiede provider esterni.
- La chat usa la wiki a query time: cerca fonti rilevanti, allega un blocco citabile e chiede al modello di distinguere fatti espliciti, schede autore, sintesi e inferenze.
- I file della wiki sono app-managed: sono leggibili e versionabili, ma non sono pensati come superficie di editing manuale. In caso di modifiche manuali, l'app puo riscriverli al sync successivo.
- Alla chiusura progetto l'app tenta un sync deterministico con timeout breve, circa 12 secondi. Se non termina in tempo, la chiusura prosegue e la memoria resta recuperabile al prossimo avvio.

## Variabili ambiente
- `NOVELIST_CODEX_COMMAND`: comando CLI (default: `codex`).
- `NOVELIST_CODEX_TIMEOUT_MS`: timeout richieste CLI in ms (default: `45000`).
- `OPENAI_API_KEY`: chiave OpenAI usata come fallback se non salvata in-app.
- `NOVELIST_IMAGE_MODEL`: override modello immagini (default runtime: `gpt-image-1`).
- `OLLAMA_HOST`: endpoint Ollama (default: `http://127.0.0.1:11434`).

## Build release
Nota pratica: le build release vengono generate e verificate sui sistemi operativi di destinazione. La build include anche moduli nativi Electron, come `better-sqlite3`, quindi ha senso generare i pacchetti sul sistema operativo di destinazione.

Per verifiche locali affidabili prima del rilascio conviene eseguire almeno:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
- `npm run test:smoke:electron:codex`

### Build macOS
1. Esegui:
   - `npm run dist`
   - oppure `npm run dist:mac`
2. Troverai gli artefatti in `release/`:
   - `The Novelist-<version>-arm64.dmg`
   - `The Novelist-<version>-arm64-mac.zip`
3. Installa aprendo il `.dmg` e trascinando `The Novelist.app` in `Applicazioni`.
4. Se la build non e firmata, al primo avvio su un altro Mac potrebbe essere necessario usare `tasto destro > Apri`.

### Build Windows
1. Assicurati che non ci siano istanze aperte di The Novelist, `electron`, o dev server che stanno usando il progetto, altrimenti la rebuild di `better-sqlite3` puo fallire.
2. Esegui:
   - `npm run dist:win`
3. Troverai gli artefatti in `release/`:
   - `The Novelist Setup <version>.exe`
   - `The Novelist <version>.exe`
   - `win-unpacked/`
4. Per distribuire:
   - usa `The Novelist Setup <version>.exe` come installer classico Windows;
   - usa `The Novelist <version>.exe` come build portable senza installazione.
5. Se la build non e firmata, su altri PC Windows potrebbe comparire SmartScreen o un warning di autore sconosciuto al primo avvio.

### Release GitHub macOS
Nel repository e presente anche un workflow GitHub Actions di release che costruisce in automatico la sola versione macOS su `macos-latest`.

Flusso consigliato:
1. aggiorna la versione in `package.json`
2. crea e pubblica il tag, ad esempio `vX.Y.Z`
3. lascia che GitHub Actions produca gli artifact e li alleghi alla release

Il workflow supporta anche avvio manuale (`workflow_dispatch`) passando il tag da rilasciare.

Nota:
- la build locale e non firmata/notarizzata; al primo avvio potrebbe essere necessario `tasto destro > Apri`.
- senza un certificato Apple `Developer ID Application` non e possibile firmare e notarizzare correttamente il pacchetto macOS.

## Struttura repository
- `src/main`: processo main Electron + IPC.
- `src/preload`: bridge sicuro `contextBridge`.
- `src/renderer`: app React.
- `src/main/persistence`: SQLite migration + repository.
- `src/main/projects`: gestione progetto su disco + snapshot/recovery.
- `tests/unit`: test unitari.
- `tests/e2e`: test end-to-end.

## Integrità e Sicurezza (Note Tecniche)
- **Validazione IPC**: Ogni payload è validato via `zod` lato Main Process.
- **Appartenenza Progetto**: Tutte le operazioni su nodi e connessioni verificano che gli ID coinvolti appartengano al progetto aperto. Questo impedisce manipolazioni dei collegamenti tra progetti diversi.
- **Gestione Chiavi**: Le chiavi API sono gestite via `safeStorage` (dove disponibile) e mai inviate in chiaro al renderer.
- **Memoria Progetto**: La wiki locale e derivata dal database, scritta con operazioni atomiche, confinata nella directory `wiki/` e inviata a provider esterni solo con consenso dedicato.

Per il riepilogo completo delle misure implementate e dei limiti residui, vedi [sicurezza.md](./sicurezza.md).

## Struttura progetto narrativo su disco
- `project.db`: database SQLite del progetto.
- `assets/`: immagini, export e allegati.
- `.snapshots/`: snapshot DB per recovery.
- `wiki/`: memoria Markdown locale derivata dal database e riscrivibile dall'app.

## IPC (selezione)
- App: `app:get-preferences`, `app:update-preferences`.
- Progetto: `project:create`, `project:open`, `project:close`, `project:inspect-path`, `project:select-directory`, `project:save-snapshot`.
- Storia: `story:get-state`, `story:create-plot`, `story:update-plot`, `story:delete-plot`, `story:create-node`, `story:update-node`, `story:delete-node`, `story:create-edge`, `story:delete-edge`.
- Capitoli: `chapter:get-document`, `chapter:save-document`, `chapter:export-docx`, `chapter:export-pdf`, `chapter:print`.
- Manoscritto: `manuscript:export-docx`, `manuscript:export-pdf`, `manuscript:print`.
- Personaggi/Location: CRUD schede, link capitoli, immagini (lista/associazione/generazione/eliminazione).
- AI: `codex:get-settings`, `codex:update-settings`, `codex:assist`, `codex:transform-selection`, `codex:chat`, `codex:cancel-active-request`.
- Wiki: `wiki:get-status`, `wiki:sync`, `wiki:search`.

## Licenza
Questo progetto e distribuito sotto licenza Apache 2.0. Vedi [LICENSE](./LICENSE).
