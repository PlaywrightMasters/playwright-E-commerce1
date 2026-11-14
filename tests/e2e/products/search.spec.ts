import { PRODUCTS } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';

test.describe('Search', () => {
  test('finds products from the header search box', { tag: '@smoke' }, async ({ catalogPage, searchPage, page }) => {
    await catalogPage.goto();
    await catalogPage.header.search('cotton');

    await expect(page).toHaveURL(/\/search\?q=cotton$/);
    await expect(searchPage.heading).toHaveText('Search results for “cotton”');
    await expect(searchPage.productCard(PRODUCTS.tee.name)).toBeVisible();
    await expect(searchPage.header.searchInput).toHaveValue('cotton');
  });

  test('matches regardless of letter case', async ({ searchPage }) => {
    await searchPage.search('KEYBOARD');
    await expect(searchPage.productCards).toHaveCount(1);
    await expect(searchPage.productCard(PRODUCTS.keyboard.name)).toBeVisible();
  });

  test('explains when nothing matches', async ({ searchPage }) => {
    await searchPage.search('xyz-not-a-product');
    await expect(searchPage.resultCount).toHaveText('0 products');
    await expect(searchPage.noResults).toBeVisible();
    await expect(searchPage.productCards).toHaveCount(0);
  });

  test('renders HTML in the query as plain text', async ({ searchPage, page }) => {
    const payload = '<img src=x onerror=alert(1)>';
    const dialogs: string[] = [];
    page.on('dialog', async (dialog) => {
      dialogs.push(dialog.message());
      await dialog.dismiss();
    });

    await searchPage.search(payload);

    await expect(searchPage.heading).toHaveText(`Search results for “${payload}”`);
    await expect(searchPage.main.locator('img')).toHaveCount(0);
    expect(dialogs).toEqual([]);
  });

  test('handles an over-long query without breaking the page', async ({ searchPage }) => {
    await searchPage.search('a'.repeat(101));
    await expect(searchPage.alert).toHaveText('Search query must be at most 100 characters');
    await expect(searchPage.header.searchInput).toHaveAttribute('maxlength', '100');
  });

  test('narrows results with a price filter', async ({ searchPage, page }) => {
    await searchPage.search('jacket');
    await expect(searchPage.productCards).toHaveCount(2);

    await searchPage.filterByPrice({ max: 100 });

    await expect(page).toHaveURL(/q=jacket/);
    await expect(page).toHaveURL(/maxPrice=100/);
    await expect(searchPage.productCards).toHaveCount(1);
    await expect(searchPage.productCard('Denim Jacket')).toBeVisible();
  });

  test('restores the previous results with the back button', async ({ searchPage, page }) => {
    await searchPage.search('mug');
    await expect(searchPage.productCard(PRODUCTS.mug.name)).toBeVisible();

    await searchPage.header.search('bottle');
    await expect(searchPage.heading).toHaveText('Search results for “bottle”');

    await page.goBack();
    await expect(searchPage.heading).toHaveText('Search results for “mug”');
    await expect(searchPage.productCard(PRODUCTS.mug.name)).toBeVisible();
  });
});
