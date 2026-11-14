import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class OrderConfirmationPage extends BasePage {
  readonly orderNumber: Locator;
  readonly items: Locator;
  readonly total: Locator;
  readonly paymentSummary: Locator;
  readonly shippingSummary: Locator;

  constructor(page: Page) {
    super(page);
    this.orderNumber = page.getByTestId('order-number');
    this.items = page.getByTestId('order-item');
    this.total = page.getByTestId('summary-total');
    this.paymentSummary = page.getByTestId('payment-summary');
    this.shippingSummary = page.getByTestId('shipping-summary');
  }

  async goto(orderId: string) {
    await this.open(`/orders/${orderId}`);
  }
}
