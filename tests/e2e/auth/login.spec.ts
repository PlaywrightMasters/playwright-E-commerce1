import { DEMO_USER } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';

test.describe('Sign in', () => {
  test('signs in with valid credentials', { tag: '@smoke' }, async ({ loginPage, accountPage, page }) => {
    await loginPage.goto();
    await loginPage.login(DEMO_USER.email, DEMO_USER.password);

    await expect(page).toHaveURL(/\/account$/);
    await expect(accountPage.details).toContainText(DEMO_USER.email);
    await expect(accountPage.header.accountLink).toBeVisible();
    await expect(accountPage.header.signInLink).toBeHidden();
  });

  test('shows a generic error for a wrong password', async ({ loginPage, page }) => {
    await loginPage.goto();
    await loginPage.login(DEMO_USER.email, 'Wrong#Password1');

    await expect(loginPage.formError).toHaveText('Invalid email or password');
    await expect(loginPage.formError).toBeFocused();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('shows the same error for an unknown email', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.login('nobody@example.test', 'Whatever#Pass1');
    await expect(loginPage.formError).toHaveText('Invalid email or password');
  });

  test('requires both fields', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.submitButton.click();

    await expect(loginPage.emailInput).toHaveAccessibleDescription('Email is required');
    await expect(loginPage.passwordInput).toHaveAccessibleDescription('Password is required');
    await expect(loginPage.emailInput).toBeFocused();
  });

  test('toggles password visibility', async ({ loginPage }) => {
    await loginPage.goto();
    await loginPage.passwordInput.fill('Secret#123');
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');

    await loginPage.showPasswordButton.click();
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'text');
    await expect(loginPage.showPasswordButton).toHaveAttribute('aria-pressed', 'true');

    await loginPage.showPasswordButton.click();
    await expect(loginPage.passwordInput).toHaveAttribute('type', 'password');
    await expect(loginPage.showPasswordButton).toHaveAttribute('aria-pressed', 'false');
  });

  test('returns to the requested page after signing in', async ({ loginPage, page }) => {
    await loginPage.goto('/cart');
    await loginPage.login(DEMO_USER.email, DEMO_USER.password);
    await expect(page).toHaveURL(/\/cart$/);
  });

  for (const next of ['https://evil.example/phish', '//evil.example/phish', '/\\evil.example']) {
    test(`ignores the unsafe redirect target ${next}`, async ({ loginPage, page, baseURL }) => {
      await loginPage.goto(next);
      await loginPage.login(DEMO_USER.email, DEMO_USER.password);
      // Full-URL match proves we stayed on the shop's own origin.
      await expect(page).toHaveURL(new URL('/account', baseURL).href);
    });
  }

  test('sends guests from the account page to sign in and back', { tag: '@smoke' }, async ({ loginPage, accountPage, page }) => {
    await page.goto('/account');
    await expect(page).toHaveURL(/\/login\?next=%2Faccount$/);
    await expect(loginPage.heading).toHaveText('Sign in');

    await loginPage.login(DEMO_USER.email, DEMO_USER.password);
    await expect(page).toHaveURL(/\/account$/);
    await expect(accountPage.heading).toHaveText('My account');
  });

  test('stays signed in after a reload', async ({ loginPage, accountPage, page }) => {
    await loginPage.goto();
    await loginPage.login(DEMO_USER.email, DEMO_USER.password);
    await expect(accountPage.heading).toHaveText('My account');

    await page.reload();
    await expect(accountPage.details).toContainText(DEMO_USER.email);
  });

  test('links to registration', async ({ loginPage, registerPage, page }) => {
    await loginPage.goto();
    await loginPage.createAccountLink.click();
    await expect(page).toHaveURL(/\/register$/);
    await expect(registerPage.heading).toHaveText('Create an account');
  });
});
