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
5. Intervento della AI: per l'assistenza testuale l'app usa OpenAI API oppure Ollama. Per le funzionalità cloud complete, inclusa la generazione immagini in-app, è necessario usare una API Key di OpenAI. Ollama resta disponibile come provider locale per chi vuole tenere il testo sul proprio computer.

Tutto ciò ha portato a The Novelist.

L'applicazione è stata interamente realizzata con assistenza AI. L'interfaccia è un po' 'techie', ma non mi dispiace, anche se avrei potuto insistere un po' di più per renderla maggiormente user-friendly.

E' perfetta?
Diciamo che funziona, e non mi pare che abbia bug evidenti. Al momento il progetto viene mantenuto con build verificate localmente su macOS e Windows, cosi da allineare supporto dichiarato e supporto realmente verificato.
Un Dev professionista potrebbe trovarci molti difetti, e qualche vulnerabilità che mi è scappata. Lascio a loro l'onere e l'onore di sistemare ciò che i miei occhi imberbi non hanno scovato.
Rimane comunque, e sempre, una app realizzata in vibe-coding.

# The Novelist - Manuale Utente (IT)

> Questa app è stata realizzata in vibecoding con codex CLI. Attualmente è da intendersi come alpha funzionante. Potrebbe necessitare di ottimizzazione, pulizia di codice orfano, interventi di sicurezza, e molto altro ancora...

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

### Lingua interfaccia

The Novelist 5.0 introduce l'interfaccia bilingue italiano/inglese. La lingua viene scelta automaticamente in base alle  impostazioni di sistema (nel caso il computer sia impostato su una lingua differente dall'italiano, viene scelta automaticamente la lingua inglese). L'impostazione può essere svolta manualmente dalla finestra Impostazioni.

_Nota:_ I contenuti dei progetti non vengono tradotti automaticamente: capitoli, scene, trame, schede, memoria Wiki e testi selezionati restano nella lingua scritta dall'autore.

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
- Possibilità di export in formato ePUB e DOCX.

Funzionalità secondarie:

- Abbinamento a modelli cloud tramite API Key
- Abbinamento a modelli locali con Ollama

## Come iniziare

### Download, firma e checksum

The Novelist e nato come programma personale ed e poi stato pubblicato come progetto open source con licenza Apache 2.0. Le build pubblicate non sono firmate con certificati Apple o Windows.

Questo significa che:

- su macOS puo comparire un avviso di Gatekeeper al primo avvio;
- su Windows puo comparire un avviso SmartScreen o "autore sconosciuto";
- il codice sorgente resta ispezionabile nel repository, ma i pacchetti scaricati non hanno una firma commerciale del sistema operativo.

E' quindi possibile che all'avvio il Sistema Operativo vi chieda il permesso a procedere nell'apertura dell'app.

Nota: In caso abbiate dubbi, nel repository trovate i checksum dei programmi. Nell'area Tech di questo documento trovate le istruzioni per verificare che i files non siano stati compromessi.

### Avvio di The Novelist

Sia su macOS. sia su Windows, è sufficiente fare doppioclick sull'icona del programma.

### Creazione di un romanzo/racconto

Cliccare su Crea.
Inserire il direttorio dove posizionare il progetto.
Indicare il titolo del progetto.
Inserire un target di parole per l'intero romanzo/racconto, e per i singoli capitoli (opzionale, ma utile).
Inserire una data prevista di conclusione del progetto (opzionale, ma utile).

### Impostare le attività AI

Quando viene creato un nuovo progetto di scrittura, i servizi di AI sono disattivati per default. Affinché questi possano funzionare è necessario andare nel menù Impostazioni, scegliere la tipologia di AI da usare, e abilitare l'accesso ai dati che si desidera condividere con l'intelligenza artificiale.

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

### Memoria

Il programma memorizza ogni modifica, ogni richiesta alla AI, ogni salvataggio fatto dall'utente. Questa 'memoria' del programma può essere interrogato in ogni momento, attraverso una barra di ricerca che funziona in stile 'Google'.

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
  L'editor consente inoltre di esportare il capitolo in formato DOCX, o di stamparlo.
  Quando si esce dall'editor, la AI farà un riassunto di quanto scritto e lo metterà in descrizione al blocco.

