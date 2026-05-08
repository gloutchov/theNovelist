import { createHash } from 'node:crypto';
import { rm } from 'node:fs/promises';
import path from 'node:path';
import type { NovelistRepository } from '../persistence/repository';
import type {
  ChapterNodeRecord,
  CharacterCardRecord,
  CodexChatMessageRecord,
  LocationCardRecord,
  PlotRecord,
  ProjectRecord,
  SceneCardRecord,
  TimelineItemRecord,
  TimelineSettingsRecord,
} from '../persistence/types';
import { extractRichTextBlocks, type RichTextDocument } from '../chapters/rich-text';
import { writeTextFileAtomic } from './atomic-write';
import { ensureProjectWiki } from './bootstrap';
import { readLastSyncState, writeLastSyncState } from './sync-state';
import type { ProjectWikiPaths } from './paths';

export interface WikiSourceExportResult {
  changed: boolean;
  changedSources: string[];
  sourceCount: number;
  derivedPending: boolean;
}

interface SourceFile {
  key: string;
  relativePath: string;
  content: string;
}

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

function sanitizeFilePart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? '').replace(/\r\n?/g, '\n').trim();
}

function parseRichTextDocument(contentJson: string | null | undefined): RichTextDocument {
  if (!contentJson) {
    return { type: 'doc', content: [] };
  }

  try {
    const parsed = JSON.parse(contentJson) as RichTextDocument;
    return parsed && typeof parsed === 'object' ? parsed : { type: 'doc', content: [] };
  } catch {
    return { type: 'doc', content: [] };
  }
}

function richTextDocumentToMarkdown(document: RichTextDocument): string {
  return extractRichTextBlocks(document)
    .map((block) => {
      const text = normalizeText(block.spans.map((span) => span.text).join(''));
      if (!text) {
        return '';
      }

      if (block.type === 'heading') {
        const level = Math.min(Math.max(block.level ?? 1, 1), 6);
        return `${'#'.repeat(level)} ${text}`;
      }

      if (block.type === 'blockquote') {
        return text
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n');
      }

      return text;
    })
    .filter(Boolean)
    .join('\n\n');
}

function characterDisplayName(card: CharacterCardRecord): string {
  return (
    [card.firstName, card.lastName]
      .filter((part) => part.trim())
      .join(' ')
      .trim() || card.id
  );
}

function formatList(items: string[]): string {
  if (items.length === 0) {
    return '- none';
  }

  return items.map((item) => `- ${item}`).join('\n');
}

function sourceRelativePathFromKey(key: string): string | null {
  if (/^chapters\/[a-z0-9_.-]+\.md$/.test(key)) {
    return path.join('sources', 'chapters', path.basename(key));
  }

  if (key === 'cards/characters.md') {
    return path.join('sources', 'cards', 'characters.md');
  }

  if (key === 'cards/locations.md') {
    return path.join('sources', 'cards', 'locations.md');
  }

  if (key === 'cards/scenes.md') {
    return path.join('sources', 'cards', 'scenes.md');
  }

  if (key === 'cards/plot.md') {
    return path.join('sources', 'cards', 'plot.md');
  }

  if (key === 'cards/timeline.md') {
    return path.join('sources', 'cards', 'timeline.md');
  }

  if (key === 'ai/chat.md') {
    return path.join('sources', 'ai', 'chat.md');
  }

  return null;
}

function formatChapterSource(params: {
  node: ChapterNodeRecord;
  text: string;
  characters: CharacterCardRecord[];
  locations: LocationCardRecord[];
}): string {
  const { node, text, characters, locations } = params;

  return [
    `# ${node.title}`,
    '',
    '## Metadata',
    '',
    `- source_type: chapter`,
    `- id: ${node.id}`,
    `- plot_number: ${node.plotNumber}`,
    `- block_number: ${node.blockNumber}`,
    `- updated_at: ${node.updatedAt}`,
    '',
    '## Description',
    '',
    normalizeText(node.description) || 'No description.',
    '',
    '## Linked Characters',
    '',
    formatList(characters.map((card) => `${characterDisplayName(card)} (${card.id})`)),
    '',
    '## Linked Locations',
    '',
    formatList(locations.map((card) => `${card.name} (${card.id})`)),
    '',
    '## Text',
    '',
    text || 'No chapter text.',
    '',
  ].join('\n');
}

