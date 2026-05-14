import type {
  CodexChatMessageRecord,
  CodexSettingsRecord,
  CharacterCardRecord,
  CharacterChapterLinkRecord,
  CharacterImageRecord,
  ChapterDocumentRecord,
  ChapterNodeRecord,
  EntityRevisionRecord,
  LocationCardRecord,
  LocationChapterLinkRecord,
  LocationImageRecord,
  PlotRecord,
  ProjectRecord,
  SceneCardRecord,
  StoryEdgeRecord,
  TimelineItemRecord,
  TimelineItemType,
  TimelineSettingsRecord,
  WritingSessionRecord,
} from '../types';
import { APP_CONFIG } from '../../config/app-config';

export function nowIso(): string {
  return new Date().toISOString();
}

export function toCodexSettingsRecord(row: Record<string, unknown>): CodexSettingsRecord {
  const provider = row.provider;
  const fallbackProvider = row.fallback_provider;
  const apiModel = row.api_model;
  const apiImageModel = row.api_image_model;
  const ollamaModel = row.ollama_model;
  const normalizedProvider =
    provider === 'openai_api' || provider === 'ollama' ? provider : APP_CONFIG.ai.defaultProvider;
  const normalizedFallbackProvider =
    fallbackProvider === 'openai_api' || fallbackProvider === 'ollama'
      ? fallbackProvider
      : 'none';

  return {
    projectId: String(row.project_id),
    enabled: Number(row.enabled) === 1,
    provider: normalizedProvider,
    fallbackProvider:
      normalizedFallbackProvider === normalizedProvider ? 'none' : normalizedFallbackProvider,
    allowApiCalls: Number(row.allow_api_calls ?? 0) === 1,
    allowExternalMemorySharing:
      Number(
        row.allow_external_memory_sharing ??
          (APP_CONFIG.ai.allowExternalMemorySharingByDefault ? 1 : 0),
      ) === 1,
    autoSummarizeDescriptions: Number(row.auto_summarize_descriptions ?? 1) === 1,
    apiKey: row.api_key === null || row.api_key === undefined ? null : String(row.api_key),
    apiModel:
      typeof apiModel === 'string' && apiModel.trim() ? apiModel : APP_CONFIG.ai.defaultApiModel,
    apiImageModel:
      typeof apiImageModel === 'string' && apiImageModel.trim()
        ? apiImageModel
        : APP_CONFIG.ai.defaultImageModel,
    ollamaModel:
      typeof ollamaModel === 'string' && ollamaModel.trim()
        ? ollamaModel
        : APP_CONFIG.ai.defaultOllamaModel,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toCodexChatMessageRecord(row: Record<string, unknown>): CodexChatMessageRecord {
  const mode = row.mode;

  return {
    id: String(row.id),
    projectId: String(row.project_id),
    chapterNodeId: String(row.chapter_node_id),
    role: String(row.role) as CodexChatMessageRecord['role'],
    content: String(row.content),
    mode: mode === null ? null : (String(mode) as CodexChatMessageRecord['mode']),
    createdAt: String(row.created_at),
  };
}

export function toProjectRecord(row: Record<string, unknown>): ProjectRecord {
  return {
    id: String(row.id),
    name: String(row.name),
    rootPath: String(row.root_path),
    targetWordCount:
      row.target_word_count === null || row.target_word_count === undefined
        ? null
        : Number(row.target_word_count),
    targetChapterWordCount:
      row.target_chapter_word_count === null || row.target_chapter_word_count === undefined
        ? null
        : Number(row.target_chapter_word_count),
    plannedCompletionDate:
      row.planned_completion_date === null || row.planned_completion_date === undefined
        ? null
        : String(row.planned_completion_date),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toWritingSessionRecord(row: Record<string, unknown>): WritingSessionRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    chapterNodeId: String(row.chapter_node_id),
    wordDelta: Number(row.word_delta),
    wordCount: Number(row.word_count),
    createdAt: String(row.created_at),
  };
}

export function toPlotRecord(row: Record<string, unknown>): PlotRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    number: Number(row.number),
    label: String(row.label),
    summary: String(row.summary ?? ''),
    color: String(row.color),
    positionX: Number(row.position_x ?? 120),
    positionY: Number(row.position_y ?? 120),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toChapterNodeRecord(row: Record<string, unknown>): ChapterNodeRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    description: String(row.description),
    plotNumber: Number(row.plot_number),
    blockNumber: Number(row.block_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    richTextDocId: row.rich_text_doc_id ? String(row.rich_text_doc_id) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toStoryEdgeRecord(row: Record<string, unknown>): StoryEdgeRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    sourceId: String(row.source_id),
    targetId: String(row.target_id),
    sourceHandle: row.source_handle ? String(row.source_handle) : null,
    targetHandle: row.target_handle ? String(row.target_handle) : null,
    label: row.label ? String(row.label) : null,
    createdAt: String(row.created_at),
  };
}

export function toChapterDocumentRecord(row: Record<string, unknown>): ChapterDocumentRecord {
  return {
    id: String(row.id),
    chapterNodeId: String(row.chapter_node_id),
    contentJson: String(row.content_json),
    wordCount: Number(row.word_count),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toCharacterCardRecord(row: Record<string, unknown>): CharacterCardRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    firstName: String(row.first_name),
    lastName: String(row.last_name),
    sex: String(row.sex),
    age: row.age === null ? null : Number(row.age),
    sexualOrientation: String(row.sexual_orientation),
    species: String(row.species),
    hairColor: String(row.hair_color),
    eyeColor: String(row.eye_color ?? ''),
    skinColor: String(row.skin_color ?? ''),
    bald: Number(row.bald) === 1,
    beard: String(row.beard),
    physique: String(row.physique),
    job: String(row.job),
    notes: String(row.notes),
    plotNumber: Number(row.plot_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toCharacterImageRecord(row: Record<string, unknown>): CharacterImageRecord {
  return {
    id: String(row.id),
    characterCardId: String(row.character_card_id),
    imageType: String(row.image_type),
    filePath: String(row.file_path),
    prompt: String(row.prompt),
    createdAt: String(row.created_at),
  };
}

export function toCharacterChapterLinkRecord(
  row: Record<string, unknown>,
): CharacterChapterLinkRecord {
  return {
    characterCardId: String(row.character_card_id),
    chapterNodeId: String(row.chapter_node_id),
    createdAt: String(row.created_at),
  };
}

export function toLocationCardRecord(row: Record<string, unknown>): LocationCardRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    locationType: String(row.location_type),
    description: String(row.description),
    notes: String(row.notes),
    plotNumber: Number(row.plot_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toLocationImageRecord(row: Record<string, unknown>): LocationImageRecord {
  return {
    id: String(row.id),
    locationCardId: String(row.location_card_id),
    imageType: String(row.image_type),
    filePath: String(row.file_path),
    prompt: String(row.prompt),
    createdAt: String(row.created_at),
  };
}

export function toLocationChapterLinkRecord(
  row: Record<string, unknown>,
): LocationChapterLinkRecord {
  return {
    locationCardId: String(row.location_card_id),
    chapterNodeId: String(row.chapter_node_id),
    createdAt: String(row.created_at),
  };
}

export function toSceneCardRecord(row: Record<string, unknown>): SceneCardRecord {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    chapterNodeId: String(row.chapter_node_id),
    name: String(row.name),
    text: String(row.text),
    contentJson: typeof row.content_json === 'string' ? row.content_json : null,
    notes: String(row.notes),
    plotNumber: Number(row.plot_number),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toTimelineSettingsRecord(row: Record<string, unknown>): TimelineSettingsRecord {
  return {
    projectId: String(row.project_id),
    startLabel: String(row.start_label ?? ''),
    endLabel: String(row.end_label ?? ''),
    timelineEndX: Number(row.timeline_end_x ?? 1148),
    updatedAt: String(row.updated_at),
  };
}

export function toTimelineItemRecord(row: Record<string, unknown>): TimelineItemRecord {
  const itemType = String(row.item_type);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    itemType: (itemType === 'scene' ? 'scene' : 'chapter') as TimelineItemType,
    entityId: String(row.entity_id),
    positionX: Number(row.position_x),
    positionY: Number(row.position_y),
    dateLabel: String(row.date_label ?? ''),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function toEntityRevisionRecord(row: Record<string, unknown>): EntityRevisionRecord {
  const entityType = String(row.entity_type);
  const reason = String(row.reason);
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    entityType:
      entityType === 'scene' || entityType === 'character' || entityType === 'location'
        ? entityType
        : 'chapter',
    entityId: String(row.entity_id),
    label: row.label === null || row.label === undefined ? null : String(row.label),
    reason: reason === 'manual' || reason === 'restore' ? reason : 'auto',
    snapshotJson: String(row.snapshot_json),
    textContent: String(row.text_content),
    createdAt: String(row.created_at),
  };
}
