# Conventions — coupon-redemption

These are the shared rules every Phase 3 worker reads first (prompt-cache
anchor) before touching its task's file scope.

## Language & runtime
- Plain ES modules (`.mjs`) so the example runs with **zero install**:
  `node --test`. (A production pipeline run would typically emit TypeScript;
  this example trades that for being runnable out of the box — see
  `examples/README.md`.)
- No third-party dependencies. Tests use the built-in `node:test` + `node:assert`.

## Money
- All monetary values are **integer cents**. Never use floats for currency.
- Rounding, when unavoidable (percent discounts), is `Math.round` to the
  nearest cent, applied once.

## Function design
- Pure functions: pass time (`now`) and data in; no hidden clock or I/O.
- Invalid input returns a structured `{ ok: false, reason }` result. Public
  functions do **not** throw on bad caller data.

## Testing
- Deterministic: a fixed `T0` timestamp, never `Date.now()`.
- Cover the happy path **and** every rejection branch and boundary
  (clamping, inclusive expiry, rounding edge).
