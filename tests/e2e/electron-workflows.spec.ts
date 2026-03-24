import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { expect, test, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';

const tempDirs: string[] = [];
const execFileAsync = promisify(execFile);

async function createTempProjectRoot(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function launchBuiltElectronApp(): Promise<{ app: ElectronApplication; window: Page }> {
  const entryPath = path.join(process.cwd(), 'out/main/index.js');
  const app = await electron.launch({
    args: process.platform === 'linux' ? ['--no-sandbox', entryPath] : [entryPath],
    env: {
      ...process.env,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
      ...(process.platform === 'linux' ? { ELECTRON_DISABLE_SANDBOX: 'true' } : {}),
    },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

async function createProjectFromUi(window: Page, rootPath: string, name: string): Promise<void> {
  const projectPanel = window.locator('.panel').filter({
    has: window.getByRole('heading', { name: 'Progetto' }),
  });
  await projectPanel.getByLabel('Path progetto').fill(rootPath);
  await projectPanel.getByLabel('Nome progetto').fill(name);
  await projectPanel.getByRole('button', { name: 'Crea' }).click();

  const charactersTab = window.getByRole('button', { name: 'Personaggi' });
  try {
    await expect(charactersTab).toBeEnabled({ timeout: 10_000 });
  } catch {
    const statusText = (await window.locator('.status-panel .status').first().textContent())?.trim() ?? '';
    const errorText = (await window.locator('.status-panel .error').first().textContent())?.trim() ?? '';
    throw new Error(`Creazione progetto fallita. Status: "${statusText}" Error: "${errorText}"`);
  }
}

async function createDefaultPlotFromUi(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Crea Trama' }).click();
  await expect(window.locator('.status-panel .status')).toContainText(/Trama .* creata/, { timeout: 10_000 });
}

function toSqlLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

async function querySqliteJson<T>(dbPath: string, sql: string): Promise<T[]> {
  const { stdout } = await execFileAsync('sqlite3', ['-json', dbPath, sql], { maxBuffer: 1024 * 1024 * 5 });
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }
  return JSON.parse(trimmed) as T[];
}

test.describe('electron real e2e workflows', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test.afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  test('persists chapter node and document through real IPC/SQLite', async () => {
    const rootPath = await createTempProjectRoot('novelist-electron-story-');
    const projectName = 'E2E Electron Story';
    const { app, window } = await launchBuiltElectronApp();

    try {
      await expect(window.getByRole('heading', { name: 'The Novelist' })).toBeVisible();
      await createProjectFromUi(window, rootPath, projectName);
      await createDefaultPlotFromUi(window);

      const nodePanel = window.locator('.panel').filter({
        has: window.getByRole('heading', { name: 'Nuovo Blocco' }),
      });
      await nodePanel.getByLabel('Titolo').fill('Capitolo DB Reale');
      await nodePanel.getByLabel('Descrizione').fill('Persistenza editor in SQLite');
      await nodePanel.getByRole('button', { name: 'Crea Blocco' }).click();

      const createdNode = window.locator('.react-flow__node').last();
      await expect(createdNode).toBeVisible({ timeout: 10_000 });
      await createdNode.click();

      const openEditorButton = window.getByRole('button', { name: 'Apri Editor Capitolo' });
      await expect(openEditorButton).toBeEnabled({ timeout: 10_000 });
      await openEditorButton.click();

      await expect(window.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
      await expect(window.getByText('Caricamento capitolo...')).toBeHidden();
      const editorContent = window.locator('.novelist-editor-content');
      await editorContent.click({ position: { x: 24, y: 18 } });
      await editorContent.pressSequentially('Questo testo viene scritto su DB reale');
      await window.getByRole('button', { name: 'Salva', exact: true }).click();
      await window.getByRole('button', { name: 'Chiudi', exact: true }).click();
      await expect(window.getByRole('heading', { name: 'Editor Capitolo' })).toBeHidden();

      const dbPath = path.join(rootPath, 'project.db');
      const nodeRows = await querySqliteJson<{ id: string; title: string }>(
        dbPath,
        `SELECT id, title FROM chapter_nodes WHERE title = ${toSqlLiteral('Capitolo DB Reale')} LIMIT 1;`,
      );
      const nodeRow = nodeRows[0];
      expect(nodeRow?.title).toBe('Capitolo DB Reale');

      const documentRows = await querySqliteJson<{ content_json: string; word_count: number }>(
        dbPath,
        `SELECT content_json, word_count FROM chapter_documents WHERE chapter_node_id = ${toSqlLiteral(nodeRow?.id ?? '')} LIMIT 1;`,
      );
      const documentRow = documentRows[0];
      expect(documentRow).toBeDefined();
      expect(documentRow?.content_json ?? '').toContain('Questo testo viene scritto su DB reale');
      expect(documentRow?.word_count ?? 0).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  test('persists character and location cards through real IPC/SQLite', async () => {
    const rootPath = await createTempProjectRoot('novelist-electron-cards-');
    const projectName = 'E2E Electron Cards';
    const { app, window } = await launchBuiltElectronApp();

    try {
      await createProjectFromUi(window, rootPath, projectName);
      await createDefaultPlotFromUi(window);

      const nodePanel = window.locator('.panel').filter({
        has: window.getByRole('heading', { name: 'Nuovo Blocco' }),
      });
      await nodePanel.getByLabel('Titolo').fill('Capitolo Supporto');
      await nodePanel.getByRole('button', { name: 'Crea Blocco' }).click();

      await window.getByRole('button', { name: 'Personaggi' }).click();
      await expect(window.getByRole('heading', { name: 'Nuovo Personaggio' })).toBeVisible();

      const characterPanel = window.locator('.panel').filter({
        has: window.getByRole('heading', { name: 'Nuovo Personaggio' }),
      });
      await characterPanel.getByLabel('Nome', { exact: true }).fill('Anna');
      await characterPanel.getByLabel('Cognome', { exact: true }).fill('Rossi');
      await characterPanel.getByRole('button', { name: 'Crea Scheda' }).click();
      await expect(window.locator('.canvas-wrap').getByText('Anna Rossi')).toBeVisible();

      await window.getByRole('button', { name: 'Location' }).click();
      await expect(window.getByRole('heading', { name: 'Nuova Location' })).toBeVisible();

      const locationPanel = window.locator('.panel').filter({
        has: window.getByRole('heading', { name: 'Nuova Location' }),
      });
      await locationPanel.getByLabel('Nome').fill('Porto Vecchio');
      await locationPanel.getByLabel('Tipo luogo').fill('Porto');
      await locationPanel.getByRole('button', { name: 'Crea Scheda' }).click();
      await expect(window.locator('.canvas-wrap').getByText('Porto Vecchio')).toBeVisible();

      const dbPath = path.join(rootPath, 'project.db');
      const characterRows = await querySqliteJson<{ count: number }>(dbPath, 'SELECT COUNT(*) as count FROM character_cards;');
      const locationRows = await querySqliteJson<{ count: number }>(dbPath, 'SELECT COUNT(*) as count FROM location_cards;');

      expect(characterRows[0]?.count ?? 0).toBe(1);
      expect(locationRows[0]?.count ?? 0).toBe(1);
    } finally {
      await app.close();
    }
  });
});
