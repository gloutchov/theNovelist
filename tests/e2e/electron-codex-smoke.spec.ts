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
      const codexStatus = await window.evaluate(() => {
        return (
          globalThis as unknown as Window & {
            novelistApi: {
              codexStatus: () => Promise<{
                available: boolean;
                command: string;
                mode: 'cli' | 'api' | 'fallback';
              }>;
            };
          }
        ).novelistApi.codexStatus();
      });
      expect(codexStatus.available).toBe(true);
      expect(codexStatus.mode).toBe('cli');
      expect(codexStatus.command).toContain('codex');
    } finally {
      await app.close();
    }
  });

  test('opens Info menu without closing the app', async () => {
    const { app, window } = await launchBuiltElectronApp();

    try {
      await expect(window.getByRole('heading', { name: 'The Novelist' })).toBeVisible();

      const result = await app.evaluate(async ({ app, BrowserWindow, Menu }) => {
        const applicationMenu = Menu.getApplicationMenu();
        const menuRoot =
          process.platform === 'darwin'
            ? applicationMenu?.items.find((item) => item.label === app.getName())
            : applicationMenu?.items.find((item) => item.label === 'Help');
        const infoItem = menuRoot?.submenu?.items.find((item) => item.label === 'Info');

        if (!infoItem) {
          return { ok: false, reason: 'Info menu item not found' };
        }

        const focusedWindow = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
        infoItem.click(focusedWindow, focusedWindow?.webContents, undefined);
        await new Promise((resolve) => setTimeout(resolve, 500));

        return {
          ok: true,
          openWindowCount: BrowserWindow.getAllWindows().filter((entry) => !entry.isDestroyed()).length,
          platform: process.platform,
        };
      });

      expect(result).toEqual(
        expect.objectContaining({
          ok: true,
        }),
      );
      expect(result.openWindowCount).toBeGreaterThan(0);
    } finally {
      await app.close();
    }
  });
});
