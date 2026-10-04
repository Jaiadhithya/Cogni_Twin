import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const ROUTES = ['/', '/dashboard', '/forecast', '/scenarios', '/ask', '/explorer', '/datasets', '/documents', '/upload', '/settings', '/no-such-page'];

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('cognitwin:settings', JSON.stringify({ demoMode: true })));
});

/** Wait until the page has stopped showing loading skeletons. */
async function settle(page: Page) {
  await page.waitForLoadState('networkidle');
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0, { timeout: 20_000 });
  await page.waitForTimeout(900); // entrance animations
}

test.describe('accessibility (WCAG 2.1 AA, demo data)', () => {
  for (const route of ROUTES) {
    test(`no axe violations on ${route}`, async ({ page }) => {
      await page.goto(route);
      await settle(page);
      const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
      const summary = results.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`);
      expect(summary, summary.join('\n')).toEqual([]);
    });
  }
});

test.describe('responsive: no horizontal scroll', () => {
  for (const width of [375, 768, 1440]) {
    test(`at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      for (const route of ROUTES) {
        await page.goto(route);
        await settle(page);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        expect(overflow, `${route} overflows by ${overflow}px at ${width}px`).toBeLessThanOrEqual(0);
      }
    });
  }
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('count-ups show final values and nothing is left animating', async ({ page }) => {
    await page.goto('/dashboard');
    // With reduced motion the KPI shows its final value as soon as it renders (no tween from zero).
    const kpi = page.getByRole('article', { name: 'Total revenue' });
    await expect(kpi).toContainText('₹3.8 Cr', { timeout: 20_000 });
    // Opacity fades are allowed; movement (transform, translate, scale, blur) is not.
    const movement = await page.evaluate(() => {
      const MOVING = ['transform', 'translate', 'scale', 'rotate', 'filter'];
      return document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .flatMap((a) => {
          const effect = a.effect as KeyframeEffect | null;
          const props = new Set((effect?.getKeyframes() ?? []).flatMap((k) => Object.keys(k)));
          const hit = MOVING.filter((p) => props.has(p));
          return hit.length ? [`${hit.join(',')} on ${effect?.target?.tagName}`] : [];
        });
    });
    expect(movement).toEqual([]);
  });
});
