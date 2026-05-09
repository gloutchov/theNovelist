import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import {
  AlignmentType,
  convertInchesToTwip,
  Document,
  Footer,
  Header,
  HeadingLevel,
  LineRuleType,
  Packer,
  PageNumber,
  Paragraph,
  SectionType,
  TextRun,
} from 'docx';
import JSZip from 'jszip';
import type { RichTextDocument, RichTextBlock, RichTextSpan } from './rich-text';
import { extractRichTextBlocks } from './rich-text';

const MANUSCRIPT_FONT = 'Courier New';
const MANUSCRIPT_FONT_SIZE_POINTS = 10;
const MANUSCRIPT_DOCX_FONT_SIZE = MANUSCRIPT_FONT_SIZE_POINTS * 2;
const MANUSCRIPT_LINE_SPACING = 480;
const MANUSCRIPT_PARAGRAPH_AFTER = 0;
const MANUSCRIPT_PAGE_WIDTH_TWIP = convertInchesToTwip(8.27);
const MANUSCRIPT_PAGE_HEIGHT_TWIP = convertInchesToTwip(11.69);
const MANUSCRIPT_PAGE_MARGINS = {
  top: convertInchesToTwip(1.6),
  right: convertInchesToTwip(0.7),
  bottom: convertInchesToTwip(1.76),
  left: convertInchesToTwip(0.7),
  header: convertInchesToTwip(0.75),
  footer: convertInchesToTwip(0.75),
};
const MANUSCRIPT_TEXT_GRID = {
  linePitch: MANUSCRIPT_LINE_SPACING,
  charSpace: 120,
};

function safeFileName(input: string): string {
  const sanitized = input
    .replace(/[^a-zA-Z0-9-_ ]/g, '')
    .trim()
    .replace(/\s+/g, '-');
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

export function getDefaultExportName(title: string, extension: 'docx' | 'epub'): string {
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
            size: MANUSCRIPT_DOCX_FONT_SIZE,
            font: MANUSCRIPT_FONT,
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

function createManuscriptParagraph(options: {
  children: TextRun[];
  alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
  heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
  spacingBefore?: number;
  indentLeft?: number;
}): Paragraph {
  return new Paragraph({
    heading: options.heading,
    children: options.children,
    alignment: options.alignment ?? AlignmentType.LEFT,
    spacing: {
      before: options.spacingBefore ?? 0,
      after: MANUSCRIPT_PARAGRAPH_AFTER,
      line: MANUSCRIPT_LINE_SPACING,
      lineRule: LineRuleType.AUTO,
    },
    indent: options.indentLeft ? { left: options.indentLeft } : undefined,
  });
}

function blocksToDocxParagraphs(blocks: ReturnType<typeof extractRichTextBlocks>): Paragraph[] {
  const children: Paragraph[] = [];

  for (const block of blocks) {
    const alignment = mapAlignmentToDocx(block.align);

    if (block.type === 'heading') {
      children.push(
        createManuscriptParagraph({
          heading: block.level && block.level > 1 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1,
          children: spansToDocxChildren(block.spans),
          alignment,
        }),
      );
      continue;
    }

    if (block.type === 'blockquote') {
      children.push(
        createManuscriptParagraph({
          children: spansToDocxChildren(block.spans, { italics: true }),
          indentLeft: 720,
          alignment,
        }),
      );
      continue;
    }

    children.push(
      createManuscriptParagraph({
        children: spansToDocxChildren(block.spans),
        alignment,
      }),
    );
  }

  return children;
}

function createDocumentHeader(projectTitle: string): Header {
  return new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            text: projectTitle,
            font: MANUSCRIPT_FONT,
            size: MANUSCRIPT_DOCX_FONT_SIZE,
          }),
        ],
      }),
    ],
  });
}

function createDocumentFooter(): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.LEFT,
        children: [
          new TextRun({
            children: [PageNumber.CURRENT],
            font: MANUSCRIPT_FONT,
            size: MANUSCRIPT_DOCX_FONT_SIZE,
          }),
        ],
      }),
    ],
  });
}

function createSectionProperties(sectionType?: (typeof SectionType)[keyof typeof SectionType]) {
  return {
    type: sectionType,
    page: {
      size: {
        width: MANUSCRIPT_PAGE_WIDTH_TWIP,
        height: MANUSCRIPT_PAGE_HEIGHT_TWIP,
      },
      margin: MANUSCRIPT_PAGE_MARGINS,
    },
    grid: MANUSCRIPT_TEXT_GRID,
  };
}

function createDocumentSections(params: {
  projectTitle: string;
  sections: Array<{
    children: Paragraph[];
    sectionType?: (typeof SectionType)[keyof typeof SectionType];
  }>;
}) {
  return params.sections.map((section) => ({
    properties: createSectionProperties(section.sectionType),
    headers: {
      default: createDocumentHeader(params.projectTitle),
    },
    footers: {
      default: createDocumentFooter(),
    },
    children: section.children,
  }));
}

