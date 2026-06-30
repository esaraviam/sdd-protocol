# SDD examples

A worked, end-to-end reference of what the SDD pipeline produces — so you can
see the artifact shapes (spec → contracts → task graph → skill markers → quality
gate report) before running it on your own project.

## `coupon-redemption/`

A small, dependency-free backend feature: apply a discount coupon to a cart
subtotal and get a correct, non-negative total.

```
coupon-redemption/
├── specs/coupon-redemption.md              # /create-spec output
├── documentation/
│   ├── conventions.md                      # Phase 1: shared worker rules
│   ├── api/api_coupon-redemption.md        # Phase 1: call signature + rules
│   └── db/db_coupon-redemption.md          # Phase 1: data shape (stateless)
├── .sdd/
│   ├── tasks/task_01.json, task_02.json    # Phase 2: the task graph
│   ├── run-log.md                          # Phase 3: fan-out + reconciliation
│   └── quality-gate-report.md              # Phase 4: GO verdict
├── src/coupon.mjs                          # the delivered implementation
└── test/coupon.test.mjs                    # the delivered test suite
```

### Run it yourself (zero install)

```
cd examples/coupon-redemption
node --test
```

Expected: `tests 12 · pass 12 · fail 0`. (Requires Node ≥ 18 for the built-in
test runner. No `npm install` — the example uses only `node:test` + `node:assert`.)

## What is real vs. illustrative — read this

This project's whole premise is **falsifiable** proof of work, so the example is
honest about its own provenance:

- **Real and verifiable.** `src/coupon.mjs` and `test/coupon.test.mjs` are real
  code; the 12 tests genuinely pass via `node --test`. Every
  `[SKILL-CONFIRMATION]` marker in the task graph and reports names a file that
  **actually appears in this directory's diff** — exactly the anchor check the
  execution coordinator (`commands/sdd-execute.md`, Phase 3 reconciliation) and the quality gate
  enforce. You can re-run the suite and grep the markers against the files to
  confirm nothing is invented.

- **Hand-assembled, not a captured autonomous run.** The SDD slash commands
  (`/create-spec`, `/sdd-plan`, `/sdd-execute`, `/sdd-quality-gate`) are designed to run inside a
  *consuming* project, not inside this plugin repo. So these artifacts were
  produced by executing the pipeline's phases by hand against this toy feature
  and writing the outputs in the exact formats the command files specify — they
  are a faithful reference, not a recording of a single autonomous session.

- **Trade-off chosen for runnability.** A typical pipeline run emits TypeScript
  (the skills are TS-first). This example is plain `.mjs` so it runs with zero
  toolchain. The architecture, layering, and quality standards are identical;
  only the syntax differs.

### Why a coupon feature
It is small but full of the edge cases that separate "works in the demo" from
"correct": floating-point money (avoided with integer cents), discounts larger
than the cart (clamped to zero), inclusive expiry boundaries, and malformed
input that must be rejected without throwing. That makes the test suite — and
therefore the gate's independent re-run — meaningful rather than ceremonial.

It also has **no UI surface**, which is why the gate reports
`UI: SKIPPED (no UI surface)` as a *clean* pass — distinct from a UI feature
whose flows were left unvalidated.
