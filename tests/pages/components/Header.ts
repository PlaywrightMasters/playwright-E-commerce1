import type { Locator, Page } from '@playwright/test';

/** Site header shared by every page: search, sign-in/account links and the cart badge. */
export class Header {
  readonly searchInput: Locator;
  readonly searchButton: Locator;
  readonly cartLink: Locator;
  readonly cartCount: Locator;
  readonly signInLink: Locator;
  readonly accountLink: Locator;

  constructor(page: Page) {
    const nav = page.getByRole('navigation', { name: 'Main' });
    this.searchInput = page.getByRole('searchbox', { name: 'Search products' });
    this.searchButton = page.getByRole('search').getByRole('button', { name: 'Search' });
    this.cartLink = nav.getByRole('link', { name: /^Cart,/ });
    this.cartCount = page.getByTestId('cart-count');
    this.signInLink = nav.getByRole('link', { name: 'Sign in' });
    this.accountLink = nav.getByRole('link', { name: 'Account' });
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }
}
