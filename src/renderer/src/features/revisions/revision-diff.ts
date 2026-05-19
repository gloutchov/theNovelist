export type RevisionDiffTone = 'equal' | 'added' | 'removed';

export interface RevisionDiffSegment {
  text: string;
  tone: RevisionDiffTone;
}

export interface RevisionDiffResult {
  current: RevisionDiffSegment[];
  previous: RevisionDiffSegment[];
  identical: boolean;
}

const TOKEN_PRODUCT_LIMIT = 250_000;

function splitTokens(value: string): string[] {
  return value.match(/\s+|[^\s]+/g) ?? [];
}

function compactSegments(segments: RevisionDiffSegment[]): RevisionDiffSegment[] {
  const compacted: RevisionDiffSegment[] = [];

  for (const segment of segments) {
    if (!segment.text) {
      continue;
    }

    const previous = compacted[compacted.length - 1];
    if (previous?.tone === segment.tone) {
      previous.text += segment.text;
    } else {
      compacted.push({ ...segment });
    }
  }

  return compacted;
}

function getSharedPrefixTokenCount(left: string[], right: string[]): number {
  const maxLength = Math.min(left.length, right.length);
  let index = 0;

  while (index < maxLength && left[index] === right[index]) {
    index += 1;
  }

  return index;
}

function getSharedSuffixTokenCount(left: string[], right: string[], prefixLength: number): number {
  const maxLength = Math.min(left.length, right.length) - prefixLength;
  let count = 0;

  while (
    count < maxLength &&
    left[left.length - 1 - count] === right[right.length - 1 - count]
  ) {
    count += 1;
  }

  return count;
}

function appendTokenRuns(
  previous: RevisionDiffSegment[],
  current: RevisionDiffSegment[],
  previousTokens: string[],
  currentTokens: string[],
  previousTone: RevisionDiffTone,
  currentTone: RevisionDiffTone,
): void {
  if (previousTokens.length > 0) {
    previous.push({ text: previousTokens.join(''), tone: previousTone });
  }
  if (currentTokens.length > 0) {
    current.push({ text: currentTokens.join(''), tone: currentTone });
  }
}

function appendTokenDiff(
  previous: RevisionDiffSegment[],
  current: RevisionDiffSegment[],
  previousTokens: string[],
  currentTokens: string[],
): void {
  if (previousTokens.length === 0 || currentTokens.length === 0) {
    appendTokenRuns(previous, current, previousTokens, currentTokens, 'removed', 'added');
    return;
  }

  if (previousTokens.length * currentTokens.length > TOKEN_PRODUCT_LIMIT) {
    appendTokenRuns(previous, current, previousTokens, currentTokens, 'removed', 'added');
    return;
  }

  const columnCount = currentTokens.length + 1;
  const table = new Uint16Array((previousTokens.length + 1) * columnCount);

  for (let leftIndex = previousTokens.length - 1; leftIndex >= 0; leftIndex -= 1) {
    for (let rightIndex = currentTokens.length - 1; rightIndex >= 0; rightIndex -= 1) {
      const cellIndex = leftIndex * columnCount + rightIndex;
      if (previousTokens[leftIndex] === currentTokens[rightIndex]) {
        table[cellIndex] = table[(leftIndex + 1) * columnCount + rightIndex + 1] + 1;
      } else {
        table[cellIndex] = Math.max(
          table[(leftIndex + 1) * columnCount + rightIndex],
          table[leftIndex * columnCount + rightIndex + 1],
        );
      }
    }
  }

  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < previousTokens.length && rightIndex < currentTokens.length) {
    if (previousTokens[leftIndex] === currentTokens[rightIndex]) {
      appendTokenRuns(
        previous,
        current,
        [previousTokens[leftIndex] ?? ''],
        [currentTokens[rightIndex] ?? ''],
        'equal',
        'equal',
      );
      leftIndex += 1;
      rightIndex += 1;
    } else if (
      table[(leftIndex + 1) * columnCount + rightIndex] >=
      table[leftIndex * columnCount + rightIndex + 1]
    ) {
      appendTokenRuns(previous, current, [previousTokens[leftIndex] ?? ''], [], 'removed', 'added');
      leftIndex += 1;
    } else {
      appendTokenRuns(previous, current, [], [currentTokens[rightIndex] ?? ''], 'removed', 'added');
      rightIndex += 1;
    }
  }

  appendTokenRuns(
    previous,
    current,
    previousTokens.slice(leftIndex),
    currentTokens.slice(rightIndex),
    'removed',
    'added',
  );
}

export function buildRevisionDiff(previousText: string, currentText: string): RevisionDiffResult {
  if (previousText === currentText) {
    const segment = { text: currentText, tone: 'equal' as const };
    return {
      current: [segment],
      previous: [segment],
      identical: true,
    };
  }

  const previousTokens = splitTokens(previousText);
  const currentTokens = splitTokens(currentText);
  const prefixLength = getSharedPrefixTokenCount(previousTokens, currentTokens);
  const suffixLength = getSharedSuffixTokenCount(previousTokens, currentTokens, prefixLength);
  const previousMiddleEnd = previousTokens.length - suffixLength;
  const currentMiddleEnd = currentTokens.length - suffixLength;
  const previous: RevisionDiffSegment[] = [];
  const current: RevisionDiffSegment[] = [];

  appendTokenRuns(
    previous,
    current,
    previousTokens.slice(0, prefixLength),
    currentTokens.slice(0, prefixLength),
    'equal',
    'equal',
  );

  appendTokenDiff(
    previous,
    current,
    previousTokens.slice(prefixLength, previousMiddleEnd),
    currentTokens.slice(prefixLength, currentMiddleEnd),
  );

  appendTokenRuns(
    previous,
    current,
    previousTokens.slice(previousMiddleEnd),
    currentTokens.slice(currentMiddleEnd),
    'equal',
    'equal',
  );

  return {
    current: compactSegments(current),
    previous: compactSegments(previous),
    identical: false,
  };
}
