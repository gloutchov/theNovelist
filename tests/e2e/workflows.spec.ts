import { expect, test, type Page } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

const selectAllShortcut = 'ControlOrMeta+A';

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

async function createChapter(page: Page, title: string, description = ''): Promise<void> {
  await page.getByRole('button', { name: 'Capitoli' }).click();
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
  await page.locator('.canvas-wrap .react-flow__node').first().click();
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
  await expect(page.getByText('Caricamento capitolo...')).toBeHidden();

  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.pressSequentially(chapterText);
  await expect(editorContent).toContainText(chapterText);
}

async function closeChapterEditorSavingIfPrompted(page: Page): Promise<void> {
  await page.locator('.editor-shell').getByRole('button', { name: 'Chiudi' }).click();
  const confirmModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifiche non salvate' }),
  });
  await confirmModal.waitFor({ state: 'visible', timeout: 500 }).catch(() => undefined);
  if (await confirmModal.isVisible()) {
    await confirmModal.getByRole('button', { name: 'Salva e chiudi' }).click();
  }
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeHidden();
}

async function expectMiniMapHasColoredContent(page: Page): Promise<void> {
  await expect(page.locator('.react-flow__minimap')).toBeVisible();
  await expect(page.locator('.react-flow__minimap-node').first()).toBeVisible();
  const fills = await page.locator('.react-flow__minimap-node').evaluateAll((nodes) =>
    nodes.map((node) => {
      const fill = node.getAttribute('fill') || window.getComputedStyle(node).fill;
      return fill.trim().toLowerCase();
    }),
  );
  expect(
    fills.some(
      (fill) =>
        fill &&
        fill !== 'none' &&
        fill !== 'transparent' &&
        fill !== 'white' &&
        fill !== '#fff' &&
        fill !== '#ffffff' &&
        fill !== 'rgb(255, 255, 255)' &&
        fill !== 'rgba(255, 255, 255, 1)',
    ),
  ).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await installNovelistApiMock(page);
  await page.goto('/');
});

test('story workflow with AI preview discard', async ({ page }) => {
  await openChapterEditorWithText(page, 'E2E Story Discard');
  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.press(selectAllShortcut);
  await expect(page.locator('.selection-bubble')).toBeVisible();
  await page
    .locator('.selection-bubble')
    .getByRole('button', { name: 'Riscrivi' })
    .dispatchEvent('click');

  await expect(page.getByRole('heading', { name: 'Anteprima modifica AI' })).toBeVisible();
  await page.getByRole('button', { name: 'Scarta' }).click();
  await expect(page.getByRole('heading', { name: 'Anteprima modifica AI' })).toBeHidden();
});

test('story workflow with AI preview apply', async ({ page }) => {
  await openChapterEditorWithText(page, 'E2E Story Apply');
  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.press(selectAllShortcut);
  await expect(page.locator('.selection-bubble')).toBeVisible();
  await page
    .locator('.selection-bubble')
    .getByRole('button', { name: 'Riscrivi' })
    .dispatchEvent('click');
  await page.getByRole('button', { name: 'Applica' }).click();

  await expect(page.getByRole('heading', { name: 'Anteprima modifica AI' })).toBeHidden();
});

test('chapter editor find and replace updates text', async ({ page }) => {
  await openChapterEditorWithText(page, 'E2E Find Replace', 'La porta rossa resta rossa.');
  const editorContent = page.locator('.novelist-editor-content');

  await page.getByRole('button', { name: 'Sostituisci' }).click();
  const findPanel = page.locator('.find-replace-panel');
  await expect(findPanel).toBeVisible();
  await findPanel.getByLabel('Trova').fill('rossa');
  await findPanel.getByLabel('Sostituisci con').fill('blu');
  await findPanel.getByRole('button', { name: 'Sostituisci tutto' }).click();

  await expect(editorContent).toContainText('La porta blu resta blu.');
});

