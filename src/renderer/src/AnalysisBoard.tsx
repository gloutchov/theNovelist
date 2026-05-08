import { useMemo, useState } from 'react';

type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type PlotRecord = StoryState['plots'][number];
type CharacterCard = Awaited<ReturnType<(typeof window.novelistApi)['listCharacterCards']>>[number];

type AnalysisKind = 'coherence' | 'open-events' | 'style' | 'rhythm' | 'names';

interface AnalysisBoardProps {
  currentProject: ProjectRecord;
  onStatus: (message: string) => void;
}

interface AnalysisResult {
  kind: AnalysisKind;
  title: string;
  generatedAt: string;
  output: string;
}

interface RichTextNodeJson {
  type?: string;
  text?: string;
  content?: RichTextNodeJson[];
}

const ANALYSIS_CONTEXT_LIMIT = 4_800;
const ANALYSIS_TIMEOUT_MS = 120_000;

const ANALYSIS_TESTS: Array<{
  kind: AnalysisKind;
  title: string;
  description: string;
  prompt: string;
}> = [
  {
    kind: 'coherence',
    title: 'Coerenza narrativa',
    description: 'Tempi, personaggi e location descritti in modo contraddittorio.',
    prompt:
      'Verifica la coerenza narrativa del romanzo: riferimenti temporali errati, descrizioni incoerenti dei personaggi, descrizioni incoerenti delle location fra capitoli e scene.',
  },
  {
    kind: 'open-events',
    title: 'Eventi non risolti',
    description: 'Vicende, promesse narrative e trame lasciate aperte.',
    prompt:
      'Controlla eventi non risolti rispetto a trame, capitoli e scene: promesse narrative, conflitti, indizi, obiettivi o vicende aperte che non hanno una chiusura riconoscibile.',
  },
  {
    kind: 'style',
    title: 'Stile',
    description: 'Tono, punteggiatura, ricorrenze, ripetizioni e leggibilità.',
    prompt:
      'Verifica lo stile: tono narrativo incoerente tra capitoli e scene, regole di punteggiatura instabili, parole o formule ricorrenti, concetti ripetuti, leggibilità incostante o pesantezza, capitoli troppo lunghi o troppo corti.',
  },
  {
    kind: 'rhythm',
    title: 'Ritmo narrativo',
    description: 'Capitoli deboli, scene ridondanti, personaggi superficiali o assenti.',
    prompt:
      'Verifica il ritmo narrativo: capitoli deboli, scene ridondanti o poco efficaci, personaggi poco definiti o superficiali, personaggi che spariscono o non vengono citati per troppo tempo, conflitti e vicende rimaste aperte.',
  },
  {
    kind: 'names',
    title: 'Nomi e convenzioni',
    description: 'Nomi propri, terminologia, convenzioni e coerenza interna.',
    prompt:
      'Verifica nomi propri, convenzioni, terminologia e coerenza interna: varianti di nomi, grafie diverse, maiuscole/minuscole incoerenti, titoli, luoghi, oggetti, ruoli e formule ricorrenti usate in modo instabile.',
  },
];

function richTextNodeToText(node: RichTextNodeJson | undefined): string {
  if (!node || node.type === 'referenceMention') {
    return '';
  }
  if (node.type === 'hardBreak') {
    return '\n';
  }
  if (typeof node.text === 'string') {
    return node.text;
  }
  return (node.content ?? []).map(richTextNodeToText).join('');
}

function richTextJsonToText(contentJson: string): string {
  try {
    const parsed = JSON.parse(contentJson) as RichTextNodeJson;
    return (parsed.content ?? []).map(richTextNodeToText).join('\n').trim();
  } catch {
    return '';
  }
}

