import {
  canonicalizeRichTextDocumentMentions,
  createEmptyRichTextDocument,
  extractRichTextBlocks,
  getWordCountFromDocument,
  type RichTextDocument,
  type RichTextReferenceType,
} from '../chapters/rich-text';
import type { CodexCliService } from '../codex/client';
import { getMainLanguage, type MainLanguage } from '../i18n';
import type {
  ChapterDocumentRecord,
  CharacterCardRecord,
  LocationCardRecord,
  SceneCardRecord,
} from '../persistence/types';
import type { ProjectSessionManager } from '../projects/session';
import { getStoryContext, syncProjectWikiSourcesBestEffort } from './project-context';
import { createAutomaticRevision } from './revision-content';
import {
  autoLinkEntityReferences,
  extractEntityReferenceMentionIds,
} from '../../shared/reference-autolink';

type Repository = ReturnType<ProjectSessionManager['getRepository']>;
type ChapterNodeRecord = ReturnType<Repository['listChapterNodes']>[number];
type StoryEdgeRecord = ReturnType<Repository['listStoryEdges']>[number];

export interface ChapterServiceDependencies {
  codexService: Pick<CodexCliService, 'chat'>;
  resolveCodexRuntime: (
    repository: Repository,
    projectId: string,
  ) => Promise<{
    settings: {
      autoSummarizeDescriptions: boolean;
      enabled: boolean;
      provider: 'openai_api' | 'ollama';
      fallbackProvider: 'openai_api' | 'ollama' | 'none';
      allowApiCalls: boolean;
      apiModel: string;
      ollamaModel: string;
    };
    runtimeApiKey: string | null;
  }>;
}

export interface SaveChapterDocumentInput {
  chapterNodeId: string;
  contentJson: string;
}

export function parseRichTextDocument(contentJson: string): RichTextDocument {
  try {
    const parsed = JSON.parse(contentJson) as RichTextDocument;
    if (!parsed || typeof parsed !== 'object') {
      return createEmptyRichTextDocument();
    }
    return parsed;
  } catch {
    return createEmptyRichTextDocument();
  }
}

function getReferenceLabel(
  repository: Repository,
  type: RichTextReferenceType,
  id: string,
): string | null {
  if (type === 'character') {
    const character = repository.getCharacterCardById(id);
    if (!character) {
      return null;
    }
    return `${character.firstName} ${character.lastName}`.trim() || null;
  }

  const location = repository.getLocationCardById(id);
  if (location) {
    return location.name.trim() || null;
  }

  const scene = repository.getSceneCardById(id);
  return scene?.name.trim() || null;
}

function normalizeRichTextDocumentMentions(
  repository: Repository,
  document: RichTextDocument,
): RichTextDocument {
  return canonicalizeRichTextDocumentMentions(document, {
    getLabel: (type, id) => getReferenceLabel(repository, type, id),
  });
}

function autoLinkRichTextDocumentReferences(
  repository: Repository,
  projectId: string,
  document: RichTextDocument,
): RichTextDocument {
  return autoLinkEntityReferences(
    document,
    repository.listCharacterCards(projectId),
    repository.listLocationCards(projectId),
  ).document as RichTextDocument;
}

function areStringArraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function syncChapterEntityLinks(
  repository: Repository,
  projectId: string,
  chapterNodeId: string,
  document: RichTextDocument,
): void {
  const references = extractEntityReferenceMentionIds(document);

  for (const character of repository.listCharacterCards(projectId)) {
    const currentLinks = repository
      .listCharacterChapterLinks(character.id)
      .map((link) => link.chapterNodeId);
    const nextLinks = currentLinks.filter((id) => id !== chapterNodeId);
    if (references.characterIds.has(character.id)) {
      nextLinks.push(chapterNodeId);
    }
    if (!areStringArraysEqual(currentLinks, nextLinks)) {
      repository.setCharacterChapterLinks({
        characterCardId: character.id,
        chapterNodeIds: nextLinks,
      });
    }
  }

  for (const location of repository.listLocationCards(projectId)) {
    const currentLinks = repository
      .listLocationChapterLinks(location.id)
      .map((link) => link.chapterNodeId);
    const nextLinks = currentLinks.filter((id) => id !== chapterNodeId);
    if (references.locationIds.has(location.id)) {
      nextLinks.push(chapterNodeId);
    }
    if (!areStringArraysEqual(currentLinks, nextLinks)) {
      repository.setLocationChapterLinks({
        locationCardId: location.id,
        chapterNodeIds: nextLinks,
      });
    }
  }
}