test('outline opens chapters and complete document in reading view', async ({ page }) => {
  await createProject(page, 'E2E Reading View');
  await createChapter(page, 'Capitolo Uno', 'Primo passaggio');
  await createChapter(page, 'Capitolo Due', 'Secondo passaggio');

  await page.evaluate(async () => {
    const state = await window.novelistApi.getStoryState();
    const firstChapter = state.nodes.find((node) => node.title === 'Capitolo Uno');
    const secondChapter = state.nodes.find((node) => node.title === 'Capitolo Due');
    if (!firstChapter || !secondChapter) {
      throw new Error('Capitoli test non trovati');
    }

    await window.novelistApi.createStoryEdge({
      sourceId: firstChapter.id,
      targetId: secondChapter.id,
    });
    await window.novelistApi.saveChapterDocument({
      chapterNodeId: firstChapter.id,
      contentJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Testo di lettura del primo capitolo.' }],
          },
        ],
      }),
      wordCount: 7,
    });
    await window.novelistApi.saveChapterDocument({
      chapterNodeId: secondChapter.id,
      contentJson: JSON.stringify({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Testo di lettura del secondo capitolo.' }],
          },
        ],
      }),
      wordCount: 7,
    });
  });

  await page.getByRole('button', { name: 'Scaletta' }).click();
  await expect(page.getByRole('heading', { name: 'Scaletta' })).toBeVisible();

  const firstChapterCard = page.locator('.outline-chapter-card').filter({
    has: page.getByRole('heading', { name: 'Capitolo Uno', exact: true }),
  });
  await firstChapterCard.getByRole('button', { name: 'Apri' }).click();
  const reader = page.locator('.reading-view-overlay');
  await expect(reader).toBeVisible();
  await expect(reader.getByRole('heading', { name: 'Capitolo Uno' })).toBeVisible();
  await expect(reader).toContainText('Testo di lettura del primo capitolo.');
  await reader.getByRole('button', { name: 'Chiudi' }).click();
  await expect(reader).toBeHidden();

  await page.getByRole('button', { name: 'Apri Documento completo' }).click();
  await expect(reader).toBeVisible();
  await expect(reader).toContainText('E2E Reading View - Documento completo');
  await expect(reader.getByText('Capitolo Uno').first()).toBeVisible();
  await expect(reader.getByText('Capitolo Due').first()).toBeVisible();
  await expect(reader).toContainText('Testo di lettura del primo capitolo.');
  await expect(reader).toContainText('Testo di lettura del secondo capitolo.');
});

