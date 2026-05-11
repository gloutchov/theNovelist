import { spawn } from 'node:child_process';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { APP_CONFIG } from '../config/app-config';
import { appFetch, toExternalRequestError } from '../network/http';

export type CodexTransformAction = 'correggi' | 'riscrivi' | 'espandi' | 'riduci';
export type AiProvider = 'codex_cli' | 'openai_api' | 'ollama';
export type AiFallbackProvider = AiProvider | 'none';

export interface CodexRuntimeSettings {
  provider: AiProvider;
  fallbackProvider: AiFallbackProvider;
  allowApiCalls: boolean;
  apiKey: string | null;
  apiModel: string;
  ollamaModel: string;
  timeoutMs: number;
}

export interface CodexStatus {
  available: boolean;
  command: string;
  mode: 'cli' | 'api' | 'fallback';
  reason?: string;
  activeRequest: boolean;
  queuedRequests: number;
  provider: AiProvider;
  fallbackProvider: AiFallbackProvider;
  apiCallsEnabled: boolean;
}

export interface CodexTransformRequest {
  action: CodexTransformAction;
  selectedText: string;
  chapterTitle?: string;
  projectName?: string;
  chapterText?: string;
  workspaceRoot?: string;
}

export interface CodexChatRequest {
  message: string;
  chapterTitle?: string;
  projectName?: string;
  chapterText?: string;
  projectMemoryContext?: string;
  workspaceRoot?: string;
}

export interface CodexResult {
  output: string;
  mode: 'cli' | 'api' | 'fallback';
  usedCommand?: string;
  error?: string;
  cancelled?: boolean;
}

interface ActiveRequest {
  id: number;
  abortController: AbortController;
}

interface ProviderProbe {
  available: boolean;
  command: string;
  mode: 'cli' | 'api' | 'fallback';
  reason?: string;
}

const DEFAULT_AI_SETTINGS: CodexRuntimeSettings = {
  provider: APP_CONFIG.ai.defaultProvider,
  fallbackProvider: APP_CONFIG.ai.defaultFallbackProvider,
  allowApiCalls: APP_CONFIG.ai.allowApiCallsByDefault,
  apiKey: null,
  apiModel: APP_CONFIG.ai.defaultApiModel,
  ollamaModel: APP_CONFIG.ai.defaultOllamaModel,
  timeoutMs: APP_CONFIG.ai.defaultTimeoutMs,
};
const resolvedCommandCache = new Map<string, Promise<string>>();
const resolvedPathCache = new Map<string, Promise<string | null>>();

type RuntimePlatform = NodeJS.Platform;

function normalizeRequestTimeoutMs(value: unknown, fallback: number): number {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue < APP_CONFIG.ai.minTimeoutMs) {
    return fallback;
  }
  return Math.min(Math.trunc(numericValue), APP_CONFIG.ai.maxTimeoutMs);
}

function normalizeSettings(
  settings?: Partial<CodexRuntimeSettings>,
  defaultTimeoutMs = resolveTimeoutMs(),
): CodexRuntimeSettings {
  const fallbackProvider = settings?.fallbackProvider;

  return {
    provider:
      settings?.provider === 'openai_api' || settings?.provider === 'ollama'
        ? settings.provider
        : 'codex_cli',
    fallbackProvider:
      fallbackProvider === 'codex_cli' ||
      fallbackProvider === 'openai_api' ||
      fallbackProvider === 'ollama'
        ? fallbackProvider
        : 'none',
    allowApiCalls: Boolean(settings?.allowApiCalls),
    apiKey: settings?.apiKey ?? null,
    apiModel: settings?.apiModel?.trim() || DEFAULT_AI_SETTINGS.apiModel,
    ollamaModel: settings?.ollamaModel?.trim() || DEFAULT_AI_SETTINGS.ollamaModel,
    timeoutMs: normalizeRequestTimeoutMs(settings?.timeoutMs, defaultTimeoutMs),
  };
}

function getActiveFallbackProvider(runtime: CodexRuntimeSettings): AiProvider | null {
  if (runtime.fallbackProvider === 'none' || runtime.fallbackProvider === runtime.provider) {
    return null;
  }

  return runtime.fallbackProvider;
}

function combineFallbackErrors(primaryError?: string, fallbackError?: string): string | undefined {
  return [primaryError, fallbackError].filter(Boolean).join(' | ') || undefined;
}

function resolveCommandName(): string {
  return process.env['NOVELIST_CODEX_COMMAND']?.trim() || 'codex';
}

