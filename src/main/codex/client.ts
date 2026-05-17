import { APP_CONFIG } from '../config/app-config';
import type { MainLanguage } from '../i18n';
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
  language: MainLanguage;
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
  language: 'it',
};

const CODEX_TEXT = {
  it: {
    additionalDetail:
      'Dettaglio aggiuntivo: approfondisci emozioni, contesto e implicazioni della scena per aumentare impatto narrativo.',
    apiCallsDisabled: 'Chiamate API esterne disabilitate nelle Impostazioni AI.',
    apiKeyMissing: 'API key mancante: configura OPENAI_API_KEY o la chiave in Impostazioni AI.',
    cancelled: 'Richiesta annullata',
    chatAssistant: 'Sei un assistente editoriale per romanzi e racconti.',
    chatChapter: 'Capitolo corrente',
    chatExcerpt: 'Estratto capitolo',
    chatMemory: 'Memoria progetto',
    chatMemoryRules: [
      'Quando rispondi usando la memoria progetto:',
      '- cita i riferimenti disponibili, per esempio [1] o il percorso del file;',
      '- distingui fatti scritti, schede autore, sintesi wiki e inferenze;',
      '- se non trovi evidenza sufficiente, scrivi esplicitamente che non hai trovato conferma.',
    ].join('\n'),
    chatProject: 'Progetto',
    chatReplyInstruction: 'Rispondi in italiano in modo operativo e conciso.',
    chatUserRequest: 'Richiesta utente',
    fallbackUnavailable: 'Modalita fallback locale attiva: AI non raggiungibile.',
    fallbackReceived: 'Richiesta ricevuta',
    fallbackTechnicalDetail: 'Dettaglio tecnico',
    fallbackSuggestion: 'Suggerimento: verifica impostazioni provider (OpenAI API o Ollama).',
    noAvailableText: 'risposta senza testo',
    ollamaDisabled: 'Abilita "chiamate API esterne" nelle Impostazioni AI per usare Ollama.',
    ollamaMissingModel: 'Modello Ollama non installato',
    ollamaNoModels: 'nessuno',
    ollamaTimeout: 'Timeout connessione Ollama',
    openAiDisabled: 'Abilita "chiamate API esterne" nelle Impostazioni AI per usare OpenAI API.',
    primaryUnavailable: 'Provider primario non disponibile',
    project: 'Progetto',
    providerUnsupported: 'Provider AI non supportato.',
    requestAction: 'Azione richiesta',
    selectedText: 'Testo selezionato da modificare',
    transformChapter: 'Capitolo',
    transformContext: 'Contesto capitolo',
    transformEditor: 'Sei un editor narrativo professionale.',
    transformInstruction: 'Restituisci solo il testo finale, senza commenti, senza markdown.',
    rewrittenVersion: 'Versione riscritta',
    unknownError: 'errore sconosciuto',
  },
  en: {
    additionalDetail:
      'Additional detail: deepen emotion, context, and scene implications to increase narrative impact.',
    apiCallsDisabled: 'External API calls are disabled in AI Settings.',
    apiKeyMissing: 'Missing API key: configure OPENAI_API_KEY or the key in AI Settings.',
    cancelled: 'Request cancelled',
    chatAssistant: 'You are an editorial assistant for novels and short stories.',
    chatChapter: 'Current chapter',
    chatExcerpt: 'Chapter excerpt',
    chatMemory: 'Project memory',
    chatMemoryRules: [
      'When you answer using project memory:',
      '- cite available references, for example [1] or the file path;',
      '- distinguish written facts, author cards, wiki summaries, and inferences;',
      '- if you do not find enough evidence, explicitly say that you found no confirmation.',
    ].join('\n'),
    chatProject: 'Project',
    chatReplyInstruction: 'Reply in English in a practical and concise way.',
    chatUserRequest: 'User request',
    fallbackUnavailable: 'Local fallback mode active: AI is unreachable.',
    fallbackReceived: 'Request received',
    fallbackTechnicalDetail: 'Technical detail',
    fallbackSuggestion: 'Suggestion: check provider settings (OpenAI API or Ollama).',
    noAvailableText: 'response without text',
    ollamaDisabled: 'Enable "external API calls" in AI Settings to use Ollama.',
    ollamaMissingModel: 'Ollama model is not installed',
    ollamaNoModels: 'none',
    ollamaTimeout: 'Ollama connection timeout',
    openAiDisabled: 'Enable "external API calls" in AI Settings to use OpenAI API.',
    primaryUnavailable: 'Primary provider unavailable',
    project: 'Project',
    providerUnsupported: 'Unsupported AI provider.',
    requestAction: 'Requested action',
    selectedText: 'Selected text to modify',
    transformChapter: 'Chapter',
    transformContext: 'Chapter context',
    transformEditor: 'You are a professional narrative editor.',
    transformInstruction: 'Return only the final text, with no comments and no markdown.',
    rewrittenVersion: 'Rewritten version',
    unknownError: 'unknown error',
  },
} as const;

