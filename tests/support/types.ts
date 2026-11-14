// Response shapes of the demo shop API, used to type `await response.json()`.

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  priceCents: number;
  rating: number;
  reviewCount: number;
  stock: number;
  inStock: boolean;
  sizes: string[];
  colors: string[];
  createdAt: string;
  description: string;
}

export interface ProductList {
  products: Product[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface Category {
  slug: string;
  name: string;
  productCount: number;
}

export interface Totals {
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  shippingMethod: 'standard' | 'express';
}

export interface CartItem {
  lineId: string;
  productId: string;
  slug: string;
  name: string;
  size: string | null;
  color: string | null;
  quantity: number;
  maxQuantity: number;
  unitPriceCents: number;
  lineTotalCents: number;
}

export interface Cart {
  items: CartItem[];
  itemCount: number;
  promo: { code: string; description: string } | null;
  totals: Totals;
  freeShippingRemainingCents: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface NewUser {
  name: string;
  email: string;
  password: string;
}

export interface CheckoutDetails {
  email: string;
  fullName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  shippingMethod: string;
  nameOnCard: string;
  cardNumber: string;
  expiry: string;
  cvc: string;
  acceptTerms: boolean;
}

export interface Order {
  id: string;
  createdAt: string;
  email: string;
  shippingAddress: { fullName: string; address: string; city: string; postalCode: string; country: string };
  shippingMethod: 'standard' | 'express';
  items: Omit<CartItem, 'lineId' | 'maxQuantity'>[];
  promo: { code: string; description: string } | null;
  totals: Totals;
  payment: { cardLast4: string };
}

export interface ApiError {
  error: string;
  fields?: Record<string, string>;
}
