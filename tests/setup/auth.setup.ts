import { expect, test as setup } from '@playwright/test';
import { DEMO_USER_STORAGE_STATE } from '../../utils/paths';
import { DEMO_USER } from '../../utils/test-data';

// Signing in through the API is faster than the UI and needs no browser, so every
// browser project can depend on it. The sign-in form itself is covered by login.spec.ts.
setup('sign in as the demo user', async ({ request }) => {
  const response = await request.post('/api/auth/login', {
    data: { email: DEMO_USER.email, password: DEMO_USER.password },
  });
  expect(response.status()).toBe(200);
  await request.storageState({ path: DEMO_USER_STORAGE_STATE });
});
