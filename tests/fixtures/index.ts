import { test as base, expect } from '@playwright/test';
import { buildUser } from '../../utils/test-data';
import { AccountPage } from '../pages/AccountPage';
import { CartPage } from '../pages/CartPage';
import { CatalogPage, SearchPage } from '../pages/CatalogPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { LoginPage } from '../pages/LoginPage';
import { OrderConfirmationPage } from '../pages/OrderConfirmationPage';
import { ProductPage } from '../pages/ProductPage';
import { RegisterPage } from '../pages/RegisterPage';
import { expectOk, ShopApi } from '../support/shop-api';
import type { NewUser } from '../support/types';

interface ShopFixtures {
  catalogPage: CatalogPage;
  searchPage: SearchPage;
  productPage: ProductPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  orderPage: OrderConfirmationPage;
  loginPage: LoginPage;
  registerPage: RegisterPage;
  accountPage: AccountPage;
  /** API client sharing cookies with the test's browser context; use it to seed state quickly. */
  shopApi: ShopApi;
  /** A freshly registered user who is already signed in within the test's browser context. */
  newUser: NewUser;
}

interface AutoFixtures {
  failOnUncaughtPageErrors: void;
}

export const test = base.extend<ShopFixtures & AutoFixtures>({
  // Any uncaught exception in the page fails the test, even if every assertion passed.
  failOnUncaughtPageErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await use();
      expect(errors, 'uncaught errors in the page').toEqual([]);
    },
    { auto: true },
  ],

  catalogPage: async ({ page }, use) => use(new CatalogPage(page)),
  searchPage: async ({ page }, use) => use(new SearchPage(page)),
  productPage: async ({ page }, use) => use(new ProductPage(page)),
  cartPage: async ({ page }, use) => use(new CartPage(page)),
  checkoutPage: async ({ page }, use) => use(new CheckoutPage(page)),
  orderPage: async ({ page }, use) => use(new OrderConfirmationPage(page)),
  loginPage: async ({ page }, use) => use(new LoginPage(page)),
  registerPage: async ({ page }, use) => use(new RegisterPage(page)),
  accountPage: async ({ page }, use) => use(new AccountPage(page)),

  shopApi: async ({ page }, use) => use(new ShopApi(page.request)),

  newUser: async ({ shopApi }, use) => {
    const user = buildUser();
    await expectOk(await shopApi.register(user), 'register test user');
    await use(user);
  },
});

export { expect };
