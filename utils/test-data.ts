import { randomUUID } from 'node:crypto';
import type { CheckoutDetails, NewUser } from '../tests/support/types';

/** Seeded account that exists every time the demo shop starts. */
export const DEMO_USER = {
  name: 'Demo Shopper',
  email: process.env.DEMO_USER_EMAIL ?? 'shopper@example.test',
  password: process.env.DEMO_USER_PASSWORD ?? 'Shopper#2026',
} as const;

export const CATALOG_SIZE = 16;
export const PAGE_SIZE = 12;

/** Known catalogue entries used as stable test data (prices in cents). */
export const PRODUCTS = {
  tee: {
    id: 'p-001',
    slug: 'classic-cotton-tee',
    name: 'Classic Cotton Tee',
    category: 'clothing',
    priceCents: 2499,
    sizes: ['S', 'M', 'L', 'XL'],
    colors: ['White', 'Black', 'Navy'],
  },
  beanie: { id: 'p-003', slug: 'wool-beanie', name: 'Wool Beanie', category: 'clothing', priceCents: 1800 },
  rainJacket: { id: 'p-004', slug: 'rain-shell-jacket', name: 'Rain Shell Jacket', category: 'clothing', priceCents: 12900 },
  keyboard: { id: 'p-006', slug: 'mechanical-keyboard', name: 'Mechanical Keyboard', category: 'electronics', priceCents: 11950, stock: 8 },
  mug: { id: 'p-009', slug: 'ceramic-coffee-mug', name: 'Ceramic Coffee Mug', category: 'home', priceCents: 1450 },
  journal: { id: 'p-016', slug: 'field-notes-journal', name: 'Field Notes Journal', category: 'books', priceCents: 1200 },
  headphones: { id: 'p-008', slug: 'noise-cancelling-headphones', name: 'Noise-Cancelling Headphones', category: 'electronics', priceCents: 24900 },
} as const;

export const PROMO_CODES = {
  percentOff: 'SAVE10',
  freeShipping: 'FREESHIP',
  expired: 'SPRING2025',
} as const;

/** Stripe-style test card numbers understood by the demo payment step. */
export const CARDS = {
  valid: '4242 4242 4242 4242',
  declined: '4000 0000 0000 0002',
  insufficientFunds: '4000 0000 0000 9995',
  failsLuhn: '4242 4242 4242 4241',
} as const;

const pad = (n: number) => String(n).padStart(2, '0');

/** An expiry date two years from now, as MM/YY. */
export function futureExpiry(now = new Date()): string {
  return `${pad(now.getMonth() + 1)}/${pad((now.getFullYear() + 2) % 100)}`;
}

/** An expiry date in the previous year, as MM/YY. */
export function pastExpiry(now = new Date()): string {
  return `12/${pad((now.getFullYear() - 1) % 100)}`;
}

/** Collision-free email so parallel workers never fight over accounts. */
export function uniqueEmail(prefix = 'user'): string {
  return `${prefix}.${randomUUID().slice(0, 12)}@example.test`;
}

export function buildUser(overrides: Partial<NewUser> = {}): NewUser {
  return { name: 'Taylor Tester', email: uniqueEmail('shopper'), password: 'Secure#Pass1', ...overrides };
}

export function buildCheckoutDetails(overrides: Partial<CheckoutDetails> = {}): CheckoutDetails {
  return {
    email: uniqueEmail('buyer'),
    fullName: 'Alex Tester',
    address: '221B Baker Street',
    city: 'London',
    postalCode: 'NW1 6XE',
    country: 'GB',
    shippingMethod: 'standard',
    nameOnCard: 'Alex Tester',
    cardNumber: CARDS.valid,
    expiry: futureExpiry(),
    cvc: '123',
    acceptTerms: true,
    ...overrides,
  };
}
