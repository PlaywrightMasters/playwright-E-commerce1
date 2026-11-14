import { DEMO_USER_STORAGE_STATE } from '../../../utils/paths';
import { buildCheckoutDetails, DEMO_USER, PRODUCTS } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';
import { expectOk } from '../../support/shop-api';
import type { Order } from '../../support/types';

test.describe('Account with the shared demo session', () => {
  // Reuses the session saved by the setup project. These tests must stay read-only:
  // signing out or changing the cart here would affect other tests sharing the session.
  test.use({ storageState: DEMO_USER_STORAGE_STATE });

  test('shows who is signed in', { tag: '@smoke' }, async ({ accountPage }) => {
    await accountPage.goto();

    await expect(accountPage.heading).toHaveText('My account');
    await expect(accountPage.details).toHaveText(`Signed in as ${DEMO_USER.name} (${DEMO_USER.email})`);
    await expect(accountPage.header.accountLink).toBeVisible();
    await expect(accountPage.header.signInLink).toBeHidden();
  });

  test('skips the sign-in form when already signed in', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/\/account$/);
  });
});

test.describe('Account with a fresh user', () => {
  test('starts with an empty order history', async ({ newUser, accountPage }) => {
    await accountPage.goto();
    await expect(accountPage.details).toContainText(newUser.email);
    await expect(accountPage.noOrders).toHaveText('You have not placed any orders yet.');
  });

  test('lists orders newest first', async ({ newUser, shopApi, accountPage }) => {
    await shopApi.seedCart({ productId: PRODUCTS.mug.id });
    const { order: first } = await expectOk<{ order: Order }>(
      await shopApi.placeOrder(buildCheckoutDetails({ email: newUser.email })),
      'first order',
    );
    await shopApi.seedCart({ productId: PRODUCTS.journal.id });
    const { order: second } = await expectOk<{ order: Order }>(
      await shopApi.placeOrder(buildCheckoutDetails({ email: newUser.email })),
      'second order',
    );

    await accountPage.goto();

    await expect(accountPage.orderRows).toHaveCount(2);
    await expect(accountPage.orderRows.nth(0)).toContainText(second.id);
    await expect(accountPage.orderRows.nth(1)).toContainText(first.id);
  });

  test('signs out and protects the account page again', async ({ newUser, accountPage, page }) => {
    await accountPage.goto();
    await expect(accountPage.details).toContainText(newUser.email);

    await accountPage.signOutButton.click();

    await expect(page).toHaveURL(/\/$/);
    await expect(accountPage.header.signInLink).toBeVisible();
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
  });
});
