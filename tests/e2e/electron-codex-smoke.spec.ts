import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';

const tempDirs: string[] = [];

async function createTempDir(prefix: string): Promise<string> {
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
  await expect(createProjectModal.getByPlaceholder('Seleziona la cartella del progetto')).toHaveValue(rootPath);
  await createProjectModal.getByLabel('Nome progetto').fill(name);
  const createAndOpenButton = createProjectModal.getByRole('button', { name: 'Crea e Apri' });
  await expect(createAndOpenButton).toBeEnabled();
  await createAndOpenButton.click();
  await expect(window.getByRole('button', { name: 'Personaggi' })).toBeEnabled({ timeout: 10_000 });
}

async function createDefaultPlotFromUi(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Nuove Trame' }).click();
  const plotModal = window.locator('.modal-card').filter({
    has: window.getByRole('heading', { name: 'Nuove Trame' }),
  });
  await expect(plotModal).toBeVisible({ timeout: 10_000 });
  await plotModal.getByRole('button', { name: 'Crea Trama' }).click();
  await expect(window.locator('.status-panel .status')).toContainText(/Trama creata:/, { timeout: 10_000 });
}

async function createNodeAndOpenEditor(window: Page): Promise<void> {
  await window.getByRole('button', { name: 'Nuovo Capitolo' }).click();
  const nodeModal = window.locator('.modal-card').filter({
    has: window.getByRole('heading', { name: 'Nuovo Capitolo' }),
  });
  await expect(nodeModal).toBeVisible({ timeout: 10_000 });
  await nodeModal.getByLabel('Titolo').fill('Capitolo Smoke Codex');
  await nodeModal.getByLabel('Descrizione').fill('Verifica rilevamento Codex CLI');
  await nodeModal.getByRole('button', { name: 'Crea Blocco' }).click();

  const createdNode = window.locator('.react-flow__node').last();
  await expect(createdNode).toBeVisible({ timeout: 10_000 });
  await createdNode.click();

  const openEditorButton = window.getByRole('button', { name: 'Apri Editor Capitolo' });
  await expect(openEditorButton).toBeEnabled({ timeout: 10_000 });
  await openEditorButton.click();
  await expect(window.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
}

async function createFakeCodexEnvironment(rootPath: string): Promise<NodeJS.ProcessEnv> {
  const homeRoot = await createTempDir('novelist-codex-home-');

  const binDir = path.join(homeRoot, '.local', 'bin');
  const commandPath = path.join(binDir, 'codex');
  await mkdir(binDir, { recursive: true });
  await writeFile(
    commandPath,
    '#!/bin/sh\nif [ "$1" = "exec" ]; then\n  echo "ok"\n  exit 0\nfi\necho "unsupported" >&2\nexit 1\n',
    'utf8',
  );
  await chmod(commandPath, 0o755);

  return {
    HOME: homeRoot,
    NOVELIST_TEST_PROJECT_DIRECTORY: rootPath,
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin',
  };
}

test.describe('electron packaged Codex CLI smoke', () => {
  test.setTimeout(120_000);

  test.afterEach(async () => {
    await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
  });

  test('finds Codex CLI from common macOS shell locations even with a reduced PATH', async () => {
    const projectRoot = await createTempDir('novelist-codex-project-');
    const fakeCodexEnv = await createFakeCodexEnvironment(projectRoot);
    const { app, window } = await launchBuiltElectronApp(fakeCodexEnv);

    try {
      await createProjectFromUi(window, projectRoot, 'Smoke Codex');
      await createDefaultPlotFromUi(window);
      await createNodeAndOpenEditor(window);

      const statusPanel = window.locator('.codex-status');
      await expect(statusPanel.getByText(/Stato:/)).toBeVisible();
      await expect(statusPanel.getByText(/Disponibile \(/)).toBeVisible({ timeout: 15_000 });
    } finally {
      await app.close();
    }
  });
});