function buildSummaryPrompt(
  chapterTitle: string,
  chapterText: string,
  language: MainLanguage,
): string {
  if (language === 'en') {
    return [
      'Summarize the chapter in English.',
      `Chapter title: ${chapterTitle}`,
      'Constraints: one sentence only, 220 characters maximum, no quotation marks, no markdown.',
      'Text to summarize:',
      chapterText,
    ].join('\n\n');
  }

  return [
    'Riassumi il capitolo in italiano.',
    `Titolo capitolo: ${chapterTitle}`,
    'Vincoli: una frase sola, massimo 220 caratteri, niente virgolette, niente markdown.',
    'Testo da riassumere:',
    chapterText,
  ].join('\n\n');
}

function normalizeSummaryText(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/^["'«»\s]+|["'«»\s]+$/g, '')
    .trim();
}

function truncateWithEllipsis(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  const trimmed = text.slice(0, maxLength - 1).trim();
  return `${trimmed}…`;
}

function summarizeTextFallback(chapterText: string, maxLength = 220): string {
  const normalized = chapterText.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return '';
  }

  const sentence = normalized.split(/(?<=[.!?])\s+/).find((part) => part.trim()) ?? normalized;
  return truncateWithEllipsis(sentence.trim(), maxLength);
}

function richTextToPlainText(document: RichTextDocument, maxLength = 12000): string {
  const text = extractRichTextBlocks(document)
    .map((block) => block.spans.map((s) => s.text).join(''))
    .map((t) => t.trim())
    .filter(Boolean)
    .join('\n');
  return text.slice(0, maxLength).trim();
}

function createDocumentFromDescription(description: string): RichTextDocument {
  const trimmedDescription = description.trim();
  if (!trimmedDescription) {
    return createEmptyRichTextDocument();
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: trimmedDescription }],
      },
    ],
  };
}

function compareChapterNodes(left: ChapterNodeRecord, right: ChapterNodeRecord): number {
  if (left.plotNumber !== right.plotNumber) {
    return left.plotNumber - right.plotNumber;
  }
  if (left.blockNumber !== right.blockNumber) {
    return left.blockNumber - right.blockNumber;
  }
  return left.title.localeCompare(right.title, 'it');
}

function orderChapterNodesByConnections(
  nodes: ChapterNodeRecord[],
  edges: StoryEdgeRecord[],
): ChapterNodeRecord[] {
  const nodesSorted = [...nodes].sort(compareChapterNodes);
  const nodeById = new Map(nodesSorted.map((node) => [node.id, node]));
  const incoming = new Map<string, string[]>(nodesSorted.map((node) => [node.id, []]));
  const outgoing = new Map<string, string[]>(nodesSorted.map((node) => [node.id, []]));

  for (const edge of edges) {
    if (!nodeById.has(edge.sourceId) || !nodeById.has(edge.targetId)) {
      continue;
    }
    outgoing.get(edge.sourceId)?.push(edge.targetId);
    incoming.get(edge.targetId)?.push(edge.sourceId);
  }

  for (const [nodeId, targetIds] of outgoing) {
    targetIds.sort((leftId, rightId) =>
      compareChapterNodes(nodeById.get(leftId)!, nodeById.get(rightId)!),
    );
    outgoing.set(nodeId, targetIds);
  }
  for (const [nodeId, sourceIds] of incoming) {
    sourceIds.sort((leftId, rightId) =>
      compareChapterNodes(nodeById.get(leftId)!, nodeById.get(rightId)!),
    );
    incoming.set(nodeId, sourceIds);
  }

  const ordered: ChapterNodeRecord[] = [];
  const visited = new Set<string>();
  const visiting = new Set<string>();

  function visit(node: ChapterNodeRecord): void {
    if (visiting.has(node.id) || visited.has(node.id)) {
      return;
    }

    visiting.add(node.id);
    ordered.push(node);
    visited.add(node.id);

    for (const targetId of outgoing.get(node.id) ?? []) {
      const targetNode = nodeById.get(targetId);
      if (targetNode) {
        visit(targetNode);
      }
    }
    visiting.delete(node.id);
  }

  const startNodes = nodesSorted.filter((node) => (incoming.get(node.id)?.length ?? 0) === 0);
  for (const node of startNodes.length > 0 ? startNodes : nodesSorted) {
    visit(node);
  }
  for (const node of nodesSorted) {
    visit(node);
  }

  return ordered;
}

