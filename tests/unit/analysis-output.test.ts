import { describe, expect, it } from 'vitest';
import { removeAnalysisFollowUpOffers } from '../../src/renderer/src/AnalysisBoard';

describe('analysis output cleanup', () => {
  it('removes final English follow-up offers from AI analysis reports', () => {
    const output = removeAnalysisFollowUpOffers(
      [
        '# Narrative Rhythm',
        '',
        'Issue: The opening repeats the same beat.',
        '',
        'If you want, I can map which pages/paragraphs to cut or condense and propose revised mini-outlines for the first five chapters to fix rhythm and escalation.',
      ].join('\n'),
    );

    expect(output).toBe('# Narrative Rhythm\n\nIssue: The opening repeats the same beat.');
  });

  it('removes final Italian follow-up offers from AI analysis reports', () => {
    const output = removeAnalysisFollowUpOffers(
      [
        '# Ritmo narrativo',
        '',
        'Problema: I primi capitoli ripetono lo stesso passaggio.',
        '',
        'Se vuoi, posso preparare una scaletta corretta per i primi cinque capitoli.',
      ].join('\n'),
    );

    expect(output).toBe(
      '# Ritmo narrativo\n\nProblema: I primi capitoli ripetono lo stesso passaggio.',
    );
  });
});
