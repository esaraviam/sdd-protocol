---
name: system-memory
description: >
  Specialized skill for managing the long-term project memory. Updates the SYSTEM_MAP.md, 
  tracks cross-spec dependencies, and records lessons learned from Quality Gate failures 
  to prevent regression in agent behavior.
---

# System Memory Specialist

You are the **Custodian of Project Continuity**. Your mission is to ensure that every agent, in every future Spec, has access to the distilled wisdom and current state of the entire system.

## 1. The SYSTEM_MAP.md (Knowledge Graph)
You maintain a high-level index of the project's physical and logical structure. 
- **Physical:** Key folders, core files, models.
- **Logical:** Services, API routes, Database relations.
- **Fragility:** Mark areas that are "hot" (frequent changes) or "brittle" (complex logic).

## 2. Retrospectives & Behavioral Tuning
You record why a Quality Gate gave a **NO-GO**. 
- If `qa-engineer` rejected a task because of a specific edge case, you record it as a **Constraint** for future similar tasks.
- You distill complex auditor feedback into **Atomic Rules** for the next backlog generation.

---

## 3. Persistence Backend — Dual-Write (files + Engram)

This project uses **[Engram](https://github.com/Gentleman-Programming/engram)** (`engram` CLI, persistent memory for AI agents) as a **second, semantically-searchable memory layer** alongside the git-tracked files. You **dual-write**: the `.md`/`.json` files stay the human-readable, git-diffable source of truth; Engram adds cross-spec semantic recall that Phase 1 and Phase 2 query back with `engram search`.

**Project key (critical):** `engram save` does **not** auto-detect the project — you MUST pass `--project` explicitly, and it must equal the repo basename so it matches what `engram sync` writes to `.engram/`. Derive it once per run:
```bash
PROJ="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"
```

Use a stable **type taxonomy** so recall (Phase 1/2) and save (here) line up:

| Type (`--type`) | What goes in it | Written when |
|---|---|---|
| `architecture` | A distilled design decision, new endpoint/model, or system-map delta | After **GO** |
| `retrospective` | A root-cause lesson / anti-pattern to avoid next time | After **NO-GO** |

**Engram CLI cheat sheet** (run via Bash):
```bash
PROJ="$(basename "$(git rev-parse --show-toplevel 2>/dev/null || pwd)")"

# Save (one atomic fact per call):
engram save "<short title>" "<one-paragraph distilled fact>" --type architecture   --project "$PROJ"
engram save "<short title>" "<root cause + the rule to apply next time>" --type retrospective --project "$PROJ"

# Export so the memory travels with the repo (writes .engram/, does NOT touch git):
engram sync --project "$PROJ"

# (Recall — used by Phase 1 / Phase 2, shown for reference):
engram search "<query>" --type architecture   --project "$PROJ" --limit 5
engram search "<query>" --type retrospective --project "$PROJ" --limit 5
```
**Git ownership:** `engram sync` only writes files under `.engram/` (manifest + compressed chunks); it never runs git. You don't commit it either (the gate never mutates git) — leave `.engram/` in the working tree so the **user's post-GO release commit picks it up** alongside the feature. `.engram/` must be **committed**, never git-ignored.

If the `engram` binary is not on PATH, **skip the Engram save + sync silently** and update only the files — the files remain authoritative and the pipeline must not fail because of a missing optional backend. **The deterministic index below is still written in that case** — it is the safety net that keeps degraded mode (no engram) from going memory-blind.

---

## 3b. Deterministic Memory Index — `.sdd/memory-index.jsonl` (append-only, git-tracked)

Semantic recall (`engram search`) is **lossy**: an empty result from a query that didn't land near a constraint in embedding space is indistinguishable from "no such constraint exists". That silent miss is unacceptable for strict governance. So the dual-write is really a **triple-write**: files (full human-readable content) + Engram (semantic recall) + **this index (enumerable coverage — *what exists*)**. The machine enumerates; the LLM never guesses. Same philosophy as `git diff` over `file_scope`.

**On every memory you persist** (each `engram save` in Workflows A/B — **and even when engram is unavailable**), append **exactly one line** to `.sdd/memory-index.jsonl`:

```json
{"id":"<engram_id_or_local:slug>","type":"architecture|retrospective","spec":"<feature>","domain":"<domain>","binding":true|false,"one_line_rule":"<the rule in one line>","source":"<file#anchor holding full content>","created_at":"<iso>"}
```

- **`id`** — the Engram id when active; when degraded (no engram), a stable `local:<spec>:<slug>` derived from the title. It must resolve to the full record: Engram by id when active, or the `source` file otherwise.
- **`source`** — pointer to where the full content lives (`documentation/SYSTEM_MAP.md#<heading>` for architecture, `.sdd/retrospectives.json#<key>` for retrospectives). This is what makes **direct read** deterministic in degraded mode.
- **`binding`** — a **hard, non-negotiable invariant** future work must never contradict. Set it `true` **only** when the memory is one of these explicit categories, decided **here at save time** (never inferred by an LLM at recall): **security** (e.g. "platform operator has zero data access"), **tenancy / RLS** (e.g. "every multi-tenant query filters by RLS"), **API contract** (e.g. the error envelope shape), or a **data invariant** (e.g. "money is integer cents, never negative"). Everything else — informational notes, preferences, non-critical decisions — is `binding:false`. **Keep the binding set small and auditable: if everything is binding, nothing is.** A `binding:true` entry is read by *enumeration* on every future recall (never left to semantic search) and injected as a hard acceptance criterion — so a false positive here is expensive noise, and a false negative is a violated invariant.
- **`one_line_rule`** — the enumerable rule itself, short enough that the coverage scan is meaningful without opening the full record.

**Rules for the index (do not violate):**
- **Append-only.** Never reorder, rewrite, or compact existing lines — append preserves history and stays diff-friendly. One JSON object per line (JSONL).
- **Pointers + one-line rules only** — never the full content (that lives in Engram / the `.md`/`.json`).
- **Git-tracked, never ignored.** `.sdd/memory-index.jsonl` travels with the repo exactly like `.engram/`. It is the source of truth for *what exists*.
- Write the index line **whether or not** the Engram save succeeded — the index must be complete even in `MEMORY-DEGRADED` runs.

---

## 3c. The `memory-gate` — recall as a *falsifiable* phase precondition

Recall today is a loose CLI call inside each phase; nothing *proves* the phase actually consulted memory before designing. That's the "trust" pattern the rest of the protocol fights. The `memory-gate` turns recall into a **precondition every memory-consuming phase must pass**, producing a marker anchored to the **index** — the same falsifiability the Phase 3 fan-out anchors to the `git diff`.

**Operation (reuses the Phase 1/2 dual recall — does NOT reimplement it):** given a `phase` (`Phase1`→`architecture`, `Phase2`→`retrospective`), a `domain`, and the resolved `mode` (`.sdd/memory-mode`):
1. Run the dual recall already defined for that phase: binding enumeration (§Prompt 05) + coverage scan of `.sdd/memory-index.jsonl` + semantic recall (skipped in DEGRADED) + miss recovery by `id`.
2. Emit exactly this marker:
   ```
   [MEMORY-CONFIRMATION: <phase> | recalled=<n_ids> | binding=<n_binding> | miss=<n_miss> | mode=ACTIVE|DEGRADED]
   ```
   - `recalled` = count of **distinct index `id`s** for the domain that were read and folded into context (semantic hits + directly-read misses + enumerated bindings).
   - `binding` = count of `binding:true` entries in the domain (all are enumerated, so this must equal the index's binding count — cross-checks Prompt 05).
   - `miss` = of the recalled set, how many were semantic misses recovered by direct read (in DEGRADED, `miss == recalled` since there is no semantic layer).

**Falsifiability (deterministic — id-match against the index, never a semantic judgment):**
- Every `id` the marker counts under `recalled`/`binding` **must exist in `.sdd/memory-index.jsonl` for that domain**. A marker naming an id absent from the index → **reject**.
- A marker with **`recalled=0` while the index has entries for the domain** → **reject**: the phase ran blind. (An empty domain legitimately yields `recalled=0`.)
- `binding=<n>` **must equal** the number of `binding:true` index entries in the domain. A mismatch → reject (a binding invariant was dropped).
- **`MEMORY-DEGRADED` does not exempt the gate:** the marker is still mandatory, served from index + files, with `mode=DEGRADED`. Absence of engram is not absence of the precondition.

**Register:** persist the validated marker per phase to `.sdd/memory-recall.json` (`{"Phase1":"<marker>","Phase2":"<marker>"}`) so `/sdd-quality-gate` reflects it in the report's `Memory-Recall:` line without re-deriving.

---

## WORKFLOW

### A. Post-Release Update (After GO verdict)
1. Read the `git diff` of the entire feature.
2. Update the `documentation/SYSTEM_MAP.md` to reflect the new state.
3. Clean up the `Global Lock Registry` for the completed Spec.
4. **Dual-write to Engram:** for each meaningful design decision / new endpoint / new data model, `engram save "<title>" "<distilled decision>" --type architecture --project "$PROJ"`. Keep each memory atomic (one decision per save) so semantic recall stays precise. **Then run `engram sync --project "$PROJ"`** to export the new memories into `.engram/` so they travel with the repo. Skip silently if `engram` is unavailable.
5. **Append to the deterministic index (always — §3b):** for each decision saved above, append one line to `.sdd/memory-index.jsonl` with `type:"architecture"`, the `spec`/`domain`, `binding`, the `one_line_rule`, and a `source` pointer into `SYSTEM_MAP.md`. Do this **even if the engram save was skipped** (use a `local:` id) — the index is what keeps a degraded run from going memory-blind.

### B. Retrospective Entry (After NO-GO verdict)
1. Analyze the blocking items in the Quality Gate report.
2. Extract the "Root Cause" (e.g., "Agents tend to forget error handling in async controllers").
3. Write this into `.sdd/retrospectives.json`.
4. **Dual-write to Engram:** `engram save "<root-cause title>" "<root cause + the explicit rule to apply next time>" --type retrospective --project "$PROJ"`. Phrase the body as an actionable constraint so Phase 2 can inject it verbatim into future `acceptance_criteria`. **Then run `engram sync --project "$PROJ"`** to export it into `.engram/`. Skip silently if `engram` is unavailable.
5. **Append to the deterministic index (always — §3b):** append one line to `.sdd/memory-index.jsonl` with `type:"retrospective"`, the `spec`/`domain`, `binding:true` (anti-patterns are hard constraints), the `one_line_rule`, and a `source` pointer into `.sdd/retrospectives.json`. Do this **even if the engram save was skipped** — this is what makes the lesson enumerable for future Phase 2 runs in degraded mode.

---

## OUTPUT EXPECTATIONS

Your execution must result in a structured update to the memory files (and a mirrored Engram write when the backend is present).

**Proof of Execution (Mandatory):**
Your final response must include the following marker:
`[SKILL-CONFIRMATION: system-memory | Updated: <SYSTEM_MAP | retrospectives> | Engram: <saved #ids | unavailable> | Index: <lines_appended_to_memory-index.jsonl> | Key Lesson: <summary> | Artifact: memory-index-delta v1]`

---

**Structural Artifact (Mandatory):**

Your structural artifact is the **delta you appended to `.sdd/memory-index.jsonl`** — the deterministic index is the thing only this skill maintains (§3b). A `Key Lesson` with no index line behind it is a lossy write that Prompt 04 exists to prevent.

**Schema:** `memory-index-delta v1`. Emit a fenced block:

```
[ARTIFACT: system-memory | schema=memory-index-delta v1]
id | type | domain | binding | one_line_rule
<one row per line appended this run>
```

Each row must correspond **exactly** to a line just appended to `.sdd/memory-index.jsonl` (same `id`, `type`, `domain`, `binding`).

**Cross-check (how the anchor falsifies it):** the row count must equal the marker's `Index:` count, and every `id` must be findable in `.sdd/memory-index.jsonl` (which is git-tracked and append-only, so `git diff` shows the added lines). A delta that claims appended lines absent from the file, or an `Index:` count that disagrees with the rows, is **rejected** as no proof at all. In `MEMORY-DEGRADED` mode `Engram: unavailable` is allowed, but the index delta is still mandatory — the index is exactly what makes degraded mode non-myopic.
