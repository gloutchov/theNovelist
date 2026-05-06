# The Novelist - Milestones

Roadmap di miglioramento basata sulle funzionalita gia presenti nel progetto: editor capitoli, canvas narrativo, trame/personaggi/location, memoria Wiki locale, AI contestuale, immagini, export, autosave, snapshot e impostazioni privacy.

## Principio guida

The Novelist non dovrebbe diventare solo un editor con AI, ma un sistema editoriale locale per costruire, scrivere, revisionare e controllare romanzi complessi.

Le milestone sono ordinate per impatto pratico e coerenza con l'architettura attuale.

## Milestone 1 - Cruscotto progetto

Obiettivo: dare all'utente una vista immediata dello stato del romanzo.

Funzionalita:
- parole totali del manoscritto;
- parole per capitolo;
- ultimo capitolo modificato;
- capitoli senza descrizione o con descrizione vecchia;
- personaggi e location non ancora collegati a capitoli;
- capitoli senza personaggi/location;
- stato memoria Wiki;
- ultimo snapshot disponibile;
- stato autosave e AI.

Valore:
- rende piu chiaro dove riprendere il lavoro;
- trasforma l'app da lavagna narrativa a ambiente di lavoro quotidiano;
- sfrutta dati gia presenti nel database.

## Milestone 2 - Vista scaletta ordinata

Obiettivo: affiancare al canvas una vista lineare piu editoriale.

Funzionalita:
- elenco ordinato dei capitoli secondo le connessioni narrative;
- titolo, trama, numero blocco, parole, descrizione breve;
- personaggi e location citati o collegati;
- apertura rapida dell'editor capitolo;
- drag and drop per riordinare;
- sincronizzazione con il canvas storia;
- segnalazione di nodi non collegati o ambigui.

Valore:
- il canvas resta utile per progettare;
- la scaletta diventa utile per revisionare e compilare;
- facilita romanzi lunghi e trame parallele.

## Milestone 3 - Scene dentro i capitoli

Obiettivo: introdurre un livello narrativo piu fine del capitolo.

Funzionalita:
- scene interne a ogni capitolo;
- titolo scena;
- POV;
- location;
- tempo narrativo;
- personaggi presenti;
- scopo della scena;
- conflitto;
- esito;
- note autore;
- riordino scene dentro il capitolo;
- export che mantiene separatori scena opzionali.

Valore:
- aiuta a progettare romanzi complessi;
- migliora la qualita del contesto dato alla AI;
- rende piu semplice analizzare ritmo e struttura.

## Milestone 4 - Cronologia narrativa

Obiettivo: distinguere l'ordine di lettura dall'ordine degli eventi.

Funzionalita:
- data o momento narrativo per capitoli e scene;
- eventi principali del romanzo;
- collegamenti prima/dopo tra eventi;
- vista timeline;
- filtro per trama, personaggio o location;
- segnalazione di possibili incoerenze temporali.

Valore:
- supporta flashback, trame parallele e intrecci complessi;
- prepara il terreno per controlli AI sulla continuita.

## Milestone 5 - Controllo continuita

Obiettivo: usare la memoria Wiki e le schede strutturate per trovare incoerenze.

Funzionalita:
- controllo nomi e alias personaggi;
- controllo eta, aspetto, lavoro, relazioni e dettagli ricorrenti;
- controllo location e oggetti narrativi;
- controllo presenza personaggi nei capitoli;
- controllo eventi non risolti;
- risultati citabili con riferimento a capitoli, schede o fonti Wiki;
- lista problemi con stato: aperto, ignorato, risolto.

Valore:
- e una delle funzioni AI piu utili per uno scrittore;
- valorizza la memoria locale gia implementata;
- riduce errori tipici nelle revisioni lunghe.

## Milestone 6 - Versioni e revisioni capitolo

Obiettivo: permettere revisioni reali senza paura di perdere testo.

