// coupon.mjs — discount-coupon redemption for a cart subtotal.
//
// Money is handled in integer cents end-to-end: floats are never used for
// currency, so 0.1 + 0.2 rounding never reaches a total. The single public
// entry point is `redeemCoupon`; everything it needs to decide an outcome is
// passed in (no hidden clock, no I/O) so the logic stays pure and testable.

/**
 * @typedef {Object} Coupon
 * @property {string} code        Uppercase alphanumeric, 4–12 chars.
 * @property {'percent'|'fixed'} kind
 * @property {number} value       percent: 1–100. fixed: discount in cents (>0).
 * @property {number} expiresAt   epoch ms; the coupon is dead once now > expiresAt.
 * @property {number} [minSubtotal=0] minimum cart subtotal in cents to qualify.
 */

/**
 * @typedef {Object} Redemption
 * @property {boolean} ok
 * @property {number}  subtotal  echoed input, cents
 * @property {number}  discount  cents actually taken off (0 when rejected)
 * @property {number}  total     subtotal - discount, never below 0
 * @property {string}  [reason]  present only when ok === false
 */

const CODE_RE = /^[A-Z0-9]{4,12}$/;

/** Reject anything that is not a non-negative, safe integer number of cents. */
function isCents(n) {
  return Number.isInteger(n) && n >= 0;
}

/**
 * Apply a coupon to a cart subtotal.
 *
 * Pure: the caller supplies `now` so the function never reads the wall clock.
 * Never throws on bad data — invalid input yields `{ ok: false, reason }` so a
 * single call site can branch on the result instead of wrapping a try/catch.
 *
 * @param {number} subtotal  cart subtotal in cents
 * @param {Coupon} coupon
 * @param {number} now       current time in epoch ms
 * @returns {Redemption}
 */
export function redeemCoupon(subtotal, coupon, now) {
  const reject = (reason) => ({ ok: false, subtotal, discount: 0, total: subtotal, reason });

  if (!isCents(subtotal)) return reject('subtotal must be a non-negative integer (cents)');
  if (!coupon || typeof coupon !== 'object') return reject('coupon is required');
  if (!CODE_RE.test(coupon.code ?? '')) return reject('invalid coupon code format');
  if (!Number.isInteger(now)) return reject('now must be an epoch-ms integer');

  if (now > coupon.expiresAt) return reject('coupon expired');

  const minSubtotal = coupon.minSubtotal ?? 0;
  if (!isCents(minSubtotal)) return reject('minSubtotal must be a non-negative integer (cents)');
  if (subtotal < minSubtotal) return reject(`subtotal below minimum of ${minSubtotal}`);

  let discount;
  if (coupon.kind === 'percent') {
    if (!Number.isInteger(coupon.value) || coupon.value < 1 || coupon.value > 100) {
      return reject('percent value must be an integer 1–100');
    }
    // Round to the nearest cent; a 33% coupon on 1000c → 330c, on 999c → 330c.
    discount = Math.round((subtotal * coupon.value) / 100);
  } else if (coupon.kind === 'fixed') {
    if (!isCents(coupon.value) || coupon.value < 1) {
      return reject('fixed value must be a positive integer (cents)');
    }
    discount = coupon.value;
  } else {
    return reject(`unknown coupon kind: ${String(coupon.kind)}`);
  }

  // A discount can never exceed the subtotal: the total floors at 0, never negative.
  discount = Math.min(discount, subtotal);
  return { ok: true, subtotal, discount, total: subtotal - discount };
}
