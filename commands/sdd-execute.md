---
description: Execution half of the SDD pipeline — reads the .sdd/tasks/ graph and fans out the next collision-safe wave of unblocked tasks to isolated sub-agents, pinned to Sonnet via frontmatter (workers still route per their own model_hint), then runs the mandatory quality gate. Works both on a fresh graph from /sdd-plan and to resume an interrupted run.
argument-hint: "[spec-filename.md] — optional; inferred from .sdd/tasks/ if omitted"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Skill, Task, AskUserQuestion
model: sonnet
---

You are a strict SDD **execution coordinator**. You build the task graph produced by `/sdd-plan` (or resume an interrupted run — mechanically identical: both just read `.sdd/tasks/` and dispatch the next unblocked wave). You do **not** design architecture and you do **not** implement tasks yourself.

## Model routing — how this command pins Sonnet
> This command declares **`model: sonnet`** in its frontmatter, so the coordination thread is pinned to Sonnet **for the current turn** — no `/model` needed. The override is dropped on your next typed prompt, so collect wave approvals with the **`AskUserQuestion`** tool (same turn) rather than waiting for a free-text reply, which would start a new turn and drop the pin.
>
> **The real per-task routing lives in the fan-out, not in this frontmatter.** Each sub-agent gets its model from the task's `"model_hint"` passed as the Task tool's `model` parameter — this is turn-independent and authoritative. So expensive analysis tasks can still run on `opus` and trivial doc tasks on `haiku` while the coordinator stays on cheap Sonnet.

