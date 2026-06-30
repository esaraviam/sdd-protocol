# Data Model — coupon-redemption

This example is **stateless compute** — there is no datastore. The contract
exists so the task graph's `read_architecture_section` pointer resolves to a
real file + heading (Stage 0 of the gate validates that pointer), and to
document the in-memory shape a persistence layer would later mirror.

### Coupon entity
A coupon is value data, not a row that this feature owns:

```
Coupon {
  code:        string   // PK if persisted; ^[A-Z0-9]{4,12}$
  kind:        'percent' | 'fixed'
  value:       integer  // percent 1..100, or fixed cents > 0
  expiresAt:   integer  // epoch ms, inclusive
  minSubtotal: integer  // cents, default 0
}
```

A real persistence layer would add: a unique index on `code`, a redemption
ledger (code × order) to enforce single-use, and a `currency` column. None of
that is in scope for this illustrative feature — the redemption logic is pure
and takes the coupon as an argument.
