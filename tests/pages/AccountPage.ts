import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class AccountPage extends BasePage {
  readonly details: Locator;
  readonly orderRows: Locator;
  readonly noOrders: Locator;
  readonly signOutButton: Locator;

  constructor(page: Page) {
    super(page);
    this.details = page.getByTestId('account-details');
    this.orderRows = page.getByTestId('order-row');
    this.noOrders = page.getByTestId('no-orders');
    this.signOutButton = page.getByRole('button', { name: 'Sign out' });
  }

  async goto() {
    await this.open('/account');
  }
}
