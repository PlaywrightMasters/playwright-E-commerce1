import type { Locator, Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class LoginPage extends BasePage {
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly showPasswordButton: Locator;
  readonly submitButton: Locator;
  readonly formError: Locator;
  readonly createAccountLink: Locator;

  constructor(page: Page) {
    super(page);
    this.emailInput = page.getByLabel('Email', { exact: true });
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.showPasswordButton = page.getByRole('button', { name: 'Show password' });
    this.submitButton = this.main.getByRole('button', { name: 'Sign in' });
    this.formError = page.getByTestId('form-error');
    this.createAccountLink = this.main.getByRole('link', { name: 'Create an account' });
  }

  /** Opens the sign-in page, optionally with a post-login redirect target. */
  async goto(next?: string) {
    await this.open(next ? `/login?next=${encodeURIComponent(next)}` : '/login');
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
