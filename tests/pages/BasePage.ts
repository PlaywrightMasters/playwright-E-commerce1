import { expect, type Locator, type Page } from '@playwright/test';
import { Header } from './components/Header';

export abstract class BasePage {
  readonly header: Header;
  readonly main: Locator;
  readonly heading: Locator;

  constructor(readonly page: Page) {
    this.header = new Header(page);
    this.main = page.getByRole('main');
    this.heading = page.getByRole('heading', { level: 1 });
  }

  /** The app flips aria-busy on <main> to "false" once the current view has rendered. */
  async waitForReady() {
    await expect(this.main).toHaveAttribute('aria-busy', 'false');
  }

  protected async open(path: string) {
    await this.page.goto(path);
    await this.waitForReady();
  }

  /** Runs an action that triggers a full page navigation and waits for the new view. */
  protected async navigateBy(action: () => Promise<unknown>) {
    const before = this.page.url();
    await action();
    await this.page.waitForURL((url) => url.href !== before);
    await this.waitForReady();
  }
}
