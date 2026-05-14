import { APP_CONFIG } from '../config/app-config';
import { appFetch, toExternalRequestError } from '../network/http';

export type CodexTransformAction = 'correggi' | 'riscrivi' | 'espandi' | 'riduci';
export type AiProvider = 'openai_api' | 'ollama';
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
  mode: 'api' | 'fallback';
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
}

export interface CodexChatRequest {
  message: string;
  chapterTitle?: string;
  projectName?: string;
  chapterText?: string;
  projectMemoryContext?: string;
}

export interface CodexResult {
  output: string;
  mode: 'api' | 'fallback';
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
  mode: 'api' | 'fallback';
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
        : DEFAULT_AI_SETTINGS.provider,
    fallbackProvider:
      fallbackProvider === 'openai_api' || fallbackProvider === 'ollama'
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
    'Suggerimento: verifica impostazioni provider (OpenAI API o Ollama).',
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

export const __testing = {
  buildChatPrompt,
};

export class CodexCliService {
  private readonly timeoutMs = resolveTimeoutMs();
  private queue: Promise<void> = Promise.resolve();
  private queuedRequests = 0;
  private nextRequestId = 1;
  private activeRequest: ActiveRequest | null = null;

  async getStatus(settings?: Partial<CodexRuntimeSettings>): Promise<CodexStatus> {
    const runtime = normalizeSettings(settings, this.timeoutMs);
    const primaryProbe = await this.probeProvider(runtime.provider, runtime);
    if (primaryProbe.available) {
      return this.toStatus(primaryProbe, runtime);
    }

    const fallbackProvider = getActiveFallbackProvider(runtime);
    if (!fallbackProvider) {
      return this.toStatus(primaryProbe, runtime);
    }

    const fallbackProbe = await this.probeProvider(fallbackProvider, runtime);
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

    return {
      available: false,
      command: String(provider),
      mode: 'fallback',
      reason: 'Provider AI non supportato.',
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
    return this.enqueuePrompt(prompt, settings, (error) => ({
      output: fallbackTransform(request.action, request.selectedText),
      mode: 'fallback',
      usedCommand: 'fallback',
      error,
    }));
  }

  async chat(
    request: CodexChatRequest,
    settings?: Partial<CodexRuntimeSettings>,
  ): Promise<CodexResult> {
    const prompt = buildChatPrompt(request);
    return this.enqueuePrompt(prompt, settings, (error) => ({
      output: fallbackChatResponse(request.message, error),
      mode: 'fallback',
      usedCommand: 'fallback',
      error,
    }));
  }

  private enqueuePrompt(
    prompt: string,
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
          abortController.signal,
        );
        if (primaryResult.mode === 'api' && primaryResult.output.trim()) {
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
          abortController.signal,
        );
        if (fallbackResult.mode === 'api' && fallbackResult.output.trim()) {
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

    return {
      output: '',
      mode: 'fallback',
      usedCommand: String(provider),
      error: 'Provider AI non supportato.',
    };
  }
}