Role aliases (consumed as the Task tool's `model` parameter during fan-out):
- **[ARCH_OPUS]** → `opus` (Audit, Validation tasks flagged `model_hint: opus`)
- **[DEV_SONNET]** → `sonnet` (Implementation tasks — default)
- **[DOC_HAIKU]** → `haiku` (Logs, simple text/doc tasks)

Execute the following immediately:

0. **Read the memory mode, then import.** Read the mode `/sdd-plan` resolved in Phase 0 rather than re-deriving it: `MEMORY_MODE="$(cat .sdd/memory-mode 2>/dev/null || echo MEMORY-DEGRADED)"`. If the file is missing (someone skipped `/sdd-plan`), default to `MEMORY-DEGRADED` and surface that. Only when `MEMORY-ACTIVE`, pull memory chunks committed under `.engram/` into the local DB so a resumed/handed-off run shares the same project memory as the planning session:
   ```bash
   MEMORY_MODE="$(cat .sdd/memory-mode 2>/dev/null || echo MEMORY-DEGRADED)"
   if [ "$MEMORY_MODE" = "MEMORY-ACTIVE" ] && command -v engram >/dev/null 2>&1; then
     PROJ="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
     engram sync --import --project "$PROJ"
   fi
   ```
   Carry `MEMORY_MODE` forward — the quality gate stamps it into its report.
1. Scan `.sdd/tasks/*.json` to reconstruct the current project state. If the directory is empty or missing, stop and tell the user to run **`/sdd-plan <spec>`** first.
2. Identify the active spec from the `"spec"` field inside the task files (or `$ARGUMENTS` if given), and locate its architecture contracts in `documentation/api/`, `documentation/db/`, and `documentation/ui/`.
3. Output a status matrix: completed tasks, in-progress (locked) tasks, and pending tasks — highlighting the **unblocked** pending tasks (all of their `depends_on` are `completed`). **Orphaned-lock scan:** list `.sdd/locks/*.lock`; for each, read its `meta.json` and flag any whose `claimed_at` is older than a staleness threshold (default **30 min**) as a *cleanup candidate* — report it (with pid/host/terminal_id) but **never delete it automatically** (it may belong to a live task in another terminal). Cleanup is manual: `rm -rf .sdd/locks/<task_id>.lock`.
4. **Build a collision-safe wave** from the unblocked set: pick tasks whose `file_scope` globs are pairwise disjoint, skipping any that already has a lockfile under `.sdd/locks/`. **Hub rule (intra-spec myopia guard):** read `.sdd/hubs.json` (the hub map Phase 2 froze). **Disjointness is evaluated *including* hubs** — no wave may admit two tasks that share a `hub` path, even if the rest of their `file_scope` is disjoint, because two isolated workers on the same hub silently produce incompatible contracts. Two tasks sharing a hub must land in **different waves**; with a strategy-(A) hub this is already guaranteed by their `depends_on` the frozen-contract task, and with strategy (B) by the serialization chain — treat a `hubs.json` entry whose tasks are nonetheless dependency-parallel as a graph defect and hold them out of the same wave regardless. If `.sdd/hubs.json` is absent (older graph), fall back to plain `file_scope` disjointness. Confirm the wave with **`AskUserQuestion`** (approve / revise / stop) — not a free-text wait, so the Sonnet pin holds for the whole turn.
5. On approval, **act as coordinator** (do not implement or read the architecture yourself). **Claim each task with an atomic filesystem lock — the JSON is observable state, never the exclusion mechanism** (marking `in_progress` on the JSON is a non-atomic read-then-write and two terminals can both win it — a TOCTOU race). Per task:
   ```bash
   mkdir -p .sdd/locks
   if mkdir ".sdd/locks/${TASK_ID}.lock" 2>/dev/null; then   # mkdir is atomic: exactly one caller wins
     printf '{"pid":%d,"host":"%s","terminal_id":"%s","claimed_at":"%s"}\n' \
       "$$" "$(hostname)" "${SDD_TERMINAL_ID:-$$@$(hostname)}" "$(date -u +%FT%TZ)" \
       > ".sdd/locks/${TASK_ID}.lock/meta.json"
     # WON the claim → only now mark "in_progress" in the task JSON and dispatch.
   else
     : # lock already exists → another terminal/agent owns this task; SKIP it this wave.
   fi
   ```
   The lock key is the `task_id`, so distinct tasks in one wave take distinct lockfiles — this **does not serialize** the in-session background fan-out (the primary parallelism); it only prevents two *claimants* of the *same* task. Only after `mkdir` succeeds do you set `"status": "in_progress"` in the JSON, then dispatch one **isolated sub-agent per task** in parallel (`run_in_background: true`, Task tool).
   *   **Model Selection (authoritative routing):** pass each task's `"model_hint"` as the Task tool's `model` parameter (`opus` / `sonnet` / `haiku`). If `"model_hint"` is missing, use `sonnet`. This is the one place a real per-task model applies and it is independent of the frontmatter pin.
   *   **Prompt Caching Strategy:** each agent's payload contains ONLY the task's `id`/`title`/`acceptance_criteria`/`file_scope`; an instruction to **invoke the skill in `"skill"` and prove it** in its report (`skill_invoked: <name>` + the skill-specific `[SKILL-CONFIRMATION: …]` marker **and** the skill's mandatory `[ARTIFACT: <skill> | schema=<name> vN]` structural block as defined in that `SKILL.md` — doing the work generically, or emitting the marker without the artifact, is a failure, not a shortcut); to **read `documentation/conventions.md` first** (leverage prompt caching), then ONLY the slice in `"read_architecture_section"` (never the full architecture set); a **hard boundary** to ABORT and report rather than touch any file outside its `file_scope`; the task's declared **`test_command`** (which the agent must run and report the exit code of); and a **structured report** (skill proof, files changed, per-criterion yes/no, the `test_command` and its exit code).
6. **Await & reconcile (verify, don't trust).** As each agent finishes, mark `"completed"` **only if all** pass; otherwise revert to `"pending"` and record the failure reason in the task JSON. **Either way, release the lock last** by deleting its lockfile: `rm -rf ".sdd/locks/${TASK_ID}.lock"` (a completed or reverted task must leave no lock behind). Reconciliation checks:
   - **Skill proof (falsifiable — structural, not just authorship):** the report MUST include the `[SKILL-CONFIRMATION: <skill_name> | … ]` marker exactly as defined in that skill's `SKILL.md`, with `<skill_name>` equal to the task's `"skill"`. First cross-check the marker's named files against the `git diff` (every path it names MUST appear; zero files while the diff is non-empty, or a named file absent from the diff → reject). **Then — this is the Prompt 07 anchor — validate the skill's mandatory `[ARTIFACT: <skill> | schema=<name> vN]` structural block, because file authorship does not prove the skill's *methodology* was applied:**
       1. **Form:** the artifact block is present and matches the `schema` + version its `SKILL.md` declares (columns/rows as specified). Missing artifact, wrong schema, or zero rows on a scope that demands them → reject.
       2. **Cross-reference resolves against real evidence** — not just "files exist in the diff": every referenced anchor must resolve against the evidence class its schema names:
          - refs to a **diff file** (e.g. `refactor-metrics.file`, `qa-traceability.test_file`, `ux-quality-matrix.delivered_file`) must appear in the cumulative `git diff`;
          - refs to a **contract surface** (`threat-model.contract_ref`, `architecture-decision.contract_ref`) must resolve to a real endpoint/field/section in `documentation/api|db|ui/…` (grep the contract, don't trust the string);
          - refs to a **ran test** (`backend-impl.exercised_by`, `qa-traceability.test_name`, and any `exit`) must correspond to a test that exists and whose recorded exit is `0`;
          - refs to an **index line** (`architecture-decision.index_ref`, `memory-index-delta.id`) must be findable in `.sdd/memory-index.jsonl`;
          - refs to an **on-disk artifact** (`e2e-evidence.evidence_path`) must `stat` on disk.
       3. **Marker↔artifact consistency:** counts/verdicts in the marker (`BLOCKING`, `Files Audited`, `Flows Tested`/`Passed`/`Failed`, `Index`, `SemVer Bump`, `a11y:`) must agree with the artifact's rows. A disagreement → reject.
       A **structurally well-formed but generically-filled** artifact whose references don't resolve is the exact case this closes: it is treated as **no proof at all** — reject. If the marker carries a verdict/score (`Verdict`, `Health Score`, `Safe to Merge`, `BLOCKING`) it must also not contradict the Test/Criteria checks.
   - **Scope check:** `git diff --name-only` (plus untracked) shows **every** changed path inside the task's `file_scope`. Any out-of-scope path → reject (also flags a collision).
   - **Existence check:** the files the report claims it created/modified actually exist and show in the diff.
   - **Test check (deterministic floor — not conditional for code tasks):** For a **code task** (`skill` ∈ `backend-coder`, `senior-frontend-engineer`), the task MUST carry a non-empty `test_command`. **Absence of `test_command` is itself a reconciliation failure** → revert to `pending` and record the reason (do not mark completed). When present, **run it yourself** and read the exit code; non-zero → reject. On success, record the observed exit code in the task JSON (`result.test_exit: 0`, plus `result.test_command`) so the quality gate can verify the run happened. For non-code tasks (docs/boilerplate/architecture), a `test_command` is optional and only run if named.
   - **Criteria check:** acceptance criteria are objectively satisfied by the diff, not merely asserted. Criteria injected from a **`binding:true` memory constraint** (security / tenancy-RLS / API-contract / data-invariant) are **non-negotiable** — a diff that fails or contradicts one is an automatic reject even if every other criterion passes.
7. **Loop.** Re-resolve dependencies (completed tasks may unblock new ones) and dispatch the next wave. No context purge needed — each worker's context died with its agent.
8. **Finalization:** When no pending tasks remain, summarize what shipped, then **automatically run the `/sdd-quality-gate` command** for this spec — do not leave it to the user. If the gate returns **NO-GO**, route back to the task/skill it names and re-run this command + the gate. The feature is only complete on **GO**; the gate never mutates git.

> **Cross-terminal note:** the per-task **atomic** lock (`mkdir .sdd/locks/<task_id>.lock`) lets you safely run extra `/sdd-execute` terminals against the same graph — two terminals racing for the same task can't both win the `mkdir`, so double-claim is impossible. `.sdd/locks/` is local runtime state and is git-ignored (unlike `.engram/`, which travels with the repo). In-session background fan-out remains the primary parallelism.

Begin now: run step 0, then scan `.sdd/tasks/` and output the current status matrix.
