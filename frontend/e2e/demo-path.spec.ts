import { expect, test } from '@playwright/test';

// Demo mode needs no backend: the sample data is built into the app.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cognitwin:settings', JSON.stringify({ demoMode: true })));
});

test('landing → dashboard → forecast → ask, in demo mode', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Run your business ahead of time.');

  await page.getByRole('link', { name: 'Open dashboard' }).first().click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText('Demo data').first()).toBeVisible();
  await expect(page.getByText('Total revenue')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top items' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Forecast' }).click();
  await expect(page).toHaveURL(/\/forecast/);
  await expect(page.getByRole('heading', { name: 'Revenue forecast' })).toBeVisible();

  // Move a lever and the what-if responds with profit and price analysis.
  await page.getByRole('slider').first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('heading', { name: 'Profit impact' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Optimal price' })).toBeVisible();

  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Ask AI' }).click();
  await expect(page).toHaveURL(/\/ask/);
  await page.getByRole('button', { name: 'Which products brought in the most revenue?' }).click();
  await expect(page.getByRole('article', { name: 'AI answer' })).toBeVisible();
  await expect(page.getByText('Source: Data')).toBeVisible();
});

test('the command palette opens with Ctrl+K and navigates', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page.getByText('Total revenue')).toBeVisible();
  await page.keyboard.press('Control+k');
  await page.getByRole('combobox', { name: /search pages/i }).fill('scen');
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/scenarios/);
});

test('mobile: the menu sheet opens and navigates', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'Open menu' }).click();
  await page.getByRole('link', { name: 'Datasets' }).click();
  await expect(page).toHaveURL(/\/datasets/);
  await expect(page.getByRole('heading', { name: 'Datasets', level: 1 })).toBeVisible();
});
