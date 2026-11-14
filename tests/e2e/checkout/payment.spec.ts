import { buildCheckoutDetails, CARDS, pastExpiry, PRODUCTS } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';
import type { CheckoutField } from '../../pages/CheckoutPage';
import { expectOk } from '../../support/shop-api';
import type { Cart, CheckoutDetails } from '../../support/types';

test.describe('Payment', () => {
  test.beforeEach(async ({ shopApi, checkoutPage }) => {
    await shopApi.seedCart({ productId: PRODUCTS.beanie.id });
    await checkoutPage.goto();
  });

  const bankDeclines = [
    { reason: 'a declined card', cardNumber: CARDS.declined, message: 'Your card was declined' },
    { reason: 'insufficient funds', cardNumber: CARDS.insufficientFunds, message: 'Your card has insufficient funds' },
  ];

  for (const { reason, cardNumber, message } of bankDeclines) {
    test(`keeps the shopper on checkout after ${reason}`, async ({ checkoutPage, shopApi, page }) => {
      await checkoutPage.fillDetails(buildCheckoutDetails({ cardNumber }));
      await checkoutPage.placeOrder();

      await expect(checkoutPage.formError).toHaveText(message);
      await expect(checkoutPage.formError).toBeFocused();
      await expect(page).toHaveURL(/\/checkout$/);
      await expect(checkoutPage.placeOrderButton).toBeEnabled();
      const cart = await expectOk<Cart>(await shopApi.getCart(), 'get cart');
      expect(cart.itemCount).toBe(1);
    });
  }

  const invalidCardDetails: { field: CheckoutField; change: Partial<CheckoutDetails>; message: string }[] = [
    { field: 'cardNumber', change: { cardNumber: CARDS.failsLuhn }, message: 'Enter a valid card number' },
    { field: 'expiry', change: { expiry: pastExpiry() }, message: 'Your card has expired' },
    { field: 'expiry', change: { expiry: '13/30' }, message: 'Enter a valid expiry month' },
    { field: 'expiry', change: { expiry: '1230' }, message: 'Enter the expiry date as MM/YY' },
    { field: 'cvc', change: { cvc: '12' }, message: 'Enter a valid security code' },
  ];

  for (const { field, change, message } of invalidCardDetails) {
    test(`flags ${field}: "${message}"`, async ({ checkoutPage }) => {
      await checkoutPage.fillDetails(buildCheckoutDetails(change));
      await checkoutPage.placeOrder();

      await expect(checkoutPage.input(field)).toHaveAccessibleDescription(message);
      await expect(checkoutPage.input(field)).toBeFocused();
    });
  }

  test('accepts a card number typed with dashes', async ({ checkoutPage, orderPage }) => {
    await checkoutPage.fillDetails(buildCheckoutDetails({ cardNumber: '4242-4242-4242-4242' }));
    await checkoutPage.placeOrder();

    await expect(orderPage.heading).toHaveText('Thank you for your order!');
    await expect(orderPage.paymentSummary).toHaveText('Paid with card ending in 4242');
  });
});