function truncateText(value: string, maxLength: number): string {
  const compact = value.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength).trim()}...`;
}

function characterName(card: CharacterCard): string {
  return `${card.firstName} ${card.lastName}`.trim() || card.id;
}

function plotLabel(plot: PlotRecord | undefined, plotNumber: number): string {
  return plot?.label?.trim() || `Trama ${plotNumber}`;
}

function pushWithinLimit(parts: string[], next: string, limit = ANALYSIS_CONTEXT_LIMIT): boolean {
  const currentLength = parts.join('\n').length;
  if (currentLength + next.length + 1 > limit) {
    return false;
  }
  parts.push(next);
  return true;
}

async function buildWikiAnalysisContext(query: string): Promise<string> {
  try {
    const results = await window.novelistApi.wikiSearch({ query, limit: 6 });
    if (results.length === 0) {
      return '';
    }

    return [
      '## Fonti Wiki piu rilevanti',
      ...results.map((result, index) =>
        [
          `[${index + 1}] ${result.title} (${result.path})`,
          truncateText(result.snippet || 'Nessuno snippet disponibile', 360),
        ].join('\n'),
      ),
    ].join('\n\n');
  } catch {
    return '';
  }
}

async function buildAnalysisContext(test: (typeof ANALYSIS_TESTS)[number]): Promise<string> {
  const [storyState, scenes, characters, locations, timelineState] = await Promise.all([
    window.novelistApi.getStoryState(),
    window.novelistApi.listSceneCards(),
    window.novelistApi.listCharacterCards(),
    window.novelistApi.listLocationCards(),
    window.novelistApi.getTimelineState?.().catch(() => null) ?? Promise.resolve(null),
  ]);
  const plotsByNumber = new Map(storyState.plots.map((plot) => [plot.number, plot]));
  const chaptersById = new Map(storyState.nodes.map((chapter) => [chapter.id, chapter]));
  const chapterDocuments = await Promise.all(
    storyState.nodes.map(async (chapter) => {
      try {
        const document = await window.novelistApi.getChapterDocument({ chapterNodeId: chapter.id });
        return [chapter.id, richTextJsonToText(document.contentJson)] as const;
      } catch {
        return [chapter.id, ''] as const;
      }
    }),
  );
  const chapterTextById = new Map(chapterDocuments);
  const wikiContext = await buildWikiAnalysisContext(`${test.title}. ${test.prompt}`);

  const parts: string[] = [
    '# Contesto analisi romanzo',
    'Usa sempre titoli e id quando segnali un problema. Le fonti Wiki sono prioritarie se presenti.',
    '',
  ];

  if (wikiContext) {
    pushWithinLimit(parts, wikiContext);
  }

  pushWithinLimit(parts, '\n## Trame');

  for (const plot of storyState.plots) {
    pushWithinLimit(
      parts,
      `- ${plotLabel(plot, plot.number)} (${plot.id}, numero ${plot.number}): ${truncateText(plot.summary || 'Nessuna sinossi', 280)}`,
    );
  }

  pushWithinLimit(parts, '\n## Capitoli');
  for (const chapter of [...storyState.nodes].sort((left, right) => {
    if (left.plotNumber !== right.plotNumber) return left.plotNumber - right.plotNumber;
    return left.blockNumber - right.blockNumber;
  })) {
    const text = chapterTextById.get(chapter.id) ?? '';
    pushWithinLimit(
      parts,
      [
        `### Capitolo: ${chapter.title} (${chapter.id})`,
        `- trama: ${plotLabel(plotsByNumber.get(chapter.plotNumber), chapter.plotNumber)}`,
        `- blocco: ${chapter.blockNumber}`,
        `- descrizione: ${truncateText(chapter.description || 'Nessuna descrizione', 180)}`,
        `- testo: ${truncateText(text || 'Nessun testo', 320)}`,
      ].join('\n'),
    );
  }

  pushWithinLimit(parts, '\n## Scene');
  for (const scene of scenes) {
    const chapter = chaptersById.get(scene.chapterNodeId);
    pushWithinLimit(
      parts,
      [
        `### Scena: ${scene.name} (${scene.id})`,
        `- capitolo: ${chapter?.title ?? 'sconosciuto'} (${scene.chapterNodeId})`,
        `- trama: ${plotLabel(plotsByNumber.get(scene.plotNumber), scene.plotNumber)}`,
        `- testo: ${truncateText(scene.text || 'Nessun testo', 220)}`,
        `- note: ${truncateText(scene.notes || 'Nessuna nota', 100)}`,
      ].join('\n'),
    );
  }

  pushWithinLimit(parts, '\n## Personaggi');
  for (const character of characters) {
    pushWithinLimit(
      parts,
      `- ${characterName(character)} (${character.id}) trama ${character.plotNumber}: sesso=${character.sex || 'n/d'}, eta=${character.age ?? 'n/d'}, specie=${character.species || 'n/d'}, aspetto=${truncateText([character.hairColor, character.eyeColor, character.skinColor, character.physique].filter(Boolean).join(', ') || 'n/d', 100)}, lavoro=${character.job || 'n/d'}, note=${truncateText(character.notes || 'n/d', 120)}`,
    );
  }

  pushWithinLimit(parts, '\n## Location');
  for (const location of locations) {
    pushWithinLimit(
      parts,
      `- ${location.name} (${location.id}) trama ${location.plotNumber}: tipo=${location.locationType || 'n/d'}, descrizione=${truncateText(location.description || 'n/d', 140)}, note=${truncateText(location.notes || 'n/d', 100)}`,
    );
  }

  if (timelineState) {
    pushWithinLimit(parts, '\n## Timeline');
    pushWithinLimit(
      parts,
      `- inizio: ${timelineState.settings.startLabel || 'n/d'}; fine: ${timelineState.settings.endLabel || 'n/d'}`,
    );
    for (const item of timelineState.items.slice(0, 80)) {
      const origin =
        item.itemType === 'chapter'
          ? chaptersById.get(item.entityId)?.title
          : scenes.find((scene) => scene.id === item.entityId)?.name;
      pushWithinLimit(
        parts,
        `- ${item.itemType} ${origin ?? item.entityId} (${item.entityId}); data=${item.dateLabel || 'n/d'}; x=${item.positionX}; y=${item.positionY}`,
      );
    }
  }

  return parts.join('\n');
}

