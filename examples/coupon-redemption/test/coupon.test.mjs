// Runnable with zero install:  node --test
// (uses only the Node.js built-in test runner + assert)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redeemCoupon } from '../src/coupon.mjs';

const T0 = 1_700_000_000_000;        // a fixed "now" so tests are deterministic
const DAY = 86_400_000;
const future = T0 + 30 * DAY;

const percentOff = (over = {}) => ({ code: 'SAVE20', kind: 'percent', value: 20, expiresAt: future, ...over });
const fixedOff = (over = {}) => ({ code: 'MINUS500', kind: 'fixed', value: 500, expiresAt: future, ...over });

test('percent coupon takes the rounded percentage off', () => {
  const r = redeemCoupon(1000, percentOff(), T0);
  assert.equal(r.ok, true);
  assert.equal(r.discount, 200);
  assert.equal(r.total, 800);
});

test('percent rounding is to the nearest cent', () => {
  // 33% of 999 = 329.67 → 330
  const r = redeemCoupon(999, percentOff({ value: 33 }), T0);
  assert.equal(r.discount, 330);
  assert.equal(r.total, 669);
});

test('fixed coupon subtracts a flat amount', () => {
  const r = redeemCoupon(2000, fixedOff(), T0);
  assert.equal(r.discount, 500);
  assert.equal(r.total, 1500);
});

test('a fixed discount never drives the total below zero', () => {
  const r = redeemCoupon(300, fixedOff({ value: 500 }), T0);
  assert.equal(r.ok, true);
  assert.equal(r.discount, 300);   // clamped to the subtotal
  assert.equal(r.total, 0);
});

test('a 100% coupon zeroes the total exactly', () => {
  const r = redeemCoupon(4999, percentOff({ value: 100 }), T0);
  assert.equal(r.total, 0);
  assert.equal(r.discount, 4999);
});

test('an expired coupon is rejected', () => {
  const r = redeemCoupon(1000, percentOff({ expiresAt: T0 - 1 }), T0);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'coupon expired');
  assert.equal(r.total, 1000);     // subtotal untouched on rejection
});

test('expiry is inclusive — exactly at expiresAt still redeems', () => {
  const r = redeemCoupon(1000, percentOff({ expiresAt: T0 }), T0);
  assert.equal(r.ok, true);
});

test('a subtotal below the minimum is rejected', () => {
  const r = redeemCoupon(900, percentOff({ minSubtotal: 1000 }), T0);
  assert.equal(r.ok, false);
  assert.match(r.reason, /below minimum/);
});

test('malformed coupon codes are rejected', () => {
  for (const code of ['', 'ab', 'lowercase', 'WAY-TOO-LONG-CODE-123', 'spaces here']) {
    const r = redeemCoupon(1000, percentOff({ code }), T0);
    assert.equal(r.ok, false, `expected ${JSON.stringify(code)} to be rejected`);
    assert.equal(r.reason, 'invalid coupon code format');
  }
});

test('out-of-range percent values are rejected', () => {
  for (const value of [0, 101, -5, 12.5]) {
    const r = redeemCoupon(1000, percentOff({ value }), T0);
    assert.equal(r.ok, false, `expected percent value ${value} to be rejected`);
  }
});

test('non-integer / negative subtotals are rejected', () => {
  for (const subtotal of [10.5, -100, NaN, '1000']) {
    const r = redeemCoupon(subtotal, percentOff(), T0);
    assert.equal(r.ok, false, `expected subtotal ${String(subtotal)} to be rejected`);
  }
});

test('an unknown coupon kind is rejected, not silently ignored', () => {
  const r = redeemCoupon(1000, { code: 'WEIRD1', kind: 'bogus', value: 5, expiresAt: future }, T0);
  assert.equal(r.ok, false);
  assert.match(r.reason, /unknown coupon kind/);
});
