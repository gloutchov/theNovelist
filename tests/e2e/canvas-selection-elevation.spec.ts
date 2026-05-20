import { expect, test, type Locator, type Page } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

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

async function createPlot(page: Page, title: string, summary = 'Bozza sintetica'): Promise<void> {
  await page.getByRole('button', { name: 'Trame', exact: true }).click();
  await page.getByRole('button', { name: 'Nuova Trama' }).click();

  const plotPanel = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Nuova Trama' }),
  });
  await expect(plotPanel).toBeVisible();
  await plotPanel.getByLabel('Etichetta trama').fill(title);
  await plotPanel.getByLabel('Bozza trama / struttura').fill(summary);
  await plotPanel.getByRole('button', { name: 'Crea Trama' }).click();
  await expect(page.locator('.canvas-wrap').getByText(title)).toBeVisible();
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

  await expect(page.locator('.canvas-wrap').getByText(title)).toBeVisible();
}

async function createCharacter(page: Page, firstName: string, lastName: string): Promise<void> {
  await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
  await page.getByRole('button', { name: 'Crea Personaggio' }).click();

  const createPanel = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Personaggio' }),
  });
  await expect(createPanel).toBeVisible();
  await createPanel.getByLabel('Nome', { exact: true }).fill(firstName);
  await createPanel.getByLabel('Cognome', { exact: true }).fill(lastName);
  await createPanel.getByRole('button', { name: 'Crea Scheda' }).click();

  await expect(page.locator('.canvas-wrap').getByText(`${firstName} ${lastName}`)).toBeVisible();
}

async function createLocation(page: Page, name: string, locationType: string): Promise<void> {
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('button', { name: 'Crea Location' }).click();

  const createPanel = page.locator('.modal-card').filter({
    has: page.getByRole('heading', { name: 'Crea Location' }),
  });
  await expect(createPanel).toBeVisible();
  await createPanel.getByLabel('Nome').fill(name);
  await createPanel.getByLabel('Tipologia luogo').fill(locationType);
  await createPanel.getByRole('button', { name: 'Crea Scheda' }).click();

  await expect(page.locator('.canvas-wrap').getByText(name)).toBeVisible();
}

function getCanvasNodeByText(page: Page, text: string): Locator {
  return page.locator('.canvas-wrap .react-flow__node').filter({ hasText: text }).first();
}

async function dragNode(page: Page, node: Locator, deltaX: number, deltaY: number): Promise<void> {
  const box = await node.boundingBox();
  if (!box) {
    throw new Error('Impossibile calcolare il bounding box del nodo.');
  }

  const startX = box.x + box.width / 2;
  const startY = box.y + box.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + deltaX, startY + deltaY, { steps: 12 });
  await page.mouse.up();
}

async function getNodeVisualState(node: Locator): Promise<{ selected: boolean; zIndex: number }> {
  return node.evaluate((element) => {
    const htmlElement = element as HTMLElement;
    const computedZIndex = Number.parseInt(window.getComputedStyle(htmlElement).zIndex || '0', 10);

    return {
      selected: htmlElement.classList.contains('selected'),
      zIndex: Number.isFinite(computedZIndex) ? computedZIndex : 0,
    };
  });
}

async function expectNodeSelectedAndElevated(primary: Locator, secondary: Locator): Promise<void> {
  await expect.poll(async () => {
    const [primaryState, secondaryState] = await Promise.all([
      getNodeVisualState(primary),
      getNodeVisualState(secondary),
    ]);

    return primaryState.selected && primaryState.zIndex > secondaryState.zIndex;
  }).toBe(true);
}

async function selectNode(node: Locator): Promise<void> {
  await node.click({ position: { x: 20, y: 20 } });
  await expect.poll(async () => {
    const state = await getNodeVisualState(node);
    return state.selected;
  }).toBe(true);
}

async function getSelectedCanvasNodeCount(page: Page): Promise<number> {
  return page.locator('.canvas-wrap .react-flow__node.selected').count();
}

async function dragSelectionBoxAround(page: Page, nodes: Locator[]): Promise<void> {
  const boxes = await Promise.all(nodes.map((node) => node.boundingBox()));
  if (boxes.some((box) => !box)) {
    throw new Error('Impossibile calcolare il bounding box dei nodi.');
  }

  const typedBoxes = boxes as NonNullable<(typeof boxes)[number]>[];
  const canvasBox = await page.locator('.canvas-wrap').boundingBox();
  if (!canvasBox) {
    throw new Error('Impossibile calcolare il bounding box del canvas.');
  }

  const left = Math.min(...typedBoxes.map((box) => box.x));
  const top = Math.min(...typedBoxes.map((box) => box.y));
  const right = Math.max(...typedBoxes.map((box) => box.x + box.width));
  const bottom = Math.max(...typedBoxes.map((box) => box.y + box.height));
  const startX = Math.max(canvasBox.x + 12, left - 48);
  const startY = Math.max(canvasBox.y + 12, top - 48);
  const endX = Math.min(canvasBox.x + canvasBox.width - 12, right + 48);
  const endY = Math.min(canvasBox.y + canvasBox.height - 12, bottom + 48);

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(endX, endY, { steps: 12 });
  await page.mouse.up();
}

