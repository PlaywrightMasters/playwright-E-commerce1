// Demo Shop client. Plain ES module, no build step.
// All user-controlled text is inserted with textContent (via h()), never innerHTML.

const main = /** @type {HTMLElement} */ (document.getElementById('main'));
const state = { user: null };

// ── Utilities ─────────────────────────────────────────────

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const money = (cents) => currency.format(cents / 100);

function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on') && typeof value === 'function') el.addEventListener(key.slice(2), value);
    else if (value === true) el.setAttribute(key, '');
    else el.setAttribute(key, String(value));
  }
  for (const child of children.flat(2)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** The request never got a response: offline, server down, or aborted by navigating away. */
class NetworkError extends Error {}

// Navigating away aborts in-flight requests (Firefox reports this as a NetworkError).
// That is expected, so it must not surface as an uncaught error.
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason instanceof NetworkError) event.preventDefault();
});

async function api(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    throw new NetworkError(`Request to ${path} failed`, { cause });
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  return { ok: response.ok, status: response.status, data };
}

function setTitle(title) {
  document.title = `${title} | Demo Shop`;
}

function setCartCount(count) {
  const link = document.querySelector('[data-nav="cart"]');
  const badge = document.querySelector('[data-testid="cart-count"]');
  badge.textContent = String(count);
  link.setAttribute('aria-label', `Cart, ${count} ${count === 1 ? 'item' : 'items'}`);
}

function updateNav() {
  document.querySelector('[data-nav="login"]').hidden = Boolean(state.user);
  document.querySelector('[data-nav="account"]').hidden = !state.user;
}

/** Returns a same-origin relative path from ?next=, or null. Prevents open redirects. */
function safeNext() {
  const next = new URLSearchParams(location.search).get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.includes('\\')) return null;
  try {
    const url = new URL(next, location.origin);
    return url.origin === location.origin ? url.pathname + url.search : null;
  } catch {
    return null;
  }
}

function variantLabel(item) {
  const parts = [item.size && `Size ${item.size}`, item.color].filter(Boolean);
  return parts.length ? `${item.name} (${parts.join(', ')})` : item.name;
}

function thumb(product, large = false) {
  const initials = product.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('');
  return h('div', { class: large ? 'thumb large' : 'thumb', 'data-category': product.category, 'aria-hidden': 'true' }, initials);
}

// ── Form helpers ──────────────────────────────────────────

function errorSlot(name) {
  return h('p', { class: 'field-error', id: `${name}-error`, 'data-for': name, hidden: true });
}

function field(name, label, { hint, ...attrs } = {}) {
  return h(
    'div',
    { class: 'field' },
    h('label', { for: name }, label),
    hint ? h('p', { class: 'hint', id: `${name}-hint` }, hint) : null,
    h('input', { id: name, name, type: 'text', 'aria-describedby': hint ? `${name}-hint` : undefined, ...attrs }),
    errorSlot(name),
  );
}

function setDescribedBy(control, id, add) {
  const ids = new Set((control.getAttribute('aria-describedby') ?? '').split(' ').filter(Boolean));
  if (add) ids.add(id);
  else ids.delete(id);
  if (ids.size) control.setAttribute('aria-describedby', [...ids].join(' '));
  else control.removeAttribute('aria-describedby');
}

/** Renders server field errors next to their controls. Returns the first invalid control. */
function applyFieldErrors(form, fields = {}) {
  let first = null;
  for (const slot of form.querySelectorAll('.field-error[data-for]')) {
    const name = slot.dataset.for;
    const message = fields[name];
    slot.textContent = message ?? '';
    slot.hidden = !message;
    for (const control of form.querySelectorAll(`[name="${name}"]`)) {
      if (message) control.setAttribute('aria-invalid', 'true');
      else control.removeAttribute('aria-invalid');
      setDescribedBy(control, slot.id, Boolean(message));
      if (message && !first) first = control;
    }
  }
  return first;
}

function formAlert() {
  return h('div', { class: 'alert', role: 'alert', tabindex: '-1', 'data-testid': 'form-error' });
}

function renderNotFound(title = 'Page not found', message = 'The page you are looking for does not exist.') {
  setTitle(title);
  main.replaceChildren(h('h1', {}, title), h('p', {}, message), h('a', { class: 'button', href: '/' }, 'Back to the shop'));
}

// ── Catalogue (home and search) ───────────────────────────