Funzionalita:
- versioni manuali dei capitoli;
- snapshot automatici prima di trasformazioni AI;
- confronto differenze tra versioni;
- ripristino versione precedente;
- etichette: bozza, revisione, finale;
- storico delle trasformazioni AI applicate o scartate.

Valore:
- rende piu sicure le operazioni AI;
- aiuta nel processo editoriale;
- si integra naturalmente con snapshot e salvataggi esistenti.

## Milestone 7 - Modalita revisione

Obiettivo: separare scrittura e revisione.

Funzionalita:
- lettura capitolo senza distrazioni;
- note e commenti marginali;
- stato capitolo: da scrivere, in revisione, completato, finale;
- filtri per stato;
- elenco commenti aperti;
- segnalibri;
- passaggio rapido al punto commentato.

Valore:
- rende l'app piu adatta a progetti lunghi;
- introduce un flusso editoriale chiaro;
- prepara collaborazione futura senza richiederla subito.

## Milestone 8 - Style Bible

Obiettivo: costruire una guida stilistica del romanzo.

Funzionalita:
- tono narrativo;
- registro dei dialoghi;
- regole di punteggiatura;
- parole o formule ricorrenti;
- nomi propri e convenzioni;
- scelte stilistiche da mantenere;
- aggiornamento manuale e assistito da AI;
- uso opzionale come contesto nelle revisioni AI.

Valore:
- migliora la coerenza delle risposte AI;
- aiuta l'autore a mantenere una voce costante;
- puo vivere nella memoria progetto come fonte dedicata.

## Milestone 9 - Analisi editoriale AI

Obiettivo: passare da chat generica a assistente editoriale strutturato.

Funzionalita:
- analisi del romanzo completo;
- analisi per capitolo;
- ritmo narrativo;
- capitoli deboli;
- scene ridondanti;
- personaggi spariti troppo a lungo;
- conflitti aperti;
- domande editoriali;
- suggerimenti con priorita;
- riferimenti alle fonti usate dalla memoria.

Valore:
- trasforma l'AI in uno strumento di revisione ad alto valore;
- riduce l'effetto chatbot generico;
- usa in modo concreto Wiki, capitoli, schede e trame.

## Milestone 10 - Schede automatiche da manoscritto

Obiettivo: estrarre struttura narrativa dal testo gia scritto.

Funzionalita:
- scansione capitolo;
- proposta nuovi personaggi;
- proposta nuove location;
- proposta aggiornamenti a schede esistenti;
- individuazione alias o nomi alternativi;
- conferma manuale prima di scrivere nel database;
- collegamento automatico dei riferimenti approvati.

Valore:
- riduce lavoro manuale;
- rende utile l'app anche a chi importa un romanzo gia iniziato;
- prosegue il flusso gia presente di creazione schede da selezione.

## Milestone 11 - Azioni AI batch

Obiettivo: applicare operazioni AI controllate su piu capitoli o schede.

Funzionalita:
- riassumi tutti i capitoli;
- aggiorna descrizioni blocchi;
- trova passaggi con un personaggio;
- genera domande editoriali per ogni capitolo;
- controlla dialoghi;
- trova ripetizioni;
- estrai eventi principali;
- produce una lista di proposte senza modificare automaticamente il testo.

Valore:
- utile per revisioni su romanzi lunghi;
- mantiene controllo umano;
- sfrutta il provider AI gia configurato.

## Milestone 12 - Obiettivi di scrittura e statistiche

Obiettivo: dare strumenti leggeri di avanzamento.

Funzionalita:
- target parole del progetto;
- target parole per capitolo;
- progresso percentuale;
- parole scritte per sessione;
- capitoli completati;
- andamento nel tempo;
- statistiche per trama;
- stime semplici di lettura.

Valore:
- motiva senza trasformare l'app in un tracker invasivo;
- usa word count gia disponibile;
- rende il cruscotto piu utile.