function isExplicitCommandPath(commandName: string): boolean {
  return commandName.includes(path.sep) || (path.sep === '/' && commandName.includes('\\'));
}

function shellEscape(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getHomePath(env: NodeJS.ProcessEnv = process.env): string {
  return env['HOME']?.trim() || env['USERPROFILE']?.trim() || '';
}

function getPathValue(env: NodeJS.ProcessEnv = process.env): string {
  return env['PATH']?.trim() || env['Path']?.trim() || '';
}

function getWindowsAppDataPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['APPDATA']?.trim();
  if (explicit) {
    return explicit;
  }

  const homePath = getHomePath(env);
  return homePath ? path.join(homePath, 'AppData', 'Roaming') : '';
}

function getWindowsLocalAppDataPath(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env['LOCALAPPDATA']?.trim();
  if (explicit) {
    return explicit;
  }

  const homePath = getHomePath(env);
  return homePath ? path.join(homePath, 'AppData', 'Local') : '';
}

function getWindowsExecutableExtensions(env: NodeJS.ProcessEnv = process.env): string[] {
  const configured = env['PATHEXT']?.trim() || '.COM;.EXE;.BAT;.CMD';
  const extensions = configured
    .split(';')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean)
    .map((entry) => (entry.startsWith('.') ? entry : `.${entry}`));

  return [...new Set(extensions)].sort((left, right) => {
    return (
      rankWindowsCommandCandidate(`command${left}`) - rankWindowsCommandCandidate(`command${right}`)
    );
  });
}

function getCommandCandidateNames(
  commandName: string,
  platform: RuntimePlatform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  if (platform !== 'win32' || path.extname(commandName)) {
    return [commandName];
  }

  return [
    ...getWindowsExecutableExtensions(env).map((extension) => `${commandName}${extension}`),
    commandName,
  ];
}

function getLoginShellCandidates(
  platform: RuntimePlatform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const envShell = env['SHELL']?.trim() || '';
  const defaults =
    platform === 'darwin'
      ? ['/bin/zsh', '/bin/bash', '/bin/sh']
      : ['/bin/bash', '/bin/sh', '/usr/bin/bash', '/usr/bin/sh'];

  return [...new Set([envShell, ...defaults].filter(Boolean))];
}

function getCommonCommandCandidates(
  commandName: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: RuntimePlatform = process.platform,
): string[] {
  const pathModule = platform === 'win32' ? path.win32 : path.posix;
  const homePath = getHomePath(env);
  const commandCandidates = getCommandCandidateNames(commandName, platform, env);
  const directories =
    platform === 'win32'
      ? [
          pathModule.join(getWindowsAppDataPath(env), 'npm'),
          pathModule.join(getWindowsLocalAppDataPath(env), 'Programs', 'nodejs'),
          env['ProgramFiles']?.trim() ? pathModule.join(env['ProgramFiles'].trim(), 'nodejs') : '',
          env['ProgramFiles(x86)']?.trim()
            ? pathModule.join(env['ProgramFiles(x86)'].trim(), 'nodejs')
            : '',
          homePath ? pathModule.join(homePath, '.local', 'bin') : '',
        ]
      : [
          homePath ? pathModule.join(homePath, '.local', 'bin') : '',
          homePath ? pathModule.join(homePath, '.npm-global', 'bin') : '',
          '/opt/homebrew/bin',
          '/usr/local/bin',
          '/usr/bin',
          '/bin',
          '/snap/bin',
        ];

  return directories
    .filter(Boolean)
    .flatMap((directory) =>
      commandCandidates.map((candidate) => pathModule.join(directory, candidate)),
    );
}

function shouldUseShellForSpawn(
  commandName: string,
  platform: RuntimePlatform = process.platform,
): boolean {
  if (platform !== 'win32') {
    return false;
  }

  const extension = path.extname(commandName).toLowerCase();
  if (!extension) {
    return false;
  }

  return extension === '.cmd' || extension === '.bat';
}

function rankWindowsCommandCandidate(filePath: string): number {
  const extension = path.extname(filePath).toLowerCase();
  switch (extension) {
    case '.exe':
      return 0;
    case '.cmd':
      return 1;
    case '.bat':
      return 2;
    case '.com':
      return 3;
    default:
      return 10;
  }
}

function selectWindowsCommandCandidate(output: string): string | null {
  const matches = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .sort((left, right) => rankWindowsCommandCandidate(left) - rankWindowsCommandCandidate(right));

  return matches[0] ?? null;
}