test('timeline keeps zoom controls and minimap inside the canvas', async ({ page }) => {
  await createProject(page, 'E2E Timeline Controls');
  await createChapter(page, 'Capitolo Timeline', 'Evento iniziale');

  await page.getByRole('button', { name: 'Timeline' }).click();
  await expect(page.getByRole('heading', { name: 'Timeline', exact: true })).toBeVisible();
  await expect(page.locator('.timeline-canvas-controls')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom in' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Zoom out' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Adatta vista' })).toBeVisible();
  await expect(page.locator('.timeline-minimap')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Zoom' })).toHaveCount(0);
});

test('flow minimaps show simplified canvas content', async ({ page }) => {
  await createProject(page, 'E2E Flow Minimap Content');
  await createChapter(page, 'Capitolo MiniMap', 'Nodo visibile nella minimappa');

  await page.evaluate(async () => {
    const state = await window.novelistApi.getStoryState();
    const chapter = state.nodes[0];
    if (!chapter) {
      throw new Error('Capitolo test non trovato');
    }

    await window.novelistApi.createSceneCard({
      chapterNodeId: chapter.id,
      name: 'Scena MiniMap',
      text: 'Contenuto scena',
      contentJson: null,
      notes: '',
      plotNumber: 1,
      positionX: 180,
      positionY: 140,
    });
    await window.novelistApi.createCharacterCard({
      firstName: 'Ada',
      lastName: 'MiniMap',
      sex: '',
      age: null,
      sexualOrientation: '',
      species: '',
      hairColor: '',
      eyeColor: '',
      skinColor: '',
      bald: false,
      beard: '',
      physique: '',
      job: 'pilota',
      notes: '',
      plotNumber: 1,
      positionX: 180,
      positionY: 140,
    });
    await window.novelistApi.createLocationCard({
      name: 'Ponte MiniMap',
      locationType: 'astronave',
      description: '',
      notes: '',
      plotNumber: 1,
      positionX: 180,
      positionY: 140,
    });
  });

  await page.getByRole('button', { name: 'Capitoli' }).click();
  await expectMiniMapHasColoredContent(page);

  await page.getByRole('button', { name: 'Scene' }).click();
  await expectMiniMapHasColoredContent(page);

  await page.getByRole('button', { name: 'Personaggi' }).click();
  await expectMiniMapHasColoredContent(page);

  await page.getByRole('button', { name: 'Location' }).click();
  await expectMiniMapHasColoredContent(page);
});

test('settings separates AI options, consents and secrets', async ({ page }) => {
  await createProject(page, 'E2E Settings Layout');

  await page.getByRole('button', { name: 'Impostazioni' }).click();
  const settingsModal = page.locator('.settings-modal-card');
  await expect(settingsModal.getByRole('heading', { name: 'Impostazioni' })).toBeVisible();

  const preferencesSection = settingsModal.locator('details.settings-section').nth(0);
  await expect(preferencesSection.locator('summary')).toHaveText('Preferenze Utente');
  await expect(preferencesSection.getByLabel('Lingua interfaccia')).toHaveValue('auto');
  await expect(preferencesSection.getByText('Lingua effettiva: Italiano.')).toBeVisible();
  await expect(preferencesSection.getByLabel('Tema interfaccia')).toHaveValue('system');
  await expect(preferencesSection.getByText('Tema selezionato: Sistema.')).toBeVisible();
  await preferencesSection.getByLabel('Tema interfaccia').selectOption('dark');
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe('dark');
  await preferencesSection.getByLabel('Tema interfaccia').selectOption('system');
  await expect
    .poll(async () => page.evaluate(() => document.documentElement.dataset.theme))
    .toBe(undefined);

  const aiSection = settingsModal.locator('details.settings-section').nth(1);
  await expect(aiSection.locator('option[value="openai_api"]').first()).toHaveText('OpenAI API');
  await expect(aiSection.getByText('OpenAI API (opzionale)')).toHaveCount(0);
  await expect(aiSection.getByLabel('Modello API', { exact: true })).toHaveValue('gpt-5-mini');
  await expect(aiSection.getByLabel('Modello API immagini', { exact: true })).toHaveValue(
    'gpt-image-1',
  );
  await expect(aiSection.getByLabel('Modello Ollama', { exact: true })).toHaveValue(
    'gemma4:e4b-it-q4_K_M',
  );
  await expect(aiSection.getByLabel('Consenso invio testo a strumenti AI')).toHaveCount(0);
  await expect(aiSection.getByLabel('Abilita chiamate API esterne')).toHaveCount(0);
  await expect(
    aiSection.getByLabel('Auto-riassunto descrizione blocco al salvataggio'),
  ).toHaveCount(0);

  const consentSection = settingsModal.locator('details.settings-section').nth(2);
  await expect(consentSection.getByLabel('Abilita chiamate API esterne')).toBeVisible();
  await expect(consentSection.getByLabel('Consenso invio testo a strumenti AI')).toBeVisible();
  await expect(
    consentSection.getByLabel('Auto-riassunto descrizione blocco al salvataggio'),
  ).toBeVisible();

  const secretsSection = settingsModal.locator('details.settings-section').nth(3);
  await expect(secretsSection.getByText('Segreti', { exact: true })).toBeVisible();
  await expect(settingsModal.getByText('API Key (opzionale)')).toHaveCount(0);
  await secretsSection.locator('summary').click();
  await expect(secretsSection.getByLabel('API Key', { exact: true })).toBeVisible();

  await preferencesSection.getByLabel('Lingua interfaccia').selectOption('en');
  await expect(settingsModal.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await expect(preferencesSection.locator('summary')).toHaveText('User Preferences');
  await expect(preferencesSection.getByLabel('Interface theme')).toHaveValue('system');
  await expect(aiSection.locator('summary')).toHaveText('AI Settings');
  await expect(page.getByRole('button', { name: 'Dashboard', exact: true })).toBeVisible();
  await settingsModal.getByRole('button', { name: 'Close' }).click();
  await page.getByRole('button', { name: 'Chapters' }).click();
  await expect(page.getByRole('button', { name: 'New Chapter' })).toBeVisible();
  await page.getByRole('button', { name: 'Characters' }).click();
  await expect(page.getByRole('button', { name: 'Create Character' })).toBeVisible();
  await page.getByRole('button', { name: 'Locations' }).click();
  await expect(page.getByRole('button', { name: 'Create Location' })).toBeVisible();
  await page.getByRole('button', { name: 'Memory' }).click();
  await expect(page.getByText('Project Memory')).toBeVisible();

  await page.setViewportSize({ width: 1024, height: 720 });
  await expect(page.getByRole('button', { name: 'Chapters' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Revisions' })).toBeVisible();

  await page.getByRole('button', { name: 'Analysis' }).click();
  await expect(page.getByRole('heading', { name: 'Project Editorial Checks' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Narrative Coherence' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Run Test' }).first()).toBeVisible();
});

test('English interface smoke covers primary creation surfaces', async ({ page }) => {
  await page.getByRole('button', { name: 'Impostazioni' }).click();
  const settingsModal = page.locator('.settings-modal-card');
  const preferencesSection = settingsModal.locator('details.settings-section').nth(0);
  await preferencesSection.getByLabel('Lingua interfaccia').selectOption('en');
  await expect(settingsModal.getByRole('heading', { name: 'Settings' })).toBeVisible();
  await settingsModal.getByRole('button', { name: 'Close' }).click();

  await page.evaluate(() => {
    window.novelistApi.selectProjectDirectory = async () => `/tmp/the-novelist-e2e-${Date.now()}`;
  });
  await page.getByRole('button', { name: 'Create', exact: true }).click();
  const createProjectModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Create Project' }),
  });
  await expect(createProjectModal).toBeVisible();
  await expect(createProjectModal.getByLabel('Work directory')).toBeVisible();
  await createProjectModal.getByRole('button', { name: 'Browse...' }).click();
  await createProjectModal.getByLabel('Project name').fill('E2E English Smoke');
  await expect(createProjectModal.getByLabel('Project word target')).toBeVisible();
  await expect(createProjectModal.getByLabel('Chapter word target')).toBeVisible();
  await expect(createProjectModal.getByLabel('Planned completion date')).toBeVisible();
  await createProjectModal.getByLabel('Project word target').fill('80000');
  await createProjectModal.getByLabel('Planned completion date').fill('2099-12-31');
  await createProjectModal.getByRole('button', { name: 'Create and Open' }).click();
  await expect(page.getByText('Project created: E2E English Smoke')).toBeVisible();
  await expect(page.getByRole('button', { name: /words\/day required/ })).toBeVisible();
  await expect(page.getByText('Required', { exact: true })).toBeVisible();
  await expect(page.getByText('Current', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Chapters' }).click();
  await page.getByRole('button', { name: 'New Chapter' }).click();
  const createChapterModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'New Chapter' }),
  });
  await expect(createChapterModal).toBeVisible();
  await expect(createChapterModal.getByLabel('Title')).toBeVisible();
  await expect(createChapterModal.getByLabel('Description')).toBeVisible();
  await expect(createChapterModal.getByRole('button', { name: 'Create Block' })).toBeVisible();
  await createChapterModal.getByLabel('Title').fill('Chapter Alpha');
  await createChapterModal.getByRole('button', { name: 'Create Block' }).click();
  await expect(page.getByText('Block created: Chapter Alpha')).toBeVisible();

  await page.getByRole('button', { name: 'Outline' }).click();
  const outlineChapter = page.locator('.outline-chapter-card').filter({ hasText: 'Chapter Alpha' });
  await expect(outlineChapter.getByText('Scenes', { exact: true })).toBeVisible();
  await expect(outlineChapter.getByText('Characters', { exact: true })).toBeVisible();
  await expect(outlineChapter.getByText('Locations', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Plots' }).click();
  await page.getByRole('button', { name: 'New Plot' }).click();
  const createPlotModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'New Plot' }),
  });
  await expect(createPlotModal.getByLabel('Plot number')).toBeVisible();
  await expect(createPlotModal.getByLabel('Plot draft / structure')).toBeVisible();
  await createPlotModal.getByRole('button', { name: 'Cancel' }).click();

  await page.getByRole('button', { name: 'Characters' }).click();
  await expect(page.getByRole('button', { name: 'Create Character' })).toBeVisible();
  await page.getByRole('button', { name: 'Locations' }).click();
  await expect(page.getByRole('button', { name: 'Create Location' })).toBeVisible();
  await expect(page.getByText('Location canvas loaded')).toBeVisible();
  await page.getByRole('button', { name: 'Plots' }).click();
  await expect(page.getByText('Plots canvas ready')).toBeVisible();
  await page.getByRole('button', { name: 'Memory' }).click();
  await expect(page.getByText('Project Memory')).toBeVisible();
  await page.getByRole('button', { name: 'Revisions' }).click();
  await expect(page.getByText(/Revisions loaded:/)).toBeVisible();
});

