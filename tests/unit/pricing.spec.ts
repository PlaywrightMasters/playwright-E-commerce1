import { expect, test } from '@playwright/test';
import { findPromo, priceCart } from '../../app/lib/pricing.mjs';

const line = (unitPriceCents: number, quantity = 1) => ({ unitPriceCents, quantity });

test.describe('priceCart', () => {
  test('an empty cart costs nothing, including shipping', () => {
    expect(priceCart([])).toEqual({
      subtotalCents: 0,
      discountCents: 0,
      shippingCents: 0,
      taxCents: 0,
      totalCents: 0,
      shippingMethod: 'standard',
    });
  });

  test('adds 8% tax on merchandise and rounds to the nearest cent', () => {
    // 3 x $14.50 = $43.50 -> tax $3.48
    expect(priceCart([line(1450, 3)])).toMatchObject({ subtotalCents: 4350, taxCents: 348, shippingCents: 599, totalCents: 5297 });
  });

  test('charges standard shipping just below the free-shipping threshold', () => {
    expect(priceCart([line(7499)]).shippingCents).toBe(599);
  });

  test('gives free standard shipping at exactly $75', () => {
    expect(priceCart([line(7500)]).shippingCents).toBe(0);
  });

  test('always charges for express shipping without a promo', () => {
    expect(priceCart([line(20000)], { shippingMethod: 'express' }).shippingCents).toBe(1499);
  });

  test('applies a percentage discount before tax', () => {
    expect(priceCart([line(2499)], { promoCode: 'SAVE10' })).toMatchObject({
      discountCents: 250,
      taxCents: 180,
      totalCents: 3028,
    });
  });

  test('uses the discounted subtotal for the free-shipping threshold', () => {
    // $80.00 - 10% = $72.00, which is below $75.
    expect(priceCart([line(8000)], { promoCode: 'SAVE10' }).shippingCents).toBe(599);
  });

  test('free-shipping promo waives every shipping method', () => {
    expect(priceCart([line(1000)], { promoCode: 'FREESHIP', shippingMethod: 'express' }).shippingCents).toBe(0);
  });

  test('falls back to standard shipping for an unknown method', () => {
    expect(priceCart([line(1000)], { shippingMethod: 'drone' }).shippingMethod).toBe('standard');
  });
});

test.describe('findPromo', () => {
  test('normalises case and whitespace', () => {
    expect(findPromo('  save10 ')).toEqual({ promo: expect.objectContaining({ code: 'SAVE10' }) });
  });

  const rejected: [unknown, string][] = [
    ['', 'Enter a promo code'],
    [undefined, 'Enter a promo code'],
    [42, 'Enter a promo code'],
    ['NOPE', 'Invalid promo code'],
    ['toString', 'Invalid promo code'],
    ['SPRING2025', 'This promo code has expired'],
  ];

  for (const [code, error] of rejected) {
    test(`rejects ${JSON.stringify(code) ?? 'undefined'} with "${error}"`, () => {
      expect(findPromo(code)).toEqual({ error });
    });
  }
});
