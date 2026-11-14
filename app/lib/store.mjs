// In-memory state for the demo shop. Restarting the server resets everything.
// Each browser context or API request context gets its own session cookie, so
// parallel tests never share a cart unless they deliberately share a session.

import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { PRODUCTS, categoryName } from '../data/catalog.mjs';
import { FREE_SHIPPING_THRESHOLD_CENTS, priceCart, PROMO_CODES } from './pricing.mjs';

export const MAX_QUANTITY_PER_LINE = 10;

/** @typedef {{ lineId: string, productId: string, size: string | null, color: string | null, quantity: number }} CartLine */
/** @typedef {{ id: string, userId: string | null, cart: { lines: CartLine[], promoCode: string | null } }} Session */

/** @type {Map<string, Session>} */
const sessions = new Map();
/** @type {Map<string, { id: string, name: string, email: string, salt: string, hash: string, createdAt: string }>} */
const usersByEmail = new Map();
/** @type {Map<string, any>} */
const orders = new Map();

// ── Products ──────────────────────────────────────────────

export function publicProduct(p) {
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    categoryName: categoryName(p.category),
    priceCents: p.priceCents,
    rating: p.rating,
    reviewCount: p.reviewCount,
    stock: p.stock,
    inStock: p.stock > 0,
    sizes: [...p.sizes],
    colors: [...p.colors],
    createdAt: p.createdAt,
    description: p.description,
  };
}

export function findProduct(idOrSlug) {
  return PRODUCTS.find((p) => p.id === idOrSlug || p.slug === idOrSlug) ?? null;
}

export function maxQuantityFor(product) {
  return Math.min(MAX_QUANTITY_PER_LINE, product.stock);
}

// ── Sessions ──────────────────────────────────────────────

const newSessionId = () => randomBytes(32).toString('base64url');

export function getSession(id) {
  return (id && sessions.get(id)) || null;
}

export function createSession() {
  /** @type {Session} */
  const session = { id: newSessionId(), userId: null, cart: { lines: [], promoCode: null } };
  sessions.set(session.id, session);
  return session;
}

/** Issues a new session id (prevents session fixation) while keeping the cart. */
export function rotateSession(session, userId) {
  sessions.delete(session.id);
  const rotated = { ...session, id: newSessionId(), userId };
  sessions.set(rotated.id, rotated);
  return rotated;
}

export function destroySession(session) {
  sessions.delete(session.id);
}

// ── Users ─────────────────────────────────────────────────

const hashPassword = (password, salt) => scryptSync(password, salt, 32).toString('hex');

export function publicUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

export function findUserById(id) {
  for (const user of usersByEmail.values()) if (user.id === id) return user;
  return null;
}

export function createUser({ name, email, password }) {
  const key = email.trim().toLowerCase();
  if (usersByEmail.has(key)) return null;
  const salt = randomBytes(16).toString('hex');
  const user = {
    id: randomUUID(),
    name: name.trim(),
    email: email.trim(),
    salt,
    hash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
  };
  usersByEmail.set(key, user);
  return user;
}

export function verifyCredentials(email, password) {
  const user = usersByEmail.get(String(email).trim().toLowerCase());
  if (!user) {
    // Burn comparable CPU time so response timing does not reveal unknown emails.
    hashPassword(String(password), 'unknown-user-salt');
    return null;
  }
  const expected = Buffer.from(user.hash, 'hex');
  const actual = Buffer.from(hashPassword(String(password), user.salt), 'hex');
  return timingSafeEqual(expected, actual) ? user : null;
}

// ── Cart ──────────────────────────────────────────────────

