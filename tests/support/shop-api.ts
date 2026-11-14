import type { APIRequestContext, APIResponse } from '@playwright/test';
import type { Cart, CheckoutDetails, NewUser } from './types';

type Query = Record<string, string | number>;

interface CartItemInput {
  productId: string;
  quantity?: unknown;
  size?: string;
  color?: string;
}

/**
 * Thin client for the demo shop API.
 *
 * Pass the `request` fixture for pure API tests, or `page.request` to seed state
 * for UI tests: `page.request` shares cookies with the page's browser context,
 * so anything added through it shows up in the UI.
 */
export class ShopApi {
  constructor(private readonly request: APIRequestContext) {}

  health() {
    return this.request.get('/api/health');
  }

  listProducts(query: Query = {}) {
    return this.request.get('/api/products', { params: query });
  }

  getProduct(idOrSlug: string) {
    return this.request.get(`/api/products/${encodeURIComponent(idOrSlug)}`);
  }

  listCategories() {
    return this.request.get('/api/categories');
  }

  getCart(shipping?: string) {
    return this.request.get('/api/cart', shipping ? { params: { shipping } } : undefined);
  }

  addToCart(item: CartItemInput) {
    return this.request.post('/api/cart/items', { data: item });
  }

  updateLine(lineId: string, quantity: unknown) {
    return this.request.patch(`/api/cart/items/${lineId}`, { data: { quantity } });
  }

  removeLine(lineId: string) {
    return this.request.delete(`/api/cart/items/${lineId}`);
  }

  clearCart() {
    return this.request.delete('/api/cart');
  }

  applyPromo(code: unknown) {
    return this.request.post('/api/cart/promo', { data: { code } });
  }

  removePromo() {
    return this.request.delete('/api/cart/promo');
  }

  register(user: NewUser) {
    return this.request.post('/api/auth/register', { data: user });
  }

  login(email: string, password: string) {
    return this.request.post('/api/auth/login', { data: { email, password } });
  }

  logout() {
    return this.request.post('/api/auth/logout');
  }

  me() {
    return this.request.get('/api/auth/me');
  }

  placeOrder(details: Partial<CheckoutDetails>) {
    return this.request.post('/api/orders', { data: details });
  }

  getOrder(orderId: string) {
    return this.request.get(`/api/orders/${encodeURIComponent(orderId)}`);
  }

  listOrders() {
    return this.request.get('/api/orders');
  }

  /** Seeding helper: adds an item and fails loudly with the server's reason if it cannot. */
  async seedCart(...items: CartItemInput[]): Promise<Cart> {
    let cart: Cart | undefined;
    for (const item of items) {
      cart = await expectOk<Cart>(await this.addToCart(item), 'add to cart');
    }
    if (!cart) throw new Error('seedCart needs at least one item');
    return cart;
  }
}

/** Parses a successful JSON response, or throws with the status and body for debugging. */
export async function expectOk<T>(response: APIResponse, action: string): Promise<T> {
  if (!response.ok()) {
    throw new Error(`${action} failed: HTTP ${response.status()} ${await response.text()}`);
  }
  return (await response.json()) as T;
}
