import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';
import {
  buildChapterPrintHtml,
  buildManuscriptPrintHtml,
  exportManuscriptToDocx,
  exportManuscriptToEpub,
} from '../../src/main/chapters/exporters';
import type { RichTextDocument } from '../../src/main/chapters/rich-text';

const tempDirs: string[] = [];

function createDocument(text: string): RichTextDocument {
  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text }],
      },
    ],
  };
}

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

describe('chapter exporters manuscript formatting', () => {
  it('builds print HTML with project header, page footer and manuscript page geometry', () => {
    const html = buildChapterPrintHtml({
      title: 'Capitolo Uno',
      projectTitle: 'Romanzo Test',
      document: createDocument('Testo del capitolo.'),
    });

    expect(html).toContain('@page');
    expect(html).toContain('size: A4');
    expect(html).toContain('width: 80ch');
    expect(html).toContain('line-height: 2');
    expect(html).toContain('Romanzo Test');
    expect(html).toContain('@top-left');
    expect(html).toContain('@bottom-left');
    expect(html).toContain('counter(page)');
    expect(html).not.toContain('print-header');
    expect(html).not.toContain('print-footer');
  });

  it('starts manuscript print chapters on new pages after the first chapter', () => {
    const html = buildManuscriptPrintHtml({
      title: 'Romanzo Test - Documento completo',
      projectTitle: 'Romanzo Test',
      chapters: [
        { title: 'Capitolo Uno', document: createDocument('Primo testo.') },
        { title: 'Capitolo Due', document: createDocument('Secondo testo.') },
      ],
    });

    expect(html).toContain('.chapter + .chapter');
    expect(html).toContain('break-before: page');
    expect(html).toContain('Capitolo Uno');
    expect(html).toContain('Capitolo Due');
  });

  it('exports DOCX with project header, page footer and one section per chapter', async () => {
    const tempDir = await createTempDir('novelist-exporters-');
    const outputPath = path.join(tempDir, 'manoscritto.docx');

    await exportManuscriptToDocx({
      title: 'Romanzo Test - Documento completo',
      projectTitle: 'Romanzo Test',
      outputPath,
      chapters: [
        { title: 'Capitolo Uno', document: createDocument('Primo testo.') },
        { title: 'Capitolo Due', document: createDocument('Secondo testo.') },
      ],
    });

    const zip = await JSZip.loadAsync(await readFile(outputPath));
    const documentXml = await zip.file('word/document.xml')?.async('string');
    const headerXml = await zip.file('word/header1.xml')?.async('string');
    const footerXml = await zip.file('word/footer1.xml')?.async('string');

    expect(documentXml).toContain('Capitolo Uno');
    expect(documentXml).toContain('Capitolo Due');
    expect(documentXml).toContain('w:type w:val="nextPage"');
    expect(documentXml).toContain('w:line="480"');
    expect(documentXml).toContain('w:charSpace="120"');
    expect(headerXml).toContain('Romanzo Test');
    expect(footerXml).toContain('PAGE');
  });

  it('exports EPUB with manuscript stylesheet and chapter files', async () => {
    const tempDir = await createTempDir('novelist-exporters-');
    const outputPath = path.join(tempDir, 'manoscritto.epub');

    await exportManuscriptToEpub({
      title: 'Romanzo Test - Documento completo',
      outputPath,
      chapters: [
        { title: 'Capitolo Uno', document: createDocument('Primo testo.') },
        { title: 'Capitolo Due', document: createDocument('Secondo testo.') },
      ],
    });

    const zip = await JSZip.loadAsync(await readFile(outputPath));
    const mimetype = await zip.file('mimetype')?.async('string');
    const containerXml = await zip.file('META-INF/container.xml')?.async('string');
    const opfXml = await zip.file('OEBPS/content.opf')?.async('string');
    const navXml = await zip.file('OEBPS/nav.xhtml')?.async('string');
    const stylesheet = await zip.file('OEBPS/styles/manuscript.css')?.async('string');
    const firstChapter = await zip.file('OEBPS/chapters/001-capitolo-uno.xhtml')?.async('string');
    const secondChapter = await zip.file('OEBPS/chapters/002-capitolo-due.xhtml')?.async('string');

    expect(mimetype).toBe('application/epub+zip');
    expect(containerXml).toContain('OEBPS/content.opf');
    expect(opfXml).toContain('<dc:title>Romanzo Test - Documento completo</dc:title>');
    expect(opfXml).toContain('chapters/001-capitolo-uno.xhtml');
    expect(opfXml).toContain('chapters/002-capitolo-due.xhtml');
    expect(navXml).toContain('Capitolo Uno');
    expect(navXml).toContain('Capitolo Due');
    expect(stylesheet).toContain('width: 80ch');
    expect(stylesheet).toContain('line-height: 2');
    expect(stylesheet).toContain('break-before: page');
    expect(firstChapter).toContain('<h1>Capitolo Uno</h1>');
    expect(firstChapter).toContain('Primo testo.');
    expect(secondChapter).toContain('<h1>Capitolo Due</h1>');
    expect(secondChapter).toContain('Secondo testo.');
  });
});
