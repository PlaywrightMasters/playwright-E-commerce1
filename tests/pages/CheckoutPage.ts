import type { Locator, Page } from '@playwright/test';
import type { CheckoutDetails } from '../support/types';
import { BasePage } from './BasePage';

export type CheckoutField = keyof CheckoutDetails;
export type ShippingMethod = 'standard' | 'express';

const TEXT_FIELDS = {
  email: 'Email',
  fullName: 'Full name',
  address: 'Address',
  city: 'City',
  postalCode: 'Postal code',
  nameOnCard: 'Name on card',
  cardNumber: 'Card number',
  expiry: 'Expiry date (MM/YY)',
  cvc: 'Security code (CVC)',
} as const satisfies Partial<Record<CheckoutField, string>>;

export class CheckoutPage extends BasePage {
  readonly emptyMessage: Locator;
  readonly countrySelect: Locator;
  readonly termsCheckbox: Locator;
  readonly placeOrderButton: Locator;
  readonly formError: Locator;
  readonly summaryItems: Locator;
  readonly subtotal: Locator;
  readonly shipping: Locator;
  readonly tax: Locator;
  readonly total: Locator;

  constructor(page: Page) {
    super(page);
    this.emptyMessage = page.getByTestId('empty-cart');
    this.countrySelect = page.getByLabel('Country', { exact: true });
    this.termsCheckbox = page.getByRole('checkbox', { name: 'I agree to the terms and conditions' });
    this.placeOrderButton = page.getByRole('button', { name: 'Place order' });
    this.formError = page.getByTestId('form-error');
    this.summaryItems = page.getByTestId('summary-item');
    this.subtotal = page.getByTestId('summary-subtotal');
    this.shipping = page.getByTestId('summary-shipping');
    this.tax = page.getByTestId('summary-tax');
    this.total = page.getByTestId('summary-total');
  }

  async goto() {
    await this.open('/checkout');
  }

  /** The form control for a checkout field; useful for asserting validation state. */
  input(field: CheckoutField): Locator {
    if (field === 'country') return this.countrySelect;
    if (field === 'acceptTerms') return this.termsCheckbox;
    if (field === 'shippingMethod') return this.shippingOption('standard');
    return this.page.getByLabel(TEXT_FIELDS[field], { exact: true });
  }

  shippingOption(method: ShippingMethod): Locator {
    return this.page.getByRole('radio', { name: method === 'standard' ? /^Standard/ : /^Express/ });
  }

  async fillDetails(details: Partial<CheckoutDetails>) {
    for (const [field, label] of Object.entries(TEXT_FIELDS) as [keyof typeof TEXT_FIELDS, string][]) {
      const value = details[field];
      if (value !== undefined) await this.page.getByLabel(label, { exact: true }).fill(value);
    }
    if (details.country) await this.countrySelect.selectOption(details.country);
    if (details.shippingMethod) await this.shippingOption(details.shippingMethod as ShippingMethod).check();
    if (details.acceptTerms !== undefined) await this.termsCheckbox.setChecked(details.acceptTerms);
  }

  async placeOrder() {
    await this.placeOrderButton.click();
  }
}
