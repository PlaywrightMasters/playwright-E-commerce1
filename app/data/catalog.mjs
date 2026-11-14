// Deterministic seed catalogue for the demo shop.
// Prices are integer cents to avoid floating-point rounding in totals.
// Stock levels are never decremented by orders, so parallel test workers
// cannot exhaust a product and make each other flaky.

export const CATEGORIES = [
  { slug: 'clothing', name: 'Clothing' },
  { slug: 'electronics', name: 'Electronics' },
  { slug: 'home', name: 'Home' },
  { slug: 'sports', name: 'Sports' },
  { slug: 'books', name: 'Books' },
];

/** @type {ReadonlyArray<{id:string,slug:string,name:string,category:string,priceCents:number,rating:number,reviewCount:number,stock:number,sizes:string[],colors:string[],createdAt:string,description:string}>} */
export const PRODUCTS = Object.freeze([
  {
    id: 'p-001', slug: 'classic-cotton-tee', name: 'Classic Cotton Tee', category: 'clothing',
    priceCents: 2499, rating: 4.5, reviewCount: 212, stock: 50,
    sizes: ['S', 'M', 'L', 'XL'], colors: ['White', 'Black', 'Navy'], createdAt: '2026-03-01',
    description: 'A soft, breathable everyday tee made from 100% organic cotton.',
  },
  {
    id: 'p-002', slug: 'denim-jacket', name: 'Denim Jacket', category: 'clothing',
    priceCents: 8900, rating: 4.2, reviewCount: 87, stock: 12,
    sizes: ['S', 'M', 'L'], colors: ['Blue'], createdAt: '2026-05-14',
    description: 'A sturdy denim jacket with a relaxed fit and brass buttons.',
  },
  {
    id: 'p-003', slug: 'wool-beanie', name: 'Wool Beanie', category: 'clothing',
    priceCents: 1800, rating: 4.7, reviewCount: 143, stock: 30,
    sizes: [], colors: ['Grey', 'Red'], createdAt: '2026-01-20',
    description: 'A warm ribbed beanie knitted from merino wool.',
  },
  {
    id: 'p-004', slug: 'rain-shell-jacket', name: 'Rain Shell Jacket', category: 'clothing',
    priceCents: 12900, rating: 4.0, reviewCount: 39, stock: 0,
    sizes: ['M', 'L'], colors: ['Olive'], createdAt: '2026-08-02',
    description: 'A lightweight waterproof shell that packs into its own pocket.',
  },
  {
    id: 'p-005', slug: 'wireless-earbuds', name: 'Wireless Earbuds', category: 'electronics',
    priceCents: 7999, rating: 4.3, reviewCount: 520, stock: 25,
    sizes: [], colors: ['Black', 'White'], createdAt: '2026-06-10',
    description: 'True wireless earbuds with a pocketable charging case.',
  },
  {
    id: 'p-006', slug: 'mechanical-keyboard', name: 'Mechanical Keyboard', category: 'electronics',
    priceCents: 11950, rating: 4.8, reviewCount: 305, stock: 8,
    sizes: [], colors: [], createdAt: '2026-04-22',
    description: 'A compact mechanical keyboard with hot-swappable switches.',
  },
  {
    id: 'p-007', slug: 'usb-c-charger', name: 'USB-C Charger 65W', category: 'electronics',
    priceCents: 3499, rating: 4.4, reviewCount: 98, stock: 40,
    sizes: [], colors: [], createdAt: '2026-02-11',
    description: 'A fast GaN charger that powers a laptop and a phone at once.',
  },
  {
    id: 'p-008', slug: 'noise-cancelling-headphones', name: 'Noise-Cancelling Headphones', category: 'electronics',
    priceCents: 24900, rating: 4.6, reviewCount: 410, stock: 5,
    sizes: [], colors: ['Black', 'Silver'], createdAt: '2026-09-01',
    description: 'Over-ear headphones with adaptive noise cancelling and 30-hour battery life.',
  },
  {
    id: 'p-009', slug: 'ceramic-coffee-mug', name: 'Ceramic Coffee Mug', category: 'home',
    priceCents: 1450, rating: 4.1, reviewCount: 76, stock: 100,
    sizes: [], colors: ['White', 'Sage'], createdAt: '2026-01-05',
    description: 'A 350 ml stoneware mug that is dishwasher and microwave safe.',
  },
  {
    id: 'p-010', slug: 'linen-throw-pillow', name: 'Linen Throw Pillow', category: 'home',
    priceCents: 3200, rating: 3.9, reviewCount: 22, stock: 20,
    sizes: [], colors: ['Natural', 'Rust'], createdAt: '2026-07-19',
    description: 'A washed-linen cushion cover with a feather insert.',
  },
  {
    id: 'p-011', slug: 'led-desk-lamp', name: 'LED Desk Lamp', category: 'home',
    priceCents: 4599, rating: 4.5, reviewCount: 64, stock: 15,
    sizes: [], colors: [], createdAt: '2026-03-28',
    description: 'A dimmable desk lamp with adjustable colour temperature.',
  },
  {
    id: 'p-012', slug: 'yoga-mat', name: 'Yoga Mat', category: 'sports',
    priceCents: 3999, rating: 4.6, reviewCount: 188, stock: 22,
    sizes: [], colors: ['Purple', 'Teal'], createdAt: '2026-02-27',
    description: 'A 6 mm non-slip mat with alignment markings.',
  },
  {
    id: 'p-013', slug: 'trail-running-shoes', name: 'Trail Running Shoes', category: 'sports',
    priceCents: 13500, rating: 4.4, reviewCount: 133, stock: 10,
    sizes: ['8', '9', '10', '11'], colors: ['Grey'], createdAt: '2026-10-03',
    description: 'Grippy trail shoes with a rock plate and a cushioned midsole.',
  },
  {
    id: 'p-014', slug: 'insulated-water-bottle', name: 'Insulated Water Bottle', category: 'sports',
    priceCents: 2750, rating: 4.8, reviewCount: 640, stock: 60,
    sizes: [], colors: ['Steel', 'Forest'], createdAt: '2026-05-30',
    description: 'A vacuum-insulated bottle that keeps drinks cold for 24 hours.',
  },
  {
    id: 'p-015', slug: 'the-testing-handbook', name: 'The Testing Handbook', category: 'books',
    priceCents: 3900, rating: 4.9, reviewCount: 57, stock: 18,
    sizes: [], colors: [], createdAt: '2026-06-21',
    description: 'A practical guide to designing reliable automated test suites.',
  },
  {
    id: 'p-016', slug: 'field-notes-journal', name: 'Field Notes Journal', category: 'books',
    priceCents: 1200, rating: 4.2, reviewCount: 45, stock: 70,
    sizes: [], colors: [], createdAt: '2026-04-09',
    description: 'A dot-grid pocket journal with 96 acid-free pages.',
  },
]);

export function categoryName(slug) {
  return CATEGORIES.find((c) => c.slug === slug)?.name ?? slug;
}
