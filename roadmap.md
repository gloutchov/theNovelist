# Roadmap: The Novelist solo macOS

## Obiettivo
Portare il progetto da supporto multipiattaforma "teorico" a supporto macOS esplicito, verificabile e mantenibile.

## Branch di lavoro
- `macos-only-roadmap`

## Principio guida
Prima si restringe il perimetro di build, CI e documentazione; poi si semplifica il codice che oggi esiste solo per coprire Windows e Linux.

## Fase 1: dichiarare ufficialmente il supporto solo macOS
### Obiettivo
Far risultare chiaro, nel repository e nei comandi di build, che l'app supporta solo macOS.

### Azioni
- Aggiornare `package.json` per rendere macOS il target principale di release.
- Decidere se mantenere `npm run dist` come alias di `dist:mac`.
- Rimuovere o deprecare gli script `dist:win` e `dist:linux`.
- Rimuovere dalla configurazione `electron-builder` i target Windows e Linux.

### File coinvolti
- `package.json`

### Criterio di completamento
- Esiste un solo percorso ufficiale di packaging: macOS.

## Fase 2: semplificare CI e pipeline di release
### Obiettivo
Evitare di dare un falso senso di compatibilita tramite pipeline che producono o testano build non verificate.

### Azioni
- Aggiornare `.github/workflows/ci.yml` per eseguire i job solo nell'ambiente piu utile per il progetto.
- Valutare se spostare anche la job `quality` da Ubuntu a `macos-latest`, dato che usi moduli nativi Electron.
- Rimuovere la matrix Windows/Linux dal job smoke.
- Aggiornare `.github/workflows/release.yml` per pubblicare solo artefatti macOS (`.dmg`, `.zip`, eventuali blockmap/mac yml).

### File coinvolti
- `.github/workflows/ci.yml`
- `.github/workflows/release.yml`

### Criterio di completamento
- La CI non promette supporto Windows/Linux.
- La release GitHub produce solo artefatti macOS.

## Fase 3: audit del codice con rami specifici per piattaforma
### Obiettivo
Capire quali rami `win32`/`linux` possono essere rimossi subito e quali conviene lasciare temporaneamente.

### Azioni
- Fare un audit dei punti che controllano `process.platform`.
- Semplificare gli script che oggi gestiscono differenze Windows (`shell`, `windowsHide`) se non servono piu.
- Valutare se ridurre la logica multipiattaforma in `src/main/codex/client.ts`, oggi molto orientata anche a Windows/Linux.
- Mantenere invece il comportamento macOS nativo in `src/main/index.ts` (`window-all-closed` con eccezione `darwin`).

### File da rivedere per primi
- `src/main/codex/client.ts`
- `src/main/index.ts`
- `scripts/run-electron-e2e.mjs`
- `scripts/run-electron-codex-smoke.mjs`
- `scripts/rebuild-electron-native.mjs`
- `scripts/rebuild-node-native.mjs`

### Criterio di completamento
- Il codice non contiene complessita multipiattaforma inutile per il nuovo obiettivo.

## Fase 4: riallineare test e aspettative
### Obiettivo
Far si che i test confermino il comportamento che vuoi davvero supportare.

### Azioni
- Rimuovere o riscrivere i test che verificano esplicitamente percorsi Windows/Linux.
- Aggiornare i test e2e che hanno branch speciali per Linux o Windows.
- Mantenere i test che restano validi anche in un contesto solo macOS.

### File da rivedere per primi
- `tests/unit/codex-client.test.ts`
- `tests/e2e/electron-codex-smoke.spec.ts`
- `tests/e2e/workflows.spec.ts`

### Criterio di completamento
- La suite non testa piu compatibilita che non intendi garantire.

## Fase 5: aggiornare documentazione e messaggio del prodotto
### Obiettivo
Evitare discrepanze tra il comportamento reale del progetto e quello che README/release fanno intendere.

### Azioni
- Aggiornare `README.md` nei comandi utili, nelle istruzioni di build e nella sezione release.
- Sostituire tutti i riferimenti a Windows/Linux con una dichiarazione esplicita di supporto solo macOS.
- Aggiungere una breve nota sul motivo della scelta: supporto limitato per garantire qualita e verificabilita.

### File coinvolti
- `README.md`

### Criterio di completamento
- Un nuovo utente capisce subito che il prodotto e pensato e distribuito solo per macOS.

## Fase 6: checklist di release minima
### Obiettivo
Definire quando una nuova versione puo essere pubblicata senza riaprire il tema multipiattaforma.

### Checklist
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e:electron`
- `npm run dist:mac`
- Avvio manuale della `.app` generata
- Installazione tramite `.dmg`
- Verifica apertura progetto, salvataggio, export e AI settings su macOS

## Decisioni da prendere prima dei tag futuri
- Supportare solo `arm64` o anche build Intel/universal?
- Tenere `dist:mac` come comando esplicito o far diventare `dist` il comando standard?
- Vuoi solo build locale non firmata o vuoi pianificare anche firma/notarizzazione macOS?

## Ordine consigliato di esecuzione
1. `package.json`
2. `.github/workflows/ci.yml`
3. `.github/workflows/release.yml`
4. audit codice e script
5. test
6. `README.md`
7. nuova release
