import { APP_CONFIG } from '../config/app-config';
import type { ProjectWikiSearchResult } from './search';
import { searchProjectWiki } from './search';

export interface ProjectMemoryContext {
  content: string;
  results: ProjectWikiSearchResult[];
}

function trimToBudget(value: string, budget: number): string {
  if (value.length <= budget) {
    return value;
  }

  return `${value.slice(0, Math.max(0, budget - 3)).trim()}...`;
}

export function formatProjectMemoryContext(
  results: ProjectWikiSearchResult[],
  maxChars: number = APP_CONFIG.wiki.memory.defaultMaxChars,
): string {
  if (results.length === 0) {
    return [
      'Memoria progetto: nessuna fonte rilevante trovata nella wiki locale.',
      'Per domande fattuali, dichiara che non hai trovato conferma invece di dedurre.',
    ].join('\n');
  }

  const sections: string[] = [
    'Memoria progetto recuperata dalla wiki locale.',
    'Usa queste fonti solo come contesto citabile. Distingui fatti espliciti, schede autore, sintesi wiki e inferenze.',
    '',
  ];
  let remainingBudget = maxChars - sections.join('\n').length;

  for (const [index, result] of results.entries()) {
    if (remainingBudget <= 0) {
      break;
    }

    const header = `[${index + 1}] ${result.title} (${result.category}) - ${result.path}`;
    const snippet = trimToBudget(
      result.snippet,
      Math.max(160, remainingBudget - header.length - 12),
    );
    const entry = `${header}\n${snippet}`;

    sections.push(entry, '');
    remainingBudget -= entry.length + 2;
  }

  sections.push(
    'Regole: cita i riferimenti tra parentesi quadre quando rispondi su fatti del romanzo; se le fonti non bastano, dillo esplicitamente.',
  );

  return trimToBudget(sections.join('\n'), maxChars);
}

export async function buildProjectMemoryContext(params: {
  wikiPath: string;
  query: string;
  limit?: number;
  maxChars?: number;
}): Promise<ProjectMemoryContext> {
  const results = await searchProjectWiki(params.wikiPath, params.query, {
    limit: params.limit ?? APP_CONFIG.wiki.memory.defaultResultLimit,
  });

  return {
    content: formatProjectMemoryContext(
      results,
      params.maxChars ?? APP_CONFIG.wiki.memory.defaultMaxChars,
    ),
    results,
  };
}
