import type { APIRequestContext } from '@playwright/test';
import { buildUser, DEMO_USER, PRODUCTS } from '../../utils/test-data';
import { expect, test } from '../fixtures/api';
import { expectOk } from '../support/shop-api';
import type { Cart, User } from '../support/types';

async function sessionId(request: APIRequestContext): Promise<string | undefined> {
  const { cookies } = await request.storageState();
  return cookies.find((c) => c.name === 'sid')?.value;
}

test.describe('Auth API', () => {
  test('registers a user, signs them in and never echoes the password', async ({ api }) => {
    const user = buildUser();
    const response = await api.register(user);
    expect(response.status()).toBe(201);
    const body = await response.json();
    expect(body).toEqual({ user: { id: expect.any(String), name: user.name, email: user.email } });
    expect(JSON.stringify(body)).not.toContain(user.password);

    const me = await expectOk<{ user: User }>(await api.me(), 'me');
    expect(me.user.email).toBe(user.email);
  });

  test('rejects an email that is already registered, ignoring case', async ({ api }) => {
    const response = await api.register(buildUser({ email: DEMO_USER.email.toUpperCase() }));
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({
      error: 'An account with this email already exists',
      fields: { email: 'An account with this email already exists' },
    });
  });

  test('reports every invalid registration field at once', async ({ api }) => {
    const response = await api.register({ name: ' ', email: 'not-an-email', password: 'short' });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Please correct the highlighted fields',
      fields: {
        name: 'Name is required',
        email: 'Enter a valid email address',
        password: 'Password must be at least 8 characters',
      },
    });
  });

  test('signing in rotates the session id and keeps the guest cart', async ({ api, request }) => {
    await api.seedCart({ productId: PRODUCTS.mug.id });
    const guestSession = await sessionId(request);

    const response = await api.login(DEMO_USER.email, DEMO_USER.password);
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ user: { id: expect.any(String), name: DEMO_USER.name, email: DEMO_USER.email } });

    const userSession = await sessionId(request);
    expect(userSession).toBeDefined();
    expect(userSession).not.toBe(guestSession);

    const cart = await expectOk<Cart>(await api.getCart(), 'get cart');
    expect(cart.items.map((i) => i.productId)).toEqual([PRODUCTS.mug.id]);
  });

  test('uses one generic error for a wrong password and an unknown email', async ({ api }) => {
    const wrongPassword = await api.login(DEMO_USER.email, 'Wrong#Password1');
    const unknownEmail = await api.login('nobody@example.test', 'Wrong#Password1');
    expect(wrongPassword.status()).toBe(401);
    expect(unknownEmail.status()).toBe(401);
    expect(await wrongPassword.json()).toEqual({ error: 'Invalid email or password' });
    expect(await unknownEmail.json()).toEqual(await wrongPassword.json());
  });

  test('requires both email and password', async ({ api }) => {
    const response = await api.login('', '');
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Email and password are required',
      fields: { email: 'Email is required', password: 'Password is required' },
    });
  });

  test('reports no user for a guest', async ({ api }) => {
    expect(await expectOk(await api.me(), 'me')).toEqual({ user: null });
  });

  test('signing out ends the session for good', async ({ api, request, playwright, baseURL }) => {
    await expectOk(await api.login(DEMO_USER.email, DEMO_USER.password), 'login');
    const oldSession = await sessionId(request);

    const response = await api.logout();
    expect(response.status()).toBe(204);
    expect(response.headers()['set-cookie']).toContain('Max-Age=0');
    expect(await expectOk(await api.me(), 'me')).toEqual({ user: null });

    // Replaying the old cookie must not restore the session.
    const replay = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { Cookie: `sid=${oldSession}` } });
    try {
      expect(await (await replay.get('/api/auth/me')).json()).toEqual({ user: null });
    } finally {
      await replay.dispose();
    }
  });
});
