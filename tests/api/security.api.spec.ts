import { expect, test } from '../fixtures/api';

test.describe('HTTP hardening', () => {
  test('pages send a strict content security policy and safe headers', async ({ request }) => {
    const response = await request.get('/');
    expect(response.status()).toBe(200);
    const headers = response.headers();
    expect(headers['content-security-policy']).toContain("script-src 'self'");
    expect(headers['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('same-origin');
  });

  test('API responses are JSON and never cached', async ({ request }) => {
    const response = await request.get('/api/products');
    expect(response.headers()['content-type']).toBe('application/json; charset=utf-8');
    expect(response.headers()['cache-control']).toBe('no-store');
  });

  test('unknown API routes return a JSON 404', async ({ request }) => {
    const response = await request.get('/api/does-not-exist');
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Not found' });
  });

  test('static assets cannot escape the public folder', async ({ request }) => {
    const response = await request.get('/assets/..%2fserver.mjs');
    expect(response.status()).toBe(404);
    expect(await response.text()).not.toContain('createServer');
  });

  test('ignores a malformed cookie instead of failing every request', async ({ request }) => {
    // Cookies are shared across ports on the same host, so another local app can send this.
    const response = await request.get('/api/cart', { headers: { Cookie: 'other=%E0%A4%A; sid=%' } });
    expect(response.status()).toBe(200);
    expect(((await response.json()) as { itemCount: number }).itemCount).toBe(0);
  });

  for (const path of ['/api/products/%E0%A4%A', '/api/orders/%E0%A4%A']) {
    test(`answers 404, not 500, for malformed percent-encoding in ${path.split('/')[2]} ids`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(404);
    });
  }

  test('rejects request bodies that are not JSON', async ({ request }) => {
    const response = await request.post('/api/cart/items', {
      headers: { 'Content-Type': 'text/plain' },
      data: 'productId=p-001',
    });
    expect(response.status()).toBe(415);
    expect(await response.json()).toEqual({ error: 'Content-Type must be application/json' });
  });

  test('rejects malformed JSON', async ({ request }) => {
    const response = await request.post('/api/cart/items', {
      headers: { 'Content-Type': 'application/json' },
      data: '{"productId":',
    });
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Malformed JSON body' });
  });

  test('rejects oversized request bodies', async ({ request }) => {
    const response = await request.post('/api/cart/items', {
      data: { productId: 'p-001', padding: 'x'.repeat(20_000) },
    });
    expect(response.status()).toBe(413);
    expect(await response.json()).toEqual({ error: 'Request body is too large' });
  });
});
