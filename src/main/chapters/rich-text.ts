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

function collectText(node: RichTextNode | undefined): string {
  if (!node) {
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

  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
}
