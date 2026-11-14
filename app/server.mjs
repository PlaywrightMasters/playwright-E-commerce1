// Demo Shop: a small, dependency-free e-commerce app used as the system under test.
// Run with `node app/server.mjs` (PORT defaults to 3100, HOST to 127.0.0.1).

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES, PRODUCTS } from './data/catalog.mjs';
import { findPromo, SHIPPING_METHODS } from './lib/pricing.mjs';
import { COUNTRIES, normaliseCardNumber, validateCheckout, validateRegistration } from './lib/validation.mjs';
import * as store from './lib/store.mjs';

const PORT = Number(process.env.PORT ?? 3100);
const HOST = process.env.HOST ?? '127.0.0.1';
const PUBLIC_DIR = resolve(fileURLToPath(new URL('./public', import.meta.url)));
const MAX_BODY_BYTES = 10 * 1024;
const SESSION_COOKIE = 'sid';

// Stripe-style test cards that pass validation but fail authorisation.
const PAYMENT_FAILURES = new Map([
  ['4000000000000002', 'Your card was declined'],
  ['4000000000009995', 'Your card has insufficient funds'],
]);

const SECURITY_HEADERS = {
  'Content-Security-Policy':
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; " +
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'same-origin',
};

const PAGE_ROUTES = [
  /^\/$/,
  /^\/search$/,
  /^\/products\/[a-z0-9-]+$/,
  /^\/cart$/,
  /^\/checkout$/,
  /^\/orders\/[A-Z0-9-]+$/,
  /^\/login$/,
  /^\/register$/,
  /^\/account$/,
];

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
};

class HttpError extends Error {
  constructor(status, message, fields) {
    super(message);
    this.status = status;
    this.fields = fields;
  }
}

// ── Helpers ───────────────────────────────────────────────

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

function sendJson(res, status, payload) {
  send(res, status, payload === undefined ? '' : JSON.stringify(payload), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
}

/** decodeURIComponent that returns null instead of throwing on malformed input. */
function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    // Cookies are not port-scoped, so other apps on this host can send malformed values.
    if (i > 0) out[part.slice(0, i).trim()] = safeDecode(part.slice(i + 1).trim()) ?? '';
  }
  return out;
}