## Milestone 13 - Export editoriale avanzato

Obiettivo: migliorare la qualita degli output.

Funzionalita:
- template DOCX/PDF;
- frontespizio;
- indice;
- numerazione capitoli;
- separatori scena;
- font e margini configurabili;
- export per singola trama;
- export solo capitoli selezionati;
- export Markdown;
- export EPUB.

Valore:
- rende The Novelist piu vicino a uno strumento produttivo completo;
- aumenta l'utilita anche fuori dall'app;
- valorizza l'ordine narrativo gia calcolato.

## Milestone 14 - Ricerca globale e command palette

Obiettivo: rendere navigazione e comandi piu rapidi.

Funzionalita:
- ricerca globale in capitoli, trame, personaggi, location e memoria;
- apertura rapida risultati;
- comandi rapidi: crea capitolo, apri impostazioni, sincronizza memoria, esporta;
- scorciatoia tastiera;
- filtri per tipo risultato.

Valore:
- migliora l'usabilita su progetti grandi;
- completa la ricerca locale della memoria;
- riduce dipendenza dal canvas.

## Milestone 15 - Privacy avanzata

Obiettivo: rafforzare la protezione dei contenuti privati.

Funzionalita:
- cifratura opzionale di `project.db`;
- cifratura opzionale della directory `wiki/`;
- password progetto;
- backup cifrati;
- report privacy: cosa puo essere inviato a provider esterni;
- avviso quando `OLLAMA_HOST` punta a un endpoint non locale.

Valore:
- risponde a un limite noto del progetto;
- importante per manoscritti inediti;
- coerente con i consensi AI gia presenti.

## Milestone 16 - Release piu affidabili

Obiettivo: rendere l'app piu facile da distribuire.

Funzionalita:
- firma Windows;
- firma e notarizzazione macOS;
- workflow release completo per macOS e Windows;
- controllo aggiornamenti;
- note release leggibili;
- smoke test su app pacchettizzata.

Valore:
- riduce warning di sistema operativo;
- aumenta fiducia dell'utente finale;
- porta il progetto fuori dalla fase alpha.

## Milestone 17 - Refactor frontend

Obiettivo: preparare il codice a nuove funzionalita senza aumentare troppo la complessita.

Interventi:
- separare `App.tsx` in moduli per tab, modali, toolbar, memoria e impostazioni;
- separare `ChapterEditor.tsx` in editor, chat, toolbar, ricerca, menzioni e diff AI;
- introdurre hook dedicati per autosave, dirty state, AI settings e wiki status;
- mantenere test mirati per ogni estrazione;
- evitare refactor puramente estetici se non aiutano feature concrete.

Valore:
- riduce rischio di regressioni;
- rende piu semplice aggiungere milestone future;
- migliora manutenibilita.

## Milestone 18 - Architettura provider AI piu estendibile

Obiettivo: rendere piu facile aggiungere provider o capacita AI.

Funzionalita:
- interfaccia provider testuale uniforme;
- interfaccia provider immagini separata;
- capability detection: chat, trasformazione testo, immagini, contesto lungo;
- configurazioni provider per progetto;
- messaggi errore piu chiari;
- test di fallback per ogni provider.

Valore:
- evita logica condizionale crescente;
- prepara nuovi provider;
- rende piu solido il comportamento fallback.

## Roadmap consigliata

Ordine pragmatico:

1. Cruscotto progetto.
2. Vista scaletta ordinata.
3. Versioni e revisioni capitolo.
4. Scene dentro i capitoli.
5. Cronologia narrativa.
6. Controllo continuita.
7. Style Bible.
8. Analisi editoriale AI.
9. Export editoriale avanzato.
10. Privacy avanzata e release firmate.

Questa sequenza privilegia funzioni ad alto impatto per l'utente e rimanda le parti piu invasive a quando il flusso editoriale sara piu maturo.
