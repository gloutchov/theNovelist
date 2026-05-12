export interface PlotStructureBlock {
  title: string;
  description: string;
}

function extractJsonPayload(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }

  const arrayStart = raw.indexOf('[');
  const arrayEnd = raw.lastIndexOf(']');
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    return raw.slice(arrayStart, arrayEnd + 1).trim();
  }

  const objectStart = raw.indexOf('{');
  const objectEnd = raw.lastIndexOf('}');
  if (objectStart >= 0 && objectEnd > objectStart) {
    return raw.slice(objectStart, objectEnd + 1).trim();
  }

  return raw.trim();
}

function parsePlotStructureBlocks(raw: string): PlotStructureBlock[] {
  const parsed = JSON.parse(extractJsonPayload(raw)) as unknown;
  const source = Array.isArray(parsed)
    ? parsed
    : parsed &&
        typeof parsed === 'object' &&
        Array.isArray((parsed as { blocks?: unknown[] }).blocks)
      ? (parsed as { blocks: unknown[] }).blocks
      : [];

  return source
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const record = item as Record<string, unknown>;
      const rawTitle = record['title'] ?? record['titolo'];
      const rawDescription = record['description'] ?? record['descrizione'] ?? record['summary'];
      const title = typeof rawTitle === 'string' ? rawTitle.trim() : '';
      const description = typeof rawDescription === 'string' ? rawDescription.trim() : '';
      if (!title || !description) {
        return null;
      }

      return {
        title,
        description,
      };
    })
    .filter((item): item is PlotStructureBlock => Boolean(item))
    .slice(0, 16);
}

export function tryParsePlotStructureBlocks(raw: string): PlotStructureBlock[] {
  try {
    return parsePlotStructureBlocks(raw);
  } catch {
    return [];
  }
}
