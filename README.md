# SDD — Spec-Driven Development for Claude Code

> *Engineering software at the speed of thought, with the precision of logic.*

**SDD is an agent orchestration protocol** packaged as a Claude Code plugin. Instead of asking an AI to "build a feature" in one shot, SDD runs a strict, auditable pipeline that turns an idea into shipped software:

```
/create-spec  →  /sdd-plan  →  /sdd-execute
   spec        architecture · backlog      parallel execution · GO/NO-GO gate
                  [Opus]                       [Sonnet]
```

It treats specifications as **executable governance**: every task is bounded by a surgical file scope, routed to the right-sized model, run by an isolated agent, and verified objectively before it counts as done.

---

## Why SDD

| | Generic AI dev | **SDD** |
|---|---|---|
| Context | Whole project (drift, hallucination) | **Surgical scope** per task (`read_architecture_section` + `file_scope`) |
| Architecture | Implicit / accidental | **Contract-first** (`documentation/api·db·ui` + `conventions.md`) |
| Model usage | One model for everything | **Model discipline**: Opus for design, Sonnet for code, Haiku for docs — see note below |
| Parallelism | Risky / serial | **Collision-safe waves** — tasks with disjoint `file_scope` run in parallel |
| "Done" | The agent says so | **Verify, don't trust** — diff-in-scope + green tests (deterministic) · diff-anchored skill proof + criteria (adjudicated) |
| Release | Manual review | **Mandatory GO/NO-GO quality gate** |

---

## Install

```text
/plugin marketplace add esaraviam/sdd-protocol
/plugin install sdd
```

That's it — the 4 commands and 10 expert skills load automatically and are available in **any** project. Run the commands from your **project root** (not from this repo).

> **Optional — semantic memory.** SDD works fully standalone. If you also install [engram](https://github.com/Gentleman-Programming/engram) (`/plugin install engram`) and allow `Bash(engram:*)`, the pipeline gains cross-spec semantic recall that travels with your repo. Without it, SDD falls back to git-tracked memory files and never fails.

> **⚠️ Remove personal copies of these skills.** The plugin's skills are namespaced `sdd:<name>` and the pipeline invokes them that way. If you keep copies with the same short names under `~/.claude/skills/` (e.g. from a pre-plugin install), a bare-name invocation can silently resolve to your **stale local copy** — whose proof markers and artifact schemas may no longer match what the quality gate validates. Delete or archive those copies after installing the plugin.

---

## Quickstart

```text
# 1. Capture the requirement (interview, one question at a time)
/create-spec checkout-flow.md

# 2. Plan — architecture + backlog, pinned to Opus (approves inline; no manual /model)
/sdd-plan checkout-flow.md
#    Phase 1  architecture contracts        → documentation/api·db·ui + conventions.md   [approve]
#    Phase 2  atomic task graph             → .sdd/tasks/task_NN.json                    [approve]

# 3. Execute — parallel fan-out + quality gate, pinned to Sonnet (workers route per model_hint)
/sdd-execute checkout-flow.md
#    Phase 3  parallel agent fan-out        → implemented code (verified, in-scope)
#    Phase 4  quality gate (auto)           → GO / NO-GO

# Interrupted? /sdd-execute also resumes from the task graph:
/sdd-execute

# Run the gate standalone anytime:
/sdd-quality-gate checkout-flow.md
```

The feature is only "done" when the gate returns **GO**. On **NO-GO** it names the exact task/skill to route back to.

---

## See a full run

A complete, **runnable** reference pipeline lives in [`examples/coupon-redemption/`](examples/coupon-redemption/) — a small backend feature carried through all four phases, with the real artifacts each phase emits (spec → contracts → task graph → skill markers → GO report).

```bash
cd examples/coupon-redemption
node --test          # → 12/12 pass, zero install (Node ≥ 18)
```

Every `[SKILL-CONFIRMATION]` marker in that run names a file that actually appears in the diff — the same anchor the reconciliation enforces, so you can grep the markers against the files and confirm nothing is invented. See [`examples/README.md`](examples/README.md) for what's real vs. illustrative.

---

## What's inside

**Commands (4)**

| Command | Role |
|---|---|
| `/create-spec` | Business-analyst interview → `specs/<feature>.md` |
| `/sdd-plan` | Planning half (Phases 0–2) **pinned to Opus** via frontmatter: architecture → backlog. Emits `.sdd/tasks/` and hands off to `/sdd-execute` |
| `/sdd-execute` | Execution half (Phase 3 + gate) **pinned to Sonnet**; workers route per their `model_hint`. Also resumes an interrupted pipeline from `.sdd/tasks/` |
| `/sdd-quality-gate` | Closing GO/NO-GO gate — **re-runs the tests itself and cross-checks each gate skill's proof against the diff** (verify, don't trust); completeness → QA → audit → release plan → memory |

