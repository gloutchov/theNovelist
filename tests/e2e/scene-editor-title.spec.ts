import { expect, test, type Page } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

const renderWarning = 'Cannot update a component';

async function createProject(page: Page, name: string): Promise<void> {
  await page.evaluate(() => {
    window.novelistApi.selectProjectDirectory = async () => `/tmp/the-novelist-e2e-${Date.now()}`;
  });

  await page.getByRole('button', { name: 'Crea', exact: true }).click();
  const createProjectModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Progetto' }),
  });
  await expect(createProjectModal).toBeVisible();
  await createProjectModal.getByRole('button', { name: 'Sfoglia...' }).click();
  await createProjectModal.getByLabel('Nome progetto').fill(name);
  await createProjectModal.getByRole('button', { name: 'Crea e Apri' }).click();
  await expect(page.getByText(`Progetto creato: ${name}`)).toBeVisible();
}

test('scene editor keeps the scene name and does not warn while rendering', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  await installNovelistApiMock(page);
  await page.goto('/');
  await createProject(page, 'E2E Scene Title');
  await page.getByRole('button', { name: 'Capitoli' }).click();
  await page.getByRole('button', { name: 'Nuovo Capitolo' }).click();
  const createChapterModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Nuovo Capitolo' }),
  });
  await createChapterModal.getByLabel('Titolo').fill('Capitolo Alfa');
  await createChapterModal.getByRole('button', { name: 'Crea Blocco' }).click();
  await expect(page.getByText('Blocco creato: Capitolo Alfa')).toBeVisible();

  await page.evaluate(async () => {
    const state = await window.novelistApi.getStoryState();
    const chapter = state.nodes[0];
    if (!chapter) {
      throw new Error('Capitolo test non trovato');
    }
    await window.novelistApi.createSceneCard({
      chapterNodeId: chapter.id,
      name: 'Scena Alfa',
      text: 'Testo della scena.',
      contentJson: JSON.stringify({
        type: 'doc',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Testo della scena.' }] }],
      }),
      notes: '',
      plotNumber: chapter.plotNumber,
      positionX: 180,
      positionY: 140,
    });
  });

  await page.getByRole('button', { name: 'Scene' }).click();
  await expect(page.locator('.scene-flow-node-title').first()).toHaveText('Scena Alfa');
  expect(consoleErrors.filter((entry) => entry.includes(renderWarning))).toEqual([]);

  await page.evaluate(() => {
    const original = window.novelistApi.getStoryState.bind(window.novelistApi);
    window.novelistApi.getStoryState = async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 2000));
      return original();
    };
  });

  await page
    .locator('.canvas-wrap .react-flow__node')
    .filter({ hasText: 'Scena Alfa' })
    .first()
    .dispatchEvent('dblclick');
  await expect(page.getByRole('heading', { name: 'Editor Scena' })).toBeVisible();
  await expect(page.getByText('Caricamento scena...')).toBeHidden();
  const titleWhileParentChapterLoads = await page
    .getByRole('textbox', { name: 'Titolo scena' })
    .inputValue();
  expect(titleWhileParentChapterLoads).toBe('Scena Alfa');

  await page.locator('.editor-shell').getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.locator('.status-panel .status')).toContainText(/Scena salvata|parole/i);

  const sceneName = await page.evaluate(async () => {
    const scenes = await window.novelistApi.listSceneCards();
    return scenes[0]?.name ?? '';
  });
  expect(sceneName).toBe('Scena Alfa');

  await page.locator('.editor-shell').getByRole('button', { name: 'Chiudi' }).click();
  await expect(page.getByRole('heading', { name: 'Editor Scena' })).toBeHidden();
  expect(consoleErrors.filter((entry) => entry.includes(renderWarning))).toEqual([]);
});
