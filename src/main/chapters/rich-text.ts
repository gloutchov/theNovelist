export interface RichTextNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  content?: RichTextNode[];
}

export interface RichTextDocument {
  type?: string;
  content?: RichTextNode[];
}

export type RichTextReferenceType = 'character' | 'location';

export interface CanonicalRichTextReferenceResolver {
  getLabel: (type: RichTextReferenceType, id: string) => string | null;
}

export interface RichTextBlock {
  type: 'heading' | 'paragraph' | 'blockquote';
  text: string;
  level?: number;
}

export function createEmptyRichTextDocument(): RichTextDocument {
  return {
    type: 'doc',
    content: [{ type: 'paragraph', content: [] }],
  };
}

function normalizeReferenceMentionNode(
  node: RichTextNode,
  resolver: CanonicalRichTextReferenceResolver,
): RichTextNode | null {
  const refId = typeof node.attrs?.['refId'] === 'string' ? node.attrs['refId'].trim() : '';
  const refType = node.attrs?.['refType'];
  if (!refId || (refType !== 'character' && refType !== 'location')) {
    return null;
  }

  const label = resolver.getLabel(refType, refId)?.trim() ?? '';
  if (!label) {
    return null;
  }

  return {
    type: 'referenceMention',
    attrs: {
      refId,
      refType,
      label,
    },
  };
}

function canonicalizeNode(
  node: RichTextNode | undefined,
  resolver: CanonicalRichTextReferenceResolver,
): RichTextNode | null {
  if (!node || typeof node !== 'object') {
    return null;
  }

  if (node.type === 'referenceMention') {
    return normalizeReferenceMentionNode(node, resolver);
  }

  const nextNode: RichTextNode = {
    ...node,
  };

  if (Array.isArray(node.content)) {
    nextNode.content = node.content
      .map((child) => canonicalizeNode(child, resolver))
      .filter((child): child is RichTextNode => child !== null);
  }

  return nextNode;
}

export function canonicalizeRichTextDocumentMentions(
  document: RichTextDocument,
  resolver: CanonicalRichTextReferenceResolver,
): RichTextDocument {
  const content = Array.isArray(document.content) ? document.content : [];

  return {
    ...document,
    type: document.type ?? 'doc',
    content: content
      .map((node) => canonicalizeNode(node, resolver))
      .filter((node): node is RichTextNode => node !== null),
  };
}

function collectText(node: RichTextNode | undefined): string {
  if (!node) {
    return '';
  }

  if (node.type === 'referenceMention') {
    return '';
  }

  if (typeof node.text === 'string') {
    return node.text;
  }

  if (!Array.isArray(node.content)) {
    return '';
  }

  return node.content.map(collectText).join('');
}

export function extractRichTextBlocks(document: RichTextDocument): RichTextBlock[] {
  const content = Array.isArray(document.content) ? document.content : [];
  const blocks: RichTextBlock[] = [];

  for (const node of content) {
    const type = node.type;
    const text = collectText(node).trim();

    if (!text) {
      continue;
    }

    if (type === 'heading') {
      const level = Number(node.attrs?.['level'] ?? 1);
      blocks.push({
        type: 'heading',
        text,
        level: Number.isFinite(level) ? level : 1,
      });
      continue;
    }

    if (type === 'blockquote') {
      blocks.push({
        type: 'blockquote',
        text,
      });
      continue;
    }

    blocks.push({
      type: 'paragraph',
      text,
    });
  }

  return blocks;
}

export function getWordCountFromDocument(document: RichTextDocument): number {
  const blocks = extractRichTextBlocks(document);
  const text = blocks.map((block) => block.text).join(' ');

  if (!text.trim()) {
    return 0;
  }

  return text.trim().split(/\s+/).filter(Boolean).length;
}
