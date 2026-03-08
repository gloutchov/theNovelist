import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type CodexTransformAction = 'correggi' | 'riscrivi' | 'espandi' | 'riduci';
export type AiProvider = 'codex_cli' | 'openai_api' | 'ollama';

export interface CodexRuntimeSettings {
  provider: AiProvider;
  allowApiCalls: boolean;
  apiKey: string | null;
  apiModel: string;
}

export interface CodexStatus {
  available: boolean;
  command: string;
  mode: 'cli' | 'api' | 'fallback';
  reason?: string;
  activeRequest: boolean;
  queuedRequests: number;
  provider: AiProvider;
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

const DEFAULT_AI_SETTINGS: CodexRuntimeSettings = {
  provider: 'codex_cli',
  allowApiCalls: false,
  apiKey: null,
  apiModel: 'gpt-5-mini',
};

function normalizeSettings(settings?: Partial<CodexRuntimeSettings>): CodexRuntimeSettings {
  return {
    provider:
      settings?.provider === 'openai_api' || settings?.provider === 'ollama'
        ? settings.provider
        : 'codex_cli',
    allowApiCalls: Boolean(settings?.allowApiCalls),
    apiKey: settings?.apiKey ?? null,
    apiModel: settings?.apiModel?.trim() || DEFAULT_AI_SETTINGS.apiModel,
  };
}

function resolveCommandName(): string {
  return process.env['NOVELIST_CODEX_COMMAND']?.trim() || 'codex';
}

function resolveTimeoutMs(): number {
  const value = Number(process.env['NOVELIST_CODEX_TIMEOUT_MS'] ?? '45000');
  if (!Number.isFinite(value) || value < 1000) {
    return 45000;
  }
  return value;
}

function resolveOllamaHost(): string {
  return (process.env['OLLAMA_HOST']?.trim() || 'http://127.0.0.1:11434').replace(/\/+$/g, '');
}

function compactWhitespace(text: string): string {
  return text.replace(/[ \t]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim();
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

function fallbackChatResponse(message: string): string {
  const clean = compactWhitespace(message);

  return [
    'Modalita fallback locale attiva: AI non raggiungibile.',
    `Richiesta ricevuta: "${clean}".`,
    'Suggerimento: verifica impostazioni provider (Codex CLI, OpenAI API o Ollama).',
  ].join('\n');
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

  return [
    'Sei un assistente editoriale per romanzi e racconti.',
    request.projectName ? `Progetto: ${request.projectName}` : null,
    request.chapterTitle ? `Capitolo corrente: ${request.chapterTitle}` : null,
    chapterContext ? `Estratto capitolo:\n${chapterContext.slice(0, 8000)}` : null,
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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = (): void => controller.abort();
  signal?.addEventListener('abort', abortHandler, { once: true });

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
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
      error: error instanceof Error ? error.message : 'Errore OpenAI API',
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortHandler);
  }
}

interface OllamaGenerateResponse {
  response?: string;
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
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abortHandler = (): void => controller.abort();
  signal?.addEventListener('abort', abortHandler, { once: true });
  const baseUrl = resolveOllamaHost();

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
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

    const payload = (await response.json()) as OllamaGenerateResponse;
    if (payload.error?.trim()) {
      return {
        output: '',
        mode: 'fallback',
        error: `Ollama error: ${payload.error.trim()}`,
      };
    }

    const text = payload.response?.trim() ?? '';
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
      error: error instanceof Error ? error.message : 'Errore Ollama API',
    };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abortHandler);
  }
}