Per richiamare un personaggio, o una location, è sufficiente digitare '@' e scegliere dall'elenco. Il richiamo non sarà visibile in fase di export, ma permetterà di avere una correlazione tra gli elementi, visibile sia nell'editor, sia nelle schede personaggio e nelle schede paesaggio.
Se si vuole creare un nuovo personaggio, o una nuova location, senza passare ai Canvas Personaggi/Location (vedi capitoli successivi), è sufficiente scrivere nell'editor la descrizione, selezionare il testo, e cliccarci sopra col tasto destro. Si aprirà un menù ad hoc per generare direttamente ciò che si desidera. Una volta confermato, il programma creerà direttamente la scheda al posto dell'utente, andando a compilare gli attributi grazie alla AI, che cercherà nel testo evidenziato i dati, e li riporterà al posto giusto. Nel caso poi siano attive le API, verrà anche generata una immagine in automatico, sempre basata sulla descrizione.
Nell'editor di testo, ovviamente, il testo selezionato rimarrà presente, ed apparirà il badge relativo al personaggio, o alla location, appena creata.
Allo stesso modo è possibile creare una scena. In questo caso la scena verrà evidenziata con il '#'.

Scorciatoie da tastiera nell'editor:

| Azione                          | Windows/Linux                      | macOS                             |
| ------------------------------- | ---------------------------------- | --------------------------------- |
| Salva capitolo                  | `Ctrl+S`                           | `Cmd+S`                           |
| Stampa capitolo                 | `Ctrl+P`                           | `Cmd+P`                           |
| Interlinea 1                    | `Ctrl+Enter`                       | `Cmd+Enter`                       |
| Trova                           | `Ctrl+F`                           | `Cmd+F`                           |
| Sostituisci                     | `Ctrl+H`                           | `Cmd+H`                           |
| Risultato successivo            | `Enter` nella barra Trova          | `Enter` nella barra Trova         |
| Risultato precedente            | `Shift+Enter` nella barra Trova    | `Shift+Enter` nella barra Trova   |
| Sostituisci occorrenza corrente | `Ctrl+Enter` nel campo Sostituisci | `Cmd+Enter` nel campo Sostituisci |
| Chiudi Trova/Sostituisci        | `Esc`                              | `Esc`                             |
| Invia messaggio AI              | `Ctrl+Enter` nella chat            | `Cmd+Enter` nella chat            |
| Grassetto                       | `Ctrl+B`                           | `Cmd+B`                           |
| Corsivo                         | `Ctrl+I`                           | `Cmd+I`                           |
| Annulla                         | `Ctrl+Z`                           | `Cmd+Z`                           |
| Ripristina                      | `Ctrl+Shift+Z`                     | `Cmd+Shift+Z`                     |

## Canvas Trame/Personaggi/Location

Le due aree non sono molto differenti da quelle già viste. Sia il blocco personaggio, sia il blocco paesaggio permette di inserire delle caratteristiche specifiche, ed eventualmente generare una immagine del personaggio/paesaggio.
Sia i blocchi personaggio, sia i blocchi location, sono dotati di 'maniglie', esattamente come avviene nel Canvas dells Struttura Progetto. Ciò permette di collegare tra loro personaggi che hanno un legame, o location legate tra loro.
Il Canvas Trame non differisce dagli altri due, ma offre le funzionalità già descritte nell'interfaccia principale, tramite il tab `Trame` e il tasto `Nuova Trama`.

Nota: Nel caso si usino le API KEY, sarà possibile generare e associare direttamente l'immagine col tasto 'Genera In-App', altrimenti sarà necessario creare il prompt, copiarlo su un chatbot in cloud, generare l'immagine, scaricarla, e associarla col tasto 'Associa'.

## Memoria

Ogni progetto di scrittura è stato dotato di una sorta di pagina Wiki che viene aggiornata a ogni salvataggio, e a cui la AI può accedere per aver maggiore consapevolezza del romanzo, e dare risposte più coerenti. La memoria Wiki contiene informazioni provenienti dall'Editor di Testo, dalle Trame, dai Personaggi, e dalle Location. I dati vengono aggiornati in automatico, ma è possibile anche eseguire aggiornamenti manuali. La memoria tiene traccia anche delle conversazioni avute con la AI nell'editor di testo, così che anche queste vadano ad arricchire la competenza della AI stessa, che deve essere vista come un assistente a 360°.

