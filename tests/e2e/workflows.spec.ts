import { expect, test, type Page } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

const selectAllShortcut = process.platform === 'darwin' ? 'Meta+A' : 'Control+A';

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

async function createChapter(
  page: Page,
  title: string,
  description = '',
): Promise<void> {
  await page.getByRole('button', { name: 'Nuovo Capitolo' }).click();

  const createChapterModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Nuovo Capitolo' }),
  });
  await expect(createChapterModal).toBeVisible();
  await createChapterModal.getByLabel('Titolo').fill(title);
  if (description) {
    await createChapterModal.getByLabel('Descrizione').fill(description);
  }
  await createChapterModal.getByRole('button', { name: 'Crea Blocco' }).click();

  await expect(page.getByText(`Blocco creato: ${title}`)).toBeVisible();
}

async function openChapterEditorWithText(
  page: Page,
  projectName: string,
  chapterText = 'testo originale',
): Promise<void> {
  await createProject(page, projectName);
  await createChapter(page, 'Capitolo Alpha', 'Scena iniziale');
  await page.locator('.canvas-wrap .react-flow__node').first().dblclick();

  const editNodeModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Blocco' }),
  });
  await expect(editNodeModal).toBeVisible();
  await editNodeModal.getByRole('button', { name: 'Apri editor capitolo' }).click();

  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
  await expect(page.getByText('Caricamento capitolo...')).toBeHidden();

  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.pressSequentially(chapterText);
  await expect(editorContent).toContainText(chapterText);
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
  await createChapter(page, 'Capitolo Personaggi');

  await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
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
  await createChapter(page, 'Capitolo Location');

  await page.getByRole('button', { name: 'Location', exact: true }).click();
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

test('create character card from editor selection', async ({ page }) => {
  const sourceText =
    'Anna Rossi e una investigatrice dai capelli rossi, trentaduenne, slanciata.';
  await openChapterEditorWithText(page, 'E2E Create Character From Editor', sourceText);

  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.press(selectAllShortcut);
  await editorContent.dispatchEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 160,
    clientY: 160,
  });

  const selectionContextMenu = page.locator('.selection-context-menu');
  await expect(selectionContextMenu).toBeVisible();
  await selectionContextMenu.getByRole('button', { name: 'Crea personaggio' }).dispatchEvent('click');

  const createModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Scheda Personaggio' }),
  });
  await createModal.getByLabel('Nome personaggio').fill('Anna Rossi');
  await createModal.getByRole('button', { name: 'Crea e inserisci @' }).click();

  await expect(editorContent).toContainText('@Anna Rossi');
  await expect(editorContent).toContainText(sourceText);
  await page.locator('.editor-shell').getByRole('button', { name: 'Chiudi' }).click();

  await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Anna Rossi')).toBeVisible();
  await canvas.getByText('Anna Rossi').dblclick();

  const editModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Personaggio' }),
  });
  await expect(editModal.getByLabel('Lavoro')).toHaveValue('investigatrice');
  await expect(editModal.getByLabel('Colore capelli')).toHaveValue('rossi');
  await expect(editModal.getByLabel('Età')).toHaveValue('32');
  await expect(editModal.getByLabel('Note')).toHaveValue(sourceText);
});

test('create location card from editor selection', async ({ page }) => {
  const sourceText = 'Il Porto Vecchio e un porto nebbioso con banchine umide e gru arrugginite.';
  await openChapterEditorWithText(page, 'E2E Create Location From Editor', sourceText);

  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.press(selectAllShortcut);
  await editorContent.dispatchEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    clientX: 160,
    clientY: 160,
  });

  const selectionContextMenu = page.locator('.selection-context-menu');
  await expect(selectionContextMenu).toBeVisible();
  await selectionContextMenu.getByRole('button', { name: 'Crea location' }).dispatchEvent('click');

  const createModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Scheda Location' }),
  });
  await createModal.getByLabel('Nome location').fill('Porto Vecchio');
  await createModal.getByRole('button', { name: 'Crea e inserisci @' }).click();

  await expect(editorContent).toContainText('@Porto Vecchio');
  await expect(editorContent).toContainText(sourceText);
  await page.locator('.editor-shell').getByRole('button', { name: 'Chiudi' }).click();

  await page.getByRole('button', { name: 'Location', exact: true }).click();
  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Porto Vecchio')).toBeVisible();
  await canvas.getByText('Porto Vecchio').dblclick();

  const editModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Location' }),
  });
  await expect(editModal.getByLabel('Tipologia luogo')).toHaveValue('porto');
  await expect(editModal.getByLabel('Descrizione')).toHaveValue(
    'Porto nebbioso con banchine umide e gru arrugginite.',
  );
  await expect(editModal.getByLabel('Note')).toHaveValue(sourceText);
});

test('plot board shows created plot cards on canvas', async ({ page }) => {
  await createProject(page, 'E2E Plots');

  await page.getByRole('button', { name: 'Trame', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Trama' })).toBeVisible();

  const plotPanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuova Trama' }),
  });
  await plotPanel.getByLabel('Titolo trama').fill('Trama di prova');
  await plotPanel.getByLabel('Bozza trama / struttura').fill('Bozza sintetica');
  await plotPanel.getByRole('button', { name: 'Crea Trama' }).click();

  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Trama di prova')).toBeVisible();
});