function buildAnalysisPrompt(testTitle: string, testPrompt: string): string {
  return [
    `${testPrompt}`,
    '',
    'Rispondi in italiano con un report operativo.',
    'Per ogni problema indica sempre Origine con capitolo, scena, personaggio, location o trama coinvolta. Se possibile includi gli id tra parentesi.',
    'Distingui tra Problemi, Evidenze, Rischio narrativo e Intervento suggerito.',
    'Limita il report agli 8 problemi piu importanti e resta sotto le 700 parole. Evita premesse e spiegazioni del metodo.',
    'Se non trovi problemi rilevanti, dillo esplicitamente e indica eventuali limiti del contesto analizzato.',
    `Titolo controllo: ${testTitle}.`,
  ].join('\n');
}

function localFallbackReport(testTitle: string, reason?: string): string {
  const detail = reason?.trim() || 'il provider AI non ha restituito un risultato utilizzabile.';
  const normalizedDetail = detail.toLowerCase();
  const suggestedAction = normalizedDetail.includes('timeout')
    ? 'riduci il contesto del progetto oppure aumenta il timeout AI, poi rilancia il controllo.'
    : normalizedDetail.includes('consenso')
      ? 'abilita il consenso AI nelle Impostazioni, poi rilancia il controllo.'
      : normalizedDetail.includes('annullat') || normalizedDetail.includes('gia in corso')
        ? 'attendi la fine delle altre richieste AI, evita di annullarle da altri editor e poi rilancia il controllo.'
        : 'verifica provider e impostazioni AI, poi rilancia il controllo.';
  return [
    `# ${testTitle}`,
    '',
    'Analisi AI non disponibile.',
    '',
    'Origine: progetto corrente.',
    `Evidenza: ${detail}`,
    `Intervento suggerito: ${suggestedAction}`,
  ].join('\n');
}

function getCodexResultIssue(
  response: Awaited<ReturnType<(typeof window.novelistApi)['codexAssist']>>,
): string {
  if (response.cancelled) {
    return response.error?.trim() || 'richiesta AI annullata.';
  }
  if (response.mode === 'fallback') {
    return (
      response.error?.trim() ||
      'il provider AI e andato in fallback e non ha eseguito una vera analisi.'
    );
  }
  if (!response.output.trim()) {
    return 'il provider AI ha restituito una risposta vuota.';
  }
  return '';
}