test('character board create and edit card', async ({ page }) => {
  await createProject(page, 'E2E Characters');
  await createChapter(page, 'Capitolo Personaggi');

  await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
  await page.getByRole('button', { name: 'Crea Personaggio' }).click();

  const createPanel = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Personaggio' }),
  });
  await expect(createPanel).toBeVisible();
  await createPanel.getByLabel('Nome', { exact: true }).fill('Anna');
  await createPanel.getByLabel('Cognome', { exact: true }).fill('Rossi');
  await createPanel.getByRole('button', { name: 'Crea Scheda' }).click();

  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Anna Rossi')).toBeVisible();
  const characterNode = canvas
    .locator('.react-flow__node')
    .filter({ hasText: 'Anna Rossi' })
    .first();
  await characterNode.dispatchEvent('dblclick');

  const modal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Personaggio' }),
  });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Prompt Da Ollama' }).click();

  const prompt = modal.getByLabel('Prompt');
  await expect(prompt).toHaveValue(/Suggerimento mock:/);
  await modal.getByLabel('Colore occhi').fill('nocciola');
  await modal.getByLabel('Colore pelle').fill('olivastra');
  await modal.getByRole('button', { name: 'Salva Scheda' }).click();
  await expect(modal).toBeHidden();

  await characterNode.dispatchEvent('dblclick');
  await expect(modal).toBeVisible();
  await expect(modal.getByLabel('Colore occhi')).toHaveValue('nocciola');
  await expect(modal.getByLabel('Colore pelle')).toHaveValue('olivastra');
});

