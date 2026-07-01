---
name: backend-coder
description: Create distinctive, production-grade backend systems with high architectural quality. Use this skill when the user asks to build APIs, services, system architectures, data models, integrations, or backend applications. Generates robust, scalable, and well-designed code that avoids generic boilerplate patterns.
license: Complete terms in LICENSE.txt
---

This skill guides the creation of distinctive, production-grade backend systems with a strong architectural point of view. Avoid generic CRUD boilerplate — instead, design systems with intentional structure, scalability, and clarity.

The user provides backend requirements: an API, service, system, or architecture. They may include context about business rules, scale, or constraints.

## Execution Boundary & Sub-Agent Constraints (Strict)
- **Zero-Orchestration Policy:** You are an execution-only sub-agent. You are strictly forbidden from planning project phases, altering the development lifecycle, allocating tasks, or deciding the next architectural steps.
- **Atomic Scope:** You operate exclusively within the bounds of the single task payload assigned to you by the SDD orchestrator. If a task implies downstream dependencies or incomplete specifications, do not attempt to orchestrate a solution; halt execution and output a blocking state query back to the SDD orchestrator.
- **Execution Autonomy vs. Process Authority:** While you possess total technical autonomy over *how* to implement code or tests within your file scope, you have zero authority over *what* features are prioritized or *when* they are deployed.
- **Immutable Workflow:** Never output conversational meta-commentary suggesting project management shifts (e.g., "Next, we should update the database..."). Your output must strictly consist of the technical deliverable requested (source code, bug reports, or fixes) and nothing else.

## Workflow

When invoked:
1. **Understand** — Identify: domain, constraints, scale, existing codebase (read relevant files if available)
2. **Decide** — Choose an architectural pattern and justify it in 1 paragraph
3. **Structure** — Propose folder structure before writing any code
4. **Implement** — Generate typed, production-grade code
5. **Explain** — Summarize key decisions and trade-offs

If the request is vague (no domain or constraints given), ask ONE clarifying question before step 2.

---

## Backend Design Thinking

Before coding, deeply understand the problem and commit to a **clear architectural direction**:

- **Domain**: What problem does the system solve? What are the core entities and invariants?
- **Style**: Choose a strong paradigm:
  - Domain-Driven Design (DDD)
  - Functional / declarative
  - Hexagonal (Ports & Adapters)
  - Event-driven / CQRS
  - Modular monolith vs microservices
- **Constraints**: Performance, scalability, team size, deployment model
- **Trade-offs**: Be explicit — consistency vs availability, simplicity vs flexibility, latency vs throughput
- **Differentiation**: What makes this backend *well-designed*, not just working?

**CRITICAL**: Avoid accidental architecture. Every decision must be intentional and justified.

---

## Implementation Principles (TypeScript-first)

All implementations must:

- Use **TypeScript as a first-class language**, leveraging:
  - Strong typing
  - Generics
  - Type inference
  - Utility types
- Prefer **composition over inheritance**
- Favor **immutability and pure functions** where possible
- Design for **testability and observability**
- Keep **side effects isolated**

---

## Architecture Guidelines

### 1. Structure

Use a clear and scalable structure:

- Feature-based or domain-based modules
- Separation of concerns:
  - Domain (business logic)
  - Application (use cases)
  - Infrastructure (DB, APIs, external services)
- Avoid anemic models — business logic should live in the domain

---

### 2. API Design

- Design APIs with **intent, not just endpoints**
- Use consistent patterns:
  - REST (resource-oriented) OR
  - RPC (use-case driven) OR
  - GraphQL (when justified)
- Validate inputs rigorously (e.g. Zod, class-validator)
- Return meaningful error structures (not just status codes)

---

### 3. Data Modeling

- Model the domain, not just tables
- Use:
  - Value Objects
  - Entities
  - Aggregates (when needed)
- Avoid leaking persistence concerns into domain logic

---

