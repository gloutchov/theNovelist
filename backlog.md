# Backlog operativo — The Novelist

## Regole di lavoro
1. Ogni task deve includere test minimi e criteri di accettazione.
2. `Definition of Done` comune: build verde, test verdi, lint verde, nessun errore console critico.
3. Priorità: P0 (bloccante MVP), P1 (alto valore), P2 (post-MVP).

## Epic 0 — Fondazioni progetto (P0)
### E0-T1 Bootstrap app desktop
- Descrizione: inizializzare Electron + React + TypeScript.
- Output: app avviabile in dev su macOS/Windows/Linux.
- Dipendenze: nessuna.
- Accettazione: avvio con comando unico, finestra principale caricata.

### E0-T2 Tooling qualità
- Descrizione: ESLint, Prettier, test runner unit, test e2e base, CI.
- Output: pipeline CI con lint+test.
- Dipendenze: E0-T1.
- Accettazione: PR fallisce se lint/test falliscono.

### E0-T3 Architettura IPC sicura
- Descrizione: canali IPC tipizzati (Zod), layer service nel main process.
- Output: contratto IPC documentato.
- Dipendenze: E0-T1.
- Accettazione: solo canali allowlist; payload invalidi rifiutati.

## Epic 1 — Persistenza progetto (P0)
### E1-T1 Schema database iniziale
- Descrizione: migration SQLite per Project, Plot, ChapterNode, ChapterEdge, ChapterDocument.
- Output: migration versionate.
- Dipendenze: E0-T1.
- Accettazione: creazione DB da zero ripetibile.

### E1-T2 Repository layer
- Descrizione: CRUD tipizzato e testato per entità base.
- Output: modulo persistence riusabile.
- Dipendenze: E1-T1.
- Accettazione: unit test CRUD principali.

### E1-T3 Gestione file progetto
- Descrizione: crea/apri/salva progetto, cartella asset dedicata.
- Output: formato progetto stabile (`project.db` + `assets/`).
- Dipendenze: E1-T2.
- Accettazione: apertura/salvataggio senza perdita dati.

### E1-T4 Autosave + crash recovery
- Descrizione: salvataggio automatico con snapshot locale.
- Output: recupero sessione dopo chiusura anomala.
- Dipendenze: E1-T3.
- Accettazione: simulazione crash con ripristino dati.

## Epic 2 — Story Canvas (P0)
### E2-T1 Canvas base capitoli
- Descrizione: implementare canvas con nodi trascinabili.
- Output: creazione/spostamento nodi.
- Dipendenze: E1-T3.
- Accettazione: drag fluido e persistenza posizione.

### E2-T2 Attributi blocco capitolo
- Descrizione: titolo, descrizione, numero trama, numero blocco.
- Output: modale doppio click per edit.
- Dipendenze: E2-T1.
- Accettazione: edit e salvataggio immediati.

### E2-T3 Connessioni e ordine narrativo
- Descrizione: creare/cancellare edge anche cross-trama.
- Output: relazione ordine capitoli visuale.
- Dipendenze: E2-T1.
- Accettazione: connessioni valide persistenti.

### E2-T4 Colori per trama
- Descrizione: mappa colore automatica per `Numero Trama`.
- Output: blocchi visivamente distinti.
- Dipendenze: E2-T2.
- Accettazione: stesso plot => stesso colore, plot diverso => colore diverso.

### E2-T5 Delete blocchi/connessioni
- Descrizione: cancellazione con conferma e cleanup riferimenti.
- Output: stato consistente dopo delete.
- Dipendenze: E2-T3.
- Accettazione: nessun edge orfano.

## Epic 3 — Editor capitoli (P0)
### E3-T1 Rich text editor base
- Descrizione: editor con stili Titolo/Normale/Citazione.
- Output: contenuto capitolo persistito in JSON rich text.
- Dipendenze: E1-T2.
- Accettazione: apertura editor da modale blocco.

### E3-T2 Formattazione avanzata
- Descrizione: grassetto, corsivo, font, dimensione, allineamenti.
- Output: toolbar completa.
- Dipendenze: E3-T1.
- Accettazione: tutte le formattazioni applicabili/rimuovibili.

### E3-T3 Stampa ed export DOCX/PDF
- Descrizione: esportazione capitolo o documento completo.
- Output: file compatibili e stampa.
- Dipendenze: E3-T2.
- Accettazione: export apribile in editor esterni + output PDF corretto.

### E3-T4 Riferimenti personaggi/location nel testo
- Descrizione: inserimento assistito di personaggi/luoghi nel capitolo.
- Output: menzione strutturata.
- Dipendenze: Epic 5, Epic 6.
- Accettazione: link a scheda personaggio/location consultabile.

## Epic 4 — Integrazione Codex CLI (P0)
### E4-T1 Wrapper CLI nel main process
- Descrizione: esecuzione comandi Codex con timeout/cancel/retry.
- Output: servizio AI robusto.
- Dipendenze: E0-T3.
- Accettazione: error handling completo e log evento.

### E4-T2 Azioni contestuali su selezione testo
- Descrizione: correggi/riscrivi/espandi/riduci con preview diff.
- Output: menu contestuale editor.
- Dipendenze: E4-T1, E3-T2.
- Accettazione: applica/scarta modifica in modo trasparente.