test('location board create and edit card', async ({ page }) => {
  await createProject(page, 'E2E Locations');
  await createChapter(page, 'Capitolo Location');

  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('button', { name: 'Crea Location' }).click();

  const createModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Location' }),
  });
  await expect(createModal).toBeVisible();
  await createModal.getByLabel('Nome').fill('Porto Vecchio');
  await createModal.getByLabel('Tipologia luogo').fill('Porto');
  await createModal.getByRole('button', { name: 'Crea Scheda' }).click();

  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Porto Vecchio')).toBeVisible();
  await canvas.getByText('Porto Vecchio').dblclick();

  const modal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Location' }),
  });
  await expect(modal).toBeVisible();
  await modal.getByRole('button', { name: 'Prompt Da Ollama' }).click();

  const prompt = modal.getByLabel('Prompt');
  await expect(prompt).toHaveValue(/Suggerimento mock:/);

  await modal.getByLabel('Path file immagine').fill('/tmp/mock-location.png');
  await modal.getByRole('button', { name: 'Associa Immagine' }).click();
  await expect(modal.getByText('/tmp/mock-location.png')).toBeVisible();
});

test('create character card from editor selection', async ({ page }) => {
  const sourceText =
    'Anna Rossi e una investigatrice dai capelli rossi, occhi verdi, pelle chiara, trentaduenne, slanciata.';
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
  await selectionContextMenu
    .getByRole('button', { name: 'Crea personaggio' })
    .dispatchEvent('click');

  const createModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Scheda Personaggio' }),
  });
  await createModal.getByLabel('Nome personaggio').fill('Anna Rossi');
  await createModal.getByRole('button', { name: 'Crea e inserisci @' }).click();

  await expect(editorContent).toContainText(sourceText);
  await closeChapterEditorSavingIfPrompted(page);

  await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Anna Rossi')).toBeVisible();
  await canvas
    .locator('.react-flow__node')
    .filter({ hasText: 'Anna Rossi' })
    .first()
    .dispatchEvent('dblclick');

  const editModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Personaggio' }),
  });
  await expect(editModal).toBeVisible();
  await expect(editModal.getByLabel('Lavoro')).toHaveValue('investigatrice');
  await expect(editModal.getByLabel('Colore capelli')).toHaveValue('rossi');
  await expect(editModal.getByLabel('Colore occhi')).toHaveValue('verdi');
  await expect(editModal.getByLabel('Colore pelle')).toHaveValue('chiara');
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

  await expect(editorContent).toContainText(sourceText);
  await closeChapterEditorSavingIfPrompted(page);

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
  await page.getByRole('button', { name: 'Nuova Trama' }).click();

  const plotPanel = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Nuova Trama' }),
  });
  await expect(plotPanel).toBeVisible();
  await plotPanel.getByLabel('Etichetta trama').fill('Trama di prova');
  await plotPanel.getByLabel('Bozza trama / struttura').fill('Bozza sintetica');
  await plotPanel.getByRole('button', { name: 'Crea Trama' }).click();

  const canvas = page.locator('.canvas-wrap');
  await expect(canvas.getByText('Trama di prova')).toBeVisible();
});

