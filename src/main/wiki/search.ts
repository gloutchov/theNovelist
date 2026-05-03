import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { isSafeWikiRelativePath } from './path-safety';

export interface ProjectWikiSearchOptions {
  limit?: number;
  maxSnippetLength?: number;
}

export interface ProjectWikiSearchResult {
  path: string;
  title: string;
  category: 'index' | 'source' | 'wiki';
  score: number;
  snippet: string;
}

interface WikiSearchDocument {
  relativePath: string;
  absolutePath: string;
  category: ProjectWikiSearchResult['category'];
}

interface ScoredWikiSearchDocument extends WikiSearchDocument {
  title: string;
  score: number;
  snippet: string;
}

const DEFAULT_LIMIT = 8;
const DEFAULT_MAX_SNIPPET_LENGTH = 420;
const MAX_SEARCH_FILE_BYTES = 500_000;
const IGNORED_DIRECTORIES = new Set(['maintenance']);

function normalizeForSearch(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return [
    ...new Set(
      normalizeForSearch(value)
        .split(/[^a-z0-9]+/i)
        .map((token) => token.trim())
        .filter((token) => token.length >= 2),
    ),
  ];
}

function categoryFromRelativePath(relativePath: string): ProjectWikiSearchResult['category'] {
  if (relativePath === 'index.md') {
    return 'index';
  }

  if (relativePath.startsWith('sources/')) {
    return 'source';
  }

  return 'wiki';
}

async function collectMarkdownDocuments(
  wikiPath: string,
  currentDirectory = wikiPath,
): Promise<WikiSearchDocument[]> {
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  const documents: WikiSearchDocument[] = [];

  for (const entry of entries) {
    if (entry.name.startsWith('.')) {
      continue;
    }

    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(wikiPath, absolutePath).split(path.sep).join('/');
    if (!isSafeWikiRelativePath(relativePath)) {
      continue;
    }

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }
      documents.push(...(await collectMarkdownDocuments(wikiPath, absolutePath)));
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith('.md')) {
      continue;
    }

    documents.push({
      relativePath,
      absolutePath,
      category: categoryFromRelativePath(relativePath),
    });
  }

  return documents;
}

function extractTitle(relativePath: string, content: string): string {
  const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
  if (heading) {
    return heading;
  }

  return path.basename(relativePath, '.md');
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) {
    return 0;
  }

  let count = 0;
  let startIndex = 0;

  while (startIndex < haystack.length) {
    const foundIndex = haystack.indexOf(needle, startIndex);
    if (foundIndex === -1) {
      break;
    }

    count += 1;
    startIndex = foundIndex + needle.length;
  }

  return count;
}

function buildSnippet(content: string, terms: string[], maxLength: number): string {
  const normalizedContent = normalizeForSearch(content);
  const firstMatch = terms
    .map((term) => normalizedContent.indexOf(term))
    .filter((index) => index >= 0)
    .sort((left, right) => left - right)[0];
  const startIndex = Math.max((firstMatch ?? 0) - Math.floor(maxLength / 3), 0);
  const rawSnippet = content
    .slice(startIndex, startIndex + maxLength)
    .replace(/\s+/g, ' ')
    .trim();

  if (startIndex === 0) {
    return rawSnippet;
  }

  return `...${rawSnippet}`;
}

function scoreDocument(params: {
  document: WikiSearchDocument;
  content: string;
  title: string;
  terms: string[];
  maxSnippetLength: number;
}): ScoredWikiSearchDocument | null {
  const normalizedContent = normalizeForSearch(params.content);
  const normalizedTitle = normalizeForSearch(params.title);
  const normalizedPath = normalizeForSearch(params.document.relativePath);
  let score = 0;

  for (const term of params.terms) {
    score += countOccurrences(normalizedContent, term);
    if (normalizedTitle.includes(term)) {
      score += 8;
    }
    if (normalizedPath.includes(term)) {
      score += 4;
    }
  }

  if (params.document.category === 'source') {
    score += 2;
  } else if (params.document.category === 'index') {
    score += 1;
  }

  if (score <= 0) {
    return null;
  }

  return {
    ...params.document,
    title: params.title,
    score,
    snippet: buildSnippet(params.content, params.terms, params.maxSnippetLength),
  };
}

export async function searchProjectWiki(
  wikiPath: string,
  query: string,
  options: ProjectWikiSearchOptions = {},
): Promise<ProjectWikiSearchResult[]> {
  const terms = tokenize(query);
  if (terms.length === 0) {
    return [];
  }

  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, 25));
  const maxSnippetLength = Math.max(
    120,
    Math.min(options.maxSnippetLength ?? DEFAULT_MAX_SNIPPET_LENGTH, 2_000),
  );
  const documents = await collectMarkdownDocuments(wikiPath);
  const scored: ScoredWikiSearchDocument[] = [];

  for (const document of documents) {
    const fileStats = await stat(document.absolutePath);
    if (!fileStats.isFile() || fileStats.size > MAX_SEARCH_FILE_BYTES) {
      continue;
    }

    const content = await readFile(document.absolutePath, 'utf8');
    const title = extractTitle(document.relativePath, content);
    const result = scoreDocument({
      document,
      content,
      title,
      terms,
      maxSnippetLength,
    });

    if (result) {
      scored.push(result);
    }
  }

  return scored
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return left.relativePath.localeCompare(right.relativePath);
    })
    .slice(0, limit)
    .map((result) => ({
      path: result.relativePath,
      title: result.title,
      category: result.category,
      score: result.score,
      snippet: result.snippet,
    }));
}
