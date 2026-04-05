export interface RichTextNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
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

export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontSize?: string | null;
  fontFamily?: string | null;
}

export interface RichTextBlock {
  type: 'heading' | 'paragraph' | 'blockquote';
  spans: RichTextSpan[];
  level?: number;
  align?: 'left' | 'center' | 'right' | 'justify';
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

function collectSpans(node: RichTextNode | undefined): RichTextSpan[] {
  if (!node) {
    return [];
  }

  if (node.type === 'referenceMention') {
    return [];
  }

  if (node.type === 'hardBreak') {
    return [{ text: '\n' }];
  }

  if (typeof node.text === 'string') {
    const bold = node.marks?.some((m) => m.type === 'bold');
    const italic = node.marks?.some((m) => m.type === 'italic');
    const textStyle = node.marks?.find((m) => m.type === 'textStyle');
    const fontSize = textStyle?.attrs?.['fontSize'];
    const fontFamily = textStyle?.attrs?.['fontFamily'];

    return [
      {
        text: node.text,
        bold,
        italic,
        fontSize: typeof fontSize === 'string' ? fontSize : null,
        fontFamily: typeof fontFamily === 'string' ? fontFamily : null,
      },
    ];
  }

  if (!Array.isArray(node.content)) {
    return [];
  }

  return node.content.flatMap(collectSpans);
}

export function extractRichTextBlocks(document: RichTextDocument): RichTextBlock[] {
  const content = Array.isArray(document.content) ? document.content : [];
  const blocks: RichTextBlock[] = [];

  for (const node of content) {
    const type = node.type;
    if (type !== 'paragraph' && type !== 'heading' && type !== 'blockquote') {
      continue;
    }

    const spans = collectSpans(node);
    if (spans.length === 0) {
      continue;
    }

    const align = node.attrs?.['textAlign'] as RichTextBlock['align'];

    if (type === 'heading') {
      const level = Number(node.attrs?.['level'] ?? 1);
      blocks.push({
        type: 'heading',
        spans,
        level: Number.isFinite(level) ? level : 1,
        align,
      });
      continue;
    }

    if (type === 'blockquote') {
      blocks.push({
        type: 'blockquote',
        spans,
        align,
      });
      continue;
    }

    blocks.push({
      type: 'paragraph',
      spans,
      align,
    });
  }

  return blocks;
}

export function getWordCountFromDocument(document: RichTextDocument): number {
  const blocks = extractRichTextBlocks(document);
  const text = blocks
    .map((block) => block.spans.map((s) => s.text || '').join(''))
    .join(' ');

  const cleaned = text.trim();
  if (!cleaned) {
    return 0;
  }

  return cleaned.split(/\s+/).filter(Boolean).length;
}