test('memory tab syncs and searches project wiki', async ({ page }) => {
  await createProject(page, 'E2E Memory');
  await createChapter(page, 'Capitolo Memoria', 'La scena contiene il patto nel magazzino.');

  await page.getByRole('button', { name: 'Memoria', exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Riassunto storia' })).toBeVisible();
  await expect(page.getByText('Aggiornata')).toBeVisible();
  await expect(page.getByText(/fonti indicizzate/)).toBeVisible();

  await page.getByRole('button', { name: 'Aggiorna' }).click();
  await expect(page.getByRole('button', { name: 'Aggiorna' })).toBeEnabled();

  await page.getByLabel('Cerca nella wiki locale').fill('magazzino');
  await page.getByRole('button', { name: 'Cerca' }).click();

  await expect(page.getByText('Capitolo Memoria').first()).toBeVisible();
  await expect(page.getByText('La scena contiene il patto nel magazzino.').first()).toBeVisible();
});

test('memory tab shows sources from last AI response', async ({ page }) => {
  await createProject(page, 'E2E Memory Sources');
  await createChapter(page, 'Capitolo Fonti AI', 'La scena contiene il patto nel magazzino.');

  await page.locator('.canvas-wrap .react-flow__node').first().click();
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
  await expect(page.getByText('Caricamento capitolo...')).toBeHidden();

  await page.getByPlaceholder(/Chiedi a .*brainstorming/).fill('magazzino');
  await page.getByRole('button', { name: 'Invia' }).click();
  await expect(page.getByText('Risposta mock: magazzino')).toBeVisible();

  await page.locator('.editor-shell').getByRole('button', { name: 'Chiudi' }).click();

  await page.getByRole('button', { name: 'Memoria', exact: true }).click();

  const lastSourcesPanel = page.locator('.memory-results-panel').filter({
    has: page.getByText('Fonti ultima risposta AI'),
  });
  await expect(lastSourcesPanel.getByText('Capitolo Fonti AI')).toBeVisible();
  await expect(lastSourcesPanel.getByText('sources/chapters/chapter-')).toBeVisible();
  await expect(
    lastSourcesPanel.getByText('La scena contiene il patto nel magazzino.'),
  ).toBeVisible();
});

test('closing chapter editor does not wait for automatic memory sync', async ({ page }) => {
  await installNovelistApiMock(page, { wikiSyncDelayMs: 800 });
  await page.goto('/');

  await openChapterEditorWithText(
    page,
    'E2E Memory Non Blocking',
    'testo da salvare prima della chiusura',
  );

  await closeChapterEditorSavingIfPrompted(page);
  await expect(page.getByText('aggiornamento memoria in corso...')).toBeVisible();
  await expect(page.getByText('memoria aggiornata')).toBeVisible();
});

test('closing dirty chapter editor opens save confirmation immediately', async ({ page }) => {
  await installNovelistApiMock(page, { autosaveMode: 'manual', chapterSaveDelayMs: 1200 });
  await page.goto('/');

  await openChapterEditorWithText(
    page,
    'E2E Close Confirmation',
    'testo non ancora salvato prima della chiusura',
  );

  const editorContent = page.locator('.novelist-editor-content');
  await editorContent.click({ position: { x: 24, y: 18 } });
  await editorContent.pressSequentially(' aggiunta finale');
  await expect(editorContent).toContainText('aggiunta finale');

  await page.locator('.editor-shell').getByRole('button', { name: 'Chiudi' }).click();

  const confirmModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifiche non salvate' }),
  });
  await expect(confirmModal).toBeVisible({ timeout: 500 });

  await confirmModal.getByRole('button', { name: 'Salva e chiudi' }).click();
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeHidden();
});

