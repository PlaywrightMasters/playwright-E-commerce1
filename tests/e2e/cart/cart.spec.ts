import { formatMoney } from '../../../utils/money';
import { DEMO_USER, PRODUCTS, PROMO_CODES } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';

const { tee, mug, beanie, journal } = PRODUCTS;

test.describe('Shopping cart', () => {
  test('adds a product with chosen options from the product page', { tag: '@smoke' }, async ({ productPage, cartPage, page }) => {
    await productPage.goto(tee.slug);
    await productPage.addToCart({ size: 'M', color: 'Black', quantity: 2 });

    await productPage.expectAddedToCart(tee.name);
    await expect(productPage.header.cartCount).toHaveText('2');

    await productPage.viewCartLink.click();
    await expect(page).toHaveURL(/\/cart$/);
    const line = cartPage.line(tee.name);
    await expect(line.options).toHaveText('Size: M · Color: Black');
    await expect(line.quantity).toHaveText('2');
    await expect(line.lineTotal).toHaveText(formatMoney(tee.priceCents * 2));
    await expect(cartPage.subtotal).toHaveText('$49.98');
  });

  test('asks for a size before adding a sized product', async ({ productPage }) => {
    await productPage.goto(tee.slug);
    await productPage.addToCart();

    await expect(productPage.errorMessage).toHaveText('Select a size');
    await expect(productPage.header.cartCount).toHaveText('0');
  });

  test('changes quantity with the stepper and recalculates totals', async ({ shopApi, cartPage }) => {
    await shopApi.seedCart({ productId: tee.id, size: 'L' });
    await cartPage.goto();
    const line = cartPage.line(tee.name);
    await expect(line.decrease).toBeDisabled();

    await line.increase.click();
    await expect(line.quantity).toHaveText('2');
    await expect(line.lineTotal).toHaveText('$49.98');
    await expect(cartPage.total).toHaveText('$59.97');
    await expect(cartPage.header.cartCount).toHaveText('2');
    await expect(line.increase).toBeFocused();

    await line.decrease.click();
    await expect(line.quantity).toHaveText('1');
    await expect(cartPage.total).toHaveText('$32.98');
  });

  test('removes an item and shows the empty state', async ({ shopApi, cartPage }) => {
    await shopApi.seedCart({ productId: mug.id });
    await cartPage.goto();

    await cartPage.line(mug.name).remove.click();

    await expect(cartPage.emptyMessage).toHaveText('Your cart is empty.');
    await expect(cartPage.header.cartCount).toHaveText('0');
    await expect(cartPage.heading).toBeFocused();
  });

  test('clears every item at once', async ({ shopApi, cartPage }) => {
    await shopApi.seedCart({ productId: mug.id }, { productId: beanie.id });
    await cartPage.goto();
    await expect(cartPage.items).toHaveCount(2);

    await cartPage.clearCartButton.click();

    await expect(cartPage.emptyMessage).toBeVisible();
    await expect(cartPage.items).toHaveCount(0);
  });

  test('applies and removes a percentage promo code', { tag: '@smoke' }, async ({ shopApi, cartPage }) => {
    await shopApi.seedCart({ productId: tee.id, size: 'M' });
    await cartPage.goto();

    await cartPage.applyPromo('save10');
    await expect(cartPage.appliedPromo).toContainText('Promo SAVE10 applied: 10% off your order.');
    await expect(cartPage.discount).toHaveText('-$2.50');
    await expect(cartPage.tax).toHaveText('$1.80');
    await expect(cartPage.total).toHaveText('$30.28');

    await cartPage.removePromoButton.click();
    await expect(cartPage.discount).toBeHidden();
    await expect(cartPage.total).toHaveText('$32.98');
  });

  const rejectedPromos = [
    { code: 'NOPE', message: 'Invalid promo code' },
    { code: PROMO_CODES.expired, message: 'This promo code has expired' },
  ];

  for (const { code, message } of rejectedPromos) {
    test(`explains why promo code ${code} was rejected`, async ({ shopApi, cartPage }) => {
      await shopApi.seedCart({ productId: beanie.id });
      await cartPage.goto();

      await cartPage.applyPromo(code);

      await expect(cartPage.promoMessage).toHaveText(message);
      await expect(cartPage.promoInput).toHaveAttribute('aria-invalid', 'true');
      await expect(cartPage.promoInput).toBeFocused();
      await expect(cartPage.discount).toBeHidden();
    });
  }

  test('shows progress towards free shipping and then waives it', async ({ shopApi, cartPage }) => {
    await shopApi.seedCart({ productId: tee.id, size: 'S', quantity: 3 });
    await cartPage.goto();
    await expect(cartPage.shipping).toHaveText('$5.99');
    await expect(cartPage.shippingHint).toHaveText('Add $0.03 more for free standard shipping.');

    await shopApi.seedCart({ productId: journal.id });
    await cartPage.goto();
    await expect(cartPage.shipping).toHaveText('Free');
    await expect(cartPage.shippingHint).toHaveText('You qualify for free shipping.');
  });

  test('keeps the cart across pages and reloads', async ({ shopApi, catalogPage, cartPage, page }) => {
    await shopApi.seedCart({ productId: mug.id, quantity: 2 });

    await catalogPage.goto();
    await expect(catalogPage.header.cartCount).toHaveText('2');
    await expect(catalogPage.header.cartLink).toHaveAccessibleName('Cart, 2 items');

    await cartPage.goto();
    await page.reload();
    await expect(cartPage.line(mug.name).quantity).toHaveText('2');
  });

  test('keeps guest cart items after signing in', async ({ shopApi, loginPage, cartPage, page }) => {
    await shopApi.seedCart({ productId: beanie.id });

    await loginPage.goto('/cart');
    await loginPage.login(DEMO_USER.email, DEMO_USER.password);

    await expect(page).toHaveURL(/\/cart$/);
    await expect(cartPage.line(beanie.name).root).toBeVisible();
    await expect(cartPage.header.accountLink).toBeVisible();
  });
});
