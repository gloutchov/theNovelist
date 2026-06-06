import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { APP_CONFIG } from '../config/app-config';
import { appFetch, toExternalRequestError } from '../network/http';

export interface OpenAiPdfOcrInput {
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

export async function extractPdfTextWithOpenAi(input: OpenAiPdfOcrInput): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? APP_CONFIG.ai.defaultTimeoutMs,
  );

  try {
    const bytes = await readFile(input.filePath);
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
                file_data: `data:application/pdf;base64,${bytes.toString('base64')}`,
              },
              {
                type: 'input_text',
                text: [
                  'Extract the readable text from this PDF using OCR when needed.',
                  'Return only the document text in reading order.',
                  'Do not summarize, comment, translate, or add markdown.',
                  'If no readable text is present, return an empty string.',
                ].join(' '),
              },
            ],
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI PDF OCR ${response.status}: ${body.slice(0, 400)}`);
    }

    return extractResponseText((await response.json()) as unknown);
  } catch (caughtError) {
    if (controller.signal.aborted) {
      throw new Error('Timeout OCR PDF OpenAI');
    }
    throw toExternalRequestError('OpenAI PDF OCR', caughtError);
  } finally {
    clearTimeout(timeout);
  }
}
