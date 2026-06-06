import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { APP_CONFIG } from '../config/app-config';
import { appFetch, toExternalRequestError } from '../network/http';

export interface OpenAiSpreadsheetAnalysisInput {
  apiKey: string;
  model: string;
  filePath: string;
  timeoutMs?: number;
}

function extractResponseText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    return '';
  }

  const record = payload as Record<string, unknown>;
  const directText = record['output_text'];
  if (typeof directText === 'string' && directText.trim()) {
    return directText.trim();
  }

  const output = record['output'];
  if (!Array.isArray(output)) {
    return '';
  }

  const chunks: string[] = [];
  for (const item of output) {
    if (!item || typeof item !== 'object') {
      continue;
    }
    const content = (item as Record<string, unknown>)['content'];
    if (!Array.isArray(content)) {
      continue;
    }
    for (const part of content) {
      if (!part || typeof part !== 'object') {
        continue;
      }
      const maybeText = (part as Record<string, unknown>)['text'];
      if (typeof maybeText === 'string' && maybeText.trim()) {
        chunks.push(maybeText.trim());
      }
    }
  }

  return chunks.join('\n\n').trim();
}

function getSpreadsheetMimeType(extension: string): string {
  switch (extension) {
    case 'csv':
      return 'text/csv';
    case 'tsv':
      return 'text/tab-separated-values';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      throw new Error('externalSources.extractionMessage.spreadsheetAiUnsupported');
  }
}

export async function extractSpreadsheetTextWithOpenAi(
  input: OpenAiSpreadsheetAnalysisInput,
): Promise<string> {
  const fileStats = await stat(input.filePath);
  if (fileStats.size > APP_CONFIG.externalSources.maxAiAnalysisBytes) {
    throw new Error('externalSources.extractionMessage.spreadsheetAiSizeLimit');
  }

  const extension = path.extname(input.filePath).replace(/^\./, '').toLowerCase();
  const mimeType = getSpreadsheetMimeType(extension);
  const bytes = await readFile(input.filePath);

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? APP_CONFIG.ai.defaultTimeoutMs,
  );

  try {
    const response = await appFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        input: [
          {
            role: 'user',
            content: [
              {
                type: 'input_file',
                filename: path.basename(input.filePath),
                file_data: `data:${mimeType};base64,${bytes.toString('base64')}`,
              },
              {
                type: 'input_text',
                text: [
                  'Extract useful source text from this spreadsheet file.',
                  'Return readable table content in workbook order.',
                  'Use one line per row and separate cells with " | ".',
                  'Include sheet names when they are inferable.',
                  'Do not summarize, translate, invent missing values, add markdown, or explain.',
                  'If no readable table content is present, return an empty string.',
                ].join('\n'),
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI spreadsheet analysis ${response.status}: ${body.slice(0, 400)}`);
    }

    return extractResponseText((await response.json()) as unknown);
  } catch (caughtError) {
    if (controller.signal.aborted) {
      throw new Error('Timeout analisi AI Excel');
    }
    throw toExternalRequestError('OpenAI spreadsheet analysis', caughtError);
  } finally {
    clearTimeout(timeout);
  }
}
