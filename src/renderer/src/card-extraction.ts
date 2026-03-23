export interface CharacterCardExtraction {
  sex: string;
  age: number | null;
  sexualOrientation: string;
  species: string;
  hairColor: string;
  bald: boolean;
  beard: string;
  physique: string;
  job: string;
}

export interface LocationCardExtraction {
  locationType: string;
  description: string;
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function extractJsonObject(source: string): Record<string, unknown> | null {
  const trimmed = source.trim();
  if (!trimmed) {
    return null;
  }

  const candidates = [trimmed];
  const fencedMatches = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/giu) ?? [];
  for (const block of fencedMatches) {
    const match = /```(?:json)?\s*([\s\S]*?)```/iu.exec(block);
    if (match?.[1]) {
      candidates.push(match[1].trim());
    }
  }

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      continue;
    }
  }

  return null;
}

function unwrapNamedObject(
  source: Record<string, unknown> | null,
  aliases: string[],
): Record<string, unknown> | null {
  if (!source) {
    return null;
  }

  const normalizedSource = new Map<string, unknown>();
  for (const [key, value] of Object.entries(source)) {
    normalizedSource.set(normalizeKey(key), value);
  }

  for (const alias of aliases) {
    const candidate = normalizedSource.get(normalizeKey(alias));
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
      return candidate as Record<string, unknown>;
    }
  }

  return source;
}

function createLookup(source: Record<string, unknown> | null): Map<string, unknown> {
  const lookup = new Map<string, unknown>();
  if (!source) {
    return lookup;
  }

  for (const [key, value] of Object.entries(source)) {
    lookup.set(normalizeKey(key), value);
  }
  return lookup;
}

function getStringField(lookup: Map<string, unknown>, aliases: string[]): string {
  for (const alias of aliases) {
    const value = lookup.get(normalizeKey(alias));
    if (typeof value === 'string') {
      return value.trim();
    }
  }
  return '';
}

function getNumberField(lookup: Map<string, unknown>, aliases: string[]): number | null {
  for (const alias of aliases) {
    const value = lookup.get(normalizeKey(alias));
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) {
      return Math.trunc(value);
    }
    if (typeof value === 'string') {
      const parsed = Number.parseInt(value.trim(), 10);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return parsed;
      }
    }
  }
  return null;
}

function getBooleanField(
  lookup: Map<string, unknown>,
  aliases: string[],
  fallback = false,
): boolean {
  for (const alias of aliases) {
    const value = lookup.get(normalizeKey(alias));
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = normalizeKey(value);
      if (['true', 'yes', 'si', '1'].includes(normalized)) {
        return true;
      }
      if (['false', 'no', '0'].includes(normalized)) {
        return false;
      }
    }
  }
  return fallback;
}

export function splitCharacterName(fullName: string): { firstName: string; lastName: string } {
  const normalized = fullName.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    return {
      firstName: '',
      lastName: '',
    };
  }

  const [firstName, ...remaining] = normalized.split(' ');
  return {
    firstName,
    lastName: remaining.join(' '),
  };
}

export function parseCharacterCreationSuggestion(responseText: string): CharacterCardExtraction {
  const parsed = unwrapNamedObject(extractJsonObject(responseText), ['character', 'personaggio']);
  const lookup = createLookup(parsed);

  return {
    sex: getStringField(lookup, ['sex', 'gender', 'sesso']),
    age: getNumberField(lookup, ['age', 'eta', 'età']),
    sexualOrientation: getStringField(lookup, [
      'sexualOrientation',
      'sexual_orientation',
      'orientation',
      'orientamento',
      'orientamentoSessuale',
      'orientamento_sessuale',
    ]),
    species: getStringField(lookup, ['species', 'specie', 'razza']),
    hairColor: getStringField(lookup, [
      'hairColor',
      'hair_color',
      'coloreCapelli',
      'colore_capelli',
      'capelli',
    ]),
    bald: getBooleanField(lookup, ['bald', 'calvo', 'calvizie'], false),
    beard: getStringField(lookup, ['beard', 'barba']),
    physique: getStringField(lookup, ['physique', 'build', 'corporatura', 'fisicita', 'fisicità']),
    job: getStringField(lookup, ['job', 'profession', 'professione', 'lavoro', 'mestiere']),
  };
}

export function parseLocationCreationSuggestion(responseText: string): LocationCardExtraction {
  const parsed = unwrapNamedObject(extractJsonObject(responseText), ['location', 'localita', 'località']);
  const lookup = createLookup(parsed);

  return {
    locationType: getStringField(lookup, [
      'locationType',
      'location_type',
      'type',
      'tipologia',
      'tipologiaLuogo',
      'tipologia_luogo',
      'tipoLuogo',
      'tipo_luogo',
    ]),
    description: getStringField(lookup, ['description', 'descrizione', 'summary', 'riassunto']),
  };
}
