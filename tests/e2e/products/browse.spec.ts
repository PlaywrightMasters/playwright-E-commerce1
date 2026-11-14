import { formatMoney } from '../../../utils/money';
import { CATALOG_SIZE, PAGE_SIZE, PRODUCTS } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';

test.describe('Product catalogue', () => {
  test('home page lists products with names and prices', { tag: '@smoke' }, async ({ catalogPage, page }) => {
    await catalogPage.goto();

    await expect(page).toHaveTitle('All products | Demo Shop');
    await expect(catalogPage.heading).toHaveText('All products');
    await expect(catalogPage.hero).toBeVisible();
    await expect(catalogPage.resultCount).toHaveText(`${CATALOG_SIZE} products`);
    await expect(catalogPage.productCards).toHaveCount(PAGE_SIZE);
    await expect(catalogPage.productCard(PRODUCTS.tee.name).getByTestId('product-price')).toHaveText(
      formatMoney(PRODUCTS.tee.priceCents),
    );
  });

  test('paginates through the whole catalogue', async ({ catalogPage }) => {
    await catalogPage.goto();
    await expect(catalogPage.pageIndicator).toHaveText('Page 1 of 2');
    await expect(catalogPage.previousPageLink).toBeHidden();
    const firstPage = await catalogPage.productNames();

    await catalogPage.goToNextPage();
    await expect(catalogPage.pageIndicator).toHaveText('Page 2 of 2');
    await expect(catalogPage.productCards).toHaveCount(CATALOG_SIZE - PAGE_SIZE);
    await expect(catalogPage.nextPageLink).toBeHidden();
    const secondPage = await catalogPage.productNames();

    expect(new Set([...firstPage, ...secondPage]).size).toBe(CATALOG_SIZE);
  });

  test('filters by category', async ({ catalogPage, page }) => {
    await catalogPage.goto();
    await catalogPage.selectCategory('Electronics');

    await expect(page).toHaveURL(/[?&]category=electronics/);
    await expect(catalogPage.heading).toHaveText('Electronics');
    await expect(catalogPage.resultCount).toHaveText('4 products');
    await expect(catalogPage.productCards).toHaveCount(4);
    await expect(catalogPage.productCards.filter({ hasNotText: 'Electronics ·' })).toHaveCount(0);
  });

  test('sorts by price in both directions', async ({ catalogPage }) => {
    await catalogPage.goto();

    await catalogPage.sortBy('Price: Low to High');
    const ascending = await catalogPage.productPrices();
    expect(ascending).toEqual([...ascending].sort((a, b) => a - b));
    await expect(catalogPage.productCards.first()).toContainText(PRODUCTS.journal.name);

    await catalogPage.sortBy('Price: High to Low');
    const descending = await catalogPage.productPrices();
    expect(descending).toEqual([...descending].sort((a, b) => b - a));
    await expect(catalogPage.productCards.first()).toContainText(PRODUCTS.headphones.name);
  });

  test('keeps filters in the URL so a view can be shared and cleared', async ({ catalogPage, page }) => {
    await catalogPage.goto({ category: 'clothing', sort: 'price-asc' });
    await expect(catalogPage.categorySelect).toHaveValue('clothing');
    await expect(catalogPage.sortSelect).toHaveValue('price-asc');
    await expect(catalogPage.productCards.first()).toContainText(PRODUCTS.beanie.name);

    await catalogPage.clearFilters();
    await expect(page).toHaveURL(/\/$/);
    await expect(catalogPage.resultCount).toHaveText(`${CATALOG_SIZE} products`);
  });

  test('shows a connection message instead of crashing when the API is unreachable', async ({ catalogPage, page }) => {
    await page.route((url) => url.pathname === '/api/products', (route) => route.abort('internetdisconnected'));

    await catalogPage.goto();

    await expect(catalogPage.heading).toHaveText('Connection problem');
    await expect(catalogPage.alert).toHaveText('We could not reach the shop. Check your connection and try again.');
  });

  test('unknown pages respond with 404 and a friendly message', async ({ catalogPage, page }) => {
    const response = await page.goto('/no-such-page');
    expect(response?.status()).toBe(404);
    await expect(catalogPage.heading).toHaveText('Page not found');
    await expect(page.getByRole('link', { name: 'Back to the shop' })).toBeVisible();
  });
});