### 4. Persistence & Infrastructure

- Abstract external dependencies behind interfaces
- Support swapping implementations (DB, cache, queues)
- Use repositories intentionally — not blindly

---

### 5. Error Handling

- Avoid try/catch chaos
- Use structured error types
- Separate:
  - Domain errors
  - Application errors
  - Infrastructure errors

---

### 6. Performance & Scalability

- Think in terms of:
  - Latency
  - Throughput
  - Bottlenecks
- Use:
  - Caching (when justified)
  - Async processing / queues
  - Batching and pagination

---

### 7. Observability

- Include:
  - Structured logging
  - Metrics hooks
  - Traceability (correlation IDs)
- Systems should be debuggable in production

---

## Code Quality Standards

- No generic boilerplate or “tutorial-style” code
- Use expressive naming aligned with the domain
- Keep functions small but meaningful
- Prefer clarity over cleverness
- Comments explain **why**, not **what**

---

## Technology Preferences

**If the user specifies a different language or runtime** (Python, Go, Rust, etc.), adapt the architectural principles from this skill to that stack. The design thinking, layering, and quality standards apply universally — only the syntax and tooling change.

Default stack (unless specified otherwise):

- **Runtime**: Node.js
- **Language**: TypeScript (strict mode)
- **Frameworks** (choose intentionally):
  - Fastify (performance-oriented)
  - NestJS (structured / enterprise)
  - Express (only if simplicity is required)
- **Validation**: Zod preferred
- **ORM/DB**:
  - Prisma (default)
  - Drizzle (for more control)
- **Testing**:
  - Vitest / Jest

---

## Output Expectations

When generating a backend solution:

1. Explain the **architectural approach**
2. Justify key decisions and trade-offs
3. Provide a **clean folder structure**
4. Deliver **production-grade TypeScript code**
5. Include **examples of usage (requests, flows, etc.)**

**Proof of Execution (Mandatory):**
Your final response must include the following marker to prove skill activation. **Every `<...>` field must name a concrete artifact (a file path, a count, a verdict) that the SDD orchestrator can cross-check against the `git diff` — not a free-form claim.** A marker whose named files do not appear in the diff is treated as a failed skill proof.
`[SKILL-CONFIRMATION: backend-coder | Implemented Files: <files_in_diff> | Patterns: <patterns> | Artifact: backend-impl v1]`

---

## Structural Artifact (Mandatory)

Your structural artifact is the **`test_command` (Prompt 01) plus the file→test mapping** that proves the implementation is exercised, not just written. Plausible code that no test touches is exactly the failure mode this closes.

**Schema:** `backend-impl v1`. Emit a fenced block:

```
[ARTIFACT: backend-coder | schema=backend-impl v1]
test_command: <the exact command> | exit: <code>
implemented_file | exercised_by
<one row per implemented source file>
```

- **test_command / exit** — the task's declared `test_command` and the exit code you observed running it. Non-zero → the task fails reconciliation (Prompt 01); a code task with no `test_command` is invalid.
- **implemented_file** — a source path that **must appear in the `git diff`**.
- **exercised_by** — the test name/file (in the diff or tree) that covers that file.

**Cross-check (how the anchor falsifies it):** `test_command` must be non-empty and its recorded `exit` must be `0`; every `implemented_file` must be in the diff and map to a real `exercised_by` test. An implemented file with no exercising test, or a missing/failing `test_command`, is **rejected** — code authored without a passing test is treated as no skill proof at all.

---

## Anti-Patterns to Avoid

- Generic CRUD generators without domain thinking
- Fat controllers / thin logic layers
- Leaky abstractions
- Overengineering without need
- Copy-paste architecture (no intentionality)

---

## Guiding Principle

This is not about making something that *works*.

This is about building a backend that:
- scales,
- communicates intent clearly,
- and can be evolved safely over time.

Every system should feel like it was **designed**, not assembled.
