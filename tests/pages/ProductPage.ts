import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './BasePage';

export interface AddToCartOptions {
  size?: string;
  color?: string;
  quantity?: number;
}

export class ProductPage extends BasePage {
  readonly price: Locator;
  readonly stockStatus: Locator;
  readonly breadcrumb: Locator;
  readonly addToCartForm: Locator;
  readonly addToCartButton: Locator;
  readonly colorSelect: Locator;
  readonly quantityInput: Locator;
  readonly statusMessage: Locator;
  readonly errorMessage: Locator;
  readonly viewCartLink: Locator;
  readonly relatedProducts: Locator;

  constructor(page: Page) {
    super(page);
    this.price = page.getByTestId('detail-price');
    this.stockStatus = page.getByTestId('stock-status');
    this.breadcrumb = page.getByRole('navigation', { name: 'Breadcrumb' });
    this.addToCartForm = page.getByRole('form', { name: 'Add to cart' });
    this.addToCartButton = this.addToCartForm.getByRole('button');
    this.colorSelect = this.addToCartForm.getByLabel('Color', { exact: true });
    this.quantityInput = this.addToCartForm.getByLabel('Quantity', { exact: true });
    this.statusMessage = page.getByTestId('add-to-cart-status');
    this.errorMessage = page.getByTestId('add-to-cart-error');
    this.viewCartLink = this.statusMessage.getByRole('link', { name: 'View cart' });
    this.relatedProducts = page.getByRole('list', { name: 'Related products' }).getByTestId('product-card');
  }

  async goto(slug: string) {
    await this.open(`/products/${slug}`);
  }

  sizeOption(size: string): Locator {
    return this.addToCartForm.getByRole('radio', { name: size, exact: true });
  }

  async addToCart({ size, color, quantity }: AddToCartOptions = {}) {
    if (size) await this.sizeOption(size).check();
    if (color) await this.colorSelect.selectOption(color);
    if (quantity !== undefined) await this.quantityInput.fill(String(quantity));
    await this.addToCartButton.click();
  }

  async expectAddedToCart(productName: string) {
    await expect(this.statusMessage).toContainText(`Added ${productName} to your cart`);
  }
}
