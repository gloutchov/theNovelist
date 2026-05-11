import {
  CodexCliService,
  type CodexResult,
  type CodexStatus,
  type CodexTransformAction,
  type AiFallbackProvider,
  type AiProvider,
} from '../codex/client';
import type { CodexChatMessageRecord } from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import {
  clearStoredCodexApiKey,
  isSecureStorageAvailable,
  setStoredCodexApiKey,
} from '../security/secure-settings';
import type { ProjectWikiSearchResult } from '../wiki/search';
import {
  resolveCodexRuntime,
  shouldAttachProjectMemoryForSettings,
  toCodexSettingsResponse,
  type CodexSettingsView,
} from './codex-runtime';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';

export interface UpdateCodexSettingsInput {
  enabled?: boolean;
  provider?: AiProvider;
  fallbackProvider?: AiFallbackProvider;
  allowApiCalls?: boolean;
  allowExternalMemorySharing?: boolean;
  autoSummarizeDescriptions?: boolean;
  apiKey?: string | null;
  clearStoredApiKey?: boolean;
  apiModel?: string;
  apiImageModel?: string;
  ollamaModel?: string;
}

export interface CodexAssistInput {
  message: string;
  context?: string;
  projectName?: string;
  timeoutMs?: number;
}

export interface CodexTransformSelectionInput {
  action: CodexTransformAction;
  selectedText: string;
  chapterTitle?: string;
  projectName?: string;
  chapterText?: string;
}

export interface CodexChatInput {
  message: string;
  chapterNodeId: string;
  chapterTitle?: string;
  projectName?: string;
  chapterText?: string;
}

export interface CodexChatHistoryInput {
  chapterNodeId: string;
  limit?: number;
}

export interface CodexChatResult extends CodexResult {
  memorySources: ProjectWikiSearchResult[];
}

export class CodexApplicationService {
  constructor(
    private readonly sessionManager: ProjectSessionManager,
    private readonly codexService: CodexCliService,
  ) {}

  async getStatus(): Promise<CodexStatus> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const workspaceRoot = this.sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;

