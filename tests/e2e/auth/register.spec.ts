import { buildUser, DEMO_USER } from '../../../utils/test-data';
import { expect, test } from '../../fixtures';

test.describe('Registration', () => {
  test('creates an account and signs the shopper in', { tag: '@smoke' }, async ({ registerPage, accountPage, page }) => {
    const user = buildUser();
    await registerPage.goto();
    await registerPage.register(user);

    await expect(page).toHaveURL(/\/account$/);
    await expect(accountPage.details).toHaveText(`Signed in as ${user.name} (${user.email})`);
    await expect(accountPage.noOrders).toBeVisible();
  });

  test('rejects an email that is already registered', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.register(buildUser({ email: DEMO_USER.email.toUpperCase() }));

    await expect(registerPage.emailInput).toHaveAccessibleDescription('An account with this email already exists');
    await expect(registerPage.emailInput).toBeFocused();
  });

  test('checks that the passwords match before contacting the server', async ({ registerPage, page }) => {
    const registerRequests: string[] = [];
    await page.route('**/api/auth/register', async (route) => {
      registerRequests.push(route.request().url());
      await route.continue();
    });
    await registerPage.goto();

    await registerPage.register(buildUser(), 'Different#Pass1');

    await expect(registerPage.confirmPasswordInput).toHaveAccessibleDescription('Passwords do not match');
    await expect(registerPage.formError).toHaveText('Please correct the highlighted fields');
    expect(registerRequests).toEqual([]);
  });

  const weakPasswords = [
    { password: 'Ab1', message: 'Password must be at least 8 characters' },
    { password: 'alllowercase1', message: 'Password must include upper and lower case letters and a number' },
    { password: 'NoDigitsHere', message: 'Password must include upper and lower case letters and a number' },
  ];

  for (const { password, message } of weakPasswords) {
    test(`explains why "${password}" is too weak`, async ({ registerPage }) => {
      await registerPage.goto();
      await registerPage.register(buildUser({ password }));

      // The description combines the always-visible hint and the error.
      await expect(registerPage.passwordInput).toHaveAccessibleDescription(new RegExp(`${message}$`));
      await expect(registerPage.passwordInput).toHaveAttribute('aria-invalid', 'true');
    });
  }

  test('validates the email format', async ({ registerPage }) => {
    await registerPage.goto();
    await registerPage.register(buildUser({ email: 'not-an-email' }));
    await expect(registerPage.emailInput).toHaveAccessibleDescription('Enter a valid email address');
  });
});
