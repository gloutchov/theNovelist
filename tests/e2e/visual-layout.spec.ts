import { expect, test, type Locator, type Page, type TestInfo } from '@playwright/test';
import { installNovelistApiMock } from './helpers/mock-novelist-api';

const LONG_REVISION_TEXT = Array.from(
  { length: 80 },
  (_item, index) =>
    `Paragrafo ${index + 1}: testo lungo per verificare scorrimento verticale, spaziature, righe e contenitori delle revisioni.`,
).join('\n\n');

async function seedVisualProject(page: Page): Promise<void> {
  await page.evaluate(async (longRevisionText) => {
    const storyState = await window.novelistApi.getStoryState();
    const [firstChapter, secondChapter] = storyState.nodes;
    if (!firstChapter || !secondChapter) {
      throw new Error('Bootstrap visuale non valido: servono almeno due capitoli');
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
            content: [{ type: 'text', text: 'Versione precedente del capitolo visuale.' }],
          },
        ],
      }),
      wordCount: 5,
    });
    await window.novelistApi.createRevision({
      entityType: 'chapter',
      entityId: firstChapter.id,
      label: 'Versione precedente visuale',
    });
    await window.novelistApi.saveChapterDocument({
      chapterNodeId: firstChapter.id,
      contentJson: JSON.stringify({
        type: 'doc',
        content: longRevisionText.split('\n\n').map((text) => ({
          type: 'paragraph',
          content: [{ type: 'text', text }],
        })),
      }),
      wordCount: longRevisionText.split(/\s+/).length,
    });

    const character = await window.novelistApi.createCharacterCard({
      firstName: 'Anna',
      lastName: 'Visuale',
      sex: 'F',
      age: 34,
      sexualOrientation: '',
      species: 'umana',
      hairColor: 'rossi',
      eyeColor: 'verdi',
      skinColor: 'chiara',
      bald: false,
      beard: '',
      physique: 'atletica',
      job: 'investigatrice',
      notes: 'Personaggio usato per verificare layout, pannelli condivisi e immagini.',
      plotNumber: 1,
      positionX: 180,
      positionY: 160,
    });
    await window.novelistApi.setCharacterChapterLinks({
      characterCardId: character.id,
      chapterNodeIds: [firstChapter.id, secondChapter.id],
    });
    await window.novelistApi.createCharacterImage({
      characterCardId: character.id,
      imageType: 'mezzo-busto',
      filePath: '/tmp/anna-visuale.png',
      prompt: 'ritratto personaggio visuale',
    });

    const location = await window.novelistApi.createLocationCard({
      name: 'Porto Visuale',
      locationType: 'porto',
      description: 'Banchine umide, gru alte e magazzini illuminati.',
      notes: 'Location usata per verificare layout, pannelli condivisi e immagini.',
      plotNumber: 1,
      positionX: 220,
      positionY: 180,
    });
    await window.novelistApi.setLocationChapterLinks({
      locationCardId: location.id,
      chapterNodeIds: [firstChapter.id],
    });
    await window.novelistApi.createLocationImage({
      locationCardId: location.id,
      imageType: 'esterno',
      filePath: '/tmp/porto-visuale.png',
      prompt: 'esterno location visuale',
    });

    await window.novelistApi.createSceneCard({
      chapterNodeId: firstChapter.id,
      name: 'Scena Visuale',
      text: 'Anna entra nel porto visuale e trova un indizio.',
      contentJson: null,
      notes: 'Scena collegata ai controlli visuali.',
      plotNumber: 1,
      positionX: 260,
      positionY: 190,
    });

    await window.novelistApi.updateTimelineSettings({
      startLabel: 'Inizio',
      endLabel: 'Fine',
      timelineEndX: 1200,
    });
    await window.novelistApi.updateTimelineItem({
      itemType: 'chapter',
      entityId: firstChapter.id,
      positionX: 180,
      positionY: 110,
      dateLabel: 'Giorno 1',
    });
  }, LONG_REVISION_TEXT);
}

async function openSeededProject(page: Page, viewportName: string): Promise<void> {
  await installNovelistApiMock(page, {
    bootstrap: {
      projectName: `E2E Visual ${viewportName}`,
      rootPath: `/tmp/the-novelist-visual-${viewportName}`,
      plotCount: 2,
      storyNodeCount: 3,
    },
  });
  await page.goto('/');
  await seedVisualProject(page);
}

async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      body: document.body.scrollWidth - document.body.clientWidth,
      root: root.scrollWidth - root.clientWidth,
    };
  });

  expect(overflow.body).toBeLessThanOrEqual(2);
  expect(overflow.root).toBeLessThanOrEqual(2);
}

