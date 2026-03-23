import { expect, test } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

test.beforeEach(async ({ page }) => {
  await installNovelistApiMock(page);
  await page.goto('/');
});

test('plot board shows existing plot cards with current project creation flow', async ({ page }) => {
  await page.evaluate(() => {
    window.novelistApi.selectProjectDirectory = async () => `/tmp/the-novelist-e2e-${Date.now()}`;
  });

  await page.getByRole('button', { name: 'Crea' }).click();

  const createProjectModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Progetto' }),
  });
  await expect(createProjectModal).toBeVisible();
  await createProjectModal.getByRole('button', { name: 'Sfoglia...' }).click();
  await createProjectModal.getByLabel('Nome progetto').fill('E2E Plot Current UI');
  await createProjectModal.getByRole('button', { name: 'Crea e Apri' }).click();

  const plotsTab = page.getByRole('button', { name: 'Trame', exact: true });
  await expect(plotsTab).toBeEnabled();
  await plotsTab.click();
  await expect(page.getByRole('heading', { name: 'Nuova Trama' })).toBeVisible();

  const plotPanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuova Trama' }),
  });
  await plotPanel.getByLabel('Titolo trama').fill('Trama di prova');
  await plotPanel.getByLabel('Bozza trama / struttura').fill('Bozza sintetica');
  await plotPanel.getByRole('button', { name: 'Crea Trama' }).click();

  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Trama di prova')).toBeVisible();
  await expect(page.locator('.plot-flow-node')).toHaveCount(1);
});
