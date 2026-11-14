import { expect, test } from '@playwright/test';
import {
  expiryProblem,
  isValidEmail,
  luhnValid,
  passwordProblem,
  validateCheckout,
  validateRegistration,
} from '../../app/lib/validation.mjs';

// A fixed clock keeps the expiry tests deterministic: 14 November 2026.
const NOW = new Date(2026, 10, 14);

test.describe('luhnValid', () => {
  for (const number of ['4242424242424242', '4000000000000002', '5555555555554444']) {
    test(`accepts ${number}`, () => expect(luhnValid(number)).toBe(true));
  }
  for (const number of ['4242424242424241', '1234567812345678', '42424242a4242424', '']) {
    test(`rejects "${number}"`, () => expect(luhnValid(number)).toBe(false));
  }
});

test.describe('expiryProblem', () => {
  test('accepts the current month', () => expect(expiryProblem('11/26', NOW)).toBeNull());

  test('accepts a future date with spaces around the slash', () => expect(expiryProblem('01 / 27', NOW)).toBeNull());

  test('rejects the previous month', () => expect(expiryProblem('10/26', NOW)).toBe('Your card has expired'));

  test('rejects month 13', () => expect(expiryProblem('13/30', NOW)).toBe('Enter a valid expiry month'));

  test('rejects month 00', () => expect(expiryProblem('00/30', NOW)).toBe('Enter a valid expiry month'));

  test('rejects a missing slash', () => expect(expiryProblem('1130', NOW)).toBe('Enter the expiry date as MM/YY'));
});

test.describe('isValidEmail', () => {
  for (const email of ['a@b.co', 'first.last+tag@example.test']) {
    test(`accepts ${email}`, () => expect(isValidEmail(email)).toBe(true));
  }
  for (const email of ['', 'plain', 'a@b', 'a b@c.de', `${'a'.repeat(250)}@b.co`]) {
    test(`rejects "${email.slice(0, 20)}"`, () => expect(isValidEmail(email)).toBe(false));
  }
});

test.describe('passwordProblem', () => {
  test('accepts a strong password', () => expect(passwordProblem('Secure#Pass1')).toBeNull());

  test('requires a value', () => expect(passwordProblem('')).toBe('Password is required'));

  test('requires 8 characters', () => expect(passwordProblem('Ab1')).toBe('Password must be at least 8 characters'));

  test('caps the length', () => expect(passwordProblem(`Aa1${'x'.repeat(130)}`)).toBe('Password must be at most 128 characters'));

  test('requires mixed case and a digit', () => {
    expect(passwordProblem('alllowercase1')).toBe('Password must include upper and lower case letters and a number');
    expect(passwordProblem('NoDigitsHere')).toBe('Password must include upper and lower case letters and a number');
  });
});

test.describe('validateRegistration', () => {
  test('passes a valid user', () => {
    expect(validateRegistration({ name: 'Ana', email: 'ana@example.test', password: 'Secure#Pass1' })).toEqual({});
  });

  test('reports every problem at once', () => {
    expect(validateRegistration({})).toEqual({
      name: 'Name is required',
      email: 'Email is required',
      password: 'Password is required',
    });
  });
});

test.describe('validateCheckout', () => {
  const valid = {
    email: 'buyer@example.test',
    fullName: 'Alex Tester',
    address: '1 Main St',
    city: 'Springfield',
    postalCode: '12345',
    country: 'US',
    shippingMethod: 'standard',
    nameOnCard: 'Alex Tester',
    cardNumber: '4242 4242 4242 4242',
    expiry: '12/30',
    cvc: '123',
    acceptTerms: true,
  };

  test('passes a complete, valid submission', () => {
    expect(validateCheckout(valid, NOW)).toEqual({});
  });

  test('accepts card numbers with dashes', () => {
    expect(validateCheckout({ ...valid, cardNumber: '4242-4242-4242-4242' }, NOW)).toEqual({});
  });

  test('requires the terms to be accepted with a real boolean', () => {
    expect(validateCheckout({ ...valid, acceptTerms: 'true' }, NOW)).toEqual({
      acceptTerms: 'You must accept the terms and conditions',
    });
  });

  test('rejects unsupported countries and shipping methods', () => {
    expect(validateCheckout({ ...valid, country: 'XX', shippingMethod: 'drone' }, NOW)).toEqual({
      country: 'Select a country',
      shippingMethod: 'Select a shipping method',
    });
  });
});
