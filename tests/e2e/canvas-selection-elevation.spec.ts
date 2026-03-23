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
  await expect(page.getByRole('heading', { name: 'Nuova Trama' })).toBeVisible();

  const plotPanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuova Trama' }),
  });
  await plotPanel.getByLabel('Titolo trama').fill(title);
  await plotPanel.getByLabel('Bozza trama / struttura').fill(summary);
  await plotPanel.getByRole('button', { name: 'Crea Trama' }).click();
  await expect(page.locator('.canvas-wrap').getByText(title)).toBeVisible();
}

async function createCharacter(page: Page, firstName: string, lastName: string): Promise<void> {
  await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuovo Personaggio' })).toBeVisible();

  const createPanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuovo Personaggio' }),
  });
  await createPanel.getByLabel('Nome', { exact: true }).fill(firstName);
  await createPanel.getByLabel('Cognome', { exact: true }).fill(lastName);
  await createPanel.getByRole('button', { name: 'Crea Scheda' }).click();

  await expect(page.locator('.canvas-wrap').getByText(`${firstName} ${lastName}`)).toBeVisible();
}

async function createLocation(page: Page, name: string, locationType: string): Promise<void> {
  await page.getByRole('button', { name: 'Location', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Nuova Location' })).toBeVisible();

  const createPanel = page.locator('.panel').filter({
    has: page.getByRole('heading', { name: 'Nuova Location' }),
  });
  await createPanel.getByLabel('Nome').fill(name);
  await createPanel.getByLabel('Tipo luogo').fill(locationType);
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
  await node.click();
  await expect.poll(async () => {
    const state = await getNodeVisualState(node);
    return state.selected;
  }).toBe(true);
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