const SORT_OPTIONS = [
  ['featured', 'Featured'],
  ['price-asc', 'Price: Low to High'],
  ['price-desc', 'Price: High to Low'],
  ['rating', 'Top rated'],
  ['newest', 'Newest'],
  ['name', 'Name: A to Z'],
];

function productCard(p, headingTag = 'h2') {
  return h(
    'li',
    {},
    h(
      'article',
      { class: 'product-card', 'data-testid': 'product-card', 'aria-labelledby': `card-${p.id}` },
      thumb(p),
      h(headingTag, { id: `card-${p.id}` }, h('a', { href: `/products/${p.slug}` }, p.name)),
      h('p', { class: 'price', 'data-testid': 'product-price' }, money(p.priceCents)),
      h('p', { class: 'meta' }, `${p.categoryName} · Rated ${p.rating} out of 5`),
      p.inStock ? null : h('p', { class: 'stock-out' }, 'Out of stock'),
    ),
  );
}

function filtersForm(params, categories, mode) {
  const select = (name, label, options, current) =>
    h(
      'div',
      { class: 'field' },
      h('label', { for: `filter-${name}` }, label),
      h(
        'select',
        { id: `filter-${name}`, name, onchange: (e) => e.target.form.requestSubmit() },
        options.map(([value, text]) => h('option', { value, selected: value === current }, text)),
      ),
    );
  const price = (name, label) =>
    h(
      'div',
      { class: 'field' },
      h('label', { for: `filter-${name}` }, label),
      h('input', { id: `filter-${name}`, name, type: 'number', min: '0', step: '0.01', inputmode: 'decimal', value: params.get(name) ?? undefined }),
    );

  const form = h(
    'form',
    { class: 'filters', action: location.pathname, method: 'get', 'aria-label': 'Filter products' },
    mode === 'search' ? h('input', { type: 'hidden', name: 'q', value: params.get('q') ?? '' }) : null,
    select('category', 'Category', [['', 'All categories'], ...categories.map((c) => [c.slug, c.name])], params.get('category') ?? ''),
    select('sort', 'Sort by', SORT_OPTIONS, params.get('sort') ?? 'featured'),
    price('minPrice', 'Min price ($)'),
    price('maxPrice', 'Max price ($)'),
    h('button', { type: 'submit', class: 'secondary' }, 'Apply filters'),
  );
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const query = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      const v = String(value).trim();
      if (v && !(key === 'sort' && v === 'featured')) query.set(key, v);
    }
    const qs = query.toString();
    location.assign(qs ? `${location.pathname}?${qs}` : location.pathname);
  });
  return form;
}

async function renderCatalog(mode) {
  const params = new URLSearchParams(location.search);
  const q = (params.get('q') ?? '').trim();
  const query = new URLSearchParams();
  for (const key of ['q', 'category', 'sort', 'minPrice', 'maxPrice', 'page']) {
    const value = params.get(key);
    if (value) query.set(key, value);
  }
  const [list, cats] = await Promise.all([api(`/api/products?${query}`), api('/api/categories')]);
  const categories = cats.data?.categories ?? [];
  const category = categories.find((c) => c.slug === params.get('category'));

  let title = category ? category.name : 'All products';
  if (mode === 'search') title = q ? `Search results for “${q}”` : 'Search';
  setTitle(title);

  const hasFilters = ['category', 'sort', 'minPrice', 'maxPrice'].some((k) => params.get(k));
  const content = [h('h1', {}, title)];

  if (mode === 'home' && !hasFilters && !params.get('page')) {
    content.push(
      h(
        'section',
        { class: 'hero', 'aria-labelledby': 'hero-heading' },
        h('h2', { id: 'hero-heading' }, 'New season essentials'),
        h('p', {}, 'Free standard shipping on orders over $75. Use code SAVE10 for 10% off.'),
      ),
    );
  }

  content.push(filtersForm(params, categories, mode));
  if (hasFilters) {
    const clearHref = mode === 'search' && q ? `/search?q=${encodeURIComponent(q)}` : location.pathname;
    content.push(h('p', {}, h('a', { href: clearHref }, 'Clear filters')));
  }

  if (!list.ok) {
    content.push(h('p', { class: 'alert', role: 'alert' }, list.data?.error ?? 'Could not load products.'));
    main.replaceChildren(...content);
    return;
  }

  const { products, pagination } = list.data;
  content.push(
    h('p', { role: 'status', 'data-testid': 'result-count' }, `${pagination.total} ${pagination.total === 1 ? 'product' : 'products'}`),
  );

  if (products.length === 0) {
    content.push(
      h('p', { 'data-testid': 'no-results' }, 'No products found. Try a different search term or clear the filters.'),
    );
  } else {
    content.push(h('ul', { class: 'product-grid', 'aria-label': 'Products' }, products.map((p) => productCard(p))));
  }

  if (pagination.totalPages > 1) {
    const pageHref = (page) => {
      const next = new URLSearchParams(params);
      next.set('page', String(page));
      return `${location.pathname}?${next}`;
    };
    content.push(
      h(
        'nav',
        { class: 'pagination', 'aria-label': 'Pagination' },
        pagination.page > 1 ? h('a', { href: pageHref(pagination.page - 1) }, 'Previous page') : null,
        h('span', { 'data-testid': 'page-indicator' }, `Page ${pagination.page} of ${pagination.totalPages}`),
        pagination.page < pagination.totalPages ? h('a', { href: pageHref(pagination.page + 1) }, 'Next page') : null,
      ),
    );
  }

  main.replaceChildren(...content);
}

