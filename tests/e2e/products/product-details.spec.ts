import { formatMoney } from '../../../utils/money';
import { PRODUCTS } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';

const { tee, rainJacket, keyboard } = PRODUCTS;

test.describe('Product details', () => {
  test('opens a product from the catalogue', { tag: '@smoke' }, async ({ catalogPage, productPage, page }) => {
    await catalogPage.goto();
    await catalogPage.openProduct(tee.name);

    await expect(page).toHaveURL(new RegExp(`/products/${tee.slug}$`));
    await expect(page).toHaveTitle(`${tee.name} | Demo Shop`);
    await expect(productPage.heading).toHaveText(tee.name);
    await expect(productPage.price).toHaveText(formatMoney(tee.priceCents));
    await expect(productPage.stockStatus).toHaveText('In stock');
  });

  test('shows the breadcrumb trail and every variant option', async ({ productPage }) => {
    await productPage.goto(tee.slug);

    await expect(productPage.breadcrumb.getByRole('link')).toHaveText(['Home', 'Clothing']);
    await expect(productPage.breadcrumb.getByText(tee.name)).toHaveAttribute('aria-current', 'page');
    for (const size of tee.sizes) {
      await expect(productPage.sizeOption(size)).toBeEnabled();
    }
    await expect(productPage.colorSelect.getByRole('option')).toHaveText([...tee.colors]);
    await expect(productPage.quantityInput).toHaveValue('1');
  });

  test('breadcrumb category link opens the filtered catalogue', async ({ productPage, catalogPage, page }) => {
    await productPage.goto(tee.slug);
    await productPage.breadcrumb.getByRole('link', { name: 'Clothing' }).click();

    await expect(page).toHaveURL(/\/\?category=clothing$/);
    await expect(catalogPage.heading).toHaveText('Clothing');
  });

  test('blocks purchase of an out-of-stock product', async ({ productPage }) => {
    await productPage.goto(rainJacket.slug);

    await expect(productPage.stockStatus).toHaveText('Out of stock');
    await expect(productPage.addToCartButton).toHaveText('Out of stock');
    await expect(productPage.addToCartButton).toBeDisabled();
  });

  test('suggests related products from the same category', async ({ productPage }) => {
    await productPage.goto(keyboard.slug);

    await expect(productPage.relatedProducts).toHaveCount(3);
    await expect(productPage.relatedProducts.filter({ hasNotText: 'Electronics ·' })).toHaveCount(0);
    await expect(productPage.relatedProducts.filter({ hasText: keyboard.name })).toHaveCount(0);
  });

  test('shows a not-found message for an unknown product', async ({ productPage }) => {
    await productPage.goto('does-not-exist');
    await expect(productPage.heading).toHaveText('Product not found');
  });
});