function createChapterTitleParagraph(
  title: string,
  level: (typeof HeadingLevel)[keyof typeof HeadingLevel],
): Paragraph {
  return createManuscriptParagraph({
    heading: level,
    children: [
      new TextRun({
        text: title,
        bold: true,
        font: MANUSCRIPT_FONT,
        size: MANUSCRIPT_DOCX_FONT_SIZE,
      }),
    ],
  });
}

export async function exportRichTextToDocx(params: {
  title: string;
  document: RichTextDocument;
  outputPath: string;
  projectTitle: string;
}): Promise<void> {
  const blocks = extractRichTextBlocks(params.document);

  const children: Paragraph[] = [createChapterTitleParagraph(params.title, HeadingLevel.HEADING_1)];

  children.push(...blocksToDocxParagraphs(blocks));

  const doc = new Document({
    sections: createDocumentSections({
      projectTitle: params.projectTitle,
      sections: [{ children }],
    }),
  });

  await mkdir(path.dirname(params.outputPath), { recursive: true });
  const buffer = await Packer.toBuffer(doc);
  await writeFile(params.outputPath, buffer);
}

export async function exportManuscriptToDocx(params: {
  title: string;
  chapters: ChapterExportSection[];
  outputPath: string;
  projectTitle: string;
}): Promise<void> {
  const sections = params.chapters.map((chapter, index) => {
    const blocks = extractRichTextBlocks(chapter.document);
    return {
      sectionType: index === 0 ? undefined : SectionType.NEXT_PAGE,
      children: [
        createChapterTitleParagraph(chapter.title, HeadingLevel.HEADING_1),
        ...blocksToDocxParagraphs(blocks),
      ],
    };
  });

  const doc = new Document({
    sections: createDocumentSections({
      projectTitle: params.projectTitle,
      sections,
    }),
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

function escapeCssString(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', ' ');
}

function spansToHtml(spans: RichTextSpan[]): string {
  return spans
    .map((span) => {
      let text = escapeHtml(span.text).replaceAll('\n', '<br />');
      const styles: string[] = [];
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

function slugifyFileName(input: string, fallback: string): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}

function spansToEpubHtml(spans: RichTextSpan[]): string {
  return spansToHtml(spans);
}

function blocksToEpubHtml(blocks: ReturnType<typeof extractRichTextBlocks>): string {
  return blocks
    .map((block) => {
      const content = spansToEpubHtml(block.spans);
      const style = block.align ? ` style="text-align: ${block.align}"` : '';
      if (block.type === 'heading') {
        const level = block.level && block.level > 1 ? 2 : 1;
        return `<h${level}${style}>${content}</h${level}>`;
      }
      if (block.type === 'blockquote') {
        return `<blockquote${style}>${content}</blockquote>`;
      }
      return `<p${style}>${content}</p>`;
    })
    .join('\n');
}

function buildEpubStyles(): string {
  return `
@namespace epub "http://www.idpf.org/2007/ops";

html,
body {
  margin: 0;
  padding: 0;
}

body {
  color: #111827;
  font-family: "${MANUSCRIPT_FONT}", monospace;
  font-size: ${MANUSCRIPT_FONT_SIZE_POINTS}pt;
  line-height: 2;
}

.manuscript-page {
  width: 80ch;
  max-width: 100%;
  margin: 0;
}

section[epub|type="chapter"] {
  break-before: page;
  page-break-before: always;
}

h1,
h2 {
  font-size: ${MANUSCRIPT_FONT_SIZE_POINTS}pt;
  line-height: 2;
  margin: 0;
  font-weight: 700;
  text-align: left;
}

p {
  margin: 0;
  min-height: 2em;
}

blockquote {
  margin: 0 0 0 4ch;
  padding: 0;
}
`;
}

function buildEpubChapterXhtml(chapter: ChapterExportSection, index: number): string {
  const content = blocksToEpubHtml(extractRichTextBlocks(chapter.document));
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="it" xml:lang="it">
  <head>
    <title>${escapeHtml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="../styles/manuscript.css" />
  </head>
  <body>
    <main class="manuscript-page">
      <section epub:type="chapter" id="chapter-${index + 1}">
        <h1>${escapeHtml(chapter.title)}</h1>
        ${content}
      </section>
    </main>
  </body>
</html>
`;
}

function buildEpubNavXhtml(params: {
  title: string;
  chapters: Array<{ title: string; href: string }>;
}): string {
  const items = params.chapters
    .map((chapter) => `<li><a href="${chapter.href}">${escapeHtml(chapter.title)}</a></li>`)
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="it" xml:lang="it">
  <head>
    <title>${escapeHtml(params.title)}</title>
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>${escapeHtml(params.title)}</h1>
      <ol>
        ${items}
      </ol>
    </nav>
  </body>
</html>
`;
}

function buildEpubOpf(params: {
  title: string;
  identifier: string;
  chapters: Array<{ id: string; href: string }>;
}): string {
  const manifestChapters = params.chapters
    .map(
      (chapter) =>
        `<item id="${chapter.id}" href="${chapter.href}" media-type="application/xhtml+xml" />`,
    )
    .join('\n    ');
  const spineChapters = params.chapters
    .map((chapter) => `<itemref idref="${chapter.id}" />`)
    .join('\n    ');

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:${params.identifier}</dc:identifier>
    <dc:title>${escapeHtml(params.title)}</dc:title>
    <dc:language>it</dc:language>
    <meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="style" href="styles/manuscript.css" media-type="text/css" />
    ${manifestChapters}
  </manifest>
  <spine>
    ${spineChapters}
  </spine>
</package>
`;
}

function buildEpubContainerXml(): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`;
}

export async function exportManuscriptToEpub(params: {
  title: string;
  chapters: ChapterExportSection[];
  outputPath: string;
}): Promise<void> {
  const zip = new JSZip();
  const chapterFiles = params.chapters.map((chapter, index) => {
    const baseName = slugifyFileName(chapter.title, `chapter-${index + 1}`);
    return {
      id: `chapter-${index + 1}`,
      title: chapter.title,
      href: `chapters/${String(index + 1).padStart(3, '0')}-${baseName}.xhtml`,
      chapter,
    };
  });

  zip.file('mimetype', 'application/epub+zip', {
    compression: 'STORE',
  });
  zip.file('META-INF/container.xml', buildEpubContainerXml());
  zip.file('OEBPS/styles/manuscript.css', buildEpubStyles());
  zip.file(
    'OEBPS/nav.xhtml',
    buildEpubNavXhtml({
      title: params.title,
      chapters: chapterFiles.map((chapter) => ({ title: chapter.title, href: chapter.href })),
    }),
  );
  zip.file(
    'OEBPS/content.opf',
    buildEpubOpf({
      title: params.title,
      identifier: randomUUID(),
      chapters: chapterFiles.map((chapter) => ({ id: chapter.id, href: chapter.href })),
    }),
  );

  chapterFiles.forEach((chapterFile, index) => {
    zip.file(`OEBPS/${chapterFile.href}`, buildEpubChapterXhtml(chapterFile.chapter, index));
  });

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    mimeType: 'application/epub+zip',
  });

  await mkdir(path.dirname(params.outputPath), { recursive: true });
  await writeFile(params.outputPath, buffer);
}

function buildPrintStyle(projectTitle: string): string {
  return `
        @page {
          size: A4;
          margin: 1.6in 0.7in 1.76in;
          @top-left {
            content: "${escapeCssString(projectTitle)}";
            font-family: "${MANUSCRIPT_FONT}", monospace;
            font-size: ${MANUSCRIPT_FONT_SIZE_POINTS}pt;
            text-align: left;
            vertical-align: top;
            padding-top: 0.75in;
          }
          @bottom-left {
            content: counter(page);
            font-family: "${MANUSCRIPT_FONT}", monospace;
            font-size: ${MANUSCRIPT_FONT_SIZE_POINTS}pt;
            text-align: left;
            vertical-align: bottom;
            padding-bottom: 0.75in;
          }
        }
        html {
          counter-reset: page;
        }
        body {
          font-family: "${MANUSCRIPT_FONT}", monospace;
          font-size: ${MANUSCRIPT_FONT_SIZE_POINTS}pt;
          line-height: 2;
          color: #111827;
          margin: 0;
        }
        .manuscript-page {
          width: 80ch;
          margin: 0;
        }
        .chapter {
          break-inside: auto;
          page-break-inside: auto;
        }
        .chapter + .chapter {
          break-before: page;
          page-break-before: always;
        }
        h1,
        h2 {
          font-size: ${MANUSCRIPT_FONT_SIZE_POINTS}pt;
          line-height: 2;
          margin: 0;
          font-weight: 700;
          break-after: avoid;
          page-break-after: avoid;
          text-align: left;
        }
        p {
          margin: 0;
          min-height: 2em;
        }
        blockquote {
          margin: 0 0 0 4ch;
          padding: 0;
          border: 0;
          color: #111827;
        }
  `;
}

function buildPrintHtml(params: { title: string; projectTitle: string; body: string }): string {
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
        ${buildPrintStyle(params.projectTitle)}
      </style>
    </head>
    <body>
      <main class="manuscript-page">
        ${params.body}
      </main>
    </body>
  </html>
  `;
}

export function buildChapterPrintHtml(params: {
  title: string;
  projectTitle: string;
  document: RichTextDocument;
}): string {
  const content = blocksToHtml(extractRichTextBlocks(params.document));
  return buildPrintHtml({
    title: params.title,
    projectTitle: params.projectTitle,
    body: `
      <section class="chapter">
        <h1>${escapeHtml(params.title)}</h1>
        ${content}
      </section>
    `,
  });
}

export function buildManuscriptPrintHtml(params: {
  title: string;
  projectTitle: string;
  chapters: ChapterExportSection[];
}): string {
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

  return buildPrintHtml({
    title: params.title,
    projectTitle: params.projectTitle,
    body: chaptersHtml,
  });
}