    return this.codexService.getStatus(
      {
        provider: settings.provider,
        fallbackProvider: settings.fallbackProvider,
        allowApiCalls: settings.allowApiCalls,
        apiKey: runtime.runtimeApiKey,
        apiModel: settings.apiModel,
        ollamaModel: settings.ollamaModel,
      },
      workspaceRoot,
    );
  }

  async getSettings(): Promise<CodexSettingsView> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const resolved = await resolveCodexRuntime(repository, projectId);
    return toCodexSettingsResponse(resolved);
  }

  async updateSettings(input: UpdateCodexSettingsInput): Promise<CodexSettingsView> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const runtime = await resolveCodexRuntime(repository, projectId);
    const shouldClearStoredApiKey = input.clearStoredApiKey === true || input.apiKey === null;
    const nextApiKey = input.apiKey?.trim() ?? '';

    if (input.clearStoredApiKey && nextApiKey) {
      throw new Error(
        'Configurazione API key non valida: non puoi impostare e cancellare la chiave insieme.',
      );
    }

    if (shouldClearStoredApiKey) {
      await clearStoredCodexApiKey(projectId);
    } else if (input.apiKey !== undefined) {
      if (!nextApiKey) {
        await clearStoredCodexApiKey(projectId);
      } else {
        await setStoredCodexApiKey(projectId, nextApiKey);
      }
    }

    const preserveLegacyApiKey =
      runtime.apiKeyStorage === 'legacy_db' &&
      !isSecureStorageAvailable() &&
      !shouldClearStoredApiKey;
    const updated = repository.upsertCodexSettings(projectId, {
      enabled: input.enabled,
      provider: input.provider,
      fallbackProvider: input.fallbackProvider,
      allowApiCalls: input.allowApiCalls,
      allowExternalMemorySharing: input.allowExternalMemorySharing,
      autoSummarizeDescriptions: input.autoSummarizeDescriptions,
      apiKey: preserveLegacyApiKey ? runtime.settings.apiKey : null,
      apiModel: input.apiModel,
      apiImageModel: input.apiImageModel,
      ollamaModel: input.ollamaModel,
    });

    const resolved = await resolveCodexRuntime(repository, projectId);
    return toCodexSettingsResponse({
      ...resolved,
      settings: updated,
    });
  }

  async assist(input: CodexAssistInput): Promise<CodexResult> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const workspaceRoot = this.sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;
    if (!settings.enabled) {
      throw new Error('Consenso Codex non abilitato per questo progetto.');
    }

    const message = input.context
      ? `${input.message}\n\nContesto:\n${input.context}`
      : input.message;
    return this.codexService.chat(
      {
        message,
        projectName: input.projectName,
        workspaceRoot,
      },
      {
        provider: settings.provider,
        fallbackProvider: settings.fallbackProvider,
        allowApiCalls: settings.allowApiCalls,
        apiKey: runtime.runtimeApiKey,
        apiModel: settings.apiModel,
        ollamaModel: settings.ollamaModel,
        timeoutMs: input.timeoutMs,
      },
    );
  }

  async transformSelection(input: CodexTransformSelectionInput): Promise<CodexResult> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const workspaceRoot = this.sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;
    if (!settings.enabled) {
      throw new Error('Consenso Codex non abilitato per questo progetto.');
    }

    return this.codexService.transformSelection(
      {
        action: input.action,
        selectedText: input.selectedText,
        chapterTitle: input.chapterTitle,
        projectName: input.projectName,
        chapterText: input.chapterText,
        workspaceRoot,
      },
      {
        provider: settings.provider,
        fallbackProvider: settings.fallbackProvider,
        allowApiCalls: settings.allowApiCalls,
        apiKey: runtime.runtimeApiKey,
        apiModel: settings.apiModel,
        ollamaModel: settings.ollamaModel,
      },
    );
  }

  async chat(input: CodexChatInput): Promise<CodexChatResult> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const workspaceRoot = this.sessionManager.getOpenedProject()?.rootPath;
    const runtime = await resolveCodexRuntime(repository, projectId);
    const settings = runtime.settings;
    if (!settings.enabled) {
      throw new Error('Consenso Codex non abilitato per questo progetto.');
    }

    const node = repository.getChapterNodeById(input.chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    let projectMemoryContext = '';
    let memorySources: ProjectWikiSearchResult[] = [];
    if (shouldAttachProjectMemoryForSettings(settings)) {
      try {
        const memory = await this.sessionManager.buildProjectMemoryContext({
          query: input.message,
          limit: 6,
        });
        projectMemoryContext = memory.content;
        memorySources = memory.results;
      } catch {
        projectMemoryContext = '';
        memorySources = [];
      }
    }

    const result = await this.codexService.chat(
      {
        message: input.message,
        chapterTitle: input.chapterTitle,
        projectName: input.projectName,
        chapterText: input.chapterText,
        projectMemoryContext,
        workspaceRoot,
      },
      {
        provider: settings.provider,
        fallbackProvider: settings.fallbackProvider,
        allowApiCalls: settings.allowApiCalls,
        apiKey: runtime.runtimeApiKey,
        apiModel: settings.apiModel,
        ollamaModel: settings.ollamaModel,
      },
    );

    if (!result.cancelled && result.output.trim()) {
      repository.appendCodexChatMessage(projectId, {
        chapterNodeId: input.chapterNodeId,
        role: 'user',
        content: input.message,
      });
      repository.appendCodexChatMessage(projectId, {
        chapterNodeId: input.chapterNodeId,
        role: 'assistant',
        content: result.output,
        mode: result.mode === 'api' ? null : result.mode,
      });
      await syncProjectWikiSourcesBestEffort(this.sessionManager);
    }

    return {
      ...result,
      memorySources,
    };
  }

  getChatHistory(input: CodexChatHistoryInput): CodexChatMessageRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const node = repository.getChapterNodeById(input.chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    return repository.listCodexChatMessages(projectId, input.chapterNodeId, input.limit ?? 100);
  }

  cancelActiveRequest(): boolean {
    return this.codexService.cancelActiveRequest();
  }
}