###

La memoria può essere interrogata in ogni momento, sia dal chatbot presente nell'editor di testo, sia direttamente dalla vista chiamata memoria. Qui è presente una barra di ricerca in stile 'Google'. Oltre alle risposte relative alla domanda posta, o alla parola chiave cercata, saranno disponibili le fonti da cui è stata estrapolata la risposta.

## Analisi

Il programma è dotato di una serie di servizi, svolti tramite AI, capaci di identificare potenziali problemi in questi ambiti:

- Coerenza Narrativa: Tempi, personaggi e location descritti in modo contradditorio, etc.
- Eventi non risolti: Vicende, promesse narrative e trame lasciate aperte.
- Stile: Tono, punteggiatura, ricorrenze, ripetizioni, e leggibilità del testo.
- Ritmo narrativo: Capitoli deboli, scene ridondanti, personaggi superficiali o assenti nella narrazione.
- Nomi e convenzioni: Nomi propri, terminologie, convenzioni, e coerenza interna.

Il report fornito è solamente indicativo, ma utile all'autore durante la fase di revisione del testo. Volendo, il report può essere stampato per poter conservare le informazioni e fare le correzioni in un secondo momento.

## Impostazioni

Il menù impostazioni serve principalmente per:

- Impostare l'autosave.
- Impostare la lingua del programma.
- Impostare il tema dell'interfaccia.
- Impostare il servizio AI da usare.
- Impostare il consenso alle AI di usare i dati conservati nella Wiki.
- Inserire la API Key (se necessario).

### Autosave

Il programma permette di scegliere tra:

1. Salvataggio manuale.
2. Salvataggio ogni N Minuti.
3. Salvataggio automatico, a ogni modifica fatta dall'utente.

### Lingua Interfaccia

Il programma permette di scegliere tra:

1. Automatico.
2. Italiano.
3. Inglese.

### Tema Interfaccia

Il programma permette di scegliere tra:

1. Come da Sistema.
2. Chiara.
3. Scura.

### Impostazioni AI

Qui si può scegliere il modello AI da usare (OpenAI API Key oppure Ollama), il fallback nel caso la AI scelta abbia problemi (tra cui anche No AI), e impostare i modelli a cui fare le richieste (prima di cambiare quelli di default, verificare i costi per token).

### Consensi

Qui sono presenti le box per abilitare le varie funzionalità AI previste dall'applicazione.

### Segreti

Qui va inserita la API KEY per i servizi cloud.

#### API KEY

Questo è l'unico sistema che permette di generare le immagini In-App, sempre che il servizio associato alla vostra chiave API lo permetta. E' prevista la compatibilità alle API KEY di OpenAI, che sono un po' uno standard de facto.

#### Ollama

Ollama è un tool che, una volta installato sul proprio computer, permette di scaricare dei modelli AI locali (misurati sulle prestazioni del PC), o di usare dei modelli Open Source in Cloud. Questa soluzione è utile per chi vuole la massima tutela della privacy, a scapito delle prestazioni dei modelli.

Attenzione: Ollama deve essere installato e in esecuzione sul computer. In caso contrario il provider locale non sarà attivo.

Il menù impostazioni presenta anche quattro check box importanti:

1. Consenso invio testo a strumenti AI: Senza questo consenso non si potranno usare i servizi AI.
2. Abilita chiamate API esterne: Senza questo consenso non potrà funzionare il servizio tramite API KEY.
3. Auto-riassunto della descrizione blocco al salvataggio: Senza questo consenso non si avrà il riassunto automatico dei capitoli in descrizione al blocco.
4. Consenso invio memoria progetto a provider esterni: se disattivato, la AI non riceverà la memoria Wiki quando il provider o il fallback possono inviare il prompt fuori dal computer.

E' inoltre presente un Fallback nel caso il servizio AI scelto non sia operativo per qualche motivo. Questo fallback può ridirigere le richieste all'altro provider disponibile, o essere completamente 'Non AI'.

_Nota:_ Le impostazioni AI sono salvate all'interno dei singoli progetti. Le preferenze di autosave invece sono globali utente, quindi restano valide anche quando si apre o si crea un altro progetto.

## Licenza

Questo progetto e distribuito sotto licenza Apache 2.0. Vedi [LICENSE](./LICENSE).