test('saving plot does not wait for automatic memory sync', async ({ page }) => {
  await installNovelistApiMock(page, { wikiSyncDelayMs: 800 });
  await page.goto('/');

  await createProject(page, 'E2E Plot Memory Sync');
  await page.getByRole('button', { name: 'Trame', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova Trama' }).click();

  const plotPanel = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Nuova Trama' }),
  });
  await expect(plotPanel).toBeVisible();
  await plotPanel.getByLabel('Etichetta trama').fill('Trama memoria');
  await plotPanel.getByLabel('Bozza trama / struttura').fill('Bozza iniziale');
  await plotPanel.getByRole('button', { name: 'Crea Trama' }).click();

  await page.locator('.plot-flow-node').filter({ hasText: 'Trama memoria' }).dblclick();
  const editPlotModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Trama' }),
  });
  await expect(editPlotModal).toBeVisible();
  await editPlotModal.getByLabel('Bozza trama / struttura').fill('Bozza aggiornata');
  await editPlotModal.getByRole('button', { name: 'Salva Trama' }).click();

  await expect(editPlotModal).toBeHidden();
  await expect(page.getByText('aggiornamento memoria in corso...')).toBeVisible();
  await expect(page.getByText('memoria aggiornata')).toBeVisible();
});

test('closing character card does not wait for automatic memory sync', async ({ page }) => {
  await installNovelistApiMock(page, { wikiSyncDelayMs: 800 });
  await page.goto('/');

  await createProject(page, 'E2E Character Memory Sync');
  await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
  await page.getByRole('button', { name: 'Crea Personaggio' }).click();

  const createPanel = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Personaggio' }),
  });
  await expect(createPanel).toBeVisible();
  await createPanel.getByLabel('Nome', { exact: true }).fill('Anna');
  await createPanel.getByRole('button', { name: 'Crea Scheda' }).click();

  await page.locator('.canvas-wrap').getByText('Anna').dblclick();
  const editCharacterModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Personaggio' }),
  });
  await expect(editCharacterModal).toBeVisible();
  await editCharacterModal.getByLabel('Note').fill('Nota aggiornata');
  await editCharacterModal.getByRole('button', { name: 'Chiudi' }).click();

  await expect(editCharacterModal).toBeHidden();
  await expect(page.getByText('aggiornamento memoria in corso...')).toBeVisible();
  await expect(page.getByText('memoria aggiornata')).toBeVisible();
});

test('saving location card does not wait for automatic memory sync', async ({ page }) => {
  await installNovelistApiMock(page, { wikiSyncDelayMs: 800 });
  await page.goto('/');

  await createProject(page, 'E2E Location Memory Sync');
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('button', { name: 'Crea Location' }).click();

  const createModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Location' }),
  });
  await expect(createModal).toBeVisible();
  await createModal.getByLabel('Nome').fill('Porto Vecchio');
  await createModal.getByRole('button', { name: 'Crea Scheda' }).click();

  await page.locator('.canvas-wrap').getByText('Porto Vecchio').dblclick();
  const editLocationModal = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Modifica Location' }),
  });
  await expect(editLocationModal).toBeVisible();
  await editLocationModal.getByLabel('Descrizione').fill('Descrizione aggiornata');
  await editLocationModal.getByRole('button', { name: 'Salva Scheda' }).click();

  await expect(editLocationModal).toBeHidden();
  await expect(page.getByText('aggiornamento memoria in corso...')).toBeVisible();
  await expect(page.getByText('memoria aggiornata')).toBeVisible();
});
