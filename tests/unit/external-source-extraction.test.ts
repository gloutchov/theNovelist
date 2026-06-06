import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { afterEach, describe, expect, it } from 'vitest';
import { extractExternalSourceText } from '../../src/main/sources/extraction';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

async function writeXlsxFile(filePath: string, files: Record<string, string>): Promise<void> {
  const zip = new JSZip();
  for (const [zipPath, content] of Object.entries(files)) {
    zip.file(zipPath, content);
  }

  await writeFile(filePath, await zip.generateAsync({ type: 'nodebuffer' }));
}

describe('external source extraction', () => {
  it('extracts inline string cells from XLSX files', async () => {
    const dir = await createTempDir('novelist-xlsx-inline-');
    const filePath = path.join(dir, 'Personaggi_Cappuccetto_Rosso.xlsx');
    await writeXlsxFile(filePath, {
      'xl/worksheets/sheet1.xml': `
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1">
              <c r="A1" t="inlineStr"><is><t>Nome</t></is></c>
              <c r="B1" t="inlineStr"><is><t>Ruolo</t></is></c>
            </row>
            <row r="2">
              <c r="A2" t="inlineStr"><is><t>Cappuccetto Rosso</t></is></c>
              <c r="B2" t="inlineStr"><is><t>protagonista</t></is></c>
            </row>
          </sheetData>
        </worksheet>
      `,
    });

    const extracted = await extractExternalSourceText(filePath);

    expect(extracted.fileType).toBe('xlsx');
    expect(extracted.extractionMethod).toBe('local');
    expect(extracted.extractionStatus).toBe('indexed');
    expect(extracted.text).toContain('Nome | Ruolo');
    expect(extracted.text).toContain('Cappuccetto Rosso | protagonista');
  });

  it('extracts rich shared strings from XLSX files', async () => {
    const dir = await createTempDir('novelist-xlsx-shared-');
    const filePath = path.join(dir, 'personaggi.xlsx');
    await writeXlsxFile(filePath, {
      'xl/sharedStrings.xml': `
        <sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <si><t>Personaggio</t></si>
          <si><r><t>Nonna</t></r><r><t> malata</t></r></si>
        </sst>
      `,
      'xl/worksheets/sheet1.xml': `
        <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
          <sheetData>
            <row r="1"><c r="A1" t="s"><v>0</v></c></row>
            <row r="2"><c r="A2" t="s"><v>1</v></c></row>
          </sheetData>
        </worksheet>
      `,
    });

    const extracted = await extractExternalSourceText(filePath);

    expect(extracted.text).toContain('Personaggio');
    expect(extracted.text).toContain('Nonna malata');
  });
});