function formatCharactersSource(
  repository: NovelistRepository,
  characters: CharacterCardRecord[],
): string {
  const sections = characters.map((card) => {
    const linkedChapterIds = repository
      .listCharacterChapterLinks(card.id)
      .map((link) => link.chapterNodeId);

    return [
      `## ${characterDisplayName(card)}`,
      '',
      `- id: ${card.id}`,
      `- plot_number: ${card.plotNumber}`,
      `- sex: ${card.sex || 'not set'}`,
      `- age: ${card.age ?? 'not set'}`,
      `- species: ${card.species || 'not set'}`,
      `- hair_color: ${card.hairColor || 'not set'}`,
      `- eye_color: ${card.eyeColor || 'not set'}`,
      `- skin_color: ${card.skinColor || 'not set'}`,
      `- job: ${card.job || 'not set'}`,
      `- updated_at: ${card.updatedAt}`,
      `- linked_chapters: ${linkedChapterIds.join(', ') || 'none'}`,
      '',
      'Notes:',
      '',
      normalizeText(card.notes) || 'No notes.',
      '',
    ].join('\n');
  });

  return ['# Character Sources', '', ...sections].join('\n');
}

function formatLocationsSource(
  repository: NovelistRepository,
  locations: LocationCardRecord[],
): string {
  const sections = locations.map((card) => {
    const linkedChapterIds = repository
      .listLocationChapterLinks(card.id)
      .map((link) => link.chapterNodeId);

    return [
      `## ${card.name}`,
      '',
      `- id: ${card.id}`,
      `- plot_number: ${card.plotNumber}`,
      `- type: ${card.locationType || 'not set'}`,
      `- updated_at: ${card.updatedAt}`,
      `- linked_chapters: ${linkedChapterIds.join(', ') || 'none'}`,
      '',
      'Description:',
      '',
      normalizeText(card.description) || 'No description.',
      '',
      'Notes:',
      '',
      normalizeText(card.notes) || 'No notes.',
      '',
    ].join('\n');
  });

  return ['# Location Sources', '', ...sections].join('\n');
}

function formatScenesSource(scenes: SceneCardRecord[], chapters: ChapterNodeRecord[]): string {
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const sections = scenes.map((scene) => {
    const chapter = chaptersById.get(scene.chapterNodeId);

    return [
      `## ${scene.name}`,
      '',
      `- id: ${scene.id}`,
      `- source_type: scene`,
      `- chapter_node_id: ${scene.chapterNodeId}`,
      `- chapter_title: ${chapter?.title ?? 'unknown'}`,
      `- plot_number: ${scene.plotNumber}`,
      `- updated_at: ${scene.updatedAt}`,
      '',
      'Text:',
      '',
      normalizeText(scene.text) || 'No scene text.',
      '',
      'Notes:',
      '',
      normalizeText(scene.notes) || 'No notes.',
      '',
    ].join('\n');
  });

  return ['# Scene Sources', '', ...sections].join('\n');
}

function formatPlotSource(plots: PlotRecord[], chapters: ChapterNodeRecord[]): string {
  const chaptersByPlot = new Map<number, ChapterNodeRecord[]>();
  for (const chapter of chapters) {
    const existing = chaptersByPlot.get(chapter.plotNumber) ?? [];
    existing.push(chapter);
    chaptersByPlot.set(chapter.plotNumber, existing);
  }

  const sections = plots.map((plot) => {
    const plotChapters = chaptersByPlot.get(plot.number) ?? [];

    return [
      `## Plot ${plot.number}: ${plot.label}`,
      '',
      `- id: ${plot.id}`,
      `- color: ${plot.color}`,
      `- updated_at: ${plot.updatedAt}`,
      '',
      'Summary:',
      '',
      normalizeText(plot.summary) || 'No summary.',
      '',
      'Chapters:',
      '',
      formatList(
        plotChapters.map(
          (chapter) => `${chapter.title} (${chapter.id}) - block ${chapter.blockNumber}`,
        ),
      ),
      '',
    ].join('\n');
  });

  return ['# Plot Sources', '', ...sections].join('\n');
}

