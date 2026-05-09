# The Novelist - Milestones

Roadmap di miglioramento basata sulle funzionalita gia presenti nel progetto: editor capitoli, canvas narrativo, trame/personaggi/location, memoria Wiki locale, AI contestuale, immagini, export, autosave, snapshot e impostazioni privacy.

## Principio guida

The Novelist non dovrebbe diventare solo un editor con AI, ma un sistema editoriale locale per costruire, scrivere, revisionare e controllare romanzi complessi.

Le milestone sono ordinate per impatto pratico e coerenza con l'architettura attuale.

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

