import { buildCheckoutDetails, buildUser, CARDS, PRODUCTS } from '../../utils/test-data';
import { expect, test } from '../fixtures/api';
import { expectOk } from '../support/shop-api';
import type { ApiError, Cart, Order } from '../support/types';

const { tee, mug, journal, beanie } = PRODUCTS;

test.describe('Orders API', () => {
  test('places an order, keeps only the last four card digits and empties the cart', async ({ api }) => {
    const cart = await api.seedCart({ productId: tee.id, size: 'M' }, { productId: mug.id, quantity: 2 });
    const details = buildCheckoutDetails();

    const response = await api.placeOrder(details);
    expect(response.status()).toBe(201);
    const { order } = (await response.json()) as { order: Order };

    expect(order.id).toMatch(/^ORD-[A-Z0-9]{8}$/);
    expect(order.email).toBe(details.email);
    expect(order.totals).toEqual(cart.totals);
    expect(order.items.map((i) => [i.name, i.quantity])).toEqual([
      [tee.name, 1],
      [mug.name, 2],
    ]);
    expect(order.payment).toEqual({ cardLast4: '4242' });
    expect(order).not.toHaveProperty('cardNumber');
    expect(order).not.toHaveProperty('cvc');

    const after = await expectOk<Cart>(await api.getCart(), 'get cart');
    expect(after.itemCount).toBe(0);

    const fetched = await expectOk<{ order: Order }>(await api.getOrder(order.id), 'get order');
    expect(fetched.order).toEqual(order);
  });

  test('charges express shipping when selected', async ({ api }) => {
    await api.seedCart({ productId: journal.id });
    const { order } = await expectOk<{ order: Order }>(
      await api.placeOrder(buildCheckoutDetails({ shippingMethod: 'express' })),
      'place order',
    );
    expect(order.shippingMethod).toBe('express');
    expect(order.totals).toMatchObject({ subtotalCents: 1200, shippingCents: 1499, taxCents: 96, totalCents: 2795 });
  });

  test('refuses to place an order for an empty cart', async ({ api }) => {
    const response = await api.placeOrder(buildCheckoutDetails());
    expect(response.status()).toBe(400);
    expect(await response.json()).toEqual({ error: 'Your cart is empty' });
  });

  test('returns a field error for every field of an empty submission', async ({ api }) => {
    await api.seedCart({ productId: beanie.id });
    const response = await api.placeOrder({});
    expect(response.status()).toBe(422);
    const body = (await response.json()) as ApiError;
    expect(body.error).toBe('Please correct the highlighted fields');
    expect(Object.keys(body.fields ?? {}).sort()).toEqual(
      ['acceptTerms', 'address', 'city', 'country', 'cvc', 'email', 'expiry', 'fullName', 'nameOnCard', 'cardNumber', 'postalCode', 'shippingMethod'].sort(),
    );
  });

  const paymentFailures = [
    { name: 'a declined card', cardNumber: CARDS.declined, error: 'Your card was declined' },
    { name: 'insufficient funds', cardNumber: CARDS.insufficientFunds, error: 'Your card has insufficient funds' },
  ];

  for (const { name, cardNumber, error } of paymentFailures) {
    test(`responds 402 for ${name} and keeps the cart`, async ({ api }) => {
      await api.seedCart({ productId: beanie.id });
      const response = await api.placeOrder(buildCheckoutDetails({ cardNumber }));
      expect(response.status()).toBe(402);
      expect(await response.json()).toEqual({ error });
      const cart = await expectOk<Cart>(await api.getCart(), 'get cart');
      expect(cart.itemCount).toBe(1);
    });
  }

  test('hides an order from other sessions', async ({ api, playwright, baseURL }) => {
    await api.seedCart({ productId: mug.id });
    const { order } = await expectOk<{ order: Order }>(await api.placeOrder(buildCheckoutDetails()), 'place order');

    const stranger = await playwright.request.newContext({ baseURL });
    try {
      const response = await stranger.get(`/api/orders/${order.id}`);
      expect(response.status()).toBe(404);
    } finally {
      await stranger.dispose();
    }
  });

  test('lists order history only for signed-in shoppers', async ({ api }) => {
    const guest = await api.listOrders();
    expect(guest.status()).toBe(401);

    await expectOk(await api.register(buildUser()), 'register');
    await api.seedCart({ productId: mug.id });
    const { order: first } = await expectOk<{ order: Order }>(await api.placeOrder(buildCheckoutDetails()), 'first order');
    await api.seedCart({ productId: journal.id });
    const { order: second } = await expectOk<{ order: Order }>(await api.placeOrder(buildCheckoutDetails()), 'second order');

    const { orders } = await expectOk<{ orders: Order[] }>(await api.listOrders(), 'list orders');
    expect(orders.map((o) => o.id)).toEqual([second.id, first.id]);
  });
});
