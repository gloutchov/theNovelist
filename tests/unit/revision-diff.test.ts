import { describe, expect, test } from 'vitest';
import { buildRevisionDiff } from '../../src/renderer/src/features/revisions/revision-diff';

function textByTone(
  result: ReturnType<typeof buildRevisionDiff>,
  side: 'current' | 'previous',
  tone: 'added' | 'equal' | 'removed',
): string {
  return result[side]
    .filter((segment) => segment.tone === tone)
    .map((segment) => segment.text)
    .join('');
}

describe('buildRevisionDiff', () => {
  test('returns a single equal segment when texts are identical', () => {
    const result = buildRevisionDiff('La porta resta chiusa.', 'La porta resta chiusa.');

    expect(result.identical).toBe(true);
    expect(result.previous).toEqual([{ text: 'La porta resta chiusa.', tone: 'equal' }]);
    expect(result.current).toEqual([{ text: 'La porta resta chiusa.', tone: 'equal' }]);
  });

  test('marks removed text in the previous version and added text in the current version', () => {
    const result = buildRevisionDiff('La porta rossa si apre.', 'La porta blu si apre piano.');

    expect(result.identical).toBe(false);
    expect(textByTone(result, 'previous', 'removed')).toContain('rossa');
    expect(textByTone(result, 'current', 'added')).toContain('blu');
    expect(textByTone(result, 'current', 'added')).toContain('piano');
    expect(textByTone(result, 'previous', 'equal')).toContain('La porta ');
    expect(textByTone(result, 'current', 'equal')).toContain(' si ');
  });

  test('preserves whitespace and newline boundaries', () => {
    const result = buildRevisionDiff('Riga uno.\n\nRiga due.', 'Riga uno.\n\nRiga due estesa.');

    expect(result.current.map((segment) => segment.text).join('')).toBe(
      'Riga uno.\n\nRiga due estesa.',
    );
    expect(result.previous.map((segment) => segment.text).join('')).toBe('Riga uno.\n\nRiga due.');
    expect(textByTone(result, 'current', 'added')).toContain(' estesa');
  });
});