// ── Product detail ────────────────────────────────────────

async function renderProduct(slug) {
  const res = await api(`/api/products/${encodeURIComponent(slug)}`);
  if (res.status === 404) return renderNotFound('Product not found', 'The product you are looking for does not exist.');
  const p = res.data.product;
  setTitle(p.name);

  const status = h('div', { class: 'notice', role: 'status', 'data-testid': 'add-to-cart-status' });
  const error = h('div', { class: 'alert', role: 'alert', 'data-testid': 'add-to-cart-error' });
  const maxQuantity = Math.min(10, p.stock);

  const form = h(
    'form',
    { 'aria-label': 'Add to cart', novalidate: true },
    p.sizes.length
      ? h(
          'fieldset',
          {},
          h('legend', {}, 'Size'),
          h(
            'div',
            { class: 'choices-inline' },
            p.sizes.map((size) =>
              h('label', { class: 'choice' }, h('input', { type: 'radio', name: 'size', value: size, disabled: !p.inStock }), size),
            ),
          ),
        )
      : null,
    p.colors.length
      ? h(
          'div',
          { class: 'field' },
          h('label', { for: 'color' }, 'Color'),
          h('select', { id: 'color', name: 'color', disabled: !p.inStock }, p.colors.map((c) => h('option', { value: c }, c))),
        )
      : null,
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'quantity' }, 'Quantity'),
      h('input', { id: 'quantity', name: 'quantity', type: 'number', class: 'quantity-input', min: '1', max: String(Math.max(1, maxQuantity)), value: '1', inputmode: 'numeric', disabled: !p.inStock }),
    ),
    h('button', { type: 'submit', disabled: !p.inStock }, p.inStock ? 'Add to cart' : 'Out of stock'),
  );

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const rawQty = String(data.get('quantity') ?? '').trim();
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const result = await api('/api/cart/items', {
      method: 'POST',
      body: {
        productId: p.id,
        quantity: /^\d+$/.test(rawQty) ? Number(rawQty) : rawQty,
        size: data.get('size') ?? undefined,
        color: data.get('color') ?? undefined,
      },
    });
    button.disabled = false;
    if (result.ok) {
      error.textContent = '';
      status.replaceChildren(`Added ${p.name} to your cart. `, h('a', { href: '/cart' }, 'View cart'));
      setCartCount(result.data.itemCount);
    } else {
      status.textContent = '';
      error.textContent = result.data?.error ?? 'Could not add this item to your cart.';
    }
  });

  const related = await api(`/api/products?category=${encodeURIComponent(p.category)}&limit=4`);
  const relatedProducts = (related.data?.products ?? []).filter((r) => r.id !== p.id).slice(0, 3);

  main.replaceChildren(
    h(
      'nav',
      { class: 'breadcrumb', 'aria-label': 'Breadcrumb' },
      h(
        'ol',
        {},
        h('li', {}, h('a', { href: '/' }, 'Home')),
        h('li', {}, h('a', { href: `/?category=${encodeURIComponent(p.category)}` }, p.categoryName)),
        h('li', {}, h('span', { 'aria-current': 'page' }, p.name)),
      ),
    ),
    h(
      'div',
      { class: 'product-detail' },
      thumb(p, true),
      h(
        'div',
        {},
        h('h1', {}, p.name),
        h('p', { class: 'price', 'data-testid': 'detail-price' }, money(p.priceCents)),
        h('p', { class: 'meta' }, `Rated ${p.rating} out of 5 from ${p.reviewCount} reviews`),
        h('p', { class: p.inStock ? 'stock-in' : 'stock-out', 'data-testid': 'stock-status' }, p.inStock ? 'In stock' : 'Out of stock'),
        h('p', {}, p.description),
        form,
        status,
        error,
      ),
    ),
    relatedProducts.length
      ? h(
          'section',
          { 'aria-labelledby': 'related-heading' },
          h('h2', { id: 'related-heading' }, 'You may also like'),
          h('ul', { class: 'product-grid', 'aria-label': 'Related products' }, relatedProducts.map((r) => productCard(r, 'h3'))),
        )
      : null,
  );
}

