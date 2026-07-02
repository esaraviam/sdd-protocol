# Proposal: Deterministic Enforcement — schemas, bundled scripts, and hooks

**Status:** DRAFT — pending approval. Nothing in this document is implemented.
**Scope:** backlog items 3, 4 and 5 of the 2026-07-02 adversarial audit.
**Why a proposal:** these changes alter the protocol's execution contract — workers go from *instructed* to *hook-blocked*, and Stage 0 goes from prose-driven greps to scripts with authoritative exit codes. That affects every plugin user and carries open design decisions, so it should be reviewed before implementation (the `openspec` CLI was not available on the authoring machine; this document is the formalization vehicle).

---

## Motivation

The audit's structural finding: the protocol has the *architecture* of falsifiability (markers, artifacts, floors, cross-checks) but **zero deterministic mechanism** — every verification is one LLM checking another LLM by instruction. The doc-backed fix is twofold:

1. **Scripts over prose** (skills best practices: *"Prefer scripts for deterministic operations"*): most Stage 0 checks are greps/jq that today are *requested* of the model. A bundled script makes the exit code the truth.
2. **Hooks for what instructions can't guarantee** (hooks docs: *"use hooks to enforce behavior deterministically"*): the few invariants where the failure mode is the model *not running* the check at all.

Guiding constraint (opinion, not doc-backed — doc default timeouts are 600s): hot-path `PreToolUse` handlers stay under ~100ms, all handlers fail **open** on missing inputs, and every hook lives in **component frontmatter** (scoped to the pipeline's lifetime — zero cost in unrelated sessions), never in a plugin-global `hooks/hooks.json`.

---

## Part 1 — Task schema (backlog item 3)

**New file `schemas/task.schema.json`** (JSON Schema draft-07): required fields `id`, `spec`, `title`, `skill` (enum of the 10 bundled skills), `model_hint` (enum `opus|sonnet|haiku`), `status` (enum `pending|in_progress|completed|INVALID`), `depends_on` (array of task ids), `read_architecture_section`, `file_scope` (non-empty array), `acceptance_criteria` (non-empty array); `test_command` required when `skill ∈ {backend-coder, senior-frontend-engineer}`.

**New script `scripts/validate-tasks.sh`**: jq-based; validates every `.sdd/tasks/*.json` against the schema **plus graph rules** a schema can't express — every `depends_on` id exists, no dependency cycles, no `INVALID` tasks, every hub in `.sdd/hubs.json` consistent with its strategy (A: contract task exists and all consumers depend on it; B: shared-hub tasks are dependency-chained). Exit 0 = valid; exit 1 = defect list on stdout.

**Wire-up:** `/sdd-plan` Phase 2 runs it before offering the graph `[APPROVAL]`; `/sdd-execute` step 1 runs it before building waves.

## Part 2 — Stage 0 as a bundled script (backlog item 4)

**New script `scripts/gate-stage0.sh`**: implements the gate's programmatic floors exactly as `sdd-quality-gate.md` describes them in prose — completeness (all tasks `completed`, no orphan locks), test floor (`result.test_exit == 0` on every code task), binding floor (every `binding:true` index entry for the domain anchored to a task's `acceptance_criteria`), artifact floor (`result.artifact.schema` matches the skill's declared schema), memory-recall validation (`.sdd/memory-recall.json` markers id-matched against `.sdd/memory-index.jsonl`), and pointer validation (`read_architecture_section` file+heading exists). Output: a machine-readable PASS/FAIL block per floor; exit 0 only if all pass.

**Wire-up:** the gate's Stage 0 instruction becomes "run `${CLAUDE_PLUGIN_ROOT}/scripts/gate-stage0.sh` and act on its exit code" instead of six manual grep instructions. The adjudicated stages (1–4) remain LLM work — they are judgment, not mechanics.

## Part 3 — Hooks (backlog item 5)

All in component frontmatter, all `type: command`, all fail-open:

| Hook | Event | Home | Guarantees |
|---|---|---|---|
| H1 `deny-git-mutation.sh` | `PreToolUse` (matcher `Bash`, `if: Bash(git *)`) | `sdd-quality-gate.md` | The gate physically cannot commit/tag/push/merge — exit 2 blocks the call |
| H2 `require-skill-proof.sh` | `SubagentStop` | `sdd-execute.md` | A worker cannot terminate without emitting `[SKILL-CONFIRMATION]` + `[ARTIFACT]` (exit 2 + reason sends it back). Open decision: worker detection is heuristic (grep transcript for `.sdd/tasks/`) — fail-open for non-SDD subagents |
| H3 `protect-memory-index.sh` | `PreToolUse` (matcher `Edit\|Write`) | `system-memory/SKILL.md` | `.sdd/memory-index.jsonl` is append-only: Edit/Write on it are blocked; only Bash `>>` appends pass |
| H4 `validate-plan-output.sh` | `Stop` | `sdd-plan.md` | The planning turn cannot end with a graph that `validate-tasks.sh` rejects or with a missing/invalid `.sdd/memory-recall.json` — the same defects the gate would catch later, caught at the cheap moment |

**Explicitly NOT hooks** (re-affirmed from the audit): acceptance-criteria adjudication, semantic `contract_ref` resolution, aesthetic judgment, model routing (that's `model:` frontmatter), human approvals (`AskUserQuestion`), and any session-global Stop hook ("done" is not deterministically detectable and would fire on every turn).

## Rollout & risks

- Ship as **minor** version: additive files + instruction edits; no schema change to existing `.sdd/` state. Older graphs without `hubs.json` already have a documented fallback.
- Risk: H2 false-positives on non-SDD subagents → mitigated by fail-open transcript heuristic; revisit if Claude Code adds agent-identity fields to the `SubagentStop` payload.
- Risk: jq/bash availability — both are required by the pipeline already; scripts must degrade with a clear message, never a silent pass.

## Acceptance criteria for the implementation PR

1. `validate-tasks.sh` rejects a fixture graph with (a) a dangling `depends_on`, (b) a cycle, (c) a code task without `test_command`; accepts the `examples/coupon-redemption` graph.
2. `gate-stage0.sh` reproduces NO-GO on a fixture missing `result.test_exit` and GO-pass on the example pipeline.
3. H1 blocks `git commit` inside a gate run (manual test) and does not fire outside it.
4. H3 blocks an Edit on `.sdd/memory-index.jsonl` while `echo '{...}' >> .sdd/memory-index.jsonl` passes.
5. All hook scripts run < 100ms on the example repo (time-boxed in the PR description).
