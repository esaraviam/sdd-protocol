# API Contract — coupon-redemption

This feature ships a single pure function (no network surface). The "API" is
its call signature and result shape.

## redeemCoupon(subtotal, coupon, now)

| Param      | Type     | Notes                                            |
|------------|----------|--------------------------------------------------|
| `subtotal` | number   | Cart subtotal in **integer cents**, ≥ 0.         |
| `coupon`   | Coupon   | See shape below.                                 |
| `now`      | number   | Current time, epoch **ms** (integer).            |

### Coupon
| Field         | Type                  | Rule                                   |
|---------------|-----------------------|----------------------------------------|
| `code`        | string                | `^[A-Z0-9]{4,12}$`                      |
| `kind`        | `'percent' \| 'fixed'`| anything else → rejected               |
| `value`       | number                | percent: int 1–100 · fixed: int cents >0|
| `expiresAt`   | number                | epoch ms; valid **up to and including**|
| `minSubtotal` | number (optional)     | int cents ≥ 0, default 0               |

### Redemption (return)
| Field      | Type    | Notes                                       |
|------------|---------|---------------------------------------------|
| `ok`       | boolean | false on any rejection                      |
| `subtotal` | number  | echoed input                                |
| `discount` | number  | cents removed; 0 when rejected              |
| `total`    | number  | `subtotal - discount`, **never < 0**        |
| `reason`   | string  | present only when `ok === false`            |

## Heading anchor for the task graph
### Redemption rules
- percent → `round(subtotal * value / 100)`; fixed → `min(value, subtotal)`.
- total clamps at 0; expiry inclusive; bad input returns `ok:false`, no throw.