async function expectNoVisibleButtonTextOverflow(page: Page): Promise<void> {
  const overflowingButtons = await page.locator('button').evaluateAll((buttons) =>
    buttons
      .filter((button) => {
        const rect = button.getBoundingClientRect();
        const visible = rect.width > 0 && rect.height > 0;
        return visible && button.scrollWidth > button.clientWidth + 2;
      })
      .map((button) => button.textContent?.trim() || button.getAttribute('aria-label') || ''),
  );

  expect(overflowingButtons).toEqual([]);
}

async function expectUsableRegion(locator: Locator): Promise<void> {
  await expect(locator).toBeVisible();
  const box = await locator.boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(240);
  expect(box?.height ?? 0).toBeGreaterThan(180);
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(`${name}.png`, {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
}

async function checkScreen(
  page: Page,
  testInfo: TestInfo,
  name: string,
  locator: Locator,
): Promise<void> {
  await expectUsableRegion(locator);
  await expectNoHorizontalOverflow(page);
  await expectNoVisibleButtonTextOverflow(page);
  await attachScreenshot(page, testInfo, name);
}

test.describe('visual layout smoke', () => {
  test('main desktop workspaces render without layout overflow', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await openSeededProject(page, 'desktop');

    await checkScreen(page, testInfo, 'desktop-dashboard', page.locator('.dashboard-workspace'));

    await page.getByRole('button', { name: 'Capitoli' }).click();
    await checkScreen(page, testInfo, 'desktop-chapters', page.locator('.canvas-wrap'));
    await page.locator('.canvas-wrap .react-flow__node').first().click();
    await checkScreen(page, testInfo, 'desktop-editor', page.locator('.editor-shell'));
    await page.locator('.editor-shell').getByRole('button', { name: 'Chiudi' }).click();
    await expect(page.getByRole('heading', { name: 'Editor Capitolo' })).toBeHidden();

    await page.getByRole('button', { name: 'Personaggi', exact: true }).click();
    await page
      .locator('.canvas-wrap .react-flow__node')
      .filter({ hasText: 'Anna Visuale' })
      .first()
      .dispatchEvent('dblclick');
    const characterModal = page.locator('.modal-card').filter({
      has: page.getByRole('heading', { name: 'Modifica Personaggio' }),
    });
    await checkScreen(page, testInfo, 'desktop-character-modal', characterModal);
    await expect(characterModal.getByText('/tmp/anna-visuale.png')).toBeVisible();
    await characterModal.getByRole('button', { name: 'Chiudi' }).click();

    await page.getByRole('button', { name: 'Location', exact: true }).click();
    await page
      .locator('.canvas-wrap .react-flow__node')
      .filter({ hasText: 'Porto Visuale' })
      .first()
      .dispatchEvent('dblclick');
    const locationModal = page.locator('.modal-card').filter({
      has: page.getByRole('heading', { name: 'Modifica Location' }),
    });
    await checkScreen(page, testInfo, 'desktop-location-modal', locationModal);
    await expect(locationModal.getByText('/tmp/porto-visuale.png')).toBeVisible();
    await locationModal.getByRole('button', { name: 'Chiudi' }).click();

    await page.getByRole('button', { name: 'Memoria', exact: true }).click();
    await checkScreen(page, testInfo, 'desktop-memory', page.locator('.memory-workspace'));

    await page.getByRole('button', { name: 'Revisioni' }).click();
    await checkScreen(page, testInfo, 'desktop-revisions', page.locator('.revision-workspace'));
    const revisionPanes = page.locator('.revision-pane pre');
    await expect(revisionPanes).toHaveCount(2);
    const currentPaneScroll = await revisionPanes.first().evaluate((pane) => ({
      clientHeight: pane.clientHeight,
      scrollHeight: pane.scrollHeight,
    }));
    expect(currentPaneScroll.scrollHeight).toBeGreaterThan(currentPaneScroll.clientHeight);

    await page.getByRole('button', { name: 'Analisi' }).click();
    await checkScreen(page, testInfo, 'desktop-analysis', page.locator('.analysis-workspace'));
  });

  test('main mobile workspaces keep responsive layout usable', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openSeededProject(page, 'mobile');

    await checkScreen(page, testInfo, 'mobile-dashboard', page.locator('.dashboard-workspace'));

    await page.getByRole('button', { name: 'Memoria', exact: true }).click();
    await checkScreen(page, testInfo, 'mobile-memory', page.locator('.memory-workspace'));

    await page.getByRole('button', { name: 'Revisioni' }).click();
    await checkScreen(page, testInfo, 'mobile-revisions', page.locator('.revision-workspace'));
    const revisionGridColumns = await page
      .locator('.revision-compare-grid')
      .evaluate((grid) => window.getComputedStyle(grid).gridTemplateColumns.split(' ').length);
    expect(revisionGridColumns).toBe(1);
  });
});
