import { expect, test } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

const MAX_CANVAS_RESTORE_MS = Number(process.env['PERF_MAX_CANVAS_RESTORE_MS'] ?? 8000);
const MAX_NODE_SELECT_MS = Number(process.env['PERF_MAX_NODE_SELECT_MS'] ?? 1500);
const MAX_EDITOR_OPEN_MS = Number(process.env['PERF_MAX_EDITOR_OPEN_MS'] ?? 6000);
const MAX_EDITOR_SAVE_MS = Number(process.env['PERF_MAX_EDITOR_SAVE_MS'] ?? 3000);

test('performance: story canvas restores 500 nodes and stays interactive', async ({ page }, testInfo) => {
  await installNovelistApiMock(page, {
    bootstrap: {
      projectName: 'Perf Canvas 500',
      plotCount: 5,
      storyNodeCount: 500,
    },
  });

  const restoreStartedAt = Date.now();
  await page.goto('/');
  await expect(page.getByText('Sessione ripristinata: Perf Canvas 500')).toBeVisible();
  await expect(page.locator('.canvas-wrap .react-flow__node').first()).toBeVisible();
  const restoreMs = Date.now() - restoreStartedAt;

  const stateNodeCount = await page.evaluate(async () => {
    const state = await window.novelistApi.getStoryState();
    return state.nodes.length;
  });
  expect(stateNodeCount).toBe(500);

  const selectionStartedAt = Date.now();
  await page.locator('.canvas-wrap .react-flow__node').first().click();
  await expect(page.getByRole('button', { name: 'Apri Editor Capitolo' })).toBeEnabled();
  const selectionMs = Date.now() - selectionStartedAt;

  testInfo.annotations.push({
    type: 'perf',
    description: `restoreMs=${restoreMs};selectionMs=${selectionMs};nodes=${stateNodeCount}`,
  });

  expect(restoreMs).toBeLessThanOrEqual(MAX_CANVAS_RESTORE_MS);
  expect(selectionMs).toBeLessThanOrEqual(MAX_NODE_SELECT_MS);
});

test('performance: long chapter editor open and save', async ({ page }, testInfo) => {
  await installNovelistApiMock(page, {
    bootstrap: {
      projectName: 'Perf Long Chapter',
      plotCount: 1,
      storyNodeCount: 1,
      longChapterWords: 20000,
    },
  });

  await page.goto('/');
  await expect(page.getByText('Sessione ripristinata: Perf Long Chapter')).toBeVisible();

  await page.locator('.canvas-wrap .react-flow__node').first().click();
  await expect(page.getByRole('button', { name: 'Apri Editor Capitolo' })).toBeEnabled();

  const openStartedAt = Date.now();
  await page.getByRole('button', { name: 'Apri Editor Capitolo' }).click();
  await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeVisible();
  await expect(page.getByText('Caricamento capitolo...')).toBeHidden();
  const openMs = Date.now() - openStartedAt;

  const saveStartedAt = Date.now();
  await page.getByRole('button', { name: 'Salva', exact: true }).click();
  await expect(page.locator('.status-panel .status')).toContainText('Capitolo salvato');
  const saveMs = Date.now() - saveStartedAt;

  testInfo.annotations.push({
    type: 'perf',
    description: `openMs=${openMs};saveMs=${saveMs};words=20000`,
  });

  expect(openMs).toBeLessThanOrEqual(MAX_EDITOR_OPEN_MS);
  expect(saveMs).toBeLessThanOrEqual(MAX_EDITOR_SAVE_MS);
});