type CodexText = (typeof CODEX_TEXT)[MainLanguage];

function getCodexText(language: MainLanguage = DEFAULT_AI_SETTINGS.language): CodexText {
  return CODEX_TEXT[language];
}
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
    language:
      settings?.language === 'it' || settings?.language === 'en'
        ? settings.language
        : DEFAULT_AI_SETTINGS.language,
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

function fallbackTransform(
  action: CodexTransformAction,
  sourceText: string,
  language: MainLanguage,
): string {
  const normalized = compactWhitespace(sourceText);
  const text = getCodexText(language);
  if (!normalized) {
    return sourceText;
  }

  if (action === 'correggi') {
    const first = normalized.charAt(0).toUpperCase() + normalized.slice(1);
    return first.replace(/\s+([,.;!?])/g, '$1');
  }

  if (action === 'riscrivi') {
    return `${text.rewrittenVersion}:\n${normalized}`;
  }

  if (action === 'espandi') {
    return `${normalized}\n\n${text.additionalDetail}`;
  }

  return normalized.length > 160 ? `${normalized.slice(0, 157).trim()}...` : normalized;
}

function fallbackChatResponse(
  message: string,
  error: string | undefined,
  language: MainLanguage,
): string {
  const clean = compactWhitespace(message);
  const text = getCodexText(language);

  return [
    text.fallbackUnavailable,
    `${text.fallbackReceived}: "${clean}".`,
    error ? `${text.fallbackTechnicalDetail}: ${error}` : null,
    text.fallbackSuggestion,
  ]
    .filter(Boolean)
    .join('\n');
}

