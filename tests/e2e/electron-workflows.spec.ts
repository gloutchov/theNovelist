import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';

const tempDirs: string[] = [];

type ElectronNovelistApi = {
  getStoryState: () => Promise<{ nodes: Array<{ id: string; title: string }> }>;
  getChapterDocument: (payload: { chapterNodeId: string }) => Promise<{
    contentJson: string;
    wordCount: number;
  }>;
  listCharacterCards: () => Promise<unknown[]>;
  listLocationCards: () => Promise<unknown[]>;
};

async function createTempProjectRoot(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

async function launchBuiltElectronApp(
  envOverrides: NodeJS.ProcessEnv = {},
): Promise<{ app: ElectronApplication; window: Page }> {
  const entryPath = path.join(process.cwd(), 'out/main/index.js');
  const app = await electron.launch({
    args: [entryPath],
    env: {
      ...process.env,
      ...envOverrides,
      ELECTRON_DISABLE_SECURITY_WARNINGS: 'true',
    },
  });
  const window = await app.firstWindow();
  await window.waitForLoadState('domcontentloaded');
  return { app, window };
}

async function createProjectFromUi(window: Page, rootPath: string, name: string): Promise<void> {
  await window.getByRole('button', { name: 'Crea', exact: true }).click();

  const createProjectModal = window.locator('.modal-card').filter({
    has: window.getByRole('heading', { name: 'Crea Progetto' }),
  });
  await expect(createProjectModal).toBeVisible({ timeout: 10_000 });
  await createProjectModal.getByRole('button', { name: 'Sfoglia...' }).click();
  await expect(createProjectModal.getByPlaceholder(/Seleziona la cartella/)).toHaveValue(rootPath);
  await createProjectModal.getByLabel('Nome progetto').fill(name);
  const createAndOpenButton = createProjectModal.getByRole('button', { name: 'Crea e Apri' });
  await expect(createAndOpenButton).toBeEnabled();
  await createAndOpenButton.click();

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
  await window.getByRole('button', { name: 'Trame' }).click();
  await window.getByRole('button', { name: 'Nuova Trama' }).click();
  const plotModal = window.locator('.modal-card').filter({
    has: window.getByRole('heading', { name: 'Nuova Trama' }),
  });
  await expect(plotModal).toBeVisible({ timeout: 10_000 });
  await plotModal.getByRole('button', { name: 'Crea Trama' }).click();
  await expect(window.locator('.status-panel .status')).toContainText(/Trama creata:/, { timeout: 10_000 });
  await window.getByRole('button', { name: 'Capitoli' }).click();
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
    const { app, window } = await launchBuiltElectronApp({
      NOVELIST_TEST_PROJECT_DIRECTORY: rootPath,
    });

    try {
      await expect(window.getByRole('heading', { name: 'The Novelist' })).toBeVisible();
      await createProjectFromUi(window, rootPath, projectName);
      await createDefaultPlotFromUi(window);

      await window.getByRole('button', { name: 'Nuovo Capitolo' }).click();
      const nodeModal = window.locator('.modal-card').filter({
        has: window.getByRole('heading', { name: 'Nuovo Capitolo' }),
      });
      await expect(nodeModal).toBeVisible({ timeout: 10_000 });
      await nodeModal.getByLabel('Titolo').fill('Capitolo DB Reale');
      await nodeModal.getByLabel('Descrizione').fill('Persistenza editor in SQLite');
      await nodeModal.getByRole('button', { name: 'Crea Blocco' }).click();

      const createdNode = window.locator('.react-flow__node').last();
      await expect(createdNode).toBeVisible({ timeout: 10_000 });
      await createdNode.dblclick();
      await expect(window.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
      await expect(window.getByText('Caricamento capitolo...')).toBeHidden();
      const editorContent = window.locator('.novelist-editor-content');
      await editorContent.click({ position: { x: 24, y: 18 } });
      await editorContent.pressSequentially('Questo testo viene scritto su DB reale');
      await window.getByRole('button', { name: 'Salva', exact: true }).click();
      await window.getByRole('button', { name: 'Chiudi', exact: true }).click();
      await expect(window.getByRole('heading', { name: 'Editor Capitolo' })).toBeHidden();

      const storyState = await window.evaluate(() => {
        const api = (globalThis as unknown as { novelistApi: ElectronNovelistApi }).novelistApi;
        return api.getStoryState();
      });
      const nodeRow = storyState.nodes.find((node) => node.title === 'Capitolo DB Reale');
      expect(nodeRow?.title).toBe('Capitolo DB Reale');

      const documentRow = await window.evaluate(
        (chapterNodeId) => {
          const api = (globalThis as unknown as { novelistApi: ElectronNovelistApi }).novelistApi;
          return api.getChapterDocument({ chapterNodeId });
        },
        nodeRow?.id ?? '',
      );
      expect(documentRow).toBeDefined();
      expect(documentRow?.contentJson ?? '').toContain('Questo testo viene scritto su DB reale');
      expect(documentRow?.wordCount ?? 0).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });

  test('persists character and location cards through real IPC/SQLite', async () => {
    const rootPath = await createTempProjectRoot('novelist-electron-cards-');
    const projectName = 'E2E Electron Cards';
    const { app, window } = await launchBuiltElectronApp({
      NOVELIST_TEST_PROJECT_DIRECTORY: rootPath,
    });

    try {
      await createProjectFromUi(window, rootPath, projectName);
      await createDefaultPlotFromUi(window);

      await window.getByRole('button', { name: 'Nuovo Capitolo' }).click();
      const nodeModal = window.locator('.modal-card').filter({
        has: window.getByRole('heading', { name: 'Nuovo Capitolo' }),
      });
      await expect(nodeModal).toBeVisible({ timeout: 10_000 });
      await nodeModal.getByLabel('Titolo').fill('Capitolo Supporto');
      await nodeModal.getByRole('button', { name: 'Crea Blocco' }).click();

      await window.getByRole('button', { name: 'Personaggi' }).click();
      await window.getByRole('button', { name: 'Crea Personaggio' }).click();

      const characterPanel = window.locator('.modal-card').filter({
        has: window.getByRole('heading', { name: 'Crea Personaggio' }),
      });
      await expect(characterPanel).toBeVisible();
      await characterPanel.getByLabel('Nome', { exact: true }).fill('Anna');
      await characterPanel.getByLabel('Cognome', { exact: true }).fill('Rossi');
      await characterPanel.getByRole('button', { name: 'Crea Scheda' }).click();
      await expect(window.locator('.canvas-wrap').getByText('Anna Rossi')).toBeVisible();

      await window.getByRole('button', { name: 'Location' }).click();
      await window.getByRole('button', { name: 'Crea Location' }).click();

      const locationPanel = window.locator('.modal-card').filter({
        has: window.getByRole('heading', { name: 'Crea Location' }),
      });
      await expect(locationPanel).toBeVisible();
      await locationPanel.getByLabel('Nome').fill('Porto Vecchio');
      await locationPanel.getByLabel('Tipologia luogo').fill('Porto');
      await locationPanel.getByRole('button', { name: 'Crea Scheda' }).click();
      await expect(window.locator('.canvas-wrap').getByText('Porto Vecchio')).toBeVisible();

      const characterRows = await window.evaluate(() => {
        const api = (globalThis as unknown as { novelistApi: ElectronNovelistApi }).novelistApi;
        return api.listCharacterCards();
      });
      const locationRows = await window.evaluate(() => {
        const api = (globalThis as unknown as { novelistApi: ElectronNovelistApi }).novelistApi;
        return api.listLocationCards();
      });

      expect(characterRows).toHaveLength(1);
      expect(locationRows).toHaveLength(1);
    } finally {
      await app.close();
    }
  });
});
