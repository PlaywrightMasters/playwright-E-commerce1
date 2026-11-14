import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class CartPage extends BasePage {
  readonly items: Locator;
  readonly emptyMessage: Locator;
  readonly subtotal: Locator;
  readonly discount: Locator;
  readonly shipping: Locator;
  readonly tax: Locator;
  readonly total: Locator;
  readonly shippingHint: Locator;
  readonly promoInput: Locator;
  readonly applyPromoButton: Locator;
  readonly promoMessage: Locator;
  readonly appliedPromo: Locator;
  readonly removePromoButton: Locator;
  readonly checkoutLink: Locator;
  readonly clearCartButton: Locator;

  constructor(page: Page) {
    super(page);
    this.items = page.getByTestId('cart-item');
    this.emptyMessage = page.getByTestId('empty-cart');
    this.subtotal = page.getByTestId('summary-subtotal');
    this.discount = page.getByTestId('summary-discount');
    this.shipping = page.getByTestId('summary-shipping');
    this.tax = page.getByTestId('summary-tax');
    this.total = page.getByTestId('summary-total');
    this.shippingHint = page.getByTestId('shipping-hint');
    this.promoInput = page.getByRole('textbox', { name: 'Promo code' });
    this.applyPromoButton = page.getByRole('button', { name: 'Apply', exact: true });
    this.promoMessage = page.getByTestId('promo-message');
    this.appliedPromo = page.getByTestId('applied-promo');
    this.removePromoButton = page.getByRole('button', { name: 'Remove promo' });
    this.checkoutLink = page.getByRole('link', { name: 'Proceed to checkout' });
    this.clearCartButton = page.getByRole('button', { name: 'Clear cart' });
  }

  async goto() {
    await this.open('/cart');
  }

  /** Locators for one cart line, found by product name. */
  line(productName: string) {
    const root = this.items.filter({ has: this.page.getByRole('heading', { name: productName, exact: true }) });
    return {
      root,
      options: root.getByTestId('cart-item-options'),
      quantity: root.getByTestId('cart-item-quantity'),
      lineTotal: root.getByTestId('line-total'),
      increase: root.getByRole('button', { name: /^Increase quantity of / }),
      decrease: root.getByRole('button', { name: /^Decrease quantity of / }),
      remove: root.getByRole('button', { name: /^Remove / }),
    };
  }

  async applyPromo(code: string) {
    await this.promoInput.fill(code);
    await this.applyPromoButton.click();
  }
}