async function resolveCommandViaWindowsWhere(commandName: string): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn('where.exe', [commandName], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: process.env,
      shell: false,
    });

    let stdout = '';
    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      if (code === 0) {
        resolve(selectWindowsCommandCandidate(stdout));
        return;
      }

      resolve(null);
    });
  });
}

async function resolveCommandViaShellLookup(
  commandName: string,
  platform: RuntimePlatform = process.platform,
): Promise<string | null> {
  if (platform === 'win32') {
    return resolveCommandViaWindowsWhere(commandName);
  }

  return resolveCommandViaLoginShell(commandName);
}

function getFallbackPathEntries(
  commandPath: string,
  env: NodeJS.ProcessEnv = process.env,
  platform: RuntimePlatform = process.platform,
): string[] {
  const homePath = getHomePath(env);
  const commandDirectory = isExplicitCommandPath(commandPath) ? path.dirname(commandPath) : '';
  const windowsEntries =
    platform === 'win32'
      ? [
          path.join(getWindowsAppDataPath(env), 'npm'),
          path.join(getWindowsLocalAppDataPath(env), 'Programs', 'nodejs'),
          env['ProgramFiles']?.trim() ? path.join(env['ProgramFiles'].trim(), 'nodejs') : '',
          env['ProgramFiles(x86)']?.trim()
            ? path.join(env['ProgramFiles(x86)'].trim(), 'nodejs')
            : '',
          homePath ? path.join(homePath, '.local', 'bin') : '',
        ]
      : [
          homePath ? path.join(homePath, '.local', 'bin') : '',
          homePath ? path.join(homePath, '.npm-global', 'bin') : '',
          '/opt/homebrew/bin',
          '/usr/local/bin',
          '/usr/bin',
          '/bin',
          '/usr/sbin',
          '/sbin',
          '/snap/bin',
        ];

  return [commandDirectory, ...windowsEntries].filter(Boolean);
}

function getEnvironmentPathKey(env: NodeJS.ProcessEnv = process.env): 'PATH' | 'Path' {
  return env['Path'] && !env['PATH'] ? 'Path' : 'PATH';
}

function buildPathEnvironment(
  mergedPath: string,
  env: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const pathKey = getEnvironmentPathKey(env);
  return {
    ...env,
    PATH: mergedPath,
    Path: mergedPath,
    [pathKey]: mergedPath,
  };
}

async function normalizeSpawnCommand(
  commandPath: string,
  platform: RuntimePlatform = process.platform,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string> {
  if (platform !== 'win32') {
    return commandPath;
  }

  const extension = path.extname(commandPath).toLowerCase();
  if (platform === 'win32' && path.extname(commandPath).toLowerCase() === '.ps1') {
    const cmdPath = commandPath.slice(0, -4) + '.cmd';
    if (await fileIsExecutable(cmdPath)) {
      return cmdPath;
    }
  }

  if (!extension) {
    for (const candidateExtension of getWindowsExecutableExtensions(env)) {
      const candidatePath = `${commandPath}${candidateExtension}`;
      if (await fileIsExecutable(candidatePath)) {
        return candidatePath;
      }
    }
  }

  return commandPath;
}

async function fileIsExecutable(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommandViaPosixShell(
  commandName: string,
  shellPath: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const child = spawn(shellPath, ['-lc', `command -v ${shellEscape(commandName)}`], {
      stdio: ['ignore', 'pipe', 'ignore'],
      env: process.env,
    });

    let stdout = '';
    child.stdout.on('data', (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });
    child.on('error', () => resolve(null));
    child.on('close', (code) => {
      const resolvedPath =
        stdout
          .trim()
          .split('\n')
          .find((line) => line.trim())
          ?.trim() ?? '';
      if (code === 0 && resolvedPath) {
        resolve(resolvedPath);
        return;
      }

      resolve(null);
    });
  });
}

async function resolveCommandViaLoginShell(commandName: string): Promise<string | null> {
  for (const shellPath of getLoginShellCandidates()) {
    const resolved = await resolveCommandViaPosixShell(commandName, shellPath);
    if (resolved) {
      return resolved;
    }
  }

  return null;
}

function resolveSearchPathEntry(commandName: string): Promise<string | null> {
  const trimmed = commandName.trim();
  const cached = resolvedPathCache.get(trimmed);
  if (cached) {
    return cached;
  }

  const resolution = resolveCommandViaShellLookup(trimmed);
  resolvedPathCache.set(trimmed, resolution);
  return resolution;
}