function formatTimelineSource(params: {
  settings: TimelineSettingsRecord;
  items: TimelineItemRecord[];
  chapters: ChapterNodeRecord[];
  scenes: SceneCardRecord[];
  plots: PlotRecord[];
}): string {
  const { settings, items, chapters, scenes, plots } = params;
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const scenesById = new Map(scenes.map((scene) => [scene.id, scene]));
  const plotsByNumber = new Map(plots.map((plot) => [plot.number, plot]));
  const sections = [...items]
    .sort((left, right) => {
      if (left.positionX !== right.positionX) return left.positionX - right.positionX;
      if (left.positionY !== right.positionY) return left.positionY - right.positionY;
      return left.updatedAt.localeCompare(right.updatedAt);
    })
    .map((item, index) => {
      const chapter =
        item.itemType === 'chapter'
          ? chaptersById.get(item.entityId)
          : chaptersById.get(scenesById.get(item.entityId)?.chapterNodeId ?? '');
      const scene = item.itemType === 'scene' ? scenesById.get(item.entityId) : null;
      const plotNumber = scene?.plotNumber ?? chapter?.plotNumber ?? 0;
      const plot = plotsByNumber.get(plotNumber);
      const title = scene?.name ?? chapter?.title ?? item.entityId;

      return [
        `## ${index + 1}. ${title}`,
        '',
        `- id: ${item.id}`,
        `- source_type: timeline_item`,
        `- item_type: ${item.itemType}`,
        `- entity_id: ${item.entityId}`,
        `- title: ${title}`,
        `- date_label: ${normalizeText(item.dateLabel) || 'not set'}`,
        `- plot_number: ${plotNumber || 'unknown'}`,
        `- plot_label: ${plot?.label ?? 'unknown'}`,
        `- chapter_node_id: ${chapter?.id ?? 'unknown'}`,
        `- chapter_title: ${chapter?.title ?? 'unknown'}`,
        `- position_x: ${item.positionX}`,
        `- position_y: ${item.positionY}`,
        `- updated_at: ${item.updatedAt}`,
        '',
        scene
          ? `Scene text: ${normalizeText(scene.text) || 'No scene text.'}`
          : `Chapter description: ${normalizeText(chapter?.description) || 'No description.'}`,
        '',
      ].join('\n');
    });

  return [
    '# Timeline Sources',
    '',
    '- source_type: timeline',
    `- start_label: ${normalizeText(settings.startLabel) || 'not set'}`,
    `- end_label: ${normalizeText(settings.endLabel) || 'not set'}`,
    `- timeline_end_x: ${settings.timelineEndX}`,
    `- updated_at: ${settings.updatedAt}`,
    '',
    'Ordine cronologico di lavoro definito dall’autore. Non modifica la scaletta narrativa o l’ordine di esportazione del manoscritto.',
    '',
    sections.length > 0 ? sections.join('\n') : 'No timeline items placed.',
    '',
  ].join('\n');
}

function formatAiChatSource(
  messages: CodexChatMessageRecord[],
  chapters: ChapterNodeRecord[],
): string {
  const chaptersById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const sections = messages.map((message) => {
    const chapter = chaptersById.get(message.chapterNodeId);
    const roleLabel = message.role === 'user' ? 'Domanda utente' : 'Risposta AI';

    return [
      `## ${message.createdAt} - ${roleLabel}`,
      '',
      `- id: ${message.id}`,
      `- source_type: ai_chat`,
      `- role: ${message.role}`,
      `- chapter_node_id: ${message.chapterNodeId}`,
      `- chapter_title: ${chapter?.title ?? 'unknown'}`,
      `- mode: ${message.mode ?? 'api'}`,
      '',
      normalizeText(message.content) || 'No content.',
      '',
    ].join('\n');
  });

  return [
    '# AI Chat Sources',
    '',
    'Conversazioni salvate tra utente e AI. Usale come memoria consultabile della sessione di lavoro, non come fonte canonica del manoscritto.',
    '',
    sections.length > 0 ? sections.join('\n') : 'No AI chat messages.',
    '',
  ].join('\n');
}

