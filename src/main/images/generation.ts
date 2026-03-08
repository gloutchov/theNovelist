import { access, copyFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export type GeneratedImageSize = '1024x1024' | '1536x1024' | '1024x1536';

export interface GenerateImageWithApiInput {
  apiKey: string;
  model: string;
  prompt: string;
  size: GeneratedImageSize;
  timeoutMs?: number;
}

interface OpenAiImageDataItem {
  b64_json?: string;
  url?: string;
}

interface OpenAiImageResponse {
  data?: OpenAiImageDataItem[];
}

export interface GeneratedImageResult {
  bytes: Buffer;
  extension: 'png' | 'jpg' | 'webp';
}

const DEFAULT_TIMEOUT_MS = 120_000;

function extensionFromMimeType(mimeType: string | null): 'png' | 'jpg' | 'webp' {
  const normalized = (mimeType ?? '').toLowerCase();
  if (normalized.includes('jpeg') || normalized.includes('jpg')) {
    return 'jpg';
  }
  if (normalized.includes('webp')) {
    return 'webp';
  }
  return 'png';
}

function sanitizeFileSegment(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) {
    return 'image';
  }

  return trimmed
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
}

export async function generateImageWithApi(input: GenerateImageWithApiInput): Promise<GeneratedImageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        size: input.size,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`OpenAI Images API ${response.status}: ${body.slice(0, 400)}`);
    }

    const payload = (await response.json()) as OpenAiImageResponse;
    const firstImage = payload.data?.[0];
    if (!firstImage) {
      throw new Error('Risposta immagini senza contenuto');
    }

    if (firstImage.b64_json?.trim()) {
      const bytes = Buffer.from(firstImage.b64_json, 'base64');
      return { bytes, extension: 'png' };
    }

    if (firstImage.url?.trim()) {
      const imageResponse = await fetch(firstImage.url);
      if (!imageResponse.ok) {
        throw new Error(`Download immagine fallito (${imageResponse.status})`);
      }

      const arrayBuffer = await imageResponse.arrayBuffer();
      return {
        bytes: Buffer.from(arrayBuffer),
        extension: extensionFromMimeType(imageResponse.headers.get('content-type')),
      };
    }

    throw new Error('Formato immagine non supportato dalla risposta API');
  } catch (caughtError) {
    if (controller.signal.aborted) {
      throw new Error('Timeout generazione immagine');
    }
    throw caughtError;
  } finally {
    clearTimeout(timeout);
  }
}

export async function saveGeneratedImageToProject(input: {
  assetsPath: string;
  category: 'characters' | 'locations';
  imageType: string;
  generated: GeneratedImageResult;
}): Promise<string> {
  const directory = path.join(input.assetsPath, 'generated-images', input.category);
  await mkdir(directory, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const imageTypeSafe = sanitizeFileSegment(input.imageType);
  const fileName = `${stamp}-${imageTypeSafe}-${randomUUID().slice(0, 8)}.${input.generated.extension}`;
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, input.generated.bytes);
  return filePath;
}

function extensionFromFilePath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  if (!ext) {
    return 'png';
  }
  if (ext === 'jpeg') {
    return 'jpg';
  }
  return ext.slice(0, 8);
}

export async function importImageToProject(input: {
  assetsPath: string;
  category: 'characters' | 'locations';
  imageType: string;
  sourceFilePath: string;
}): Promise<string> {
  const sourceFilePath = path.resolve(input.sourceFilePath.trim());
  await access(sourceFilePath);

  const directory = path.join(input.assetsPath, 'img', input.category);
  await mkdir(directory, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const imageTypeSafe = sanitizeFileSegment(input.imageType);
  const extension = extensionFromFilePath(sourceFilePath);
  const fileName = `${stamp}-${imageTypeSafe}-${randomUUID().slice(0, 8)}.${extension}`;
  const destinationFilePath = path.join(directory, fileName);
  await copyFile(sourceFilePath, destinationFilePath);
  return destinationFilePath;
}
