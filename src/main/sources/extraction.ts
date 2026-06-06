import { readFile } from 'node:fs/promises';
import path from 'node:path';
import JSZip from 'jszip';
import { APP_CONFIG } from '../config/app-config';

const XML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  quot: '"',
};
const TEXT_EXTENSIONS = [
  'txt',
  'md',
  'markdown',
  'text',
  'log',
  'json',
  'xml',
  'yaml',
  'yml',
  'csv',
  'tsv',
];

export interface ExtractedExternalSource {
  fileType: string;
  text: string;
  summary: string;
  extractionMethod: 'local' | 'ai_ocr' | 'ai_analysis' | 'none';
  extractionStatus: 'indexed' | 'partial' | 'failed';
  extractionMessage: string;
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function decodeXml(value: string): string {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&([a-z]+);/gi, (match, entity: string) => XML_ENTITY_MAP[entity] ?? match);
}

function stripRtf(value: string): string {
  return normalizeWhitespace(
    value
      .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\[a-zA-Z]+-?\d* ?/g, ' ')
      .replace(/[{}]/g, ' '),
  );
}

function getXmlAttribute(attributes: string, name: string): string {
  const match = new RegExp(`\\b${name}=(["'])(.*?)\\1`).exec(attributes);
  return match?.[2] ?? '';
}

function extractXmlTextRuns(xml: string): string {
  return [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)]
    .map((match) => decodeXml(match[1] ?? ''))
    .join('');
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('string');
  if (!documentXml) {
    return '';
  }

  return normalizeWhitespace(
    decodeXml(
      documentXml
        .replace(/<w:tab\/>/g, ' ')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<[^>]+>/g, ' '),
    ),
  );
}

async function extractXlsx(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);
  const sharedStringsXml = await zip.file('xl/sharedStrings.xml')?.async('string');
  const sharedStrings = sharedStringsXml ? extractXlsxSharedStrings(sharedStringsXml) : [];
  const sheetNames = Object.keys(zip.files)
    .filter((name) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
    .sort();
  const rows: string[] = [];

  for (const sheetName of sheetNames) {
    const sheetXml = await zip.file(sheetName)?.async('string');
    if (!sheetXml) {
      continue;
    }

    for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
      const cells: string[] = [];
      const rowXml = rowMatch[1] ?? '';
      for (const cellMatch of rowXml.matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)) {
        const attributes = cellMatch[1] ?? '';
        const cellXml = cellMatch[2] ?? '';
        const value = extractXlsxCellValue({ attributes, cellXml, sharedStrings });
        if (!value.trim()) {
          continue;
        }
        cells.push(value);
      }
      if (cells.some((cell) => cell.trim())) {
        rows.push(cells.join(' | '));
      }
      if (rows.join('\n').length > APP_CONFIG.externalSources.maxIndexedCharacters) {
        break;
      }
    }
  }

  return normalizeWhitespace(rows.join('\n'));
}

function extractXlsxSharedStrings(sharedStringsXml: string): string[] {
  const sharedStrings = [...sharedStringsXml.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(
    (match) => extractXmlTextRuns(match[1] ?? ''),
  );

  if (sharedStrings.length > 0) {
    return sharedStrings;
  }

  return [...sharedStringsXml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) =>
    decodeXml(match[1] ?? ''),
  );
}

function extractXlsxCellValue(input: {
  attributes: string;
  cellXml: string;
  sharedStrings: string[];
}): string {
  const cellType = getXmlAttribute(input.attributes, 't');
  if (cellType === 'inlineStr') {
    return extractXmlTextRuns(input.cellXml);
  }

  const rawValue = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(input.cellXml)?.[1] ?? '';
  if (cellType === 's') {
    return input.sharedStrings[Number(rawValue)] ?? '';
  }
  if (cellType === 'b') {
    return rawValue === '1' ? 'TRUE' : 'FALSE';
  }
  if (rawValue.trim()) {
    return decodeXml(rawValue);
  }

  return extractXmlTextRuns(input.cellXml);
}

function extractPdfBestEffort(buffer: Buffer): string {
  const raw = buffer.toString('latin1');
  const pieces: string[] = [];

  for (const match of raw.matchAll(/\(([^()]{2,1000})\)\s*Tj/g)) {
    pieces.push(match[1] ?? '');
  }
  for (const match of raw.matchAll(/\[((?:\([^()]{1,1000}\)\s*)+)[^\]]*\]\s*TJ/g)) {
    const group = match[1] ?? '';
    pieces.push(
      [...group.matchAll(/\(([^()]+)\)/g)].map((pieceMatch) => pieceMatch[1] ?? '').join(' '),
    );
  }

  return normalizeWhitespace(
    pieces
      .join(' ')
      .replace(/\\\)/g, ')')
      .replace(/\\\(/g, '(')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\n')
      .replace(/\\t/g, ' '),
  );
}

function extractPrintableTextBestEffort(buffer: Buffer): string {
  return normalizeWhitespace(
    (buffer.toString('latin1').match(/[\x20-\x7E]{4,}/g) ?? [])
      .filter((piece) => /[A-Za-z0-9]/.test(piece))
      .join(' '),
  );
}

function buildSummary(text: string, fileName: string): string {
  const normalized = normalizeWhitespace(text);
  if (!normalized) {
    return fileName;
  }

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const summary = (sentences.length > 0 ? sentences.slice(0, 3).join(' ') : normalized).slice(
    0,
    520,
  );

  return summary.trim() || fileName;
}

export function buildExternalSourceSummary(text: string, fileName: string): string {
  return buildSummary(text, fileName);
}

export function isSupportedExternalSourceExtension(extension: string): boolean {
  return (APP_CONFIG.externalSources.supportedExtensions as readonly string[]).includes(
    extension.toLowerCase(),
  );
}

export async function extractExternalSourceText(filePath: string): Promise<ExtractedExternalSource> {
  const extension = path.extname(filePath).replace(/^\./, '').toLowerCase();
  if (!isSupportedExternalSourceExtension(extension)) {
    throw new Error(`Unsupported file type: ${extension || 'unknown'}`);
  }

  const buffer = await readFile(filePath);
  let text = '';

  if (TEXT_EXTENSIONS.includes(extension)) {
    text = buffer.toString('utf8');
  } else if (extension === 'rtf') {
    text = stripRtf(buffer.toString('utf8'));
  } else if (extension === 'docx') {
    text = await extractDocx(buffer);
  } else if (extension === 'xlsx') {
    text = await extractXlsx(buffer);
  } else if (extension === 'xls') {
    text = extractPrintableTextBestEffort(buffer);
  } else if (extension === 'pdf') {
    text = extractPdfBestEffort(buffer);
  }

  const extractedText = normalizeWhitespace(text).slice(
    0,
    APP_CONFIG.externalSources.maxIndexedCharacters,
  );

  return {
    fileType: extension,
    text: extractedText,
    summary: buildSummary(extractedText, path.basename(filePath)),
    extractionMethod: extractedText ? 'local' : 'none',
    extractionStatus: extractedText ? 'indexed' : 'partial',
    extractionMessage: extractedText ? '' : 'externalSources.extractionMessage.localNoReadableText',
  };
}