### E4-T3 Sidebar chat persistente
- Descrizione: chat laterale per brainstorming e ricerche narrative.
- Output: storico sessione per progetto/capitolo.
- Dipendenze: E4-T1.
- Accettazione: riapertura progetto mantiene storico.

### E4-T4 Privacy e consenso AI
- Descrizione: opt-in invio testo, toggle log, avviso dati.
- Output: policy privacy locale-by-default.
- Dipendenze: E4-T1.
- Accettazione: nessuna chiamata AI senza consenso attivo.

## Epic 5 — Schede personaggi (P0)
### E5-T1 Modello dati personaggio
- Descrizione: migration `CharacterCard`, `CharacterImage`, `CharacterChapterLink`.
- Output: struttura DB completa.
- Dipendenze: E1-T1.
- Accettazione: migration testata e retrocompatibile.

### E5-T2 Canvas/board personaggi
- Descrizione: lista/canvas con card, creazione, drag, delete.
- Output: board personaggi operativa.
- Dipendenze: E5-T1.
- Accettazione: CRUD completo via UI.

### E5-T3 Modale dettagli personaggio
- Descrizione: form con tutti gli attributi richiesti.
- Output: doppio click per edit.
- Dipendenze: E5-T2.
- Accettazione: validazioni base (campi obbligatori/coerenza).

### E5-T4 Immagini personaggio
- Descrizione: upload immagini locali + metadati.
- Output: gallery nella scheda.
- Dipendenze: E5-T3.
- Accettazione: immagini salvate e ricaricate correttamente.

### E5-T5 AI per personaggi
- Descrizione: suggerimenti descrittivi e prompt immagine da Codex.
- Output: azioni AI in scheda.
- Dipendenze: E4-T1, E5-T3.
- Accettazione: suggerimento applicabile con un click.

## Epic 6 — Schede location (P0)
### E6-T1 Modello dati location
- Descrizione: migration `LocationCard`, `LocationImage`, `LocationChapterLink`.
- Output: struttura DB location pronta.
- Dipendenze: E1-T1.
- Accettazione: CRUD DB testato.

### E6-T2 Canvas/board location
- Descrizione: creazione/modifica/cancellazione schede luogo.
- Output: board location operativa.
- Dipendenze: E6-T1.
- Accettazione: doppio click edit e drag funzionanti.

### E6-T3 Modale dettagli location
- Descrizione: nome, tipologia, descrizione, note, trama.
- Output: form completo per ambientazioni.
- Dipendenze: E6-T2.
- Accettazione: salvataggio e validazioni base.

### E6-T4 Immagini location
- Descrizione: upload locale + generazione immagini da descrizione.
- Output: gallery location con varianti (esterno/interno/dettaglio).
- Dipendenze: E6-T3, E4-T1.
- Accettazione: immagine associata correttamente alla location.

### E6-T5 Collegamenti location-capitolo
- Descrizione: associazione luogo a capitoli per tracciamento presenze.
- Output: sezione "compare nei capitoli".
- Dipendenze: E6-T3, E2-T2.
- Accettazione: navigazione bidirezionale capitolo <-> location.

## Epic 7 — Rifinitura prodotto e release beta (P1)
### E7-T1 Prestazioni grandi progetti
- Descrizione: profiling e ottimizzazioni canvas/editor.
- Output: target 500+ blocchi gestibili.
- Dipendenze: Epic 2, Epic 3.
- Accettazione: benchmark documentato.

### E7-T2 UX finale
- Descrizione: undo/redo globale, shortcut, accessibilità base.
- Output: usabilità migliorata.
- Dipendenze: Epic 2-6.
- Accettazione: checklist UX chiusa.

### E7-T3 Packaging distribuzione
- Descrizione: build installer `dmg`, `exe`, `AppImage`.
- Output: pacchetti installabili.
- Dipendenze: tutte le Epic P0 completate.
- Accettazione: installazione pulita su OS target.

### E7-T4 Documentazione utente
- Descrizione: guida rapida, privacy AI, troubleshooting.
- Output: docs incluse nel pacchetto.
- Dipendenze: E7-T3.
- Accettazione: manuale consultabile in-app o file allegato.

## Sequenza esecutiva consigliata
1. Epic 0 -> 1 -> 2 -> 3.
2. Epic 4 in parallelo da metà Epic 3.
3. Epic 5 e Epic 6 in parallelo (stesso pattern board+scheda+immagini).
4. Epic 7 finale.

## Piano iterazioni (stima)
1. Iterazione 1 (settimane 1-2): Epic 0 + Epic 1.
2. Iterazione 2 (settimane 3-4): Epic 2.
3. Iterazione 3 (settimane 5-6): Epic 3.
4. Iterazione 4 (settimane 7-8): Epic 4.
5. Iterazione 5 (settimane 9-11): Epic 5 + Epic 6.
6. Iterazione 6 (settimane 12-13): Epic 7 + beta.

## Checklist prima di iniziare coding
1. Confermare formato progetto: cartella con `project.db` + `assets/`.
2. Confermare privacy default: AI disattivata finché utente non abilita opt-in.
3. Confermare tassonomia location iniziale: minimale o estesa.
4. Confermare priorità export: DOCX e PDF nella stessa iterazione.
