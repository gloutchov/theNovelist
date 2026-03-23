import { expect, test } from '@playwright/test';

test('renderer build renders title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Novelist' })).toBeVisible();
  await expect(page.getByText('Scrivi la tua storia da professionista')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Struttura Storia' })).toBeVisible();
});
