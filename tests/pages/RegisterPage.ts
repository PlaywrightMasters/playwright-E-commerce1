import type { Locator, Page } from '@playwright/test';
import type { NewUser } from '../support/types';
import { BasePage } from './BasePage';

export class RegisterPage extends BasePage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly confirmPasswordInput: Locator;
  readonly submitButton: Locator;
  readonly formError: Locator;

  constructor(page: Page) {
    super(page);
    this.nameInput = page.getByLabel('Full name', { exact: true });
    this.emailInput = page.getByLabel('Email', { exact: true });
    this.passwordInput = page.getByLabel('Password', { exact: true });
    this.confirmPasswordInput = page.getByLabel('Confirm password', { exact: true });
    this.submitButton = page.getByRole('button', { name: 'Create account' });
    this.formError = page.getByTestId('form-error');
  }

  async goto() {
    await this.open('/register');
  }

  async register(user: NewUser, confirmPassword = user.password) {
    await this.nameInput.fill(user.name);
    await this.emailInput.fill(user.email);
    await this.passwordInput.fill(user.password);
    await this.confirmPasswordInput.fill(confirmPassword);
    await this.submitButton.click();
  }
}