export function cartView(session, shippingMethod = 'standard') {
  const lines = session?.cart.lines ?? [];
  const promoCode = session?.cart.promoCode ?? null;
  const items = lines.map((line) => {
    const product = findProduct(line.productId);
    return {
      lineId: line.lineId,
      productId: product.id,
      slug: product.slug,
      name: product.name,
      size: line.size,
      color: line.color,
      quantity: line.quantity,
      maxQuantity: maxQuantityFor(product),
      unitPriceCents: product.priceCents,
      lineTotalCents: product.priceCents * line.quantity,
    };
  });
  const promo = promoCode ? PROMO_CODES[promoCode] : null;
  const totals = priceCart(items, { promoCode, shippingMethod });
  const discounted = totals.subtotalCents - totals.discountCents;
  const freeShippingRemainingCents =
    items.length > 0 && totals.shippingCents > 0 && totals.shippingMethod === 'standard'
      ? Math.max(0, FREE_SHIPPING_THRESHOLD_CENTS - discounted)
      : 0;
  return {
    items,
    itemCount: items.reduce((n, i) => n + i.quantity, 0),
    promo: promo ? { code: promo.code, description: promo.description } : null,
    totals,
    freeShippingRemainingCents,
  };
}

/**
 * Adds a validated line to the cart, merging identical variants.
 * @returns {{ ok: true } | { ok: false, status: number, error: string }}
 */
export function addToCart(session, product, { size, color, quantity }) {
  const max = maxQuantityFor(product);
  const existing = session.cart.lines.find(
    (l) => l.productId === product.id && l.size === size && l.color === color,
  );
  const nextQuantity = (existing?.quantity ?? 0) + quantity;
  if (nextQuantity > max) {
    return { ok: false, status: 409, error: `You can add at most ${max} of this item` };
  }
  if (existing) existing.quantity = nextQuantity;
  else session.cart.lines.push({ lineId: randomUUID(), productId: product.id, size, color, quantity });
  return { ok: true };
}

export function findLine(session, lineId) {
  return session?.cart.lines.find((l) => l.lineId === lineId) ?? null;
}

export function removeLine(session, lineId) {
  session.cart.lines = session.cart.lines.filter((l) => l.lineId !== lineId);
  if (session.cart.lines.length === 0) session.cart.promoCode = null;
}

export function clearCart(session) {
  session.cart = { lines: [], promoCode: null };
}

// ── Orders ────────────────────────────────────────────────

const ORDER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function newOrderId() {
  const bytes = randomBytes(8);
  let id = 'ORD-';
  for (const b of bytes) id += ORDER_ALPHABET[b % ORDER_ALPHABET.length];
  return id;
}

export function createOrder(session, details) {
  const view = cartView(session, details.shippingMethod);
  const order = {
    id: newOrderId(),
    createdAt: new Date().toISOString(),
    email: details.email.trim(),
    shippingAddress: {
      fullName: details.fullName.trim(),
      address: details.address.trim(),
      city: details.city.trim(),
      postalCode: details.postalCode.trim(),
      country: details.country,
    },
    shippingMethod: view.totals.shippingMethod,
    items: view.items.map(({ lineId, maxQuantity, ...item }) => item),
    promo: view.promo,
    totals: view.totals,
    payment: { cardLast4: details.cardLast4 },
    // Ownership metadata, never serialised to clients.
    ownerSessionId: session.id,
    userId: session.userId,
  };
  orders.set(order.id, order);
  clearCart(session);
  return order;
}

export function publicOrder(order) {
  const { ownerSessionId, userId, ...rest } = order;
  return rest;
}

export function findOrderFor(session, orderId) {
  const order = orders.get(orderId);
  if (!order || !session) return null;
  const ownsBySession = order.ownerSessionId === session.id;
  const ownsByUser = order.userId !== null && order.userId === session.userId;
  return ownsBySession || ownsByUser ? order : null;
}

export function ordersForUser(userId) {
  // Map preserves insertion order, so reversing gives newest first even when
  // two orders share the same millisecond timestamp.
  return [...orders.values()].filter((o) => o.userId === userId).reverse();
}

// ── Seed data ─────────────────────────────────────────────

export const DEMO_USER = Object.freeze({
  name: 'Demo Shopper',
  email: process.env.DEMO_USER_EMAIL ?? 'shopper@example.test',
  password: process.env.DEMO_USER_PASSWORD ?? 'Shopper#2026',
});

createUser(DEMO_USER);