function buildSourceFiles(params: {
  repository: NovelistRepository;
  project: ProjectRecord;
}): SourceFile[] {
  const { repository, project } = params;
  const chapters = repository.listChapterNodes(project.id);
  const characters = repository.listCharacterCards(project.id);
  const locations = repository.listLocationCards(project.id);
  const scenes = repository.listSceneCards(project.id);
  const plots = repository.listPlots(project.id);
  const timelineSettings = repository.getTimelineSettings(project.id);
  const timelineItems = repository.listTimelineItems(project.id);
  const aiChatMessages = repository.listProjectCodexChatMessages(project.id);

  const chapterSources = chapters.map((node) => {
    const document = repository.getChapterDocumentByNodeId(node.id);
    const text = richTextDocumentToMarkdown(parseRichTextDocument(document?.contentJson));
    const fileName = `chapter-${sanitizeFilePart(node.id)}.md`;

    return {
      key: `chapters/${fileName}`,
      relativePath: path.join('sources', 'chapters', fileName),
      content: formatChapterSource({
        node,
        text,
        characters: repository.listCharactersForChapter(project.id, node.id),
        locations: repository.listLocationsForChapter(project.id, node.id),
      }),
    };
  });

  return [
    ...chapterSources,
    {
      key: 'cards/characters.md',
      relativePath: path.join('sources', 'cards', 'characters.md'),
      content: formatCharactersSource(repository, characters),
    },
    {
      key: 'cards/locations.md',
      relativePath: path.join('sources', 'cards', 'locations.md'),
      content: formatLocationsSource(repository, locations),
    },
    {
      key: 'cards/scenes.md',
      relativePath: path.join('sources', 'cards', 'scenes.md'),
      content: formatScenesSource(scenes, chapters),
    },
    {
      key: 'cards/plot.md',
      relativePath: path.join('sources', 'cards', 'plot.md'),
      content: formatPlotSource(plots, chapters),
    },
    {
      key: 'cards/timeline.md',
      relativePath: path.join('sources', 'cards', 'timeline.md'),
      content: formatTimelineSource({
        settings: timelineSettings,
        items: timelineItems,
        chapters,
        scenes,
        plots,
      }),
    },
    {
      key: 'ai/chat.md',
      relativePath: path.join('sources', 'ai', 'chat.md'),
      content: formatAiChatSource(aiChatMessages, chapters),
    },
  ];
}

export async function exportProjectSources(params: {
  wikiPath: string;
  repository: NovelistRepository;
  project: ProjectRecord;
}): Promise<WikiSourceExportResult> {
  const wikiPaths: ProjectWikiPaths = await ensureProjectWiki({
    wikiPath: params.wikiPath,
    project: params.project,
  });
  const previousState = await readLastSyncState(wikiPaths.lastSyncPath);
  const sources = buildSourceFiles({ repository: params.repository, project: params.project });
  const nextSources = { ...previousState.sources };
  const changedSources: string[] = [];
  const now = new Date().toISOString();

  for (const source of sources) {
    const hash = sha256(source.content);
    const previous = previousState.sources[source.key];
    if (previous?.hash !== hash) {
      const targetPath = path.join(wikiPaths.wikiPath, source.relativePath);
      await writeTextFileAtomic(targetPath, source.content);
      changedSources.push(source.key);
    }

    nextSources[source.key] = {
      path: source.relativePath.split(path.sep).join('/'),
      hash,
      updatedAt: now,
    };
  }

  const currentKeys = new Set(sources.map((source) => source.key));
  const removedSources = Object.keys(nextSources).filter((key) => !currentKeys.has(key));
  for (const key of removedSources) {
    const relativePath = sourceRelativePathFromKey(key);
    if (relativePath) {
      await rm(path.join(wikiPaths.wikiPath, relativePath), { force: true });
    }
    delete nextSources[key];
    changedSources.push(key);
  }

  const changed = changedSources.length > 0;
  const derivedPending = previousState.derivedPending || changed;

  await writeLastSyncState(wikiPaths.lastSyncPath, {
    schemaVersion: previousState.schemaVersion,
    updatedAt: now,
    derivedPending,
    sources: nextSources,
  });

  return {
    changed,
    changedSources,
    sourceCount: sources.length,
    derivedPending,
  };
}