export default function AnalysisBoard({ currentProject, onStatus }: AnalysisBoardProps) {
  const [activeKind, setActiveKind] = useState<AnalysisKind | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const activeTest = useMemo(
    () => ANALYSIS_TESTS.find((test) => test.kind === activeKind) ?? null,
    [activeKind],
  );

  async function runAnalysis(kind: AnalysisKind): Promise<void> {
    const test = ANALYSIS_TESTS.find((candidate) => candidate.kind === kind);
    if (!test || activeKind) {
      return;
    }

    setActiveKind(kind);
    setError(null);
    onStatus(`Analisi in corso: ${test.title}`);
    try {
      const [settings, status] = await Promise.all([
        window.novelistApi.codexGetSettings(),
        window.novelistApi.codexStatus(),
      ]);

      if (!settings.enabled) {
        const reason = 'Consenso AI non abilitato nelle Impostazioni.';
        setError(reason);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, reason),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(`Analisi non avviata: ${test.title}`);
        return;
      }

      if (!status.available) {
        const reason = status.reason?.trim() || 'provider AI non raggiungibile.';
        setError(reason);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, reason),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(`Analisi non disponibile: ${test.title}`);
        return;
      }

      if (status.activeRequest || status.queuedRequests > 0) {
        const reason = `Una richiesta AI e gia in corso (${status.queuedRequests} in coda).`;
        setError(reason);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, reason),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(`Analisi in attesa: ${test.title}`);
        return;
      }

      const context = await buildAnalysisContext(test);
      const response = await window.novelistApi.codexAssist({
        projectName: currentProject?.name,
        message: buildAnalysisPrompt(test.title, test.prompt),
        context,
        timeoutMs: ANALYSIS_TIMEOUT_MS,
      });
      const responseIssue = getCodexResultIssue(response);
      if (responseIssue) {
        setError(responseIssue);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, responseIssue),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(`Analisi non completata: ${test.title}`);
        return;
      }

      const output = response.output.trim();
      setResults((previous) => [
        {
          kind,
          title: test.title,
          generatedAt: new Date().toISOString(),
          output,
        },
        ...previous.filter((result) => result.kind !== kind),
      ]);
      onStatus(`Analisi completata: ${test.title}`);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : 'Errore sconosciuto';
      setError(message);
      setResults((previous) => [
        {
          kind,
          title: test.title,
          generatedAt: new Date().toISOString(),
          output: localFallbackReport(test.title, message),
        },
        ...previous.filter((result) => result.kind !== kind),
      ]);
      onStatus(`Analisi non completata: ${test.title}`);
    } finally {
      setActiveKind(null);
    }
  }

  return (
    <section className="analysis-workspace">
      <section className="panel analysis-header-panel">
        <div>
          <p className="eyebrow">Analisi</p>
          <h2>Controlli editoriali del progetto</h2>
          <p className="muted">
            Ogni controllo prepara un contesto compatto del romanzo e usa l’AI per segnalare
            problemi con origine e intervento suggerito.
          </p>
        </div>
        <div className="analysis-status">
          <strong>{activeTest ? activeTest.title : 'Pronto'}</strong>
          <span>{activeTest ? 'Analisi in corso...' : `${results.length} report generati`}</span>
        </div>
      </section>

      <section className="analysis-test-grid">
        {ANALYSIS_TESTS.map((test) => (
          <article className="panel analysis-test-card" key={test.kind}>
            <div>
              <h3>{test.title}</h3>
              <p>{test.description}</p>
            </div>
            <button
              type="button"
              className={activeKind === test.kind ? 'ai-working' : undefined}
              onClick={() => void runAnalysis(test.kind)}
              disabled={Boolean(activeKind)}
            >
              {activeKind === test.kind ? 'Analizzo...' : 'Avvia test'}
            </button>
          </article>
        ))}
      </section>

      {error ? (
        <section className="panel analysis-error-panel">
          <h2>Errore analisi</h2>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="analysis-results">
        {results.length > 0 ? (
          results.map((result) => (
            <article className="panel analysis-result-card" key={result.kind}>
              <header>
                <div>
                  <p className="eyebrow">Report</p>
                  <h2>{result.title}</h2>
                </div>
                <span>{new Date(result.generatedAt).toLocaleString()}</span>
              </header>
              <pre>{result.output}</pre>
            </article>
          ))
        ) : (
          <section className="panel analysis-empty-panel">
            <h2>Nessun report</h2>
            <p className="muted">Avvia uno dei cinque test per generare la prima analisi.</p>
          </section>
        )}
      </section>
    </section>
  );
}
