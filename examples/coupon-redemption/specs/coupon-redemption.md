# Spec: Coupon Redemption

## 1. Objective & Value Proposition
Let a shopper apply a single discount coupon to their cart subtotal and get a
correct, non-negative total. The value is correctness under edge cases that
break naive implementations: floating-point money, discounts larger than the
cart, expired or malformed codes. A wrong total here is a direct revenue or
trust loss, so the rules must be explicit and provable.

## 2. User Personas & Actors
- **Shopper** — enters a coupon code at checkout and expects a predictable price.
- **Checkout service** — calls the redemption logic and renders the result.
- **Marketing** — issues coupons (percent-off or fixed-amount) with an expiry
  and an optional minimum-spend threshold.

## 3. Functional Requirements & User Stories
- As a shopper, when I apply a valid percent coupon, the discount is that
  percentage of the subtotal, rounded to the nearest cent.
- As a shopper, when I apply a valid fixed coupon, that flat amount comes off,
  but never more than my subtotal (the total floors at zero).
- As a shopper, when my coupon is expired, malformed, or my cart is below the
  coupon's minimum, the coupon is rejected and my subtotal is left untouched —
  with a human-readable reason.
- As the checkout service, I get a single structured result (`ok`, `total`,
  `discount`, `reason`) and never have to catch an exception for bad input.

## 4. Business Logic & Constraints
- **Money is integer cents** everywhere; floats are never used for currency.
- Coupon `code` must match `^[A-Z0-9]{4,12}$`.
- Expiry is **inclusive**: a coupon is valid up to and including `expiresAt`.
- `percent.value` is an integer 1–100; discount = `round(subtotal * value / 100)`.
- `fixed.value` is a positive integer (cents); discount = `min(value, subtotal)`.
- `total = subtotal - discount`, clamped so it is **never negative**.
- The redemption function is **pure**: the caller passes `now`; no wall clock,
  no I/O. Invalid input returns `{ ok: false, reason }` rather than throwing.

## 5. Explicit Acceptance Criteria
- [x] Percent and fixed coupons compute the correct discounted total.
- [x] A discount larger than the subtotal clamps the total to 0 (never negative).
- [x] Expired coupons are rejected; expiry is inclusive at `expiresAt`.
- [x] Malformed codes and out-of-range percent values are rejected.
- [x] Subtotals below `minSubtotal` are rejected.
- [x] Non-integer / negative subtotals are rejected without throwing.
- [x] An unknown coupon kind is rejected, not silently treated as no discount.