function clearResolvedCommandCaches(): void {
  resolvedCommandCache.clear();
  resolvedPathCache.clear();
}

async function resolveCommandFromCommonPaths(commandName: string): Promise<string | null> {
  for (const candidate of getCommonCommandCandidates(commandName)) {
    if (await fileIsExecutable(candidate)) {
      return normalizeSpawnCommand(candidate);
    }
  }

  return null;
}

function resolveRunnableCommandName(commandName: string): Promise<string> {
  const trimmed = commandName.trim() || 'codex';
  const cached = resolvedCommandCache.get(trimmed);
  if (cached) {
    return cached;
  }

  const resolution = (async () => {
    if (isExplicitCommandPath(trimmed)) {
      return normalizeSpawnCommand(trimmed);
    }

    const commonPathResolved = await resolveCommandFromCommonPaths(trimmed);
    if (commonPathResolved) {
      return commonPathResolved;
    }

    const shellResolved = await resolveCommandViaShellLookup(trimmed);
    if (shellResolved) {
      return normalizeSpawnCommand(shellResolved);
    }

    return trimmed;
  })();

  resolvedCommandCache.set(trimmed, resolution);
  return resolution;
}

async function buildCliEnvironment(commandPath: string): Promise<NodeJS.ProcessEnv> {
  const currentPath = getPathValue(process.env);
  const pathEntries = currentPath ? currentPath.split(path.delimiter).filter(Boolean) : [];
  const resolvedNodePath = await resolveSearchPathEntry('node');
  const nodeDirectory = resolvedNodePath?.trim() ? path.dirname(resolvedNodePath.trim()) : '';
  const fallbackEntries = [...getFallbackPathEntries(commandPath), nodeDirectory].filter(Boolean);

  const mergedPath = [...new Set([...fallbackEntries, ...pathEntries])].join(path.delimiter);
  return buildPathEnvironment(mergedPath, process.env);
}

function resolveTimeoutMs(): number {
  const value = Number(process.env[APP_CONFIG.ai.timeoutEnvVar] ?? APP_CONFIG.ai.defaultTimeoutMs);
  if (!Number.isFinite(value) || value < APP_CONFIG.ai.minTimeoutMs) {
    return APP_CONFIG.ai.defaultTimeoutMs;
  }
  return Math.min(Math.trunc(value), APP_CONFIG.ai.maxTimeoutMs);
}

function resolveOllamaHost(): string {
  return (process.env['OLLAMA_HOST']?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/g, '');
}