async function probeOllama(timeoutMs: number): Promise<{ available: boolean; reason?: string }> {
  const baseUrl = resolveOllamaHost();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}/api/tags`, {
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
    return { available: true };
  } catch (error) {
    if (controller.signal.aborted) {
      return { available: false, reason: 'Timeout connessione Ollama' };
    }
    return {
      available: false,
      reason: error instanceof Error ? error.message : 'Errore connessione Ollama',
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

      const child = spawn(commandName, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: process.env,
        cwd: options?.cwd?.trim() || process.cwd(),
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

export class CodexCliService {
  private readonly commandName = resolveCommandName();
  private readonly timeoutMs = resolveTimeoutMs();
  private queue: Promise<void> = Promise.resolve();
  private queuedRequests = 0;
  private nextRequestId = 1;
  private activeRequest: ActiveRequest | null = null;

  async getStatus(settings?: Partial<CodexRuntimeSettings>, workspaceRoot?: string): Promise<CodexStatus> {
    const runtime = normalizeSettings(settings);
    if (runtime.provider === 'openai_api' && runtime.allowApiCalls) {
      const apiKey = runtime.apiKey?.trim() || process.env['OPENAI_API_KEY']?.trim();
      if (apiKey) {
        return {
          available: true,
          command: this.commandName,
          mode: 'api',
          activeRequest: this.activeRequest !== null,
          queuedRequests: this.queuedRequests,
          provider: runtime.provider,
          apiCallsEnabled: true,
        };
      }

      return {
        available: false,
        command: this.commandName,
        mode: 'fallback',
        reason: 'API key mancante: configura OPENAI_API_KEY o la chiave in Impostazioni AI.',
        activeRequest: this.activeRequest !== null,
        queuedRequests: this.queuedRequests,
        provider: runtime.provider,
        apiCallsEnabled: true,
      };
    }

    if (runtime.provider === 'ollama') {
      if (!runtime.allowApiCalls) {
        return {
          available: false,
          command: 'ollama',
          mode: 'fallback',
          reason: 'Abilita "chiamate API esterne" nelle Impostazioni AI per usare Ollama.',
          activeRequest: this.activeRequest !== null,
          queuedRequests: this.queuedRequests,
          provider: runtime.provider,
          apiCallsEnabled: false,
        };
      }

      const probe = await probeOllama(Math.min(this.timeoutMs, 10_000));
      if (probe.available) {
        return {
          available: true,
          command: `ollama@${resolveOllamaHost()}`,
          mode: 'api',
          activeRequest: this.activeRequest !== null,
          queuedRequests: this.queuedRequests,
          provider: runtime.provider,
          apiCallsEnabled: true,
        };
      }

      return {
        available: false,
        command: `ollama@${resolveOllamaHost()}`,
        mode: 'fallback',
        reason: probe.reason ?? 'Ollama non raggiungibile',
        activeRequest: this.activeRequest !== null,
        queuedRequests: this.queuedRequests,
        provider: runtime.provider,
        apiCallsEnabled: true,
      };
    }

    const probe = await runCodexCli(
      this.commandName,
      'Rispondi solo con: ok',
      Math.min(this.timeoutMs, 10_000),
      {
        cwd: workspaceRoot,
      },
    );

    if (probe.mode === 'cli') {
      return {
        available: true,
        command: this.commandName,
        mode: 'cli',
        activeRequest: this.activeRequest !== null,
        queuedRequests: this.queuedRequests,
        provider: runtime.provider,
        apiCallsEnabled: runtime.allowApiCalls,
      };
    }

    return {
      available: false,
      command: this.commandName,
      mode: 'fallback',
      reason: probe.error ?? 'Codex CLI non raggiungibile',
      activeRequest: this.activeRequest !== null,
      queuedRequests: this.queuedRequests,
      provider: runtime.provider,
      apiCallsEnabled: runtime.allowApiCalls,
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

  async chat(request: CodexChatRequest, settings?: Partial<CodexRuntimeSettings>): Promise<CodexResult> {
    const prompt = buildChatPrompt(request);
    return this.enqueuePrompt(prompt, request.workspaceRoot, settings, (error) => ({
      output: fallbackChatResponse(request.message),
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
        const apiKey = runtime.apiKey?.trim() || process.env['OPENAI_API_KEY']?.trim() || '';
        const shouldTryApi = runtime.provider === 'openai_api' && runtime.allowApiCalls && Boolean(apiKey);
        const shouldTryOllama = runtime.provider === 'ollama' && runtime.allowApiCalls;

        if (shouldTryApi) {
          const apiResult = await runOpenAiApi(
            apiKey,
            runtime.apiModel,
            prompt,
            this.timeoutMs,
            abortController.signal,
          );
          if (apiResult.mode === 'api' && apiResult.output.trim()) {
            return apiResult;
          }
          if (apiResult.cancelled) {
            return apiResult;
          }

          const cliFallback = await runCodexCli(
            this.commandName,
            prompt,
            this.timeoutMs,
            {
              cwd: workspaceRoot,
            },
            abortController.signal,
          );
          if (cliFallback.mode === 'cli' && cliFallback.output.trim()) {
            return cliFallback;
          }
          if (cliFallback.cancelled) {
            return cliFallback;
          }

          return fallbackBuilder(apiResult.error ?? cliFallback.error);
        }

        if (shouldTryOllama) {
          const ollamaResult = await runOllamaApi(
            runtime.apiModel,
            prompt,
            this.timeoutMs,
            abortController.signal,
          );
          if (ollamaResult.mode === 'api' && ollamaResult.output.trim()) {
            return ollamaResult;
          }
          if (ollamaResult.cancelled) {
            return ollamaResult;
          }

          const cliFallback = await runCodexCli(
            this.commandName,
            prompt,
            this.timeoutMs,
            {
              cwd: workspaceRoot,
            },
            abortController.signal,
          );
          if (cliFallback.mode === 'cli' && cliFallback.output.trim()) {
            return cliFallback;
          }
          if (cliFallback.cancelled) {
            return cliFallback;
          }

          return fallbackBuilder(ollamaResult.error ?? cliFallback.error);
        }

        const cliResult = await runCodexCli(
          this.commandName,
          prompt,
          this.timeoutMs,
          {
            cwd: workspaceRoot,
          },
          abortController.signal,
        );
        if (cliResult.mode === 'cli' && cliResult.output.trim()) {
          return cliResult;
        }
        if (cliResult.cancelled) {
          return cliResult;
        }

        return fallbackBuilder(cliResult.error);
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
}
