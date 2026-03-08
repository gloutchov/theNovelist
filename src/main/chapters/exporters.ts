import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import PDFDocument from 'pdfkit';
import type { RichTextDocument } from './rich-text';
import { extractRichTextBlocks } from './rich-text';

function safeFileName(input: string): string {
  const sanitized = input.replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '-');
  return sanitized || 'chapter';
}

export function getDefaultExportName(title: string, extension: 'docx' | 'pdf'): string {
  return `${safeFileName(title)}.${extension}`;
}

export interface ChapterExportSection {
  title: string;
  document: RichTextDocument;
}

function blocksToDocxParagraphs(blocks: ReturnType<typeof extractRichTextBlocks>): Paragraph[] {
  const children: Paragraph[] = [];

  for (const block of blocks) {
    if (block.type === 'heading') {
      children.push(
        new Paragraph({
          heading: block.level && block.level > 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
          children: [new TextRun(block.text)],
          spacing: { after: 220 },
        }),
      );
      continue;
    }

    if (block.type === 'blockquote') {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: block.text, italics: true })],
          indent: { left: 720 },
          spacing: { after: 180 },
        }),
      );
      continue;
    }

    children.push(
      new Paragraph({
        children: [new TextRun(block.text)],
        spacing: { after: 160 },
      }),
    );
  }

  return children;
}

function writeBlocksToPdf(pdf: PDFKit.PDFDocument, blocks: ReturnType<typeof extractRichTextBlocks>): void {
  for (const block of blocks) {
    if (block.type === 'heading') {
      pdf.font('Helvetica-Bold').fontSize(16).text(block.text);
      pdf.moveDown(0.6);
      pdf.font('Helvetica').fontSize(12);
      continue;
    }

    if (block.type === 'blockquote') {
      pdf.font('Helvetica-Oblique').fontSize(12).text(block.text, {
        indent: 24,
      });
      pdf.moveDown(0.5);
      pdf.font('Helvetica').fontSize(12);
      continue;
    }

    pdf.font('Helvetica').fontSize(12).text(block.text, {
      align: 'left',
    });
    pdf.moveDown(0.45);
  }
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

export async function exportRichTextToPdf(params: {
  title: string;
  document: RichTextDocument;
  outputPath: string;
}): Promise<void> {
  const blocks = extractRichTextBlocks(params.document);

  await mkdir(path.dirname(params.outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(params.outputPath);
    const pdf = new PDFDocument({ margin: 56, size: 'A4' });

    stream.on('finish', () => resolve());
    stream.on('error', (error) => reject(error));

    pdf.pipe(stream);

    pdf.fontSize(20).text(params.title, { align: 'left' });
    pdf.moveDown(1);

    writeBlocksToPdf(pdf, blocks);

    pdf.end();
  });
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

export async function exportManuscriptToPdf(params: {
  title: string;
  chapters: ChapterExportSection[];
  outputPath: string;
}): Promise<void> {
  await mkdir(path.dirname(params.outputPath), { recursive: true });

  await new Promise<void>((resolve, reject) => {
    const stream = createWriteStream(params.outputPath);
    const pdf = new PDFDocument({ margin: 56, size: 'A4' });

    stream.on('finish', () => resolve());
    stream.on('error', (error) => reject(error));

    pdf.pipe(stream);

    pdf.fontSize(20).font('Helvetica-Bold').text(params.title, { align: 'left' });
    pdf.moveDown(1);
    pdf.font('Helvetica').fontSize(12);

    for (const chapter of params.chapters) {
      pdf.font('Helvetica-Bold').fontSize(16).text(chapter.title);
      pdf.moveDown(0.7);
      pdf.font('Helvetica').fontSize(12);
      writeBlocksToPdf(pdf, extractRichTextBlocks(chapter.document));
      pdf.moveDown(0.9);
    }

    pdf.end();
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function blocksToHtml(blocks: ReturnType<typeof extractRichTextBlocks>): string {
  return blocks
    .map((block) => {
      const text = escapeHtml(block.text);
      if (block.type === 'heading') {
        return `<h2>${text}</h2>`;
      }
      if (block.type === 'blockquote') {
        return `<blockquote>${text}</blockquote>`;
      }
      return `<p>${text}</p>`;
    })
    .join('\n');
}

export function buildChapterPrintHtml(params: { title: string; document: RichTextDocument }): string {
  const content = blocksToHtml(extractRichTextBlocks(params.document));
  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${escapeHtml(params.title)}</title>
      <style>
        body { font-family: Georgia, "Times New Roman", serif; margin: 2rem; line-height: 1.6; color: #111827; }
        h1 { margin: 0 0 1rem; }
        h2 { margin: 1.1rem 0 0.6rem; }
        p { margin: 0.5rem 0; }
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
      <title>${escapeHtml(params.title)}</title>
      <style>
        body { font-family: Georgia, "Times New Roman", serif; margin: 2rem; line-height: 1.6; color: #111827; }
        h1 { margin: 0 0 1.2rem; }
        h2 { margin: 1.15rem 0 0.6rem; }
        p { margin: 0.5rem 0; }
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
