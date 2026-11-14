// Pure pricing rules. Every amount is an integer number of cents.

export const TAX_RATE = 0.08;
export const FREE_SHIPPING_THRESHOLD_CENTS = 7500;

export const SHIPPING_METHODS = Object.freeze({
  standard: { id: 'standard', label: 'Standard (3–5 business days)', costCents: 599 },
  express: { id: 'express', label: 'Express (1–2 business days)', costCents: 1499 },
});

export const PROMO_CODES = Object.freeze({
  SAVE10: { code: 'SAVE10', type: 'percent', value: 10, description: '10% off your order' },
  FREESHIP: { code: 'FREESHIP', type: 'free-shipping', value: 0, description: 'Free shipping' },
  SPRING2025: { code: 'SPRING2025', type: 'percent', value: 20, description: '20% off', expired: true },
});

/**
 * Normalises and looks up a promo code.
 * @param {unknown} rawCode
 * @returns {{ promo: typeof PROMO_CODES[keyof typeof PROMO_CODES] } | { error: string }}
 */
export function findPromo(rawCode) {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!code) return { error: 'Enter a promo code' };
  const promo = Object.hasOwn(PROMO_CODES, code) ? PROMO_CODES[code] : undefined;
  if (!promo) return { error: 'Invalid promo code' };
  if (promo.expired) return { error: 'This promo code has expired' };
  return { promo };
}

/**
 * Prices a cart.
 * Tax applies to the discounted merchandise subtotal, not to shipping.
 * Free standard shipping applies when the discounted subtotal reaches the threshold.
 * @param {ReadonlyArray<{ unitPriceCents: number, quantity: number }>} lines
 * @param {{ promoCode?: string | null, shippingMethod?: string }} [options]
 */
export function priceCart(lines, { promoCode = null, shippingMethod = 'standard' } = {}) {
  const method = Object.hasOwn(SHIPPING_METHODS, shippingMethod)
    ? SHIPPING_METHODS[shippingMethod]
    : SHIPPING_METHODS.standard;
  const promo = promoCode && Object.hasOwn(PROMO_CODES, promoCode) ? PROMO_CODES[promoCode] : null;

  const subtotalCents = lines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
  const discountCents = promo?.type === 'percent' ? Math.round((subtotalCents * promo.value) / 100) : 0;
  const discountedCents = subtotalCents - discountCents;

  let shippingCents = 0;
  if (lines.length > 0 && promo?.type !== 'free-shipping') {
    const qualifiesForFreeStandard =
      method.id === 'standard' && discountedCents >= FREE_SHIPPING_THRESHOLD_CENTS;
    shippingCents = qualifiesForFreeStandard ? 0 : method.costCents;
  }

  const taxCents = Math.round(discountedCents * TAX_RATE);

  return {
    subtotalCents,
    discountCents,
    shippingCents,
    taxCents,
    totalCents: discountedCents + shippingCents + taxCents,
    shippingMethod: method.id,
  };
}
