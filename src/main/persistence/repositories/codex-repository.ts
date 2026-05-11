import { randomUUID } from 'node:crypto';
import type Database from 'better-sqlite3';
import { APP_CONFIG } from '../../config/app-config';
import type {
  CodexChatMessageRecord,
  CodexSettingsRecord,
  CreateCodexChatMessageInput,
  UpsertCodexSettingsInput,
} from '../types';
import { nowIso, toCodexChatMessageRecord, toCodexSettingsRecord } from './shared';

export class CodexRepository {
  constructor(private readonly db: Database.Database) {}

  getOrCreateCodexSettings(projectId: string): CodexSettingsRecord {
    const existing = this.db
      .prepare('SELECT * FROM codex_settings WHERE project_id = ?')
      .get(projectId) as Record<string, unknown> | undefined;

    if (existing) {
      return toCodexSettingsRecord(existing);
    }

    const timestamp = nowIso();
    this.db
      .prepare(
        `
        INSERT INTO codex_settings(
          project_id,
          enabled,
          provider,
          fallback_provider,
          allow_api_calls,
          allow_external_memory_sharing,
          auto_summarize_descriptions,
          api_key,
          api_model,
          api_image_model,
          ollama_model,
          created_at,
          updated_at
        )
        VALUES (
          @projectId,
          @enabled,
          @provider,
          @fallbackProvider,
          @allowApiCalls,
          @allowExternalMemorySharing,
          @autoSummarizeDescriptions,
          NULL,
          @apiModel,
          @apiImageModel,
          @ollamaModel,
          @createdAt,
          @updatedAt
        )
        `,
      )
      .run({
        projectId,
        enabled: APP_CONFIG.ai.enabledByDefault ? 1 : 0,
        provider: APP_CONFIG.ai.defaultProvider,
        fallbackProvider: APP_CONFIG.ai.defaultFallbackProvider,
        allowApiCalls: APP_CONFIG.ai.allowApiCallsByDefault ? 1 : 0,
        allowExternalMemorySharing: APP_CONFIG.ai.allowExternalMemorySharingByDefault ? 1 : 0,
        autoSummarizeDescriptions: APP_CONFIG.ai.autoSummarizeDescriptionsByDefault ? 1 : 0,
        apiModel: APP_CONFIG.ai.defaultApiModel,
        apiImageModel: APP_CONFIG.ai.defaultImageModel,
        ollamaModel: APP_CONFIG.ai.defaultOllamaModel,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    const created = this.db
      .prepare('SELECT * FROM codex_settings WHERE project_id = ?')
      .get(projectId) as Record<string, unknown> | undefined;

    if (!created) {
      throw new Error('Codex settings creation failed');
    }

    return toCodexSettingsRecord(created);
  }

  upsertCodexSettings(projectId: string, input: UpsertCodexSettingsInput): CodexSettingsRecord {
    const current = this.getOrCreateCodexSettings(projectId);
    const next: CodexSettingsRecord = {
      ...current,
      enabled: input.enabled ?? current.enabled,
      provider: input.provider ?? current.provider,
      fallbackProvider: input.fallbackProvider ?? current.fallbackProvider,
      allowApiCalls: input.allowApiCalls ?? current.allowApiCalls,
      allowExternalMemorySharing:
        input.allowExternalMemorySharing ?? current.allowExternalMemorySharing,
      autoSummarizeDescriptions:
        input.autoSummarizeDescriptions ?? current.autoSummarizeDescriptions,
      apiKey: input.apiKey === undefined ? current.apiKey : input.apiKey,
      apiModel: input.apiModel?.trim() ? input.apiModel.trim() : current.apiModel,
      apiImageModel: input.apiImageModel?.trim()
        ? input.apiImageModel.trim()
        : current.apiImageModel,
      ollamaModel: input.ollamaModel?.trim() ? input.ollamaModel.trim() : current.ollamaModel,
      updatedAt: nowIso(),
    };
    if (next.fallbackProvider === next.provider) {
      next.fallbackProvider = 'none';
    }
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO codex_settings(
          project_id,
          enabled,
          provider,
          fallback_provider,
          allow_api_calls,
          allow_external_memory_sharing,
          auto_summarize_descriptions,
          api_key,
          api_model,
          api_image_model,
          ollama_model,
          created_at,
          updated_at
        )
        VALUES (
          @projectId,
          @enabled,
          @provider,
          @fallbackProvider,
          @allowApiCalls,
          @allowExternalMemorySharing,
          @autoSummarizeDescriptions,
          @apiKey,
          @apiModel,
          @apiImageModel,
          @ollamaModel,
          @createdAt,
          @updatedAt
        )
        ON CONFLICT(project_id) DO UPDATE SET
          enabled = excluded.enabled,
          provider = excluded.provider,
          fallback_provider = excluded.fallback_provider,
          allow_api_calls = excluded.allow_api_calls,
          allow_external_memory_sharing = excluded.allow_external_memory_sharing,
          auto_summarize_descriptions = excluded.auto_summarize_descriptions,
          api_key = excluded.api_key,
          api_model = excluded.api_model,
          api_image_model = excluded.api_image_model,
          ollama_model = excluded.ollama_model,
          updated_at = excluded.updated_at
        `,
      )
      .run({
        projectId,
        enabled: next.enabled ? 1 : 0,
        provider: next.provider,
        fallbackProvider: next.fallbackProvider,
        allowApiCalls: next.allowApiCalls ? 1 : 0,
        allowExternalMemorySharing: next.allowExternalMemorySharing ? 1 : 0,
        autoSummarizeDescriptions: next.autoSummarizeDescriptions ? 1 : 0,
        apiKey: next.apiKey,
        apiModel: next.apiModel,
        apiImageModel: next.apiImageModel,
        ollamaModel: next.ollamaModel,
        createdAt: timestamp,
        updatedAt: timestamp,
      });

    return this.getOrCreateCodexSettings(projectId);
  }

  appendCodexChatMessage(
    projectId: string,
    input: CreateCodexChatMessageInput,
  ): CodexChatMessageRecord {
    const id = randomUUID();
    const timestamp = nowIso();

    this.db
      .prepare(
        `
        INSERT INTO codex_chat_messages(id, project_id, chapter_node_id, role, content, mode, created_at)
        VALUES (@id, @projectId, @chapterNodeId, @role, @content, @mode, @createdAt)
        `,
      )
      .run({
        id,
        projectId,
        chapterNodeId: input.chapterNodeId,
        role: input.role,
        content: input.content,
        mode: input.mode ?? null,
        createdAt: timestamp,
      });

    const created = this.db.prepare('SELECT * FROM codex_chat_messages WHERE id = ?').get(id) as
      | Record<string, unknown>
      | undefined;

    if (!created) {
      throw new Error('Codex chat message creation failed');
    }

    return toCodexChatMessageRecord(created);
  }

  listCodexChatMessages(
    projectId: string,
    chapterNodeId: string,
    limit = 100,
  ): CodexChatMessageRecord[] {
    const safeLimit = Math.max(1, Math.min(limit, 500));
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM codex_chat_messages
        WHERE project_id = ? AND chapter_node_id = ?
        ORDER BY created_at DESC
        LIMIT ?
        `,
      )
      .all(projectId, chapterNodeId, safeLimit) as Record<string, unknown>[];

    return rows.reverse().map(toCodexChatMessageRecord);
  }

  listProjectCodexChatMessages(projectId: string): CodexChatMessageRecord[] {
    const rows = this.db
      .prepare(
        `
        SELECT *
        FROM codex_chat_messages
        WHERE project_id = ?
        ORDER BY created_at ASC, rowid ASC
        `,
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(toCodexChatMessageRecord);
  }
}
