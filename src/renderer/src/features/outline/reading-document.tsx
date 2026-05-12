import type { CSSProperties, ReactNode } from 'react';

export interface RichTextNodeJson {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: RichTextNodeJson[];
}

export interface RichTextDocumentJson {
  type?: string;
  content?: RichTextNodeJson[];
}

export function parseReadingDocument(contentJson: string): RichTextDocumentJson {
  try {
    const parsed = JSON.parse(contentJson) as RichTextDocumentJson;
    if (parsed && parsed.type === 'doc' && Array.isArray(parsed.content)) {
      return parsed;
    }
  } catch {
    return { type: 'doc', content: [] };
  }

  return { type: 'doc', content: [] };
}

function richTextNodeHasContent(node: RichTextNodeJson): boolean {
  if (typeof node.text === 'string' && node.text.trim().length > 0) {
    return true;
  }
  if (node.type === 'referenceMention') {
    const label = typeof node.attrs?.label === 'string' ? node.attrs.label.trim() : '';
    return label.length > 0;
  }
  return Array.isArray(node.content) && node.content.some(richTextNodeHasContent);
}

function richTextDocumentHasContent(document: RichTextDocumentJson): boolean {
  return Array.isArray(document.content) && document.content.some(richTextNodeHasContent);
}

function getReadingTextAlign(
  attrs: Record<string, unknown> | undefined,
): CSSProperties | undefined {
  const textAlign = attrs?.textAlign;
  if (
    textAlign === 'left' ||
    textAlign === 'center' ||
    textAlign === 'right' ||
    textAlign === 'justify'
  ) {
    return { textAlign };
  }

  return undefined;
}

function renderReadingInlineNode(node: RichTextNodeJson, key: string): ReactNode {
  if (node.type === 'hardBreak') {
    return <br key={key} />;
  }

  if (node.type === 'referenceMention') {
    return null;
  }

  let content: ReactNode =
    typeof node.text === 'string'
      ? node.text
      : node.content?.map((child, index) => renderReadingInlineNode(child, `${key}-${index}`));

  for (const [markIndex, mark] of (node.marks ?? []).entries()) {
    const markKey = `${key}-mark-${markIndex}`;
    if (mark.type === 'bold') {
      content = <strong key={markKey}>{content}</strong>;
    } else if (mark.type === 'italic') {
      content = <em key={markKey}>{content}</em>;
    } else if (mark.type === 'strike') {
      content = <s key={markKey}>{content}</s>;
    } else if (mark.type === 'code') {
      content = <code key={markKey}>{content}</code>;
    } else if (mark.type === 'underline') {
      content = <u key={markKey}>{content}</u>;
    }
  }

  return <span key={key}>{content}</span>;
}

function renderReadingBlockNode(node: RichTextNodeJson, key: string): ReactNode {
  const children = Array.isArray(node.content)
    ? node.content.map((child, index) => {
        if (
          child.type === 'bulletList' ||
          child.type === 'orderedList' ||
          child.type === 'blockquote'
        ) {
          return renderReadingBlockNode(child, `${key}-${index}`);
        }
        return renderReadingInlineNode(child, `${key}-${index}`);
      })
    : null;
  const textAlignStyle = getReadingTextAlign(node.attrs);

  if (node.type === 'heading') {
    const level = node.attrs?.level === 1 ? 2 : node.attrs?.level === 2 ? 3 : 4;
    if (level === 2) {
      return (
        <h2 key={key} style={textAlignStyle}>
          {children}
        </h2>
      );
    }
    if (level === 3) {
      return (
        <h3 key={key} style={textAlignStyle}>
          {children}
        </h3>
      );
    }
    return (
      <h4 key={key} style={textAlignStyle}>
        {children}
      </h4>
    );
  }

  if (node.type === 'blockquote') {
    return (
      <blockquote key={key} style={textAlignStyle}>
        {children}
      </blockquote>
    );
  }

  if (node.type === 'bulletList') {
    return <ul key={key}>{children}</ul>;
  }

  if (node.type === 'orderedList') {
    return <ol key={key}>{children}</ol>;
  }

  if (node.type === 'listItem') {
    return <li key={key}>{children}</li>;
  }

  return (
    <p key={key} style={textAlignStyle}>
      {children}
    </p>
  );
}

export function renderReadingDocument(document: RichTextDocumentJson): ReactNode {
  if (!richTextDocumentHasContent(document)) {
    return <p className="reader-empty-chapter">Capitolo vuoto.</p>;
  }

  return (document.content ?? []).map((node, index) =>
    renderReadingBlockNode(node, `block-${index}`),
  );
}