function sessionCookie(id, maxAge) {
  const parts = [`${SESSION_COOKIE}=${id}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAge !== undefined) parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

async function readJson(req) {
  if (!['POST', 'PATCH', 'PUT'].includes(req.method)) return {};
  if (Number(req.headers['content-length'] ?? 0) > MAX_BODY_BYTES) {
    req.resume(); // drain so the client receives the 413 instead of a reset socket
    throw new HttpError(413, 'Request body is too large');
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size <= MAX_BODY_BYTES) chunks.push(chunk);
  }
  if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large');
  if (size === 0) return {};
  const type = req.headers['content-type'] ?? '';
  if (!type.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'Content-Type must be application/json');
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('not an object');
    return body;
  } catch {
    throw new HttpError(400, 'Malformed JSON body');
  }
}

function parseIntParam(params, name, { min, max, fallback }) {
  const raw = params.get(name);
  if (raw === null || raw === '') return fallback;
  if (!/^-?\d+$/.test(raw)) throw new HttpError(400, `${name} must be a whole number`);
  const value = Number(raw);
  if (value < min || value > max) throw new HttpError(400, `${name} must be between ${min} and ${max}`);
  return value;
}

function parsePriceParam(params, name) {
  const raw = params.get(name);
  if (raw === null || raw === '') return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) throw new HttpError(400, `${name} must be a non-negative number`);
  return Math.round(value * 100);
}

const SORTERS = {
  featured: (a, b) => a.id.localeCompare(b.id),
  'price-asc': (a, b) => a.priceCents - b.priceCents || a.id.localeCompare(b.id),
  'price-desc': (a, b) => b.priceCents - a.priceCents || a.id.localeCompare(b.id),
  rating: (a, b) => b.rating - a.rating || a.id.localeCompare(b.id),
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  name: (a, b) => a.name.localeCompare(b.name),
};

// ── API handlers ──────────────────────────────────────────

function listProducts(params) {
  const q = (params.get('q') ?? '').trim();
  if (q.length > 100) throw new HttpError(400, 'Search query must be at most 100 characters');
  const category = params.get('category') || null;
  if (category && !CATEGORIES.some((c) => c.slug === category)) throw new HttpError(400, 'Unknown category');
  const sort = params.get('sort') || 'featured';
  if (!Object.hasOwn(SORTERS, sort)) throw new HttpError(400, 'Unknown sort option');
  const min = parsePriceParam(params, 'minPrice');
  const max = parsePriceParam(params, 'maxPrice');
  if (min !== null && max !== null && min > max) {
    throw new HttpError(400, 'minPrice cannot be greater than maxPrice');
  }
  const page = parseIntParam(params, 'page', { min: 1, max: 10_000, fallback: 1 });
  const limit = parseIntParam(params, 'limit', { min: 1, max: 50, fallback: 12 });

  const needle = q.toLowerCase();
  const matches = PRODUCTS.filter(
    (p) =>
      (!needle || p.name.toLowerCase().includes(needle) || p.description.toLowerCase().includes(needle)) &&
      (!category || p.category === category) &&
      (min === null || p.priceCents >= min) &&
      (max === null || p.priceCents <= max),
  ).sort(SORTERS[sort]);

  const total = matches.length;
  const start = (page - 1) * limit;
  return {
    products: matches.slice(start, start + limit).map(store.publicProduct),
    pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
  };
}

function parseCartItem(body) {
  const product = typeof body.productId === 'string' ? store.findProduct(body.productId) : null;
  if (!product) throw new HttpError(404, 'Product not found');
  const quantity = body.quantity ?? 1;
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > store.MAX_QUANTITY_PER_LINE) {
    throw new HttpError(400, `Quantity must be a whole number between 1 and ${store.MAX_QUANTITY_PER_LINE}`);
  }
  if (product.stock === 0) throw new HttpError(409, 'This product is out of stock');

  let size = null;
  if (product.sizes.length > 0) {
    if (body.size === undefined || body.size === null || body.size === '') {
      throw new HttpError(400, 'Select a size', { size: 'Select a size' });
    }
    if (!product.sizes.includes(body.size)) throw new HttpError(400, 'Invalid size', { size: 'Invalid size' });
    size = body.size;
  }
  let color = null;
  if (product.colors.length > 0) {
    color = body.color ?? product.colors[0];
    if (!product.colors.includes(color)) throw new HttpError(400, 'Invalid colour', { color: 'Invalid colour' });
  }
  return { product, size, color, quantity };
}

async function handleApi(req, res, url, ctx) {
  const { pathname, searchParams } = url;
  const method = req.method;
  const route = `${method} ${pathname}`;
  let m;

  if (route === 'GET /api/health') return sendJson(res, 200, { status: 'ok' });

  if (route === 'GET /api/products') return sendJson(res, 200, listProducts(searchParams));

  if (method === 'GET' && (m = /^\/api\/products\/([^/]+)$/.exec(pathname))) {
    const product = store.findProduct(safeDecode(m[1]));
    if (!product) throw new HttpError(404, 'Product not found');
    return sendJson(res, 200, { product: store.publicProduct(product) });
  }

  if (route === 'GET /api/categories') {
    return sendJson(res, 200, {
      categories: CATEGORIES.map((c) => ({
        ...c,
        productCount: PRODUCTS.filter((p) => p.category === c.slug).length,
      })),
    });
  }

  if (route === 'GET /api/meta') {
    return sendJson(res, 200, {
      countries: COUNTRIES,
      shippingMethods: Object.values(SHIPPING_METHODS),
    });
  }

  // ── Cart
  if (route === 'GET /api/cart') {
    const shipping = searchParams.get('shipping') ?? 'standard';
    if (!Object.hasOwn(SHIPPING_METHODS, shipping)) throw new HttpError(400, 'Unknown shipping method');
    return sendJson(res, 200, store.cartView(ctx.session, shipping));
  }

  if (route === 'POST /api/cart/items') {
    const body = await readJson(req);
    const item = parseCartItem(body);
    const session = ctx.ensureSession();
    const result = store.addToCart(session, item.product, item);
    if (!result.ok) throw new HttpError(result.status, result.error);
    return sendJson(res, 201, store.cartView(session));
  }

  if ((m = /^\/api\/cart\/items\/([^/]+)$/.exec(pathname))) {
    const line = store.findLine(ctx.session, m[1]);
    if (!line) throw new HttpError(404, 'Cart item not found');
    if (method === 'PATCH') {
      const { quantity } = await readJson(req);
      const max = store.maxQuantityFor(store.findProduct(line.productId));
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new HttpError(400, 'Quantity must be a whole number of at least 1');
      }
      if (quantity > max) throw new HttpError(409, `You can add at most ${max} of this item`);
      line.quantity = quantity;
      return sendJson(res, 200, store.cartView(ctx.session));
    }
    if (method === 'DELETE') {
      store.removeLine(ctx.session, line.lineId);
      return sendJson(res, 200, store.cartView(ctx.session));
    }
  }

  if (route === 'DELETE /api/cart') {
    if (ctx.session) store.clearCart(ctx.session);
    return sendJson(res, 200, store.cartView(ctx.session));
  }

  if (route === 'POST /api/cart/promo') {
    const { code } = await readJson(req);
    if (!ctx.session || ctx.session.cart.lines.length === 0) {
      throw new HttpError(400, 'Add items to your cart before applying a promo code');
    }
    const found = findPromo(code);
    if ('error' in found) throw new HttpError(400, found.error);
    ctx.session.cart.promoCode = found.promo.code;
    return sendJson(res, 200, store.cartView(ctx.session));
  }

  if (route === 'DELETE /api/cart/promo') {
    if (ctx.session) ctx.session.cart.promoCode = null;
    return sendJson(res, 200, store.cartView(ctx.session));
  }

  // ── Auth
  if (route === 'POST /api/auth/register') {
    const body = await readJson(req);
    const fields = validateRegistration(body);
    if (Object.keys(fields).length > 0) throw new HttpError(400, 'Please correct the highlighted fields', fields);
    const user = store.createUser(body);
    if (!user) {
      throw new HttpError(409, 'An account with this email already exists', {
        email: 'An account with this email already exists',
      });
    }
    ctx.signIn(user);
    return sendJson(res, 201, { user: store.publicUser(user) });
  }

  if (route === 'POST /api/auth/login') {
    const { email, password } = await readJson(req);
    const fields = {};
    if (typeof email !== 'string' || !email.trim()) fields.email = 'Email is required';
    if (typeof password !== 'string' || !password) fields.password = 'Password is required';
    if (Object.keys(fields).length > 0) throw new HttpError(400, 'Email and password are required', fields);
    const user = store.verifyCredentials(email, password);
    if (!user) throw new HttpError(401, 'Invalid email or password');
    ctx.signIn(user);
    return sendJson(res, 200, { user: store.publicUser(user) });
  }

  if (route === 'POST /api/auth/logout') {
    ctx.signOut();
    return sendJson(res, 204);
  }

  if (route === 'GET /api/auth/me') {
    // Guests get 200 + null so every page load does not log a 401 in the console.
    return sendJson(res, 200, { user: store.publicUser(ctx.user) });
  }

  // ── Orders
  if (route === 'POST /api/orders') {
    const body = await readJson(req);
    if (!ctx.session || ctx.session.cart.lines.length === 0) throw new HttpError(400, 'Your cart is empty');
    const fields = validateCheckout(body);
    if (Object.keys(fields).length > 0) throw new HttpError(422, 'Please correct the highlighted fields', fields);
    const card = normaliseCardNumber(body.cardNumber);
    const failure = PAYMENT_FAILURES.get(card);
    if (failure) throw new HttpError(402, failure);
    const order = store.createOrder(ctx.session, { ...body, cardLast4: card.slice(-4) });
    return sendJson(res, 201, { order: store.publicOrder(order) });
  }

  if (route === 'GET /api/orders') {
    if (!ctx.user) throw new HttpError(401, 'Sign in to view your orders');
    return sendJson(res, 200, { orders: store.ordersForUser(ctx.user.id).map(store.publicOrder) });
  }

  if (method === 'GET' && (m = /^\/api\/orders\/([^/]+)$/.exec(pathname))) {
    const order = store.findOrderFor(ctx.session, safeDecode(m[1]));
    if (!order) throw new HttpError(404, 'Order not found');
    return sendJson(res, 200, { order: store.publicOrder(order) });
  }

  throw new HttpError(404, 'Not found');
}

// ── Static files and pages ────────────────────────────────

async function serveFile(res, filePath, status = 200) {
  const body = await readFile(filePath);
  send(res, status, body, {
    'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
}

async function handleStatic(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');

  if (url.pathname.startsWith('/assets/')) {
    const relative = safeDecode(url.pathname.slice('/assets/'.length));
    if (relative === null) return send(res, 400, 'Bad request');
    const filePath = resolve(join(PUBLIC_DIR, relative));
    // Refuse anything that escapes the public directory (e.g. "..%2fserver.mjs").
    if (!filePath.startsWith(PUBLIC_DIR + sep) || !MIME[extname(filePath)]) {
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    try {
      return await serveFile(res, filePath);
    } catch {
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
  }

  const known = PAGE_ROUTES.some((r) => r.test(url.pathname));
  return serveFile(res, join(PUBLIC_DIR, 'index.html'), known ? 200 : 404);
}

// ── Server ────────────────────────────────────────────────

function createContext(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  let session = store.getSession(cookies[SESSION_COOKIE]);
  const setCookie = (value) => res.setHeader('Set-Cookie', value);
  const ctx = {
    get session() {
      return session;
    },
    get user() {
      return session?.userId ? store.findUserById(session.userId) : null;
    },
    ensureSession() {
      if (!session) {
        session = store.createSession();
        setCookie(sessionCookie(session.id));
      }
      return session;
    },
    signIn(user) {
      session = store.rotateSession(ctx.ensureSession(), user.id);
      setCookie(sessionCookie(session.id));
    },
    signOut() {
      if (session) store.destroySession(session);
      session = null;
      setCookie(sessionCookie('', 0));
    },
  };
  return ctx;
}

export function createApp() {
  return createServer(async (req, res) => {
    let url;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      return send(res, 400, 'Bad request');
    }
    try {
      if (url.pathname.startsWith('/api/')) {
        return await handleApi(req, res, url, createContext(req, res));
      }
      return await handleStatic(req, res, url);
    } catch (error) {
      if (error instanceof HttpError) {
        return sendJson(res, error.status, { error: error.message, ...(error.fields && { fields: error.fields }) });
      }
      console.error(error);
      return sendJson(res, 500, { error: 'Internal server error' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, HOST, () => {
    console.log(`Demo Shop listening on http://${HOST}:${PORT}`);
  });
}