export function collectManuscriptChapters(
  repository: Repository,
  projectId: string,
): Array<{ title: string; document: RichTextDocument }> {
  const allNodes = repository.listChapterNodes(projectId);
  const allEdges = repository.listStoryEdges(projectId);

  const documentsByNodeId = new Map(
    allNodes
      .map((node) => [node.id, repository.getChapterDocumentByNodeId(node.id)] as const)
      .filter(
        (
          entry,
        ): entry is readonly [
          string,
          NonNullable<ReturnType<Repository['getChapterDocumentByNodeId']>>,
        ] => {
          const [, document] = entry;
          return document !== null && document.wordCount > 0;
        },
      ),
  );

  const orderedNodes = orderChapterNodesByConnections(allNodes, allEdges).filter((node) =>
    documentsByNodeId.has(node.id),
  );

  return orderedNodes.map((node) => ({
    title: node.title,
    document: parseRichTextDocument(documentsByNodeId.get(node.id)!.contentJson),
  }));
}

export class ChapterService {
  constructor(
    private readonly sessionManager: ProjectSessionManager,
    private readonly dependencies: ChapterServiceDependencies,
  ) {}

  getDocument(chapterNodeId: string): ChapterDocumentRecord {
    const { repository } = getStoryContext(this.sessionManager);
    const node = repository.getChapterNodeById(chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }

    const existing = repository.getChapterDocumentByNodeId(chapterNodeId);
    if (existing) {
      const normalizedDocument = normalizeRichTextDocumentMentions(
        repository,
        parseRichTextDocument(existing.contentJson),
      );
      const normalizedContentJson = JSON.stringify(normalizedDocument);
      const normalizedWordCount = getWordCountFromDocument(normalizedDocument);
      if (
        existing.contentJson !== normalizedContentJson ||
        existing.wordCount !== normalizedWordCount
      ) {
        const updated = repository.upsertChapterDocument({
          chapterNodeId,
          contentJson: normalizedContentJson,
          wordCount: normalizedWordCount,
        });
        repository.setChapterNodeRichTextDocId(chapterNodeId, updated.id);
        return updated;
      }

      return {
        ...existing,
        contentJson: normalizedContentJson,
        wordCount: normalizedWordCount,
      };
    }

    const emptyDocument = createEmptyRichTextDocument();
    const created = repository.upsertChapterDocument({
      chapterNodeId,
      contentJson: JSON.stringify(emptyDocument),
      wordCount: 0,
    });
    repository.setChapterNodeRichTextDocId(chapterNodeId, created.id);
    return created;
  }

  getChapterNode(chapterNodeId: string): ChapterNodeRecord {
    const { repository } = getStoryContext(this.sessionManager);
    const node = repository.getChapterNodeById(chapterNodeId);
    if (!node) {
      throw new Error('Chapter node not found');
    }
    return node;
  }

  async saveDocument(input: SaveChapterDocumentInput): Promise<ChapterDocumentRecord> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    const node = repository.getChapterNodeById(input.chapterNodeId);
    if (!node || node.projectId !== projectId) {
      throw new Error('Chapter node not found');
    }

    const parsedDocument = parseRichTextDocument(input.contentJson);
    const autoLinkedDocument = autoLinkRichTextDocumentReferences(
      repository,
      projectId,
      parsedDocument,
    );
    const normalizedDocument = normalizeRichTextDocumentMentions(repository, autoLinkedDocument);
    const wordCount = getWordCountFromDocument(normalizedDocument);
    const previousDocument = repository.getChapterDocumentByNodeId(input.chapterNodeId);
    createAutomaticRevision(repository, projectId, 'chapter', input.chapterNodeId);
    syncChapterEntityLinks(repository, projectId, input.chapterNodeId, normalizedDocument);

    const saved = repository.upsertChapterDocument({
      chapterNodeId: input.chapterNodeId,
      contentJson: JSON.stringify(normalizedDocument),
      wordCount,
    });
    const wordDelta = wordCount - (previousDocument?.wordCount ?? 0);
    if (wordDelta > 0) {
      try {
        repository.recordWritingSession(projectId, {
          chapterNodeId: input.chapterNodeId,
          wordDelta,
          wordCount,
        });
      } catch {
        // Writing metrics are auxiliary; manuscript saves must remain the primary operation.
      }
    }

