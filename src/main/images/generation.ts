import { copyFile, mkdir, open, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  APP_CONFIG,
  type GeneratedImageSize,
  type ImportedImageExtension,
} from '../config/app-config';
import { toProjectStoredFilePath } from '../projects/asset-paths';
import { appFetch, toExternalRequestError } from '../network/http';

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

export async function generateImageWithApi(
  input: GenerateImageWithApiInput,
): Promise<GeneratedImageResult> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? APP_CONFIG.images.defaultGenerationTimeoutMs,
  );

  try {
    const response = await appFetch('https://api.openai.com/v1/images/generations', {
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
      const imageResponse = await appFetch(firstImage.url);
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
    throw toExternalRequestError('OpenAI Images API', caughtError);
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
  const directory = path.join(
    input.assetsPath,
    APP_CONFIG.images.generatedImagesDirName,
    input.category,
  );
  await mkdir(directory, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const imageTypeSafe = sanitizeFileSegment(input.imageType);
  const fileName = `${stamp}-${imageTypeSafe}-${randomUUID().slice(0, 8)}.${input.generated.extension}`;
  const filePath = path.join(directory, fileName);
  await writeFile(filePath, input.generated.bytes);
  return toProjectStoredFilePath(path.dirname(path.resolve(input.assetsPath)), filePath);
}

type StoredImportedImageExtension = Exclude<ImportedImageExtension, 'jpeg'>;

const IMPORTED_IMAGE_EXTENSIONS = new Set<ImportedImageExtension>(
  APP_CONFIG.images.importedExtensions,
);

function extensionFromFilePath(filePath: string): ImportedImageExtension {
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  if (IMPORTED_IMAGE_EXTENSIONS.has(ext as ImportedImageExtension)) {
    return ext as ImportedImageExtension;
  }
  throw new Error('Formato immagine non supportato');
}

function storedExtension(extension: ImportedImageExtension): StoredImportedImageExtension {
  return extension === 'jpeg' ? 'jpg' : extension;
}

function formatBytes(bytes: number): string {
  const megabytes = bytes / (1024 * 1024);
  return `${Number.isInteger(megabytes) ? megabytes.toFixed(0) : megabytes.toFixed(1)} MB`;
}

function hasImageSignature(extension: ImportedImageExtension, bytes: Buffer): boolean {
  switch (extension) {
    case 'png':
      return bytes
        .subarray(0, 8)
        .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case 'jpg':
    case 'jpeg':
      return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case 'webp':
      return (
        bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
        bytes.subarray(8, 12).toString('ascii') === 'WEBP'
      );
    case 'gif': {
      const header = bytes.subarray(0, 6).toString('ascii');
      return header === 'GIF87a' || header === 'GIF89a';
    }
    case 'bmp':
      return bytes.subarray(0, 2).toString('ascii') === 'BM';
  }
}

export async function validateProjectImageFile(
  sourceFilePath: string,
  options: { maxBytes?: number } = {},
): Promise<ImportedImageExtension> {
  const extension = extensionFromFilePath(sourceFilePath);
  const maxBytes = options.maxBytes ?? APP_CONFIG.images.maxUploadBytes;
  const fileStats = await stat(sourceFilePath);
  if (!fileStats.isFile()) {
    throw new Error('Il percorso selezionato non e un file immagine');
  }
  if (fileStats.size > maxBytes) {
    throw new Error(`Immagine troppo grande: limite ${formatBytes(maxBytes)}`);
  }

  const handle = await open(sourceFilePath, 'r');
  try {
    const header = Buffer.alloc(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    if (!hasImageSignature(extension, header.subarray(0, bytesRead))) {
      throw new Error('Il file selezionato non corrisponde al formato immagine dichiarato');
    }
  } finally {
    await handle.close();
  }

  return extension;
}

export async function importImageToProject(input: {
  assetsPath: string;
  category: 'characters' | 'locations';
  imageType: string;
  sourceFilePath: string;
}): Promise<string> {
  const sourceFilePath = path.resolve(input.sourceFilePath.trim());
  const extension = await validateProjectImageFile(sourceFilePath);

  const directory = path.join(
    input.assetsPath,
    APP_CONFIG.images.importedImagesDirName,
    input.category,
  );
  await mkdir(directory, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const imageTypeSafe = sanitizeFileSegment(input.imageType);
  const fileName = `${stamp}-${imageTypeSafe}-${randomUUID().slice(0, 8)}.${storedExtension(extension)}`;
  const destinationFilePath = path.join(directory, fileName);
  await copyFile(sourceFilePath, destinationFilePath);
  return toProjectStoredFilePath(path.dirname(path.resolve(input.assetsPath)), destinationFilePath);
}
