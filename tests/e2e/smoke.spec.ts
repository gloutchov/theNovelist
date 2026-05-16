import { expect, test } from '@playwright/test';

test('renderer build renders title', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'The Novelist' })).toBeVisible();
  await expect(page.getByText('Write your story like a professional')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Chapters' })).toBeVisible();
});
