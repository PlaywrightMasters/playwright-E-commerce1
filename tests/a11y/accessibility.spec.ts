import AxeBuilder from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { PRODUCTS } from '../../utils/test-data';
import { expect, test } from '../fixtures';

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Runs axe and returns a compact, readable list of violations. */
async function wcagViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(WCAG_TAGS).analyze();
  return results.violations.map((v) => ({
    rule: v.id,
    impact: v.impact,
    help: v.help,
    targets: v.nodes.map((n) => n.target.join(' ')),
  }));
}

const staticPages = [
  { name: 'home', path: '/' },
  { name: 'search results', path: '/search?q=cotton' },
  { name: 'product details', path: `/products/${PRODUCTS.tee.slug}` },
  { name: 'sign in', path: '/login' },
  { name: 'registration', path: '/register' },
];

test.describe('Accessibility (axe-core, WCAG 2.2 A/AA)', () => {
  for (const { name, path } of staticPages) {
    test(`${name} page has no detectable violations`, async ({ page, catalogPage }) => {
      await page.goto(path);
      await catalogPage.waitForReady();
      expect(await wcagViolations(page)).toEqual([]);
    });
  }

  test('cart with items has no detectable violations', async ({ shopApi, cartPage, page }) => {
    await shopApi.seedCart({ productId: PRODUCTS.tee.id, size: 'M' });
    await cartPage.goto();
    await expect(cartPage.items).toHaveCount(1);
    expect(await wcagViolations(page)).toEqual([]);
  });

  test('checkout showing validation errors has no detectable violations', async ({ shopApi, checkoutPage, page }) => {
    await shopApi.seedCart({ productId: PRODUCTS.mug.id });
    await checkoutPage.goto();
    await checkoutPage.placeOrder();
    await expect(checkoutPage.formError).toBeVisible();
    expect(await wcagViolations(page)).toEqual([]);
  });

  test('skip link moves keyboard focus to the main content', async ({ catalogPage, page }) => {
    await catalogPage.goto();
    await page.keyboard.press('Tab');
    const skipLink = page.getByRole('link', { name: 'Skip to main content' });
    await expect(skipLink).toBeFocused();

    await page.keyboard.press('Enter');
    await expect(catalogPage.main).toBeFocused();
  });
});