// ── Cart ──────────────────────────────────────────────────

function summaryList(totals, promo) {
  return h(
    'dl',
    {},
    h('dt', {}, 'Subtotal'),
    h('dd', { 'data-testid': 'summary-subtotal' }, money(totals.subtotalCents)),
    totals.discountCents > 0
      ? [h('dt', {}, `Discount (${promo?.code ?? 'promo'})`), h('dd', { 'data-testid': 'summary-discount' }, `-${money(totals.discountCents)}`)]
      : null,
    h('dt', {}, 'Shipping'),
    h('dd', { 'data-testid': 'summary-shipping' }, totals.shippingCents === 0 ? 'Free' : money(totals.shippingCents)),
    h('dt', {}, 'Estimated tax'),
    h('dd', { 'data-testid': 'summary-tax' }, money(totals.taxCents)),
    h('dt', { class: 'total' }, 'Total'),
    h('dd', { class: 'total', 'data-testid': 'summary-total' }, money(totals.totalCents)),
  );
}

async function renderCart() {
  setTitle('Your cart');
  const res = await api('/api/cart');
  paintCart(res.data);
}

function paintCart(cart, { focusId, promoError, cartError } = {}) {
  setCartCount(cart.itemCount);
  const heading = h('h1', { tabindex: '-1' }, 'Your cart');

  if (cart.items.length === 0) {
    main.replaceChildren(
      heading,
      h('p', { 'data-testid': 'empty-cart' }, 'Your cart is empty.'),
      h('a', { class: 'button', href: '/' }, 'Continue shopping'),
    );
    if (focusId) heading.focus();
    return;
  }

  const mutate = async (request, nextFocusId) => {
    const result = await request;
    if (result.ok) paintCart(result.data, { focusId: nextFocusId });
    else {
      const fresh = await api('/api/cart');
      paintCart(fresh.data, { focusId: nextFocusId, cartError: result.data?.error ?? 'Could not update your cart.' });
    }
  };

  const items = cart.items.map((item) => {
    const label = variantLabel(item);
    const options = [item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`].filter(Boolean).join(' · ');
    const setQuantity = (quantity, focus) =>
      mutate(api(`/api/cart/items/${item.lineId}`, { method: 'PATCH', body: { quantity } }), focus);
    return h(
      'li',
      { class: 'cart-item', 'data-testid': 'cart-item' },
      h(
        'div',
        {},
        h('h2', {}, h('a', { href: `/products/${item.slug}` }, item.name)),
        options ? h('p', { class: 'meta', 'data-testid': 'cart-item-options' }, options) : null,
        h('p', { class: 'meta' }, `${money(item.unitPriceCents)} each`),
        h(
          'div',
          { class: 'stepper' },
          h('button', { type: 'button', class: 'secondary', id: `dec-${item.lineId}`, 'aria-label': `Decrease quantity of ${label}`, disabled: item.quantity <= 1, onclick: () => setQuantity(item.quantity - 1, `dec-${item.lineId}`) }, '−'),
          h('output', { 'aria-label': `Quantity of ${label}`, 'data-testid': 'cart-item-quantity' }, String(item.quantity)),
          h('button', { type: 'button', class: 'secondary', id: `inc-${item.lineId}`, 'aria-label': `Increase quantity of ${label}`, disabled: item.quantity >= item.maxQuantity, onclick: () => setQuantity(item.quantity + 1, `inc-${item.lineId}`) }, '+'),
        ),
      ),
      h(
        'div',
        {},
        h('p', { class: 'price', 'data-testid': 'line-total' }, money(item.lineTotalCents)),
        h('button', { type: 'button', class: 'link', 'aria-label': `Remove ${label}`, onclick: () => mutate(api(`/api/cart/items/${item.lineId}`, { method: 'DELETE' }), 'cart-heading') }, 'Remove'),
      ),
    );
  });

  let promoBlock;
  if (cart.promo) {
    promoBlock = h(
      'div',
      { class: 'notice', 'data-testid': 'applied-promo' },
      `Promo ${cart.promo.code} applied: ${cart.promo.description}. `,
      h('button', { type: 'button', class: 'link', onclick: () => mutate(api('/api/cart/promo', { method: 'DELETE' }), 'promo-code') }, 'Remove promo'),
    );
  } else {
    const promoForm = h(
      'form',
      { class: 'promo-form', novalidate: true, 'aria-label': 'Promo code' },
      h(
        'div',
        { class: 'field' },
        h('label', { for: 'promo-code' }, 'Promo code'),
        h('input', { id: 'promo-code', name: 'code', autocomplete: 'off', 'aria-describedby': 'promo-message', 'aria-invalid': promoError ? 'true' : undefined }),
      ),
      h('button', { type: 'submit', class: 'secondary' }, 'Apply'),
    );
    promoForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const code = String(new FormData(promoForm).get('code') ?? '');
      const result = await api('/api/cart/promo', { method: 'POST', body: { code } });
      if (result.ok) paintCart(result.data, { focusId: 'cart-heading' });
      else paintCart(cart, { focusId: 'promo-code', promoError: result.data?.error ?? 'Invalid promo code' });
    });
    promoBlock = h('div', {}, promoForm, h('p', { class: 'field-error', id: 'promo-message', role: 'alert', 'data-testid': 'promo-message' }, promoError ?? ''));
  }

  const discounted = cart.totals.subtotalCents - cart.totals.discountCents;
  const shippingHint =
    cart.freeShippingRemainingCents > 0
      ? `Add ${money(cart.freeShippingRemainingCents)} more for free standard shipping.`
      : cart.totals.shippingCents === 0 && discounted > 0
        ? 'You qualify for free shipping.'
        : null;

  heading.id = 'cart-heading';
  const clearButton = h('button', { type: 'button', class: 'link', onclick: () => mutate(api('/api/cart', { method: 'DELETE' }), 'cart-heading') }, 'Clear cart');

  main.replaceChildren(
    heading,
    h('div', { class: 'alert', role: 'alert', 'data-testid': 'cart-error' }, cartError ?? ''),
    h(
      'div',
      { class: 'two-column' },
      h(
        'div',
        {},
        h('ul', { class: 'cart-list', 'aria-label': 'Cart items' }, items),
        h('div', { class: 'actions' }, h('a', { href: '/' }, 'Continue shopping'), clearButton),
        promoBlock,
      ),
      h(
        'section',
        { class: 'summary', 'aria-labelledby': 'summary-heading' },
        h('h2', { id: 'summary-heading' }, 'Order summary'),
        summaryList(cart.totals, cart.promo),
        shippingHint ? h('p', { class: 'meta', 'data-testid': 'shipping-hint' }, shippingHint) : null,
        h('a', { class: 'button', href: '/checkout' }, 'Proceed to checkout'),
      ),
    ),
  );

  if (focusId) {
    const target = document.getElementById(focusId);
    if (target && !target.disabled) target.focus();
    else heading.focus();
  }
}

// ── Checkout ──────────────────────────────────────────────

async function renderCheckout() {
  setTitle('Checkout');
  const [cartRes, metaRes] = await Promise.all([api('/api/cart'), api('/api/meta')]);
  const cart = cartRes.data;
  const { countries, shippingMethods } = metaRes.data;

  if (cart.items.length === 0) {
    main.replaceChildren(
      h('h1', {}, 'Checkout'),
      h('p', { 'data-testid': 'empty-cart' }, 'Your cart is empty.'),
      h('a', { class: 'button', href: '/' }, 'Continue shopping'),
    );
    return;
  }

  const alert = formAlert();
  const summaryTotals = h('div', {}, summaryList(cart.totals, cart.promo));

  const shippingLabel = (m) =>
    m.id === 'standard' ? `${m.label}: ${money(m.costCents)}, free on orders over $75` : `${m.label}: ${money(m.costCents)}`;

  const form = h(
    'form',
    { id: 'checkout-form', novalidate: true, 'aria-label': 'Checkout' },
    alert,
    h('fieldset', {}, h('legend', {}, 'Contact'), field('email', 'Email', { type: 'email', autocomplete: 'email', value: state.user?.email })),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Shipping address'),
      field('fullName', 'Full name', { autocomplete: 'name' }),
      field('address', 'Address', { autocomplete: 'street-address' }),
      field('city', 'City', { autocomplete: 'address-level2' }),
      field('postalCode', 'Postal code', { autocomplete: 'postal-code' }),
      h(
        'div',
        { class: 'field' },
        h('label', { for: 'country' }, 'Country'),
        h('select', { id: 'country', name: 'country', autocomplete: 'country' }, countries.map((c) => h('option', { value: c.code }, c.name))),
        errorSlot('country'),
      ),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Shipping method'),
      shippingMethods.map((m) =>
        h(
          'div',
          { class: 'choice' },
          h('input', { type: 'radio', id: `shipping-${m.id}`, name: 'shippingMethod', value: m.id, checked: m.id === 'standard' }),
          h('label', { for: `shipping-${m.id}` }, shippingLabel(m)),
        ),
      ),
      errorSlot('shippingMethod'),
    ),
    h(
      'fieldset',
      {},
      h('legend', {}, 'Payment'),
      h('p', { class: 'hint' }, 'Test mode: use card 4242 4242 4242 4242 with any future expiry date.'),
      field('nameOnCard', 'Name on card', { autocomplete: 'cc-name' }),
      field('cardNumber', 'Card number', { autocomplete: 'cc-number', inputmode: 'numeric' }),
      field('expiry', 'Expiry date (MM/YY)', { autocomplete: 'cc-exp', placeholder: 'MM/YY' }),
      field('cvc', 'Security code (CVC)', { autocomplete: 'cc-csc', inputmode: 'numeric' }),
    ),
    h(
      'div',
      { class: 'field' },
      h('div', { class: 'choice' }, h('input', { type: 'checkbox', id: 'acceptTerms', name: 'acceptTerms' }), h('label', { for: 'acceptTerms' }, 'I agree to the terms and conditions')),
      errorSlot('acceptTerms'),
    ),
    h('button', { type: 'submit' }, 'Place order'),
  );

  // Rapid changes can resolve out of order; only the latest quote may update the
  // summary, otherwise it could show a total for a method that is no longer selected.
  let latestQuote = 0;
  for (const radio of form.querySelectorAll('input[name="shippingMethod"]')) {
    radio.addEventListener('change', async () => {
      const quoteId = ++latestQuote;
      const quote = await api(`/api/cart?shipping=${encodeURIComponent(radio.value)}`);
      if (quote.ok && quoteId === latestQuote) {
        summaryTotals.replaceChildren(summaryList(quote.data.totals, quote.data.promo));
      }
    });
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const fields = ['email', 'fullName', 'address', 'city', 'postalCode', 'country', 'shippingMethod', 'nameOnCard', 'cardNumber', 'expiry', 'cvc'];
    const body = Object.fromEntries(fields.map((name) => [name, String(data.get(name) ?? '')]));
    body.acceptTerms = form.querySelector('#acceptTerms').checked;

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    button.textContent = 'Placing order…';
    const result = await api('/api/orders', { method: 'POST', body });
    if (result.status === 201) {
      location.assign(`/orders/${result.data.order.id}`);
      return;
    }
    button.disabled = false;
    button.textContent = 'Place order';
    const firstInvalid = applyFieldErrors(form, result.data?.fields);
    alert.textContent = result.data?.error ?? 'Something went wrong. Please try again.';
    (firstInvalid ?? alert).focus();
  });

  main.replaceChildren(
    h('h1', {}, 'Checkout'),
    h(
      'div',
      { class: 'two-column' },
      form,
      h(
        'section',
        { class: 'summary', 'aria-labelledby': 'summary-heading' },
        h('h2', { id: 'summary-heading' }, 'Order summary'),
        h('ul', { 'aria-label': 'Items in your order' }, cart.items.map((i) => h('li', { 'data-testid': 'summary-item' }, `${variantLabel(i)} × ${i.quantity}: ${money(i.lineTotalCents)}`))),
        summaryTotals,
      ),
    ),
  );
}

// ── Order confirmation ────────────────────────────────────

async function renderOrder(orderId) {
  const res = await api(`/api/orders/${encodeURIComponent(orderId)}`);
  if (!res.ok) return renderNotFound('Order not found', 'We could not find that order.');
  const order = res.data.order;
  const country = order.shippingAddress.country;
  setTitle('Order confirmed');
  main.replaceChildren(
    h('h1', {}, 'Thank you for your order!'),
    h('p', {}, 'Your order number is ', h('strong', { 'data-testid': 'order-number' }, order.id), '.'),
    h('p', {}, `We will send updates to ${order.email}.`),
    h(
      'section',
      { class: 'summary', 'aria-labelledby': 'order-summary-heading' },
      h('h2', { id: 'order-summary-heading' }, 'Order summary'),
      h('ul', {}, order.items.map((i) => h('li', { 'data-testid': 'order-item' }, `${variantLabel(i)} × ${i.quantity}: ${money(i.lineTotalCents)}`))),
      summaryList(order.totals, order.promo),
      h('p', { 'data-testid': 'payment-summary' }, `Paid with card ending in ${order.payment.cardLast4}`),
      h('p', { 'data-testid': 'shipping-summary' }, `Shipping to ${order.shippingAddress.fullName}, ${order.shippingAddress.address}, ${order.shippingAddress.city} ${order.shippingAddress.postalCode}, ${country}`),
    ),
    h('p', {}, h('a', { class: 'button', href: '/' }, 'Continue shopping')),
  );
}

// ── Auth ──────────────────────────────────────────────────

function passwordField(name, label, { autocomplete, hint }) {
  const input = h('input', { id: name, name, type: 'password', autocomplete, 'aria-describedby': hint ? `${name}-hint` : undefined });
  const toggle = h('button', { type: 'button', class: 'secondary', 'aria-pressed': 'false', 'aria-controls': name }, 'Show password');
  toggle.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggle.setAttribute('aria-pressed', String(show));
  });
  return h(
    'div',
    { class: 'field' },
    h('label', { for: name }, label),
    hint ? h('p', { class: 'hint', id: `${name}-hint` }, hint) : null,
    h('div', { class: 'password-row' }, input, toggle),
    errorSlot(name),
  );
}

function nextQuery() {
  const next = safeNext();
  return next ? `?next=${encodeURIComponent(next)}` : '';
}

function renderLogin() {
  if (state.user) {
    location.replace(safeNext() ?? '/account');
    return;
  }
  setTitle('Sign in');
  const alert = formAlert();
  const form = h(
    'form',
    { class: 'auth-card', novalidate: true, 'aria-labelledby': 'login-heading' },
    alert,
    field('email', 'Email', { type: 'email', autocomplete: 'username' }),
    passwordField('password', 'Password', { autocomplete: 'current-password' }),
    h('button', { type: 'submit' }, 'Sign in'),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const result = await api('/api/auth/login', {
      method: 'POST',
      body: { email: String(data.get('email') ?? ''), password: String(data.get('password') ?? '') },
    });
    if (result.ok) {
      location.assign(safeNext() ?? '/account');
      return;
    }
    const firstInvalid = applyFieldErrors(form, result.data?.fields);
    alert.textContent = result.data?.error ?? 'Could not sign in.';
    (firstInvalid ?? alert).focus();
  });
  main.replaceChildren(
    h('h1', { id: 'login-heading' }, 'Sign in'),
    form,
    h('p', {}, 'New to Demo Shop? ', h('a', { href: `/register${nextQuery()}` }, 'Create an account')),
  );
}

function renderRegister() {
  setTitle('Create an account');
  const alert = formAlert();
  const form = h(
    'form',
    { class: 'auth-card', novalidate: true, 'aria-labelledby': 'register-heading' },
    alert,
    field('name', 'Full name', { autocomplete: 'name' }),
    field('email', 'Email', { type: 'email', autocomplete: 'email' }),
    passwordField('password', 'Password', {
      autocomplete: 'new-password',
      hint: 'At least 8 characters, including upper and lower case letters and a number.',
    }),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'confirmPassword' }, 'Confirm password'),
      h('input', { id: 'confirmPassword', name: 'confirmPassword', type: 'password', autocomplete: 'new-password' }),
      errorSlot('confirmPassword'),
    ),
    h('button', { type: 'submit' }, 'Create account'),
  );
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const body = {
      name: String(data.get('name') ?? ''),
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    };
    if (body.password !== String(data.get('confirmPassword') ?? '')) {
      const firstInvalid = applyFieldErrors(form, { confirmPassword: 'Passwords do not match' });
      alert.textContent = 'Please correct the highlighted fields';
      firstInvalid.focus();
      return;
    }
    const result = await api('/api/auth/register', { method: 'POST', body });
    if (result.ok) {
      location.assign(safeNext() ?? '/account');
      return;
    }
    const firstInvalid = applyFieldErrors(form, result.data?.fields);
    alert.textContent = result.data?.error ?? 'Could not create your account.';
    (firstInvalid ?? alert).focus();
  });
  main.replaceChildren(
    h('h1', { id: 'register-heading' }, 'Create an account'),
    form,
    h('p', {}, 'Already have an account? ', h('a', { href: `/login${nextQuery()}` }, 'Sign in')),
  );
}

async function renderAccount() {
  if (!state.user) {
    location.replace(`/login?next=${encodeURIComponent('/account')}`);
    return;
  }
  setTitle('My account');
  const res = await api('/api/orders');
  const orders = res.data?.orders ?? [];
  const signOut = h('button', { type: 'button', class: 'secondary' }, 'Sign out');
  signOut.addEventListener('click', async () => {
    await api('/api/auth/logout', { method: 'POST' });
    location.assign('/');
  });

  main.replaceChildren(
    h('h1', {}, 'My account'),
    h('p', { 'data-testid': 'account-details' }, 'Signed in as ', h('strong', {}, state.user.name), ` (${state.user.email})`),
    h(
      'section',
      { 'aria-labelledby': 'orders-heading' },
      h('h2', { id: 'orders-heading' }, 'Order history'),
      orders.length === 0
        ? h('p', { 'data-testid': 'no-orders' }, 'You have not placed any orders yet.')
        : h(
            'table',
            {},
            h('caption', { class: 'visually-hidden' }, 'Your orders, newest first'),
            h('thead', {}, h('tr', {}, ['Order', 'Date', 'Items', 'Total'].map((t) => h('th', { scope: 'col' }, t)))),
            h(
              'tbody',
              {},
              orders.map((o) =>
                h(
                  'tr',
                  { 'data-testid': 'order-row' },
                  h('td', {}, h('a', { href: `/orders/${o.id}` }, o.id)),
                  h('td', {}, new Date(o.createdAt).toLocaleDateString('en-US', { dateStyle: 'medium' })),
                  h('td', {}, String(o.items.reduce((n, i) => n + i.quantity, 0))),
                  h('td', {}, money(o.totals.totalCents)),
                ),
              ),
            ),
          ),
    ),
    h('p', { class: 'actions' }, signOut),
  );
}

// ── Router ────────────────────────────────────────────────

const ROUTES = [
  [/^\/$/, () => renderCatalog('home')],
  [/^\/search$/, () => renderCatalog('search')],
  [/^\/products\/([a-z0-9-]+)$/, (m) => renderProduct(m[1])],
  [/^\/cart$/, () => renderCart()],
  [/^\/checkout$/, () => renderCheckout()],
  [/^\/orders\/([A-Z0-9-]+)$/, (m) => renderOrder(m[1])],
  [/^\/login$/, () => renderLogin()],
  [/^\/register$/, () => renderRegister()],
  [/^\/account$/, () => renderAccount()],
];

async function start() {
  const search = /** @type {HTMLInputElement} */ (document.getElementById('site-search'));
  if (location.pathname === '/search') search.value = new URLSearchParams(location.search).get('q') ?? '';

  try {
    const [me, cart] = await Promise.all([api('/api/auth/me'), api('/api/cart')]);
    state.user = me.data?.user ?? null;
    updateNav();
    setCartCount(cart.data?.itemCount ?? 0);

    const match = ROUTES.map(([pattern, render]) => [pattern.exec(location.pathname), render]).find(([m]) => m);
    if (match) await match[1](match[0]);
    else renderNotFound();
  } catch (error) {
    const offline = error instanceof NetworkError;
    main.replaceChildren(
      h('h1', {}, offline ? 'Connection problem' : 'Something went wrong'),
      h(
        'p',
        { class: 'alert', role: 'alert' },
        offline ? 'We could not reach the shop. Check your connection and try again.' : 'Please refresh the page and try again.',
      ),
    );
    // Real bugs still surface as uncaught errors so tests and monitoring catch them.
    if (!offline) throw error;
  } finally {
    main.setAttribute('aria-busy', 'false');
  }
}

start();