function compactWhitespace(text: string): string {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

function fallbackTransform(action: CodexTransformAction, sourceText: string): string {
  const normalized = compactWhitespace(sourceText);
  if (!normalized) {
    return sourceText;
  }

  if (action === 'correggi') {
    const first = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return first.replace(/\s+([,.;!?])/g, '$1');
  }

  if (action === 'riscrivi') {
    return `Versione riscritta:\n${normalized}`;
  }

  if (action === 'espandi') {
    return `${normalized}\n\nDettaglio aggiuntivo: approfondisci emozioni, contesto e implicazioni della scena per aumentare impatto narrativo.`;
  }

  return normalized.length > 160 ? `${normalized.slice(0, 157).trim()}...` : normalized;
}

function fallbackChatResponse(message: string, error?: string): string {
  const clean = compactWhitespace(message);

  return [
    'Modalita fallback locale attiva: AI non raggiungibile.',
    `Richiesta ricevuta: "${clean}".`,
    error ? `Dettaglio tecnico: ${error}` : null,
    'Suggerimento: verifica impostazioni provider (Codex CLI, OpenAI API o Ollama).',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTransformPrompt(request: CodexTransformRequest): string {
  const fullContext = (request.chapterText ?? '').trim();

  return [
    'Sei un editor narrativo professionale.',
    `Azione richiesta: ${request.action}.`,
    request.projectName ? `Progetto: ${request.projectName}` : null,
    request.chapterTitle ? `Capitolo: ${request.chapterTitle}` : null,
    fullContext ? `Contesto capitolo:\n${fullContext.slice(0, 8000)}` : null,
    'Testo selezionato da modificare:',
    request.selectedText,
    'Restituisci solo il testo finale, senza commenti, senza markdown.',
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildChatPrompt(request: CodexChatRequest): string {
  const chapterContext = (request.chapterText ?? '').trim();
  const projectMemoryContext = (request.projectMemoryContext ?? '').trim();

  return [
    'Sei un assistente editoriale per romanzi e racconti.',
    request.projectName ? `Progetto: ${request.projectName}` : null,
    request.chapterTitle ? `Capitolo corrente: ${request.chapterTitle}` : null,
    chapterContext ? `Estratto capitolo:\n${chapterContext.slice(0, 8000)}` : null,
    projectMemoryContext ? `Memoria progetto:\n${projectMemoryContext}` : null,
    projectMemoryContext
      ? [
          'Quando rispondi usando la memoria progetto:',
          '- cita i riferimenti disponibili, per esempio [1] o il percorso del file;',
          '- distingui fatti scritti, schede autore, sintesi wiki e inferenze;',
          '- se non trovi evidenza sufficiente, scrivi esplicitamente che non hai trovato conferma.',
        ].join('\n')
      : null,
    `Richiesta utente:\n${request.message}`,
    'Rispondi in italiano in modo operativo e conciso.',
  ]
    .filter(Boolean)
    .join('\n\n');
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

async function runOpenAiApi(
  apiKey: string,
  model: string,
  prompt: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<CodexResult> {
  if (signal?.aborted) {
    return {
      output: '',
      mode: 'fallback',
      error: 'Richiesta annullata',
      cancelled: true,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortHandler = (): void => controller.abort();
  signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    const response = await appFetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: prompt,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        output: '',
        mode: 'fallback',
        error: `OpenAI API ${response.status}: ${body.slice(0, 400)}`,
      };
    }

    const json = (await response.json()) as unknown;
    const text = extractResponseText(json);
    if (!text) {
      return {
        output: '',
        mode: 'fallback',
        error: 'OpenAI API risposta senza testo',
      };
    }

    return {
      output: text,
      mode: 'api',
      usedCommand: 'openai_api',
    };
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) {
      if (timedOut && !signal?.aborted) {
        return {
          output: '',
          mode: 'fallback',
          error: `Timeout OpenAI API (${timeoutMs}ms)`,
        };
      }

      return {
        output: '',
        mode: 'fallback',
        error: 'Richiesta annullata',
        cancelled: true,
      };
    }

    return {
      output: '',
      mode: 'fallback',
      error: toExternalRequestError('OpenAI API', error).message,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortHandler);
  }
}

interface OllamaChatResponse {
  message?: {
    content?: string;
  };
  error?: string;
}

async function runOllamaApi(
  model: string,
  prompt: string,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<CodexResult> {
  if (signal?.aborted) {
    return {
      output: '',
      mode: 'fallback',
      error: 'Richiesta annullata',
      cancelled: true,
    };
  }

  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const abortHandler = (): void => controller.abort();
  signal?.addEventListener('abort', abortHandler, { once: true });
  const baseUrl = resolveOllamaHost();

  try {
    const response = await appFetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        stream: false,
        think: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        output: '',
        mode: 'fallback',
        error: `Ollama API ${response.status}: ${body.slice(0, 400)}`,
      };
    }

    const payload = (await response.json()) as OllamaChatResponse;
    if (payload.error?.trim()) {
      return {
        output: '',
        mode: 'fallback',
        error: `Ollama error: ${payload.error.trim()}`,
      };
    }

    const text = payload.message?.content?.trim() ?? '';
    if (!text) {
      return {
        output: '',
        mode: 'fallback',
        error: 'Ollama risposta senza testo',
      };
    }

    return {
      output: text,
      mode: 'api',
      usedCommand: 'ollama',
    };
  } catch (error) {
    if (controller.signal.aborted || signal?.aborted) {
      if (timedOut && !signal?.aborted) {
        return {
          output: '',
          mode: 'fallback',
          error: `Timeout Ollama API (${timeoutMs}ms)`,
        };
      }

      return {
        output: '',
        mode: 'fallback',
        error: 'Richiesta annullata',
        cancelled: true,
      };
    }

    return {
      output: '',
      mode: 'fallback',
      error: toExternalRequestError('Ollama API', error).message,
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortHandler);
  }
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string; model?: string }>;
}

async function probeOllama(
  timeoutMs: number,
  model?: string,
): Promise<{ available: boolean; reason?: string }> {
  const baseUrl = resolveOllamaHost();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await appFetch(`${baseUrl}/api/tags`, {
      method: 'GET',
      signal: controller.signal,
    });
    if (!response.ok) {
      const body = await response.text();
      return {
        available: false,
        reason: `Ollama API ${response.status}: ${body.slice(0, 200)}`,
      };
    }
    if (model?.trim()) {
      const payload = (await response.json()) as OllamaTagsResponse;
      const modelNames = new Set(
        (payload.models ?? [])
          .flatMap((item) => [item.name, item.model])
          .filter((name): name is string => typeof name === 'string' && Boolean(name.trim())),
      );
      if (!modelNames.has(model.trim())) {
        return {
          available: false,
          reason: `Modello Ollama non installato: ${model.trim()}. Modelli disponibili: ${
            [...modelNames].join(', ') || 'nessuno'
          }.`,
        };
      }
    }
    return { available: true };
  } catch (error) {
    if (controller.signal.aborted) {
      return { available: false, reason: 'Timeout connessione Ollama' };
    }
    return {
      available: false,
      reason: toExternalRequestError('Ollama API', error).message,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function runCodexCli(
  commandName: string,
  prompt: string,
  timeoutMs: number,
  options?: {
    cwd?: string;
  },
  signal?: AbortSignal,
): Promise<CodexResult> {
  return new Promise((resolve) => {
    void (async () => {
      if (signal?.aborted) {
        resolve({
          output: '',
          mode: 'fallback',
          usedCommand: commandName,
          error: 'Richiesta annullata',
          cancelled: true,
        });
        return;
      }

      let outputRoot: string | null = null;
      let outputPath: string | null = null;
      try {
        outputRoot = await mkdtemp(path.join(tmpdir(), 'novelist-codex-'));
        outputPath = path.join(outputRoot, 'last-message.txt');
      } catch {
        outputRoot = null;
        outputPath = null;
      }

      const args = ['exec', '--skip-git-repo-check'] as string[];
      if (options?.cwd?.trim()) {
        args.push('--cd', options.cwd.trim());
      }
      if (outputPath) {
        args.push('--output-last-message', outputPath);
      }
      args.push('-');
      const cliEnv = await buildCliEnvironment(commandName);

      const child = spawn(commandName, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: cliEnv,
        cwd: options?.cwd?.trim() || process.cwd(),
        shell: shouldUseShellForSpawn(commandName),
      });

      let stdout = '';
      let stderr = '';
      let settled = false;

      const cleanupOutputDir = async (): Promise<void> => {
        if (outputRoot) {
          await rm(outputRoot, { recursive: true, force: true }).catch(() => undefined);
        }
      };

      const cleanupTimers = (): void => {
        clearTimeout(timeout);
        signal?.removeEventListener('abort', onAbort);
      };

      const timeout = setTimeout(() => {
        if (settled) {
          return;
        }

        settled = true;
        child.kill('SIGTERM');
        cleanupTimers();
        void cleanupOutputDir();
        resolve({
          output: '',
          mode: 'fallback',
          usedCommand: commandName,
          error: `Timeout Codex CLI (${timeoutMs}ms)`,
        });
      }, timeoutMs);

      const onAbort = (): void => {
        if (settled) {
          return;
        }

        settled = true;
        child.kill('SIGTERM');
        cleanupTimers();
        void cleanupOutputDir();
        resolve({
          output: '',
          mode: 'fallback',
          usedCommand: commandName,
          error: 'Richiesta annullata',
          cancelled: true,
        });
      };

      signal?.addEventListener('abort', onAbort, { once: true });
      child.stdin.write(prompt);
      child.stdin.end();

      child.stdout.on('data', (chunk: Buffer | string) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk: Buffer | string) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanupTimers();
        void cleanupOutputDir();
        resolve({
          output: '',
          mode: 'fallback',
          usedCommand: commandName,
          error: error.message,
        });
      });

      child.on('close', async (code) => {
        if (settled) {
          return;
        }

        settled = true;
        cleanupTimers();

        if (signal?.aborted) {
          await cleanupOutputDir();
          resolve({
            output: '',
            mode: 'fallback',
            usedCommand: commandName,
            error: 'Richiesta annullata',
            cancelled: true,
          });
          return;
        }

        const out = stdout.trim();
        const err = stderr.trim();
        let outputFromFile = '';
        if (outputPath) {
          try {
            outputFromFile = (await readFile(outputPath, 'utf8')).trim();
          } catch {
            // Ignore file output errors and fallback to stdout parsing.
          }
        }
        await cleanupOutputDir();

        const outputText = outputFromFile || out;
        if (code === 0 && outputText) {
          resolve({
            output: outputText,
            mode: 'cli',
            usedCommand: commandName,
          });
          return;
        }

        resolve({
          output: '',
          mode: 'fallback',
          usedCommand: commandName,
          error: err || `Codex CLI exited with code ${code ?? -1}`,
        });
      });
    })();
  });
}

export const __testing = {
  buildChatPrompt,
  clearResolvedCommandCaches,
  getLoginShellCandidates,
  getCommonCommandCandidates,
  resolveRunnableCommandName,
  selectWindowsCommandCandidate,
  shouldUseShellForSpawn,
};

export class CodexCliService {
  private readonly commandName = resolveCommandName();
  private readonly timeoutMs = resolveTimeoutMs();
  private queue: Promise<void> = Promise.resolve();
  private queuedRequests = 0;
  private nextRequestId = 1;
  private activeRequest: ActiveRequest | null = null;

  async getStatus(
    settings?: Partial<CodexRuntimeSettings>,
    workspaceRoot?: string,
  ): Promise<CodexStatus> {
    const runtime = normalizeSettings(settings, this.timeoutMs);
    const primaryProbe = await this.probeProvider(runtime.provider, runtime, workspaceRoot);
    if (primaryProbe.available) {
      return this.toStatus(primaryProbe, runtime);
    }

    const fallbackProvider = getActiveFallbackProvider(runtime);
    if (!fallbackProvider) {
      return this.toStatus(primaryProbe, runtime);
    }

    const fallbackProbe = await this.probeProvider(fallbackProvider, runtime, workspaceRoot);
    if (fallbackProbe.available) {
      return this.toStatus(
        {
          ...fallbackProbe,
          reason: `Provider primario non disponibile: ${primaryProbe.reason ?? 'errore sconosciuto'}.`,
        },
        runtime,
      );
    }

    return this.toStatus(
      {
        ...primaryProbe,
        reason: combineFallbackErrors(primaryProbe.reason, fallbackProbe.reason),
      },
      runtime,
    );
  }

  private toStatus(probe: ProviderProbe, runtime: CodexRuntimeSettings): CodexStatus {
    return {
      available: probe.available,
      command: probe.command,
      mode: probe.mode,
      reason: probe.reason,
      activeRequest: this.activeRequest !== null,
      queuedRequests: this.queuedRequests,
      provider: runtime.provider,
      fallbackProvider: runtime.fallbackProvider,
      apiCallsEnabled: runtime.allowApiCalls,
    };
  }

  private async probeProvider(
    provider: AiProvider,
    runtime: CodexRuntimeSettings,
    workspaceRoot?: string,
  ): Promise<ProviderProbe> {
    if (provider === 'openai_api') {
      if (!runtime.allowApiCalls) {
        return {
          available: false,
          command: 'OpenAI API',
          mode: 'fallback',
          reason: 'Abilita "chiamate API esterne" nelle Impostazioni AI per usare OpenAI API.',
        };
      }

      const apiKey = runtime.apiKey?.trim() || process.env['OPENAI_API_KEY']?.trim();
      if (!apiKey) {
        return {
          available: false,
          command: 'OpenAI API',
          mode: 'fallback',
          reason: 'API key mancante: configura OPENAI_API_KEY o la chiave in Impostazioni AI.',
        };
      }

      return {
        available: true,
        command: 'OpenAI API',
        mode: 'api',
      };
    }

    if (provider === 'ollama') {
      if (!runtime.allowApiCalls) {
        return {
          available: false,
          command: 'ollama',
          mode: 'fallback',
          reason: 'Abilita "chiamate API esterne" nelle Impostazioni AI per usare Ollama.',
        };
      }

      const probe = await probeOllama(Math.min(this.timeoutMs, 10_000), runtime.ollamaModel);
      return {
        available: probe.available,
        command: `ollama@${resolveOllamaHost()} ${runtime.ollamaModel}`,
        mode: probe.available ? 'api' : 'fallback',
        reason: probe.available ? undefined : (probe.reason ?? 'Ollama non raggiungibile'),
      };
    }

    const resolvedCommandName = await resolveRunnableCommandName(this.commandName);
    const probe = await runCodexCli(
      resolvedCommandName,
      'Rispondi solo con: ok',
      Math.min(this.timeoutMs, 10_000),
      {
        cwd: workspaceRoot,
      },
    );

    return {
      available: probe.mode === 'cli',
      command: resolvedCommandName,
      mode: probe.mode === 'cli' ? 'cli' : 'fallback',
      reason: probe.mode === 'cli' ? undefined : (probe.error ?? 'Codex CLI non raggiungibile'),
    };
  }

  cancelActiveRequest(): boolean {
    if (!this.activeRequest) {
      return false;
    }

    this.activeRequest.abortController.abort();
    return true;
  }

  async transformSelection(
    request: CodexTransformRequest,
    settings?: Partial<CodexRuntimeSettings>,
  ): Promise<CodexResult> {
    const prompt = buildTransformPrompt(request);
    return this.enqueuePrompt(prompt, request.workspaceRoot, settings, (error) => ({
      output: fallbackTransform(request.action, request.selectedText),
      mode: 'fallback',
      usedCommand: this.commandName,
      error,
    }));
  }

  async chat(
    request: CodexChatRequest,
    settings?: Partial<CodexRuntimeSettings>,
  ): Promise<CodexResult> {
    const prompt = buildChatPrompt(request);
    return this.enqueuePrompt(prompt, request.workspaceRoot, settings, (error) => ({
      output: fallbackChatResponse(request.message, error),
      mode: 'fallback',
      usedCommand: this.commandName,
      error,
    }));
  }

  private enqueuePrompt(
    prompt: string,
    workspaceRoot: string | undefined,
    settings: Partial<CodexRuntimeSettings> | undefined,
    fallbackBuilder: (error?: string) => CodexResult,
  ): Promise<CodexResult> {
    const runtime = normalizeSettings(settings);
    this.queuedRequests += 1;

    const execute = async (): Promise<CodexResult> => {
      this.queuedRequests -= 1;
      const requestId = this.nextRequestId++;
      const abortController = new AbortController();
      this.activeRequest = { id: requestId, abortController };

      try {
        const primaryResult = await this.runProvider(
          runtime.provider,
          runtime,
          prompt,
          workspaceRoot,
          abortController.signal,
        );
        if (
          (primaryResult.mode === 'cli' || primaryResult.mode === 'api') &&
          primaryResult.output.trim()
        ) {
          return primaryResult;
        }
        if (primaryResult.cancelled) {
          return primaryResult;
        }

        const fallbackProvider = getActiveFallbackProvider(runtime);
        if (!fallbackProvider) {
          return fallbackBuilder(primaryResult.error);
        }

        const fallbackResult = await this.runProvider(
          fallbackProvider,
          runtime,
          prompt,
          workspaceRoot,
          abortController.signal,
        );
        if (
          (fallbackResult.mode === 'cli' || fallbackResult.mode === 'api') &&
          fallbackResult.output.trim()
        ) {
          return fallbackResult;
        }
        if (fallbackResult.cancelled) {
          return fallbackResult;
        }

        return fallbackBuilder(combineFallbackErrors(primaryResult.error, fallbackResult.error));
      } finally {
        if (this.activeRequest?.id === requestId) {
          this.activeRequest = null;
        }
      }
    };

    const task = this.queue.then(execute);
    this.queue = task.then(
      () => undefined,
      () => undefined,
    );

    return task;
  }

  private async runProvider(
    provider: AiProvider,
    runtime: CodexRuntimeSettings,
    prompt: string,
    workspaceRoot: string | undefined,
    signal: AbortSignal,
  ): Promise<CodexResult> {
    if (provider === 'openai_api') {
      if (!runtime.allowApiCalls) {
        return {
          output: '',
          mode: 'fallback',
          usedCommand: 'openai_api',
          error: 'Chiamate API esterne disabilitate nelle Impostazioni AI.',
        };
      }

      const apiKey = runtime.apiKey?.trim() || process.env['OPENAI_API_KEY']?.trim() || '';
      if (!apiKey) {
        return {
          output: '',
          mode: 'fallback',
          usedCommand: 'openai_api',
          error: 'API key mancante: configura OPENAI_API_KEY o la chiave in Impostazioni AI.',
        };
      }

      return runOpenAiApi(apiKey, runtime.apiModel, prompt, runtime.timeoutMs, signal);
    }

    if (provider === 'ollama') {
      if (!runtime.allowApiCalls) {
        return {
          output: '',
          mode: 'fallback',
          usedCommand: 'ollama',
          error: 'Chiamate API esterne disabilitate nelle Impostazioni AI.',
        };
      }

      return runOllamaApi(runtime.ollamaModel, prompt, runtime.timeoutMs, signal);
    }

    const resolvedCommandName = await resolveRunnableCommandName(this.commandName);
    return runCodexCli(
      resolvedCommandName,
      prompt,
      runtime.timeoutMs,
      {
        cwd: workspaceRoot,
      },
      signal,
    );
  }
}
