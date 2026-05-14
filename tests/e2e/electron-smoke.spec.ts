import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';
import { _electron as electron, type ElectronApplication } from 'playwright';

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

test.describe('electron packaged smoke', () => {
  test.setTimeout(120_000);

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