    repository.setChapterNodeRichTextDocId(input.chapterNodeId, saved.id);
    await this.updateChapterSummary(repository, projectId, node, normalizedDocument, saved.id);
    await syncProjectWikiSourcesBestEffort(this.sessionManager);

    return saved;
  }

  getChapterExportDocument(chapterNodeId: string, fallbackDescription: string): RichTextDocument {
    const { repository } = getStoryContext(this.sessionManager);
    const existing = repository.getChapterDocumentByNodeId(chapterNodeId);
    if (existing) {
      return parseRichTextDocument(existing.contentJson);
    }

    const document = createDocumentFromDescription(fallbackDescription);
    const created = repository.upsertChapterDocument({
      chapterNodeId,
      contentJson: JSON.stringify(document),
      wordCount: getWordCountFromDocument(document),
    });
    repository.setChapterNodeRichTextDocId(chapterNodeId, created.id);
    return document;
  }

  getManuscriptChapters(): Array<{ title: string; document: RichTextDocument }> {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    return collectManuscriptChapters(repository, projectId);
  }

  getManuscriptTitle(): string {
    const project = this.sessionManager.getOpenedProject();
    return project?.project.name?.trim() || 'Manoscritto';
  }

  getProjectPrintTitle(): string {
    return this.sessionManager.getOpenedProject()?.project.name ?? 'The Novelist';
  }

  listCharacters(chapterNodeId: string): CharacterCardRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    this.assertChapterNodeInProject(repository, projectId, chapterNodeId);
    return repository.listCharactersForChapter(projectId, chapterNodeId);
  }

  listLocations(chapterNodeId: string): LocationCardRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    this.assertChapterNodeInProject(repository, projectId, chapterNodeId);
    return repository.listLocationsForChapter(projectId, chapterNodeId);
  }

  listScenes(chapterNodeId: string): SceneCardRecord[] {
    const { repository, projectId } = getStoryContext(this.sessionManager);
    this.assertChapterNodeInProject(repository, projectId, chapterNodeId);
    return repository.listScenesForChapter(projectId, chapterNodeId);
  }

  private async updateChapterSummary(
    repository: Repository,
    projectId: string,
    node: ChapterNodeRecord,
    document: RichTextDocument,
    richTextDocId: string,
  ): Promise<void> {
    const plainText = richTextToPlainText(document);
    const runtime = await this.dependencies.resolveCodexRuntime(repository, projectId);
    const codexSettings = runtime.settings;
    if (!plainText || !codexSettings.autoSummarizeDescriptions) {
      return;
    }

    const language = getMainLanguage();
    const summaryRequest = buildSummaryPrompt(node.title, plainText, language);
    let summaryText = '';

    if (codexSettings.enabled) {
      try {
        const summaryResult = await this.dependencies.codexService.chat(
          {
            message: summaryRequest,
            chapterTitle: node.title,
            projectName: this.sessionManager.getOpenedProject()?.project.name,
            chapterText: plainText,
          },
          {
            provider: codexSettings.provider,
            fallbackProvider: codexSettings.fallbackProvider,
            allowApiCalls: codexSettings.allowApiCalls,
            apiKey: runtime.runtimeApiKey,
            apiModel: codexSettings.apiModel,
            ollamaModel: codexSettings.ollamaModel,
            language,
          },
        );
        summaryText = normalizeSummaryText(summaryResult.output);
      } catch {
        summaryText = '';
      }
    }

    const nextDescription = truncateWithEllipsis(
      summaryText || summarizeTextFallback(plainText),
      220,
    );
    if (nextDescription && nextDescription !== node.description) {
      repository.updateChapterNode(node.id, {
        title: node.title,
        description: nextDescription,
        plotNumber: node.plotNumber,
        blockNumber: node.blockNumber,
        positionX: node.positionX,
        positionY: node.positionY,
        richTextDocId,
      });
    }
  }

  private assertChapterNodeInProject(
    repository: Repository,
    projectId: string,
    chapterNodeId: string,
  ): void {
    const node = repository.getChapterNodeById(chapterNodeId);
    if (!node || node.projectId !== projectId) {
      throw new Error('Chapter node not found');
    }
  }
}
