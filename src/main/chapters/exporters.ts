import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AlignmentType, Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import type { RichTextDocument, RichTextBlock, RichTextSpan } from './rich-text';
import { extractRichTextBlocks } from './rich-text';

function safeFileName(input: string): string {
  const sanitized = input.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
  return sanitized || 'chapter';
}

function getTimestamp(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}`;
}

export function getDefaultExportName(title: string, extension: 'docx'): string {
  return `${safeFileName(title)}_${getTimestamp()}.${extension}`;
}

export interface ChapterExportSection {
  title: string;
  document: RichTextDocument;
}

function mapAlignmentToDocx(
  align?: RichTextBlock['align'],
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  switch (align) {
    case 'center':
      return AlignmentType.CENTER;
    case 'right':
      return AlignmentType.RIGHT;
    case 'justify':
      return AlignmentType.JUSTIFIED;
    default:
      return AlignmentType.LEFT;
  }
}

function fontSizeToDocx(size?: string | null): number | undefined {
  if (!size) return undefined;
  const numeric = parseInt(size, 10);
  if (isNaN(numeric)) return undefined;
  return numeric * 2;
}

function fontFamilyToDocx(family?: string | null): string | undefined {
  if (!family) return undefined;
  return family.replace(/['"]/g, '').split(',')[0].trim();
}

function spansToDocxChildren(spans: RichTextSpan[], options?: { italics?: boolean }): TextRun[] {
  const children: TextRun[] = [];

  for (const span of spans) {
    if (span.text === '\n') {
      children.push(new TextRun({ break: 1 }));
      continue;
    }

    const lines = span.text.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line || i < lines.length - 1) {
        children.push(
          new TextRun({
            text: line,
            italics: options?.italics || span.italic,
            bold: span.bold,
            size: fontSizeToDocx(span.fontSize),
            font: fontFamilyToDocx(span.fontFamily),
          }),
        );
      }
      if (i < lines.length - 1) {
        children.push(new TextRun({ break: 1 }));
      }
    }
  }

  return children;
}

function blocksToDocxParagraphs(blocks: ReturnType<typeof extractRichTextBlocks>): Paragraph[] {
  const children: Paragraph[] = [];

  for (const block of blocks) {
    const alignment = mapAlignmentToDocx(block.align);

    if (block.type === 'heading') {
      children.push(
        new Paragraph({
          heading: block.level && block.level > 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
          children: spansToDocxChildren(block.spans),
          alignment,
          spacing: { after: 220 },
        }),
      );
      continue;
    }

    if (block.type === 'blockquote') {
      children.push(
        new Paragraph({
          children: spansToDocxChildren(block.spans, { italics: true }),
          indent: { left: 720 },
          alignment,
          spacing: { after: 180 },
        }),
      );
      continue;
    }

    children.push(
      new Paragraph({
        children: spansToDocxChildren(block.spans),
        alignment,
        spacing: { after: 160 },
      }),
    );
  }

  return children;
}

export async function exportRichTextToDocx(params: {
  title: string;
  document: RichTextDocument;
  outputPath: string;
}): Promise<void> {
  const blocks = extractRichTextBlocks(params.document);

  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: params.title, bold: true })],
      spacing: { after: 320 },
    }),
  ];

  children.push(...blocksToDocxParagraphs(blocks));

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  await mkdir(path.dirname(params.outputPath), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  await writeFile(params.outputPath, buffer);
}

export async function exportManuscriptToDocx(params: {
  title: string;
  chapters: ChapterExportSection[];
  outputPath: string;
}): Promise<void> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: params.title, bold: true })],
      spacing: { after: 360 },
    }),
  ];

  for (const chapter of params.chapters) {
    children.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: chapter.title, bold: true })],
        spacing: { before: 260, after: 220 },
      }),
    );

    const blocks = extractRichTextBlocks(chapter.document);
    children.push(...blocksToDocxParagraphs(blocks));
  }

  const doc = new Document({
    sections: [
      {
        children,
      },
    ],
  });

  await mkdir(path.dirname(params.outputPath), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  await writeFile(params.outputPath, buffer);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function spansToHtml(spans: RichTextSpan[]): string {
  return spans
    .map((span) => {
      let text = escapeHtml(span.text).replaceAll('\n', '<br />');
      const styles: string[] = [];
      if (span.fontSize) styles.push(`font-size: ${span.fontSize}px`);
      if (span.fontFamily) styles.push(`font-family: ${span.fontFamily}`);
      
      const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
      
      if (span.italic) text = `<em>${text}</em>`;
      if (span.bold) text = `<strong>${text}</strong>`;
      
      return styleAttr ? `<span${styleAttr}>${text}</span>` : text;
    })
    .join('');
}

function blocksToHtml(blocks: ReturnType<typeof extractRichTextBlocks>): string {
  return blocks
    .map((block) => {
      const content = spansToHtml(block.spans);
      const style = block.align ? ` style="text-align: ${block.align}"` : '';
      if (block.type === 'heading') {
        return `<h2${style}>${content}</h2>`;
      }
      if (block.type === 'blockquote') {
        return `<blockquote${style}>${content}</blockquote>`;
      }
      return `<p${style}>${content}</p>`;
    })
    .join('\n');
}

export function buildChapterPrintHtml(params: { title: string; document: RichTextDocument }): string {
  const content = blocksToHtml(extractRichTextBlocks(params.document));
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src data: file:; style-src 'unsafe-inline';"
      />
      <title>${escapeHtml(params.title)}</title>
      <style>
        body { font-family: Georgia, "Times New Roman", serif; margin: 2rem; line-height: 1.6; color: #111827; }
        h1 { margin: 0 0 1rem; }
        h2 { margin: 1.1rem 0 0.6rem; }
        p { margin: 0.5rem 0; min-height: 1.2em; }
        blockquote { margin-left: 1.5rem; padding-left: 1rem; border-left: 3px solid #9ca3af; color: #374151; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(params.title)}</h1>
      ${content}
    </body>
  </html>
  `;
}

export function buildManuscriptPrintHtml(params: { title: string; chapters: ChapterExportSection[] }): string {
  const chaptersHtml = params.chapters
    .map((chapter) => {
      const content = blocksToHtml(extractRichTextBlocks(chapter.document));
      return `
      <section class="chapter">
        <h2>${escapeHtml(chapter.title)}</h2>
        ${content}
      </section>
      `;
    })
    .join('\n');

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <meta
        http-equiv="Content-Security-Policy"
        content="default-src 'none'; img-src data: file:; style-src 'unsafe-inline';"
      />
      <title>${escapeHtml(params.title)}</title>
      <style>
        body { font-family: Georgia, "Times New Roman", serif; margin: 2rem; line-height: 1.6; color: #111827; }
        h1 { margin: 0 0 1.2rem; }
        h2 { margin: 1.15rem 0 0.6rem; }
        p { margin: 0.5rem 0; min-height: 1.2em; }
        blockquote { margin-left: 1.5rem; padding-left: 1rem; border-left: 3px solid #9ca3af; color: #374151; }
        .chapter { page-break-inside: avoid; margin-bottom: 1.1rem; }
      </style>
    </head>
    <body>
      <h1>${escapeHtml(params.title)}</h1>
      ${chaptersHtml}
    </body>
  </html>
  `;
}
