import { CATALOG_SIZE, PAGE_SIZE, PRODUCTS } from '../../utils/test-data';
import { expect, test } from '../fixtures/api';
import type { ApiError, Category, Product, ProductList } from '../support/types';

test.describe('Products API', () => {
  test('health check reports ok', async ({ api }) => {
    const response = await api.health();
    expect(response.status()).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('lists the first page with pagination metadata', async ({ api }) => {
    const response = await api.listProducts();
    expect(response.status()).toBe(200);
    const body = (await response.json()) as ProductList;
    expect(body.pagination).toEqual({ page: 1, limit: PAGE_SIZE, total: CATALOG_SIZE, totalPages: 2 });
    expect(body.products).toHaveLength(PAGE_SIZE);
  });

  test('returns products in the documented shape', async ({ api }) => {
    const { products } = (await (await api.listProducts({ limit: 50 })).json()) as ProductList;
    for (const product of products) {
      expect(product).toEqual({
        id: expect.stringMatching(/^p-\d{3}$/),
        slug: expect.stringMatching(/^[a-z0-9-]+$/),
        name: expect.any(String),
        category: expect.any(String),
        categoryName: expect.any(String),
        priceCents: expect.any(Number),
        rating: expect.any(Number),
        reviewCount: expect.any(Number),
        stock: expect.any(Number),
        inStock: product.stock > 0,
        sizes: expect.any(Array),
        colors: expect.any(Array),
        createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        description: expect.any(String),
      });
      expect(Number.isInteger(product.priceCents), `${product.id} price is whole cents`).toBe(true);
    }
  });

  test('serves the remaining products on the last page without overlap', async ({ api }) => {
    const first = (await (await api.listProducts({ page: 1 })).json()) as ProductList;
    const last = (await (await api.listProducts({ page: 2 })).json()) as ProductList;
    expect(last.products).toHaveLength(CATALOG_SIZE - PAGE_SIZE);
    const ids = [...first.products, ...last.products].map((p) => p.id);
    expect(new Set(ids).size).toBe(CATALOG_SIZE);
  });

  test('returns an empty page beyond the last page', async ({ api }) => {
    const response = await api.listProducts({ page: 5 });
    expect(response.status()).toBe(200);
    const body = (await response.json()) as ProductList;
    expect(body.products).toEqual([]);
    expect(body.pagination.total).toBe(CATALOG_SIZE);
  });

  test('filters by category', async ({ api }) => {
    const { categories } = (await (await api.listCategories()).json()) as { categories: Category[] };
    const electronics = categories.find((c) => c.slug === 'electronics');
    const { products, pagination } = (await (await api.listProducts({ category: 'electronics' })).json()) as ProductList;
    expect(pagination.total).toBe(electronics?.productCount);
    expect(products.map((p) => p.category)).toEqual(Array(products.length).fill('electronics'));
  });

  test('filters by an inclusive price range in dollars', async ({ api }) => {
    const { products } = (await (await api.listProducts({ minPrice: 24.99, maxPrice: 45.99, limit: 50 })).json()) as ProductList;
    expect(products.length).toBeGreaterThan(0);
    for (const p of products) {
      expect(p.priceCents).toBeGreaterThanOrEqual(2499);
      expect(p.priceCents).toBeLessThanOrEqual(4599);
    }
    // Both boundaries are inclusive.
    expect(products.map((p) => p.slug)).toEqual(expect.arrayContaining([PRODUCTS.tee.slug, 'led-desk-lamp']));
  });

  const sortCases: { sort: string; isOrdered: (a: Product, b: Product) => boolean }[] = [
    { sort: 'price-asc', isOrdered: (a, b) => a.priceCents <= b.priceCents },
    { sort: 'price-desc', isOrdered: (a, b) => a.priceCents >= b.priceCents },
    { sort: 'rating', isOrdered: (a, b) => a.rating >= b.rating },
    { sort: 'newest', isOrdered: (a, b) => a.createdAt >= b.createdAt },
    { sort: 'name', isOrdered: (a, b) => a.name.localeCompare(b.name) <= 0 },
  ];

  for (const { sort, isOrdered } of sortCases) {
    test(`sorts the whole catalogue by ${sort}`, async ({ api }) => {
      const { products } = (await (await api.listProducts({ sort, limit: 50 })).json()) as ProductList;
      expect(products).toHaveLength(CATALOG_SIZE);
      const outOfOrder = products.slice(1).filter((p, i) => !isOrdered(products[i], p));
      expect(outOfOrder.map((p) => p.name)).toEqual([]);
    });
  }

  test('searches names and descriptions case-insensitively', async ({ api }) => {
    const { products } = (await (await api.listProducts({ q: 'COTTON' })).json()) as ProductList;
    expect(products.map((p) => p.slug)).toContain(PRODUCTS.tee.slug);
    for (const p of products) {
      expect(`${p.name} ${p.description}`.toLowerCase()).toContain('cotton');
    }
  });

  test('returns no products for an unmatched search', async ({ api }) => {
    const body = (await (await api.listProducts({ q: 'xyz-not-a-product' })).json()) as ProductList;
    expect(body.products).toEqual([]);
    expect(body.pagination).toMatchObject({ total: 0, totalPages: 1 });
  });

  test('gets the same product by id and by slug', async ({ api }) => {
    const byId = await api.getProduct(PRODUCTS.tee.id);
    const bySlug = await api.getProduct(PRODUCTS.tee.slug);
    expect(byId.status()).toBe(200);
    expect(bySlug.status()).toBe(200);
    const { product } = (await byId.json()) as { product: Product };
    expect(product).toMatchObject({ name: PRODUCTS.tee.name, priceCents: PRODUCTS.tee.priceCents, sizes: PRODUCTS.tee.sizes });
    expect(await bySlug.json()).toEqual({ product });
  });

  test('returns 404 for an unknown product', async ({ api }) => {
    const response = await api.getProduct('p-999');
    expect(response.status()).toBe(404);
    expect(await response.json()).toEqual({ error: 'Product not found' });
  });

  test('lists categories whose counts cover the catalogue', async ({ api }) => {
    const { categories } = (await (await api.listCategories()).json()) as { categories: Category[] };
    expect(categories.map((c) => c.slug)).toEqual(['clothing', 'electronics', 'home', 'sports', 'books']);
    expect(categories.reduce((sum, c) => sum + c.productCount, 0)).toBe(CATALOG_SIZE);
  });

  const invalidQueries: { name: string; query: Record<string, string | number>; error: string }[] = [
    { name: 'page zero', query: { page: 0 }, error: 'page must be between 1 and 10000' },
    { name: 'non-numeric page', query: { page: 'abc' }, error: 'page must be a whole number' },
    { name: 'limit above 50', query: { limit: 51 }, error: 'limit must be between 1 and 50' },
    { name: 'unknown sort', query: { sort: 'cheapest' }, error: 'Unknown sort option' },
    { name: 'unknown category', query: { category: 'toys' }, error: 'Unknown category' },
    { name: 'negative price', query: { minPrice: -1 }, error: 'minPrice must be a non-negative number' },
    { name: 'inverted price range', query: { minPrice: 50, maxPrice: 10 }, error: 'minPrice cannot be greater than maxPrice' },
    { name: 'over-long search', query: { q: 'x'.repeat(101) }, error: 'Search query must be at most 100 characters' },
  ];

  for (const { name, query, error } of invalidQueries) {
    test(`rejects ${name} with 400`, async ({ api }) => {
      const response = await api.listProducts(query);
      expect(response.status()).toBe(400);
      expect((await response.json()) as ApiError).toEqual({ error });
    });
  }
});
