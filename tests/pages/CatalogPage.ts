import type { Locator, Page } from '@playwright/test';
import { parseMoney } from '../../utils/money';
import { BasePage } from './BasePage';

export type SortOption =
  | 'Featured'
  | 'Price: Low to High'
  | 'Price: High to Low'
  | 'Top rated'
  | 'Newest'
  | 'Name: A to Z';

/** Product listing used by the home page (`/`) and search results (`/search`). */
export class CatalogPage extends BasePage {
  readonly hero: Locator;
  readonly productCards: Locator;
  readonly resultCount: Locator;
  readonly noResults: Locator;
  readonly alert: Locator;
  readonly categorySelect: Locator;
  readonly sortSelect: Locator;
  readonly minPriceInput: Locator;
  readonly maxPriceInput: Locator;
  readonly applyFiltersButton: Locator;
  readonly clearFiltersLink: Locator;
  readonly pageIndicator: Locator;
  readonly nextPageLink: Locator;
  readonly previousPageLink: Locator;

  constructor(page: Page) {
    super(page);
    this.hero = page.getByRole('region', { name: 'New season essentials' });
    this.productCards = page.getByRole('list', { name: 'Products' }).getByTestId('product-card');
    this.resultCount = page.getByTestId('result-count');
    this.noResults = page.getByTestId('no-results');
    this.alert = this.main.getByRole('alert');
    this.categorySelect = page.getByLabel('Category', { exact: true });
    this.sortSelect = page.getByLabel('Sort by', { exact: true });
    this.minPriceInput = page.getByLabel('Min price ($)', { exact: true });
    this.maxPriceInput = page.getByLabel('Max price ($)', { exact: true });
    this.applyFiltersButton = page.getByRole('button', { name: 'Apply filters' });
    this.clearFiltersLink = page.getByRole('link', { name: 'Clear filters' });
    const pagination = page.getByRole('navigation', { name: 'Pagination' });
    this.pageIndicator = pagination.getByTestId('page-indicator');
    this.nextPageLink = pagination.getByRole('link', { name: 'Next page' });
    this.previousPageLink = pagination.getByRole('link', { name: 'Previous page' });
  }

  async goto(query: Record<string, string> = {}) {
    const qs = new URLSearchParams(query).toString();
    await this.open(qs ? `/?${qs}` : '/');
  }

  productCard(name: string): Locator {
    return this.productCards.filter({ has: this.page.getByRole('heading', { name, exact: true }) });
  }

  async openProduct(name: string) {
    await this.navigateBy(() => this.productCard(name).getByRole('link', { name, exact: true }).click());
  }

  async productNames(): Promise<string[]> {
    await this.waitForReady();
    return this.productCards.getByRole('heading').allInnerTexts();
  }

  async productPrices(): Promise<number[]> {
    await this.waitForReady();
    return (await this.productCards.getByTestId('product-price').allInnerTexts()).map(parseMoney);
  }

  async selectCategory(label: string) {
    await this.navigateBy(() => this.categorySelect.selectOption({ label }));
  }

  async sortBy(option: SortOption) {
    await this.navigateBy(() => this.sortSelect.selectOption({ label: option }));
  }

  async filterByPrice({ min, max }: { min?: number; max?: number }) {
    if (min !== undefined) await this.minPriceInput.fill(String(min));
    if (max !== undefined) await this.maxPriceInput.fill(String(max));
    await this.navigateBy(() => this.applyFiltersButton.click());
  }

  async clearFilters() {
    await this.navigateBy(() => this.clearFiltersLink.click());
  }

  async goToNextPage() {
    await this.navigateBy(() => this.nextPageLink.click());
  }
}

export class SearchPage extends CatalogPage {
  async search(query: string) {
    await this.open(`/search?q=${encodeURIComponent(query)}`);
  }
}
