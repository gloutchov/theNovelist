export interface RichTextAutolinkNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
  content?: RichTextAutolinkNode[];
}

export interface RichTextAutolinkDocument {
  type?: string;
  content?: RichTextAutolinkNode[];
}

export interface ReferenceAutolinkCharacter {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ReferenceAutolinkLocation {
  id: string;
  name: string;
}

export interface ReferenceAutolinkResult {
  document: RichTextAutolinkDocument;
  changed: boolean;
  insertedCharacterIds: string[];
  insertedLocationIds: string[];
}

interface AutolinkCandidate {
  id: string;
  type: 'character' | 'location';
  label: string;
  terms: string[];
}

interface TextMatch {
  from: number;
  to: number;
}

interface FoldedText {
  value: string;
  startMap: number[];
  endMap: number[];
}

function cloneRichTextNode(node: RichTextAutolinkNode): RichTextAutolinkNode {
  return {
    ...node,
    attrs: node.attrs ? { ...node.attrs } : undefined,
    marks: node.marks?.map((mark) => ({
      type: mark.type,
      attrs: mark.attrs ? { ...mark.attrs } : undefined,
    })),
    content: node.content?.map(cloneRichTextNode),
  };
}

function cloneRichTextDocument(document: RichTextAutolinkDocument): RichTextAutolinkDocument {
  return {
    ...document,
    content: document.content?.map(cloneRichTextNode),
  };
}

function normalizeSearchTerm(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('it')
    .replace(/\s+/gu, ' ')
    .trim();
}

function foldCharacter(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('it');
}

function foldText(value: string): FoldedText {
  let folded = '';
  const startMap: number[] = [];
  const endMap: number[] = [];

  for (let index = 0; index < value.length; ) {
    const character = value[index];
    const codePoint = value.codePointAt(index);
    const char = codePoint === undefined ? character : String.fromCodePoint(codePoint);
    const nextIndex = index + char.length;
    const normalized = foldCharacter(char);

    for (let foldedIndex = 0; foldedIndex < normalized.length; foldedIndex += 1) {
      startMap.push(index);
      endMap.push(nextIndex);
    }
    folded += normalized;
    index = nextIndex;
  }

  return { value: folded, startMap, endMap };
}

function getPreviousCharacter(value: string, index: number): string {
  return value.slice(0, index).match(/[\s\S]$/u)?.[0] ?? '';
}

function getNextCharacter(value: string, index: number): string {
  return value.slice(index).match(/^[\s\S]/u)?.[0] ?? '';
}

function isWordCharacter(value: string): boolean {
  return /[\p{L}\p{N}_]/u.test(value);
}

function hasValidBoundaries(text: string, from: number, to: number, term: string): boolean {
  const firstTermCharacter = term.match(/^[\s\S]/u)?.[0] ?? '';
  const lastTermCharacter = term.match(/[\s\S]$/u)?.[0] ?? '';
  if (firstTermCharacter && isWordCharacter(firstTermCharacter)) {
    const previous = getPreviousCharacter(text, from);
    if (previous && isWordCharacter(previous)) {
      return false;
    }
  }
  if (lastTermCharacter && isWordCharacter(lastTermCharacter)) {
    const next = getNextCharacter(text, to);
    if (next && isWordCharacter(next)) {
      return false;
    }
  }
  return true;
}

function findFirstTermMatch(text: string, terms: string[]): TextMatch | null {
  const foldedText = foldText(text);

  for (const rawTerm of terms) {
    const term = normalizeSearchTerm(rawTerm);
    if (!term) {
      continue;
    }

    let foldedIndex = foldedText.value.indexOf(term);
    while (foldedIndex >= 0) {
      const foldedEndIndex = foldedIndex + term.length - 1;
      const from = foldedText.startMap[foldedIndex];
      const to = foldedText.endMap[foldedEndIndex];
      if (
        from !== undefined &&
        to !== undefined &&
        hasValidBoundaries(text, from, to, rawTerm)
      ) {
        return { from, to };
      }
      foldedIndex = foldedText.value.indexOf(term, foldedIndex + Math.max(term.length, 1));
    }
  }

  return null;
}

export function extractEntityReferenceMentionIds(document: RichTextAutolinkDocument): {
  characterIds: Set<string>;
  locationIds: Set<string>;
} {
  const characterIds = new Set<string>();
  const locationIds = new Set<string>();

  function visit(node: RichTextAutolinkNode | undefined): void {
    if (!node) {
      return;
    }

    if (node.type === 'referenceMention') {
      const refId = typeof node.attrs?.['refId'] === 'string' ? node.attrs['refId'].trim() : '';
      const refType = node.attrs?.['refType'];
      if (refId && refType === 'character') {
        characterIds.add(refId);
      }
      if (refId && refType === 'location') {
        locationIds.add(refId);
      }
      return;
    }

    for (const child of node.content ?? []) {
      visit(child);
    }
  }

  for (const node of document.content ?? []) {
    visit(node);
  }

  return { characterIds, locationIds };
}

function countNormalized(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const value of values) {
    const normalized = normalizeSearchTerm(value);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  return counts;
}

function isUniqueTerm(value: string, counts: Map<string, number>): boolean {
  const normalized = normalizeSearchTerm(value);
  return normalized.length >= 2 && counts.get(normalized) === 1;
}

function getCharacterLabel(character: ReferenceAutolinkCharacter): string {
  return `${character.firstName} ${character.lastName}`.trim();
}

function buildCandidates(
  document: RichTextAutolinkDocument,
  characters: ReferenceAutolinkCharacter[],
  locations: ReferenceAutolinkLocation[],
): AutolinkCandidate[] {
  const mentionedIds = extractEntityReferenceMentionIds(document);
  const firstNameCounts = countNormalized(characters.map((character) => character.firstName));
  const lastNameCounts = countNormalized(characters.map((character) => character.lastName));
  const fullNameCounts = countNormalized(characters.map(getCharacterLabel));
  const locationNameCounts = countNormalized(locations.map((location) => location.name));
  const candidates: AutolinkCandidate[] = [];

  for (const character of characters) {
    if (mentionedIds.characterIds.has(character.id)) {
      continue;
    }

    const label = getCharacterLabel(character);
    const hasFirstAndLastName = Boolean(character.firstName.trim() && character.lastName.trim());
    const terms = [
      hasFirstAndLastName && isUniqueTerm(label, fullNameCounts) ? label : '',
      isUniqueTerm(character.firstName, firstNameCounts) ? character.firstName.trim() : '',
      isUniqueTerm(character.lastName, lastNameCounts) ? character.lastName.trim() : '',
    ]
      .filter(Boolean)
      .sort((left, right) => right.length - left.length);

    if (label && terms.length > 0) {
      candidates.push({
        id: character.id,
        type: 'character',
        label,
        terms,
      });
    }
  }

  for (const location of locations) {
    if (mentionedIds.locationIds.has(location.id)) {
      continue;
    }

    const label = location.name.trim();
    if (label && isUniqueTerm(label, locationNameCounts)) {
      candidates.push({
        id: location.id,
        type: 'location',
        label,
        terms: [label],
      });
    }
  }

  return candidates;
}

function createReferenceMention(candidate: AutolinkCandidate): RichTextAutolinkNode {
  return {
    type: 'referenceMention',
    attrs: {
      refId: candidate.id,
      refType: candidate.type,
      label: candidate.label,
    },
  };
}

function createTextFragment(
  source: RichTextAutolinkNode,
  text: string,
): RichTextAutolinkNode | null {
  if (!text) {
    return null;
  }

  return {
    type: 'text',
    text,
    marks: source.marks?.map((mark) => ({
      type: mark.type,
      attrs: mark.attrs ? { ...mark.attrs } : undefined,
    })),
  };
}

function insertCandidateAfterFirstMatch(
  document: RichTextAutolinkDocument,
  candidate: AutolinkCandidate,
): boolean {
  function visitArray(nodes: RichTextAutolinkNode[]): boolean {
    for (let index = 0; index < nodes.length; index += 1) {
      const node = nodes[index];
      if (!node || node.type === 'referenceMention') {
        continue;
      }

      if (typeof node.text === 'string') {
        const match = findFirstTermMatch(node.text, candidate.terms);
        if (!match) {
          continue;
        }

        const replacement = [
          createTextFragment(node, node.text.slice(0, match.to)),
          createReferenceMention(candidate),
          createTextFragment(node, node.text.slice(match.to)),
        ].filter((part): part is RichTextAutolinkNode => part !== null);
        nodes.splice(index, 1, ...replacement);
        return true;
      }

      if (Array.isArray(node.content) && visitArray(node.content)) {
        return true;
      }
    }

    return false;
  }

  return visitArray(document.content ?? []);
}

export function autoLinkEntityReferences(
  document: RichTextAutolinkDocument,
  characters: ReferenceAutolinkCharacter[],
  locations: ReferenceAutolinkLocation[],
): ReferenceAutolinkResult {
  const nextDocument = cloneRichTextDocument(document);
  const insertedCharacterIds: string[] = [];
  const insertedLocationIds: string[] = [];

  for (const candidate of buildCandidates(nextDocument, characters, locations)) {
    if (!insertCandidateAfterFirstMatch(nextDocument, candidate)) {
      continue;
    }

    if (candidate.type === 'character') {
      insertedCharacterIds.push(candidate.id);
    } else {
      insertedLocationIds.push(candidate.id);
    }
  }

  return {
    document:
      insertedCharacterIds.length > 0 || insertedLocationIds.length > 0 ? nextDocument : document,
    changed: insertedCharacterIds.length > 0 || insertedLocationIds.length > 0,
    insertedCharacterIds,
    insertedLocationIds,
  };
}