**Skills (10)** — the expertise the orchestrator invokes by name:

- **Design & security:** `software-architect`, `ai-security-expert`, `ux-design-expert`
- **Implementation:** `backend-coder`, `senior-frontend-engineer`
- **Quality & release:** `qa-engineer`, `webapp-testing`, `refactor-auditor`, `release-manager`
- **Memory:** `system-memory`

---

## How it works (the three pillars)

1. **Surgical context over massive context.** Each task reads only its `read_architecture_section` and writes only inside its `file_scope`. No drift.
2. **Token governance.** Intelligence is proportional to task complexity — Opus for strategy/security/the gate, Sonnet for logic, Haiku for utility. ⚠️ *A slash command can't change your session's model mid-run, so this is a **recommendation you apply** with `/model` for main-thread phases. A genuine automatic per-task override only happens in the **Phase 3 sub-agent fan-out** (Task tool `model` param). Tip: run the session on Opus and let Phase 3 drop to Sonnet/Haiku.*
3. **Verification over trust.** A task is `completed` only when its changes pass reconciliation. Two of those checks are **deterministic** (machine-objective): `git diff` stays inside the task's `file_scope`, and any declared test/lint command exits zero. Two are **adjudicated** (the orchestrator LLM judges them, anchored to the diff): the `[SKILL-CONFIRMATION]` marker must name files that actually appear in the diff (a free-form marker an agent could fabricate won't survive that cross-check), and the `acceptance_criteria` must be satisfied by the diff rather than merely asserted. The deterministic pair is the floor that can't be talked past; the adjudicated pair adds judgment on top. See [`docs/SDD-FLOW.md`](docs/SDD-FLOW.md) for the exact reconciliation order.

Read the full operating manual in [`docs/SDD-FLOW.md`](docs/SDD-FLOW.md) and the philosophy in [`docs/SDD_MANIFESTO.md`](docs/SDD_MANIFESTO.md).

---

## Artifacts SDD produces in your project

```text
your-project/
├── specs/<feature>.md                              # /create-spec
├── documentation/
│   ├── api|db|ui/<feature>.md                       # Phase 1 contracts
│   ├── conventions.md                               # cross-cutting rules (cached, read by every task)
│   └── SYSTEM_MAP.md                                # living architecture index
├── .sdd/
│   ├── tasks/task_NN.json                           # the dependency graph
│   ├── quality-gate-report.md                       # GO/NO-GO verdict
│   └── retrospectives.json                          # lessons fed back into future runs
└── src/ ...                                          # the implemented feature
```

---

## The golden rule

> **Never implement what has not been designed; never design what has not been specified; never release what has not been verified.**

---

## License

MIT (see [`LICENSE`](LICENSE)) — except three bundled skills (`backend-coder`,
`senior-frontend-engineer`, `webapp-testing`) which are redistributed under the
**Apache License 2.0**, with their original license files preserved in-tree.
See [`NOTICE`](NOTICE) for details.
