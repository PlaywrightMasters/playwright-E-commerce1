import { buildCheckoutDetails, PRODUCTS } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';
import type { CheckoutField } from '../../pages/CheckoutPage';
import { expectOk } from '../../support/shop-api';
import type { Order } from '../../support/types';

const { tee, mug, journal } = PRODUCTS;

test.describe('Checkout', () => {
  test('guest completes checkout and sees the confirmation', { tag: '@smoke' }, async ({ shopApi, checkoutPage, orderPage, page }) => {
    await shopApi.seedCart({ productId: tee.id, size: 'M', color: 'Navy' });
    await checkoutPage.goto();
    await expect(checkoutPage.summaryItems).toHaveText([`${tee.name} (Size M, Navy) × 1: $24.99`]);
    await expect(checkoutPage.total).toHaveText('$32.98');

    await checkoutPage.fillDetails(buildCheckoutDetails());
    await checkoutPage.placeOrder();

    await expect(page).toHaveURL(/\/orders\/ORD-[A-Z0-9]{8}$/);
    await expect(orderPage.heading).toHaveText('Thank you for your order!');
    await expect(orderPage.orderNumber).toHaveText(/^ORD-[A-Z0-9]{8}$/);
    await expect(orderPage.total).toHaveText('$32.98');
    await expect(orderPage.paymentSummary).toHaveText('Paid with card ending in 4242');
    await expect(orderPage.header.cartCount).toHaveText('0');
  });

  test('shows an empty-cart message instead of the form', async ({ checkoutPage }) => {
    await checkoutPage.goto();
    await expect(checkoutPage.emptyMessage).toHaveText('Your cart is empty.');
    await expect(checkoutPage.placeOrderButton).toBeHidden();
  });

  test('flags every missing field and focuses the first one', async ({ shopApi, checkoutPage }) => {
    await shopApi.seedCart({ productId: mug.id });
    await checkoutPage.goto();

    await checkoutPage.placeOrder();

    await expect(checkoutPage.formError).toHaveText('Please correct the highlighted fields');
    await expect(checkoutPage.input('email')).toBeFocused();
    const expectedErrors: [CheckoutField, string][] = [
      ['email', 'Email is required'],
      ['fullName', 'Full name is required'],
      ['address', 'Address is required'],
      ['city', 'City is required'],
      ['postalCode', 'Postal code is required'],
      ['nameOnCard', 'Name on card is required'],
      ['cardNumber', 'Card number is required'],
      ['expiry', 'Expiry date is required'],
      ['cvc', 'Security code is required'],
      ['acceptTerms', 'You must accept the terms and conditions'],
    ];
    for (const [field, message] of expectedErrors) {
      await expect(checkoutPage.input(field), field).toHaveAttribute('aria-invalid', 'true');
      await expect(checkoutPage.input(field), field).toHaveAccessibleDescription(message);
    }
  });

  test('clears a field error once the field is corrected', async ({ shopApi, checkoutPage }) => {
    await shopApi.seedCart({ productId: mug.id });
    await checkoutPage.goto();
    await checkoutPage.fillDetails(buildCheckoutDetails({ email: 'not-an-email' }));
    await checkoutPage.placeOrder();
    await expect(checkoutPage.input('email')).toHaveAccessibleDescription('Enter a valid email address');

    await checkoutPage.fillDetails({ email: 'fixed@example.test', acceptTerms: false });
    await checkoutPage.placeOrder();

    await expect(checkoutPage.input('email')).not.toHaveAttribute('aria-invalid');
    await expect(checkoutPage.input('email')).toHaveAccessibleDescription('');
    await expect(checkoutPage.input('acceptTerms')).toHaveAccessibleDescription('You must accept the terms and conditions');
  });

  test('express shipping updates the order summary', async ({ shopApi, checkoutPage }) => {
    await shopApi.seedCart({ productId: tee.id, size: 'M' });
    await checkoutPage.goto();
    await expect(checkoutPage.shipping).toHaveText('$5.99');

    await checkoutPage.shippingOption('express').check();

    await expect(checkoutPage.shipping).toHaveText('$14.99');
    await expect(checkoutPage.total).toHaveText('$41.98');
  });

  test('signed-in shopper gets a prefilled email and sees the order in their history', async ({
    newUser,
    shopApi,
    checkoutPage,
    orderPage,
    accountPage,
  }) => {
    await shopApi.seedCart({ productId: mug.id, quantity: 3 });
    await checkoutPage.goto();
    await expect(checkoutPage.input('email')).toHaveValue(newUser.email);

    await checkoutPage.fillDetails(buildCheckoutDetails({ email: newUser.email }));
    await checkoutPage.placeOrder();
    await expect(orderPage.orderNumber).toHaveText(/^ORD-/);
    const orderNumber = await orderPage.orderNumber.innerText();

    await accountPage.goto();
    await expect(accountPage.orderRows).toHaveCount(1);
    await expect(accountPage.orderRows.first()).toContainText(orderNumber);
    await expect(accountPage.orderRows.first()).toContainText('$52.97');
  });

  test('keeps an order confirmation private to the shopper who placed it', async ({ shopApi, browser, baseURL }) => {
    await shopApi.seedCart({ productId: journal.id });
    const { order } = await expectOk<{ order: Order }>(await shopApi.placeOrder(buildCheckoutDetails()), 'place order');

    const strangerContext = await browser.newContext({ baseURL });
    try {
      const stranger = await strangerContext.newPage();
      await stranger.goto(`/orders/${order.id}`);
      await expect(stranger.getByRole('heading', { level: 1 })).toHaveText('Order not found');
    } finally {
      await strangerContext.close();
    }
  });
});
