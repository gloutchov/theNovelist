import { useMemo, useState } from 'react';
import type { AppLanguage, Translate } from './i18n';

type ProjectRecord = Awaited<ReturnType<(typeof window.novelistApi)['getCurrentProject']>>;
type StoryState = Awaited<ReturnType<(typeof window.novelistApi)['getStoryState']>>;
type PlotRecord = StoryState['plots'][number];
type CharacterCard = Awaited<ReturnType<(typeof window.novelistApi)['listCharacterCards']>>[number];

type AnalysisKind = 'coherence' | 'open-events' | 'style' | 'rhythm' | 'names';

interface AnalysisBoardProps {
  currentProject: ProjectRecord;
  language: AppLanguage;
  onStatus: (message: string) => void;
  t: Translate;
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
const FOLLOW_UP_OFFER_PATTERNS = [
  /^\s*(?:[-*]\s*)?(?:if you (?:want|would like)|if you'd like|i can (?:also|map|prepare|propose))\b/i,
  /^\s*(?:[-*]\s*)?(?:se vuoi|se desideri|posso (?:anche|mappare|preparare|proporre))\b/i,
];

const ANALYSIS_TESTS: Array<{
  kind: AnalysisKind;
  titleKey: string;
  descriptionKey: string;
  promptKey: string;
}> = [
  {
    kind: 'coherence',
    titleKey: 'analysis.test.coherence.title',
    descriptionKey: 'analysis.test.coherence.description',
    promptKey: 'analysis.test.coherence.prompt',
  },
  {
    kind: 'open-events',
    titleKey: 'analysis.test.openEvents.title',
    descriptionKey: 'analysis.test.openEvents.description',
    promptKey: 'analysis.test.openEvents.prompt',
  },
  {
    kind: 'style',
    titleKey: 'analysis.test.style.title',
    descriptionKey: 'analysis.test.style.description',
    promptKey: 'analysis.test.style.prompt',
  },
  {
    kind: 'rhythm',
    titleKey: 'analysis.test.rhythm.title',
    descriptionKey: 'analysis.test.rhythm.description',
    promptKey: 'analysis.test.rhythm.prompt',
  },
  {
    kind: 'names',
    titleKey: 'analysis.test.names.title',
    descriptionKey: 'analysis.test.names.description',
    promptKey: 'analysis.test.names.prompt',
  },
];

type AnalysisTest = {
  kind: AnalysisKind;
  title: string;
  description: string;
  prompt: string;
};

function getAnalysisTests(t: Translate): AnalysisTest[] {
  return ANALYSIS_TESTS.map((test) => ({
    kind: test.kind,
    title: t(test.titleKey),
    description: t(test.descriptionKey),
    prompt: t(test.promptKey),
  }));
}

function getAnalysisContextText(language: AppLanguage) {
  if (language === 'en') {
    return {
      chapter: 'chapter',
      chapters: 'Chapters',
      contextTitle: '# Novel Analysis Context',
      date: 'date',
      description: 'description',
      end: 'end',
      locationDescription: 'description',
      locations: 'Locations',
      notes: 'notes',
      noDescription: 'No description',
      noNote: 'No note',
      noSnippet: 'No snippet available',
      noSynopsis: 'No synopsis',
      noText: 'No text',
      none: 'n/a',
      number: 'number',
      plot: 'plot',
      plots: 'Plots',
      relevantWikiSources: '## Most Relevant Wiki Sources',
      role: 'job',
      scenes: 'Scenes',
      sex: 'sex',
      appearance: 'appearance',
      species: 'species',
      start: 'start',
      text: 'text',
      timeline: 'Timeline',
      type: 'type',
      unknown: 'unknown',
      wikiPriority:
        'Always use titles and ids when reporting an issue. Wiki sources have priority when present.',
    };
  }

  return {
    chapter: 'capitolo',
    chapters: 'Capitoli',
    contextTitle: '# Contesto analisi romanzo',
    date: 'data',
    description: 'descrizione',
    end: 'fine',
    locationDescription: 'descrizione',
    locations: 'Location',
    notes: 'note',
    noDescription: 'Nessuna descrizione',
    noNote: 'Nessuna nota',
    noSnippet: 'Nessuno snippet disponibile',
    noSynopsis: 'Nessuna sinossi',
    noText: 'Nessun testo',
    none: 'n/d',
    number: 'numero',
    plot: 'trama',
    plots: 'Trame',
    relevantWikiSources: '## Fonti Wiki piu rilevanti',
    role: 'lavoro',
    scenes: 'Scene',
    sex: 'sesso',
    appearance: 'aspetto',
    species: 'specie',
    start: 'inizio',
    text: 'testo',
    timeline: 'Timeline',
    type: 'tipo',
    unknown: 'sconosciuto',
    wikiPriority:
      'Usa sempre titoli e id quando segnali un problema. Le fonti Wiki sono prioritarie se presenti.',
  };
}

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

export function removeAnalysisFollowUpOffers(output: string): string {
  const lines = output.trim().split(/\r?\n/);

  while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
    lines.pop();
  }

  while (
    lines.length > 0 &&
    FOLLOW_UP_OFFER_PATTERNS.some((pattern) => pattern.test(lines[lines.length - 1] ?? ''))
  ) {
    lines.pop();
    while (lines.length > 0 && !lines[lines.length - 1]?.trim()) {
      lines.pop();
    }
  }

  return lines.join('\n').trim();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function characterName(card: CharacterCard): string {
  return `${card.firstName} ${card.lastName}`.trim() || card.id;
}

function plotLabel(plot: PlotRecord | undefined, plotNumber: number, t: Translate): string {
  return plot?.label?.trim() || `${t('common.plot')} ${plotNumber}`;
}

function pushWithinLimit(parts: string[], next: string, limit = ANALYSIS_CONTEXT_LIMIT): boolean {
  const currentLength = parts.join('\n').length;
  if (currentLength + next.length + 1 > limit) {
    return false;
  }
  parts.push(next);
  return true;
}

async function buildWikiAnalysisContext(query: string, language: AppLanguage): Promise<string> {
  try {
    const results = await window.novelistApi.wikiSearch({ query, limit: 6 });
    if (results.length === 0) {
      return '';
    }
    const labels = getAnalysisContextText(language);

    return [
      labels.relevantWikiSources,
      ...results.map((result, index) =>
        [
          `[${index + 1}] ${result.title} (${result.path})`,
          truncateText(result.snippet || labels.noSnippet, 360),
        ].join('\n'),
      ),
    ].join('\n\n');
  } catch {
    return '';
  }
}

async function buildAnalysisContext(
  test: AnalysisTest,
  language: AppLanguage,
  t: Translate,
): Promise<string> {
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
  const wikiContext = await buildWikiAnalysisContext(`${test.title}. ${test.prompt}`, language);
  const labels = getAnalysisContextText(language);

  const parts: string[] = [labels.contextTitle, labels.wikiPriority, ''];

  if (wikiContext) {
    pushWithinLimit(parts, wikiContext);
  }

  pushWithinLimit(parts, `\n## ${labels.plots}`);

  for (const plot of storyState.plots) {
    pushWithinLimit(
      parts,
      `- ${plotLabel(plot, plot.number, t)} (${plot.id}, ${labels.number} ${plot.number}): ${truncateText(plot.summary || labels.noSynopsis, 280)}`,
    );
  }

  pushWithinLimit(parts, `\n## ${labels.chapters}`);
  for (const chapter of [...storyState.nodes].sort((left, right) => {
    if (left.plotNumber !== right.plotNumber) return left.plotNumber - right.plotNumber;
    return left.blockNumber - right.blockNumber;
  })) {
    const text = chapterTextById.get(chapter.id) ?? '';
    pushWithinLimit(
      parts,
      [
        `### ${t('common.chapter')}: ${chapter.title} (${chapter.id})`,
        `- ${labels.plot}: ${plotLabel(plotsByNumber.get(chapter.plotNumber), chapter.plotNumber, t)}`,
        `- ${t('common.block')}: ${chapter.blockNumber}`,
        `- ${labels.description}: ${truncateText(chapter.description || labels.noDescription, 180)}`,
        `- ${labels.text}: ${truncateText(text || labels.noText, 320)}`,
      ].join('\n'),
    );
  }

  pushWithinLimit(parts, `\n## ${labels.scenes}`);
  for (const scene of scenes) {
    const chapter = chaptersById.get(scene.chapterNodeId);
    pushWithinLimit(
      parts,
      [
        `### ${t('common.scene')}: ${scene.name} (${scene.id})`,
        `- ${labels.chapter}: ${chapter?.title ?? labels.unknown} (${scene.chapterNodeId})`,
        `- ${labels.plot}: ${plotLabel(plotsByNumber.get(scene.plotNumber), scene.plotNumber, t)}`,
        `- ${labels.text}: ${truncateText(scene.text || labels.noText, 220)}`,
        `- ${labels.notes}: ${truncateText(scene.notes || labels.noNote, 100)}`,
      ].join('\n'),
    );
  }

  pushWithinLimit(parts, `\n## ${t('common.characters')}`);
  for (const character of characters) {
    pushWithinLimit(
      parts,
      `- ${characterName(character)} (${character.id}) ${labels.plot} ${character.plotNumber}: ${labels.sex}=${character.sex || labels.none}, ${t('common.age')}=${character.age ?? labels.none}, ${labels.species}=${character.species || labels.none}, ${labels.appearance}=${truncateText([character.hairColor, character.eyeColor, character.skinColor, character.physique].filter(Boolean).join(', ') || labels.none, 100)}, ${labels.role}=${character.job || labels.none}, ${labels.notes}=${truncateText(character.notes || labels.none, 120)}`,
    );
  }

  pushWithinLimit(parts, `\n## ${labels.locations}`);
  for (const location of locations) {
    pushWithinLimit(
      parts,
      `- ${location.name} (${location.id}) ${labels.plot} ${location.plotNumber}: ${labels.type}=${location.locationType || labels.none}, ${labels.locationDescription}=${truncateText(location.description || labels.none, 140)}, ${labels.notes}=${truncateText(location.notes || labels.none, 100)}`,
    );
  }

  if (timelineState) {
    pushWithinLimit(parts, `\n## ${labels.timeline}`);
    pushWithinLimit(
      parts,
      `- ${labels.start}: ${timelineState.settings.startLabel || labels.none}; ${labels.end}: ${timelineState.settings.endLabel || labels.none}`,
    );
    for (const item of timelineState.items.slice(0, 80)) {
      const origin =
        item.itemType === 'chapter'
          ? chaptersById.get(item.entityId)?.title
          : scenes.find((scene) => scene.id === item.entityId)?.name;
      pushWithinLimit(
        parts,
        `- ${item.itemType} ${origin ?? item.entityId} (${item.entityId}); ${labels.date}=${item.dateLabel || labels.none}; x=${item.positionX}; y=${item.positionY}`,
      );
    }
  }

  return parts.join('\n');
}

function buildAnalysisPrompt(testTitle: string, testPrompt: string, language: AppLanguage): string {
  if (language === 'en') {
    return [
      `${testPrompt}`,
      '',
      'Reply in English with a practical report.',
      'For each issue always indicate Origin with the chapter, scene, character, location, or plot involved. Include ids in parentheses when possible.',
      'Distinguish between Issues, Evidence, Narrative risk, and Suggested intervention.',
      'Limit the report to the 8 most important issues and stay under 700 words. Avoid preambles and method explanations.',
      'Do not include follow-up offers, invitations to ask for more work, or sentences such as "If you want, I can...".',
      'If you find no relevant issues, say so explicitly and note any limits of the analyzed context.',
      `Check title: ${testTitle}.`,
    ].join('\n');
  }

  return [
    `${testPrompt}`,
    '',
    'Rispondi in italiano con un report operativo.',
    'Per ogni problema indica sempre Origine con capitolo, scena, personaggio, location o trama coinvolta. Se possibile includi gli id tra parentesi.',
    'Distingui tra Problemi, Evidenze, Rischio narrativo e Intervento suggerito.',
    'Limita il report agli 8 problemi piu importanti e resta sotto le 700 parole. Evita premesse e spiegazioni del metodo.',
    'Non includere offerte di follow-up, inviti a chiedere altro lavoro o frasi come "Se vuoi, posso...".',
    'Se non trovi problemi rilevanti, dillo esplicitamente e indica eventuali limiti del contesto analizzato.',
    `Titolo controllo: ${testTitle}.`,
  ].join('\n');
}

function localFallbackReport(
  testTitle: string,
  reason: string | undefined,
  language: AppLanguage,
): string {
  const detail =
    reason?.trim() ||
    (language === 'en'
      ? 'the AI provider did not return a usable result.'
      : 'il provider AI non ha restituito un risultato utilizzabile.');
  const normalizedDetail = detail.toLowerCase();
  const suggestedAction =
    language === 'en'
      ? normalizedDetail.includes('timeout')
        ? 'reduce the project context or increase the AI timeout, then run the check again.'
        : normalizedDetail.includes('consent')
          ? 'enable AI consent in Settings, then run the check again.'
          : normalizedDetail.includes('cancel') || normalizedDetail.includes('in progress')
            ? 'wait for other AI requests to finish, avoid cancelling them from other editors, then run the check again.'
            : 'check the provider and AI settings, then run the check again.'
      : normalizedDetail.includes('timeout')
        ? 'riduci il contesto del progetto oppure aumenta il timeout AI, poi rilancia il controllo.'
        : normalizedDetail.includes('consenso')
          ? 'abilita il consenso AI nelle Impostazioni, poi rilancia il controllo.'
          : normalizedDetail.includes('annullat') || normalizedDetail.includes('gia in corso')
            ? 'attendi la fine delle altre richieste AI, evita di annullarle da altri editor e poi rilancia il controllo.'
            : 'verifica provider e impostazioni AI, poi rilancia il controllo.';

  if (language === 'en') {
    return [
      `# ${testTitle}`,
      '',
      'AI analysis unavailable.',
      '',
      'Origin: current project.',
      `Evidence: ${detail}`,
      `Suggested intervention: ${suggestedAction}`,
    ].join('\n');
  }

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
  language: AppLanguage,
): string {
  if (response.cancelled) {
    return (
      response.error?.trim() ||
      (language === 'en' ? 'AI request cancelled.' : 'richiesta AI annullata.')
    );
  }
  if (response.mode === 'fallback') {
    return (
      response.error?.trim() ||
      (language === 'en'
        ? 'the AI provider switched to fallback and did not run a real analysis.'
        : 'il provider AI e andato in fallback e non ha eseguito una vera analisi.')
    );
  }
  if (!response.output.trim()) {
    return language === 'en'
      ? 'the AI provider returned an empty response.'
      : 'il provider AI ha restituito una risposta vuota.';
  }
  return '';
}

export default function AnalysisBoard({
  currentProject,
  language,
  onStatus,
  t,
}: AnalysisBoardProps) {
  const [activeKind, setActiveKind] = useState<AnalysisKind | null>(null);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const analysisTests = useMemo(() => getAnalysisTests(t), [t]);

  const completedKinds = useMemo(() => new Set(results.map((result) => result.kind)), [results]);
  const activeTest = useMemo(
    () => analysisTests.find((test) => test.kind === activeKind) ?? null,
    [activeKind, analysisTests],
  );

  function printResult(result: AnalysisResult): void {
    const frame = document.createElement('iframe');
    frame.title = t('analysis.print.frameTitle', { title: result.title });
    frame.style.position = 'fixed';
    frame.style.right = '0';
    frame.style.bottom = '0';
    frame.style.width = '0';
    frame.style.height = '0';
    frame.style.border = '0';
    document.body.appendChild(frame);

    const frameDocument = frame.contentDocument;
    if (!frameDocument) {
      document.body.removeChild(frame);
      const message = t('analysis.print.prepareError');
      setError(message);
      onStatus(t('analysis.status.printError'));
      return;
    }

    frameDocument.open();
    frameDocument.write(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(result.title)}</title>
    <style>
      @page { margin: 1.5cm; }
      body {
        color: #111827;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11pt;
        line-height: 1.5;
      }
      h1 { margin: 0 0 0.35rem; font-size: 18pt; }
      time { display: block; color: #64748b; margin-bottom: 1rem; }
      pre {
        margin: 0;
        white-space: pre-wrap;
        word-break: break-word;
        font-family: inherit;
      }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(result.title)}</h1>
    <time>${escapeHtml(new Date(result.generatedAt).toLocaleString())}</time>
    <pre>${escapeHtml(result.output)}</pre>
  </body>
</html>`);
    frameDocument.close();

    setTimeout(() => {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
      setTimeout(() => {
        frame.remove();
      }, 1_000);
    }, 100);
  }

  async function runAnalysis(kind: AnalysisKind): Promise<void> {
    const test = analysisTests.find((candidate) => candidate.kind === kind);
    if (!test || activeKind) {
      return;
    }

    setActiveKind(kind);
    setError(null);
    onStatus(t('analysis.status.running', { title: test.title }));
    try {
      const [settings, status] = await Promise.all([
        window.novelistApi.codexGetSettings(),
        window.novelistApi.codexStatus(),
      ]);

      if (!settings.enabled) {
        const reason = t('analysis.reason.aiConsentDisabled');
        setError(reason);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, reason, language),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(t('analysis.status.notStarted', { title: test.title }));
        return;
      }

      if (!status.available) {
        const reason = status.reason?.trim() || t('analysis.reason.providerUnavailable');
        setError(reason);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, reason, language),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(t('analysis.status.unavailable', { title: test.title }));
        return;
      }

      if (status.activeRequest || status.queuedRequests > 0) {
        const reason = t('analysis.reason.requestInProgress', { count: status.queuedRequests });
        setError(reason);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, reason, language),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(t('analysis.status.waiting', { title: test.title }));
        return;
      }

      const context = await buildAnalysisContext(test, language, t);
      const response = await window.novelistApi.codexAssist({
        projectName: currentProject?.name,
        message: buildAnalysisPrompt(test.title, test.prompt, language),
        context,
        timeoutMs: ANALYSIS_TIMEOUT_MS,
      });
      const responseIssue = getCodexResultIssue(response, language);
      if (responseIssue) {
        setError(responseIssue);
        setResults((previous) => [
          {
            kind,
            title: test.title,
            generatedAt: new Date().toISOString(),
            output: localFallbackReport(test.title, responseIssue, language),
          },
          ...previous.filter((result) => result.kind !== kind),
        ]);
        onStatus(t('analysis.status.notCompleted', { title: test.title }));
        return;
      }

      const output = removeAnalysisFollowUpOffers(response.output);
      setResults((previous) => [
        {
          kind,
          title: test.title,
          generatedAt: new Date().toISOString(),
          output,
        },
        ...previous.filter((result) => result.kind !== kind),
      ]);
      onStatus(t('analysis.status.completed', { title: test.title }));
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : t('common.unknownError');
      setError(message);
      setResults((previous) => [
        {
          kind,
          title: test.title,
          generatedAt: new Date().toISOString(),
          output: localFallbackReport(test.title, message, language),
        },
        ...previous.filter((result) => result.kind !== kind),
      ]);
      onStatus(t('analysis.status.notCompleted', { title: test.title }));
    } finally {
      setActiveKind(null);
    }
  }

  return (
    <section className="analysis-workspace">
      <section className="panel analysis-header-panel">
        <div>
          <p className="eyebrow">{t('analysis.eyebrow')}</p>
          <h2>{t('analysis.title')}</h2>
          <p className="muted">{t('analysis.subtitle')}</p>
        </div>
        <div className="analysis-status">
          <strong>{activeTest ? activeTest.title : t('analysis.status.ready')}</strong>
          <span>
            {activeTest
              ? t('analysis.status.runningShort')
              : t('analysis.status.generatedReports', { count: results.length })}
          </span>
        </div>
      </section>

      <section className="analysis-test-grid">
        {analysisTests.map((test) => (
          <article className="panel analysis-test-card" key={test.kind}>
            <div>
              <h3>
                {test.title}
                {completedKinds.has(test.kind) ? (
                  <span
                    className="analysis-test-complete-flag"
                    aria-label={t('analysis.test.completed')}
                  >
                    ✓
                  </span>
                ) : null}
              </h3>
              <p>{test.description}</p>
            </div>
            <button
              type="button"
              className={activeKind === test.kind ? 'ai-working' : undefined}
              onClick={() => void runAnalysis(test.kind)}
              disabled={Boolean(activeKind)}
            >
              {activeKind === test.kind ? t('analysis.actions.running') : t('analysis.actions.run')}
            </button>
          </article>
        ))}
      </section>

      {error ? (
        <section className="panel analysis-error-panel">
          <h2>{t('analysis.error.title')}</h2>
          <p>{error}</p>
        </section>
      ) : null}

      <section className="analysis-results">
        {results.length > 0 ? (
          results.map((result) => (
            <article className="panel analysis-result-card" key={result.kind}>
              <header>
                <div>
                  <p className="eyebrow">{t('analysis.report.eyebrow')}</p>
                  <h2>{result.title}</h2>
                </div>
                <div className="analysis-result-actions">
                  <span>{new Date(result.generatedAt).toLocaleString()}</span>
                  <button
                    type="button"
                    className="button-secondary"
                    onClick={() => printResult(result)}
                  >
                    {t('analysis.actions.print')}
                  </button>
                </div>
              </header>
              <pre>{result.output}</pre>
            </article>
          ))
        ) : (
          <section className="panel analysis-empty-panel">
            <h2>{t('analysis.empty.title')}</h2>
            <p className="muted">{t('analysis.empty.body')}</p>
          </section>
        )}
      </section>
    </section>
  );
}