function buildTransformPrompt(
  request: CodexTransformRequest,
  language: MainLanguage = DEFAULT_AI_SETTINGS.language,
): string {
  const fullContext = (request.chapterText ?? '').trim();
  const text = getCodexText(language);

  return [
    text.transformEditor,
    `${text.requestAction}: ${request.action}.`,
    request.projectName ? `${text.project}: ${request.projectName}` : null,
    request.chapterTitle ? `${text.transformChapter}: ${request.chapterTitle}` : null,
    fullContext ? `${text.transformContext}:\n${fullContext.slice(0, 8000)}` : null,
    `${text.selectedText}:`,
    request.selectedText,
    text.transformInstruction,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildChatPrompt(
  request: CodexChatRequest,
  language: MainLanguage = DEFAULT_AI_SETTINGS.language,
): string {
  const chapterContext = (request.chapterText ?? '').trim();
  const projectMemoryContext = (request.projectMemoryContext ?? '').trim();
  const text = getCodexText(language);

  return [
    text.chatAssistant,
    request.projectName ? `${text.chatProject}: ${request.projectName}` : null,
    request.chapterTitle ? `${text.chatChapter}: ${request.chapterTitle}` : null,
    chapterContext ? `${text.chatExcerpt}:\n${chapterContext.slice(0, 8000)}` : null,
    projectMemoryContext ? `${text.chatMemory}:\n${projectMemoryContext}` : null,
    projectMemoryContext ? text.chatMemoryRules : null,
    `${text.chatUserRequest}:\n${request.message}`,
    text.chatReplyInstruction,
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
  language: MainLanguage,
  signal?: AbortSignal,
): Promise<CodexResult> {
  const labels = getCodexText(language);
  if (signal?.aborted) {
    return {
      output: '',
      mode: 'fallback',
      error: labels.cancelled,
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
        error: `OpenAI API ${labels.noAvailableText}`,
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
        error: labels.cancelled,
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
  language: MainLanguage,
  signal?: AbortSignal,
): Promise<CodexResult> {
  const labels = getCodexText(language);
  if (signal?.aborted) {
    return {
      output: '',
      mode: 'fallback',
      error: labels.cancelled,
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
        error: `Ollama ${labels.noAvailableText}`,
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
        error: labels.cancelled,
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
  language: MainLanguage,
  model?: string,
): Promise<{ available: boolean; reason?: string }> {
  const baseUrl = resolveOllamaHost();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const labels = getCodexText(language);

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
          reason: `${labels.ollamaMissingModel}: ${model.trim()}. ${
            language === 'en' ? 'Available models' : 'Modelli disponibili'
          }: ${[...modelNames].join(', ') || labels.ollamaNoModels}.`,
        };
      }
    }
    return { available: true };
  } catch (error) {
    if (controller.signal.aborted) {
      return { available: false, reason: labels.ollamaTimeout };
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
  buildTransformPrompt,
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
      const labels = getCodexText(runtime.language);
      return this.toStatus(
        {
          ...fallbackProbe,
          reason: `${labels.primaryUnavailable}: ${primaryProbe.reason ?? labels.unknownError}.`,
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
    const labels = getCodexText(runtime.language);
    if (provider === 'openai_api') {
      if (!runtime.allowApiCalls) {
        return {
          available: false,
          command: 'OpenAI API',
          mode: 'fallback',
          reason: labels.openAiDisabled,
        };
      }

      const apiKey = runtime.apiKey?.trim() || process.env['OPENAI_API_KEY']?.trim();
      if (!apiKey) {
        return {
          available: false,
          command: 'OpenAI API',
          mode: 'fallback',
          reason: labels.apiKeyMissing,
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
          reason: labels.ollamaDisabled,
        };
      }

      const probe = await probeOllama(
        Math.min(this.timeoutMs, 10_000),
        runtime.language,
        runtime.ollamaModel,
      );
      return {
        available: probe.available,
        command: `ollama@${resolveOllamaHost()} ${runtime.ollamaModel}`,
        mode: probe.available ? 'api' : 'fallback',
        reason: probe.available
          ? undefined
          : (probe.reason ??
            (runtime.language === 'en' ? 'Ollama unreachable' : 'Ollama non raggiungibile')),
      };
    }

    return {
      available: false,
      command: String(provider),
      mode: 'fallback',
      reason: labels.providerUnsupported,
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
    const runtime = normalizeSettings(settings);
    const prompt = buildTransformPrompt(request, runtime.language);
    return this.enqueuePrompt(prompt, runtime, (error) => ({
      output: fallbackTransform(request.action, request.selectedText, runtime.language),
      mode: 'fallback',
      usedCommand: 'fallback',
      error,
    }));
  }

  async chat(
    request: CodexChatRequest,
    settings?: Partial<CodexRuntimeSettings>,
  ): Promise<CodexResult> {
    const runtime = normalizeSettings(settings);
    const prompt = buildChatPrompt(request, runtime.language);
    return this.enqueuePrompt(prompt, runtime, (error) => ({
      output: fallbackChatResponse(request.message, error, runtime.language),
      mode: 'fallback',
      usedCommand: 'fallback',
      error,
    }));
  }

  private enqueuePrompt(
    prompt: string,
    runtime: CodexRuntimeSettings,
    fallbackBuilder: (error?: string) => CodexResult,
  ): Promise<CodexResult> {
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
    const labels = getCodexText(runtime.language);
    if (provider === 'openai_api') {
      if (!runtime.allowApiCalls) {
        return {
          output: '',
          mode: 'fallback',
          usedCommand: 'openai_api',
          error: labels.apiCallsDisabled,
        };
      }

      const apiKey = runtime.apiKey?.trim() || process.env['OPENAI_API_KEY']?.trim() || '';
      if (!apiKey) {
        return {
          output: '',
          mode: 'fallback',
          usedCommand: 'openai_api',
          error: labels.apiKeyMissing,
        };
      }

      return runOpenAiApi(
        apiKey,
        runtime.apiModel,
        prompt,
        runtime.timeoutMs,
        runtime.language,
        signal,
      );
    }

    if (provider === 'ollama') {
      if (!runtime.allowApiCalls) {
        return {
          output: '',
          mode: 'fallback',
          usedCommand: 'ollama',
          error: labels.apiCallsDisabled,
        };
      }

      return runOllamaApi(runtime.ollamaModel, prompt, runtime.timeoutMs, runtime.language, signal);
    }

    return {
      output: '',
      mode: 'fallback',
      usedCommand: String(provider),
      error: labels.providerUnsupported,
    };
  }
}