test.beforeEach(async ({ page }) => {
  await installNovelistApiMock(page);
  await page.goto('/');
});

test('plots canvas keeps dragged plot node selected and above the others', async ({ page }) => {
  await createProject(page, 'E2E Plot Layering');
  await createPlot(page, 'Trama Alpha');
  await createPlot(page, 'Trama Beta');

  const primaryNode = getCanvasNodeByText(page, 'Trama Alpha');
  const secondaryNode = getCanvasNodeByText(page, 'Trama Beta');

  await selectNode(primaryNode);
  await dragNode(page, primaryNode, 120, 40);
  await expectNodeSelectedAndElevated(primaryNode, secondaryNode);
});

test('plots canvas brings the selected overlapping plot node to the front', async ({ page }) => {
  await createProject(page, 'E2E Plot Overlap Layering');
  await createPlot(page, 'Trama Alpha');
  await createPlot(page, 'Trama Beta');

  const primaryNode = getCanvasNodeByText(page, 'Trama Alpha');
  const secondaryNode = getCanvasNodeByText(page, 'Trama Beta');

  await dragNode(page, secondaryNode, -250, 10);
  await selectNode(primaryNode);
  await dragNode(page, primaryNode, 40, 20);
  await expectNodeSelectedAndElevated(primaryNode, secondaryNode);
});

test('chapters canvas opens the chapter editor only on double click', async ({ page }) => {
  await createProject(page, 'E2E Chapter Double Click');
  await createChapter(page, 'Capitolo Doppio Click', 'Apertura editor');

  const node = getCanvasNodeByText(page, 'Capitolo Doppio Click');
  await node.click();
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeHidden();
  await expect.poll(() => getSelectedCanvasNodeCount(page)).toBe(1);

  await node.dblclick();
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
});

test('chapters canvas supports modifier multi-select and group dragging', async ({ page }) => {
  await createProject(page, 'E2E Chapter Modifier Multi Select');
  await createChapter(page, 'Capitolo Alpha');
  await createChapter(page, 'Capitolo Beta');

  const alphaNode = getCanvasNodeByText(page, 'Capitolo Alpha');
  const betaNode = getCanvasNodeByText(page, 'Capitolo Beta');
  const alphaStart = await alphaNode.boundingBox();
  const betaStart = await betaNode.boundingBox();
  if (!alphaStart || !betaStart) {
    throw new Error('Impossibile calcolare la posizione iniziale dei capitoli.');
  }

  await alphaNode.click({ position: { x: 20, y: 20 } });
  await betaNode.click({ position: { x: 20, y: 20 }, modifiers: ['ControlOrMeta'] });
  await expect.poll(() => getSelectedCanvasNodeCount(page)).toBe(2);

  await dragNode(page, alphaNode, 110, 30);

  const alphaEnd = await alphaNode.boundingBox();
  const betaEnd = await betaNode.boundingBox();
  if (!alphaEnd || !betaEnd) {
    throw new Error('Impossibile calcolare la posizione finale dei capitoli.');
  }

  expect(alphaEnd.x - alphaStart.x).toBeGreaterThan(70);
  expect(betaEnd.x - betaStart.x).toBeGreaterThan(70);
});

test('chapters canvas supports drag rectangle multi-select', async ({ page }) => {
  await createProject(page, 'E2E Chapter Rectangle Select');
  await createChapter(page, 'Capitolo Gamma');
  await createChapter(page, 'Capitolo Delta');

  const gammaNode = getCanvasNodeByText(page, 'Capitolo Gamma');
  const deltaNode = getCanvasNodeByText(page, 'Capitolo Delta');

  await dragSelectionBoxAround(page, [gammaNode, deltaNode]);
  await expect.poll(() => getSelectedCanvasNodeCount(page)).toBe(2);
});

test('characters canvas keeps dragged character node selected and above the others', async ({ page }) => {
  await createProject(page, 'E2E Character Layering');
  await createPlot(page, 'Trama Base');
  await createCharacter(page, 'Anna', 'Rossi');
  await createCharacter(page, 'Marco', 'Bianchi');

  const primaryNode = getCanvasNodeByText(page, 'Anna Rossi');
  const secondaryNode = getCanvasNodeByText(page, 'Marco Bianchi');

  await selectNode(primaryNode);
  await dragNode(page, primaryNode, 140, 30);
  await expectNodeSelectedAndElevated(primaryNode, secondaryNode);
});

test('locations canvas keeps dragged location node selected and above the others', async ({ page }) => {
  await createProject(page, 'E2E Location Layering');
  await createPlot(page, 'Trama Base');
  await createLocation(page, 'Porto Vecchio', 'Porto');
  await createLocation(page, 'Faro Nord', 'Faro');

  const primaryNode = getCanvasNodeByText(page, 'Porto Vecchio');
  const secondaryNode = getCanvasNodeByText(page, 'Faro Nord');

  await selectNode(primaryNode);
  await dragNode(page, primaryNode, 140, 30);
  await expectNodeSelectedAndElevated(primaryNode, secondaryNode);
});
