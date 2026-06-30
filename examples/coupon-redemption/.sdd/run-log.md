# SDD Run Log — coupon-redemption

Captured artifacts from running the SDD phases over `specs/coupon-redemption.md`.
See `examples/README.md` for how this example was produced and what is real
(the code, the tests, the marker→diff anchoring) vs. illustrative.

---

## Phase 1 — Architecture (`software-architect`)
Contracts written:
- `documentation/api/api_coupon-redemption.md` — call signature + Redemption rules
- `documentation/db/db_coupon-redemption.md` — stateless; Coupon value shape
- `documentation/conventions.md` — integer-cents, pure functions, `node --test`

No UI surface → **no `documentation/ui/` contract** (this feature has no
front end; see how the gate treats that, below).

---

## Phase 2 — Backlog (2 tasks)
| id | skill | depends_on | file_scope |
|----|-------|-----------|------------|
| task_01 | backend-coder | — | `src/coupon.mjs` |
| task_02 | backend-coder | task_01 | `test/coupon.test.mjs` |

File scopes are disjoint and task_02 depends on task_01 → **two sequential
waves**, never a collision.

---

## Phase 3 — Fan-out & reconciliation (verify, don't trust)

### Wave 1 — task_01
Agent report:
- `skill_invoked: backend-coder`
- files: `src/coupon.mjs`
- marker: `[SKILL-CONFIRMATION: backend-coder | Implemented Files: src/coupon.mjs | Patterns: pure-function, integer-cents, result-type-over-exceptions]`

Reconciliation:
- **Presence + name match:** marker present, name == task `"skill"` ✓
- **Anchor cross-check:** `src/coupon.mjs` appears in `git diff --name-only` ✓
- **Scope check:** only `src/coupon.mjs` changed, inside `file_scope` ✓
- **Test check:** `node --test` exits 0 ✓
- → **task_01 = completed**

### Wave 2 — task_02
Agent report:
- `skill_invoked: backend-coder`
- files: `test/coupon.test.mjs`
- marker: `[SKILL-CONFIRMATION: backend-coder | Implemented Files: test/coupon.test.mjs | Patterns: deterministic-clock, branch-coverage, node-test-runner]`

Reconciliation:
- **Presence + name match:** ✓
- **Anchor cross-check:** `test/coupon.test.mjs` appears in the diff ✓
- **Scope check:** only `test/coupon.test.mjs` changed ✓
- **Test check:** `node --test` → `tests 12 · pass 12 · fail 0` ✓
- → **task_02 = completed**

> Why this is falsifiable: each marker names a file. If an agent had emitted a
> marker without doing the work, the named file would be **absent from the
> `git diff`** and reconciliation would have rejected it. The proof is anchored
> to reality, not to the agent's word.

---

## Phase 4 — Quality Gate
Auto-invoked → see `.sdd/quality-gate-report.md`. Verdict: **GO**.
