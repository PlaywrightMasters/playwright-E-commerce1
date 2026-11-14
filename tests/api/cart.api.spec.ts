import { PRODUCTS, PROMO_CODES } from '../../utils/test-data';
import { expect, test } from '../fixtures/api';
import { expectOk } from '../support/shop-api';
import type { ApiError, Cart } from '../support/types';

const { tee, beanie, rainJacket, keyboard, mug, journal } = PRODUCTS;

test.describe('Cart API', () => {
  test('a new visitor has an empty cart and gets no session cookie', async ({ api }) => {
    const response = await api.getCart();
    expect(response.status()).toBe(200);
    expect(response.headers()['set-cookie']).toBeUndefined();
    expect(await response.json()).toEqual({
      items: [],
      itemCount: 0,
      promo: null,
      totals: { subtotalCents: 0, discountCents: 0, shippingCents: 0, taxCents: 0, totalCents: 0, shippingMethod: 'standard' },
      freeShippingRemainingCents: 0,
    });
  });

  test('adding an item starts an HttpOnly session and prices the cart', async ({ api }) => {
    const response = await api.addToCart({ productId: tee.id, size: 'M', color: 'Black', quantity: 2 });
    expect(response.status()).toBe(201);
    expect(response.headers()['set-cookie']).toMatch(/^sid=[\w-]{43}; Path=\/; HttpOnly; SameSite=Lax$/);

    const cart = (await response.json()) as Cart;
    expect(cart.itemCount).toBe(2);
    expect(cart.items).toEqual([
      expect.objectContaining({ productId: tee.id, size: 'M', color: 'Black', quantity: 2, unitPriceCents: 2499, lineTotalCents: 4998 }),
    ]);
    expect(cart.totals).toEqual({
      subtotalCents: 4998,
      discountCents: 0,
      shippingCents: 599,
      taxCents: 400,
      totalCents: 5997,
      shippingMethod: 'standard',
    });
  });

  test('defaults the colour to the first option', async ({ api }) => {
    const cart = await api.seedCart({ productId: beanie.id });
    expect(cart.items[0]).toMatchObject({ color: 'Grey', size: null });
  });

  test('merges repeat adds of the same variant into one line', async ({ api }) => {
    await api.seedCart({ productId: tee.id, size: 'M' });
    const cart = await api.seedCart({ productId: tee.id, size: 'M', quantity: 2 });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].quantity).toBe(3);
  });

  test('keeps different sizes on separate lines', async ({ api }) => {
    const cart = await api.seedCart({ productId: tee.id, size: 'M' }, { productId: tee.id, size: 'L' });
    expect(cart.items.map((i) => i.size)).toEqual(['M', 'L']);
    expect(cart.itemCount).toBe(2);
  });

  const invalidItems = [
    { name: 'an unknown product', item: { productId: 'p-999' }, status: 404, error: 'Product not found' },
    { name: 'a missing size', item: { productId: tee.id }, status: 400, error: 'Select a size' },
    { name: 'an unknown size', item: { productId: tee.id, size: 'XXL' }, status: 400, error: 'Invalid size' },
    { name: 'an unknown colour', item: { productId: beanie.id, color: 'Purple' }, status: 400, error: 'Invalid colour' },
    { name: 'a zero quantity', item: { productId: beanie.id, quantity: 0 }, status: 400, error: 'Quantity must be a whole number between 1 and 10' },
    { name: 'a fractional quantity', item: { productId: beanie.id, quantity: 1.5 }, status: 400, error: 'Quantity must be a whole number between 1 and 10' },
    { name: 'a quantity sent as text', item: { productId: beanie.id, quantity: '2' }, status: 400, error: 'Quantity must be a whole number between 1 and 10' },
    { name: 'a quantity above 10', item: { productId: beanie.id, quantity: 11 }, status: 400, error: 'Quantity must be a whole number between 1 and 10' },
    { name: 'an out-of-stock product', item: { productId: rainJacket.id, size: 'M' }, status: 409, error: 'This product is out of stock' },
  ];

  for (const { name, item, status, error } of invalidItems) {
    test(`rejects ${name} and leaves the cart unchanged`, async ({ api }) => {
      const response = await api.addToCart(item);
      expect(response.status()).toBe(status);
      expect(((await response.json()) as ApiError).error).toBe(error);
      const cart = await expectOk<Cart>(await api.getCart(), 'get cart');
      expect(cart.itemCount).toBe(0);
    });
  }

  test('caps a line at the stock available', async ({ api }) => {
    await api.seedCart({ productId: keyboard.id, quantity: keyboard.stock });
    const response = await api.addToCart({ productId: keyboard.id });
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: `You can add at most ${keyboard.stock} of this item` });
  });

  test('updates and removes cart lines', async ({ api }) => {
    const { items } = await api.seedCart({ productId: mug.id });
    const lineId = items[0].lineId;

    const updated = await expectOk<Cart>(await api.updateLine(lineId, 3), 'update line');
    expect(updated.items[0]).toMatchObject({ quantity: 3, lineTotalCents: 4350 });
    expect(updated.totals).toMatchObject({ subtotalCents: 4350, taxCents: 348, totalCents: 5297 });

    expect((await api.updateLine(lineId, 0)).status()).toBe(400);
    expect((await api.updateLine(lineId, 11)).status()).toBe(409);

    const removed = await expectOk<Cart>(await api.removeLine(lineId), 'remove line');
    expect(removed.items).toEqual([]);
    expect((await api.removeLine(lineId)).status()).toBe(404);
  });

  test('a percentage promo applies before tax', async ({ api }) => {
    await api.seedCart({ productId: tee.id, size: 'M' });
    const cart = await expectOk<Cart>(await api.applyPromo(' save10 '), 'apply promo');
    expect(cart.promo).toEqual({ code: 'SAVE10', description: '10% off your order' });
    expect(cart.totals).toEqual({
      subtotalCents: 2499,
      discountCents: 250,
      shippingCents: 599,
      taxCents: 180,
      totalCents: 3028,
      shippingMethod: 'standard',
    });

    const withoutPromo = await expectOk<Cart>(await api.removePromo(), 'remove promo');
    expect(withoutPromo.promo).toBeNull();
    expect(withoutPromo.totals.totalCents).toBe(3298);
  });

  test('a free-shipping promo also waives express shipping', async ({ api }) => {
    await api.seedCart({ productId: tee.id, size: 'M' });
    await expectOk<Cart>(await api.applyPromo(PROMO_CODES.freeShipping), 'apply promo');
    const quote = await expectOk<Cart>(await api.getCart('express'), 'express quote');
    expect(quote.totals).toMatchObject({ shippingCents: 0, totalCents: 2699, shippingMethod: 'express' });
  });

  const rejectedPromos = [
    { code: '', error: 'Enter a promo code' },
    { code: 'NOPE', error: 'Invalid promo code' },
    { code: PROMO_CODES.expired, error: 'This promo code has expired' },
  ];

  for (const { code, error } of rejectedPromos) {
    test(`rejects promo code "${code}"`, async ({ api }) => {
      await api.seedCart({ productId: beanie.id });
      const response = await api.applyPromo(code);
      expect(response.status()).toBe(400);
      expect(await response.json()).toEqual({ error });
    });
  }

  test('requires items before a promo code can be applied', async ({ api }) => {
    const response = await api.applyPromo(PROMO_CODES.percentOff);
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Add items to your cart before applying a promo code' });
  });

  test('clearing the cart also drops the promo', async ({ api }) => {
    await api.seedCart({ productId: tee.id, size: 'S' });
    await expectOk<Cart>(await api.applyPromo(PROMO_CODES.percentOff), 'apply promo');
    const cleared = await expectOk<Cart>(await api.clearCart(), 'clear cart');
    expect(cleared).toMatchObject({ items: [], itemCount: 0, promo: null });
  });

  test('free standard shipping starts at exactly $75 after discounts', async ({ api }) => {
    const below = await api.seedCart({ productId: tee.id, size: 'S', quantity: 3 });
    expect(below.totals).toMatchObject({ subtotalCents: 7497, shippingCents: 599 });
    expect(below.freeShippingRemainingCents).toBe(3);

    const above = await api.seedCart({ productId: journal.id });
    expect(above.totals).toMatchObject({ subtotalCents: 8697, shippingCents: 0 });
    expect(above.freeShippingRemainingCents).toBe(0);
  });

  test('quotes express shipping on request and rejects unknown methods', async ({ api }) => {
    await api.seedCart({ productId: tee.id, size: 'M' });
    const express = await expectOk<Cart>(await api.getCart('express'), 'express quote');
    expect(express.totals).toMatchObject({ shippingCents: 1499, totalCents: 4198, shippingMethod: 'express' });
    expect((await api.getCart('drone')).status()).toBe(400);
  });

  test('keeps carts isolated between sessions', async ({ api, playwright, baseURL }) => {
    await api.seedCart({ productId: mug.id });
    const stranger = await playwright.request.newContext({ baseURL });
    try {
      const cart = (await (await stranger.get('/api/cart')).json()) as Cart;
      expect(cart.itemCount).toBe(0);
    } finally {
      await stranger.dispose();
    }
  });
});
