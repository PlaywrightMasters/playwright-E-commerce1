// Pure validation helpers shared by the API routes.

import { SHIPPING_METHODS } from './pricing.mjs';

export const COUNTRIES = Object.freeze([
  { code: 'US', name: 'United States' },
  { code: 'CA', name: 'Canada' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IN', name: 'India' },
  { code: 'DE', name: 'Germany' },
]);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const text = (value) => (typeof value === 'string' ? value.trim() : '');

export function isValidEmail(value) {
  const email = text(value);
  return email.length > 0 && email.length <= 254 && EMAIL_PATTERN.test(email);
}

/** @returns {string | null} a problem description, or null when the password is acceptable */
export function passwordProblem(value) {
  if (typeof value !== 'string' || value.length === 0) return 'Password is required';
  if (value.length < 8) return 'Password must be at least 8 characters';
  if (value.length > 128) return 'Password must be at most 128 characters';
  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return 'Password must include upper and lower case letters and a number';
  }
  return null;
}

export function validateRegistration(body) {
  /** @type {Record<string, string>} */
  const errors = {};
  const name = text(body?.name);
  if (!name) errors.name = 'Name is required';
  else if (name.length > 80) errors.name = 'Name must be at most 80 characters';

  if (!text(body?.email)) errors.email = 'Email is required';
  else if (!isValidEmail(body.email)) errors.email = 'Enter a valid email address';

  const pw = passwordProblem(body?.password);
  if (pw) errors.password = pw;
  return errors;
}

/** Luhn checksum for a string of digits. */
export function luhnValid(digits) {
  if (!/^\d+$/.test(digits)) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

export function normaliseCardNumber(value) {
  return typeof value === 'string' ? value.replace(/[\s-]/g, '') : '';
}

/**
 * @param {unknown} value expiry as MM/YY
 * @param {Date} now injectable clock for deterministic tests
 * @returns {string | null}
 */
export function expiryProblem(value, now = new Date()) {
  const match = /^(\d{2})\s*\/\s*(\d{2})$/.exec(text(value));
  if (!match) return 'Enter the expiry date as MM/YY';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'Enter a valid expiry month';
  // A card is valid through the last day of its expiry month.
  const firstDayAfterExpiry = new Date(year, month, 1);
  if (firstDayAfterExpiry <= now) return 'Your card has expired';
  return null;
}

/**
 * Validates the flat checkout payload. Returns a map of field name to message.
 * @param {Record<string, unknown>} body
 * @param {Date} now
 */
export function validateCheckout(body, now = new Date()) {
  /** @type {Record<string, string>} */
  const errors = {};
  const b = body ?? {};

  if (!text(b.email)) errors.email = 'Email is required';
  else if (!isValidEmail(b.email)) errors.email = 'Enter a valid email address';

  if (!text(b.fullName)) errors.fullName = 'Full name is required';
  if (!text(b.address)) errors.address = 'Address is required';
  if (!text(b.city)) errors.city = 'City is required';

  const postal = text(b.postalCode);
  if (!postal) errors.postalCode = 'Postal code is required';
  else if (!/^[A-Za-z0-9 -]{3,10}$/.test(postal)) errors.postalCode = 'Enter a valid postal code';

  if (!COUNTRIES.some((c) => c.code === b.country)) errors.country = 'Select a country';
  if (typeof b.shippingMethod !== 'string' || !Object.hasOwn(SHIPPING_METHODS, b.shippingMethod)) {
    errors.shippingMethod = 'Select a shipping method';
  }

  if (!text(b.nameOnCard)) errors.nameOnCard = 'Name on card is required';

  const card = normaliseCardNumber(b.cardNumber);
  if (!card) errors.cardNumber = 'Card number is required';
  else if (!/^\d{13,19}$/.test(card) || !luhnValid(card)) errors.cardNumber = 'Enter a valid card number';

  if (!text(b.expiry)) errors.expiry = 'Expiry date is required';
  else {
    const expiry = expiryProblem(b.expiry, now);
    if (expiry) errors.expiry = expiry;
  }

  const cvc = text(b.cvc);
  if (!cvc) errors.cvc = 'Security code is required';
  else if (!/^\d{3,4}$/.test(cvc)) errors.cvc = 'Enter a valid security code';

  if (b.acceptTerms !== true) errors.acceptTerms = 'You must accept the terms and conditions';

  return errors;
}
