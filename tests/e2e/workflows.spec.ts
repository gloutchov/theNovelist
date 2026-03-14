import { expect, test, type Page } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

async function createProject(page: Page, name: string): Promise<void> {
  const projectPanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Progetto' }),
  });

  await projectPanel.getByLabel('Path progetto').fill(`/tmp/the-novelist-e2e-${Date.now()}`);
  await projectPanel.getByLabel('Nome progetto').fill(name);
  await projectPanel.getByRole('button', { name: 'Crea' }).click();

  await expect(page.getByText(`Progetto creato: ${name}`)).toBeVisible();
}

async function openChapterEditorWithText(page: Page, projectName: string): Promise<void> {
  await createProject(page, projectName);

  const nodePanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuovo Capitolo' }),
  });
  await nodePanel.getByLabel('Titolo').fill('Capitolo Alpha');
  await nodePanel.getByLabel('Descrizione').fill('Scena iniziale');
  await nodePanel.getByRole('button', { name: 'Crea Blocco' }).click();

  await expect(page.getByText('Blocco creato: Capitolo Alpha')).toBeVisible();
  await page.locator('.canvas-wrap .react-flow__node').first().click();
  await expect(page.getByRole('button', { name: 'Apri Editor Capitolo' })).toBeEnabled();
  await page.getByRole('button', { name: 'Apri Editor Capitolo' }).click();
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
  await expect(page.getByText('Caricamento capitolo...')).toBeHidden();

  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.pressSequentially('testo originale');
  await expect(editorContent).toContainText('testo originale');
}

test.beforeEach(async ({ page }) => {
  await installNovelistApiMock(page);
  await page.goto('/');
});

test('story workflow with Codex preview discard', async ({ page }) => {
  await openChapterEditorWithText(page, 'E2E Story Discard');
  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.press(selectAllShortcut);
  await expect(page.locator('.selection-bubble')).toBeVisible();
  await page.locator('.selection-bubble').getByRole('button', { name: 'Riscrivi' }).dispatchEvent('click');

  await expect(page.getByRole('heading', { name: 'Anteprima modifica Codex' })).toBeVisible();
  await page.getByRole('button', { name: 'Scarta' }).click();
  await expect(page.getByRole('heading', { name: 'Anteprima modifica Codex' })).toBeHidden();
});

test('story workflow with Codex preview apply', async ({ page }) => {
  await openChapterEditorWithText(page, 'E2E Story Apply');
  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.press(selectAllShortcut);
  await expect(page.locator('.selection-bubble')).toBeVisible();
  await page.locator('.selection-bubble').getByRole('button', { name: 'Riscrivi' }).dispatchEvent('click');
  await page.getByRole('button', { name: 'Applica' }).click();

  await expect(page.getByRole('heading', { name: 'Anteprima modifica Codex' })).toBeHidden();
});

test('character board create and edit card', async ({ page }) => {
  await createProject(page, 'E2E Characters');

  const nodePanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuovo Capitolo' }),
  });
  await nodePanel.getByLabel('Titolo').fill('Capitolo Personaggi');
  await nodePanel.getByRole('button', { name: 'Crea Blocco' }).click();

  await page.getByRole('button', { name: 'Personaggi' }).click();
  await expect(page.getByRole('heading', { name: 'Nuovo Personaggio' })).toBeVisible();

  const createPanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuovo Personaggio' }),
  });
  await createPanel.getByLabel('Nome', { exact: true }).fill('Anna');
  await createPanel.getByLabel('Cognome', { exact: true }).fill('Rossi');
  await createPanel.getByRole('button', { name: 'Crea Scheda' }).click();

  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Anna Rossi')).toBeVisible();
  await canvas.getByText('Anna Rossi').dblclick();

  const modal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Personaggio' }),
  });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Prompt Da Codex' }).click();

  const prompt = modal.getByLabel('Prompt');
  await expect(prompt).toHaveValue(/Suggerimento mock:/);
  await modal.getByRole('button', { name: 'Salva Scheda' }).click();
  await expect(modal).toBeHidden();
});

test('location board create and edit card', async ({ page }) => {
  await createProject(page, 'E2E Locations');

  const nodePanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuovo Capitolo' }),
  });
  await nodePanel.getByLabel('Titolo').fill('Capitolo Location');
  await nodePanel.getByRole('button', { name: 'Crea Blocco' }).click();

  await page.getByRole('button', { name: 'Location' }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Location' })).toBeVisible();

  await page.getByLabel('Nome').fill('Porto Vecchio');
  await page.getByLabel('Tipo luogo').fill('Porto');
  await page.getByRole('button', { name: 'Crea Scheda' }).click();

  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Porto Vecchio')).toBeVisible();
  await canvas.getByText('Porto Vecchio').dblclick();

  const modal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Location' }),
  });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Prompt Da Codex' }).click();

  const prompt = modal.getByLabel('Prompt');
  await expect(prompt).toHaveValue(/Suggerimento mock:/);

  await modal.getByLabel('Path file immagine').fill('/tmp/mock-location.png');
  await modal.getByRole('button', { name: 'Associa Immagine' }).click();
  await expect(modal.getByText('/tmp/mock-location.png')).toBeVisible();
});
