# Roadmap

Phases are sequential in *commitment* but may overlap in *exploration*. A phase is
complete when its exit criteria are met and recorded in Navigation.

## Phase −1 · The Why ✔

Establish the reason for AgentOS to exist.
**Exit:** VISION, MANIFESTO and PRINCIPLES written and stable. *(Done — Session 001.)*

## Phase 0 · Foundation ← current

Fix the vocabulary, the conceptual architecture and the decision process before any
production code.
**Exit criteria:**
- All TERMINOLOGY terms defined and used consistently across docs.
- Conceptual architecture with layer boundaries and invariants (ARCHITECTURE.md).
- ADR process operating (template + first accepted ADRs).
- Navigation system proven across ≥ 2 sessions.
- Open questions in CURRENT.md either answered or explicitly deferred with owner.

## Phase 1 · Kernel

The governance core: work orders, budget enforcement (Cost Probe), approval gates,
audit log, versioned stores.
**Exit:** a Workflow can be authorized, metered, halted and fully audited — even if
the "work" is trivial.

## Phase 2 · Executive UI

The Pilot's cockpit: Executive Mode decision flow, teaching UX for GuruSeeds,
provenance/review views.
**Exit:** the Pilot can govern a full Workflow lifecycle without touching internals.

## Phase 3 · Runtime

Real execution: model calls, tool access, sandboxing, retries — all under Kernel
work orders.
**Exit:** a non-trivial Workflow produces Artifacts with complete provenance and
respected budgets.

## Phase 4 · Mentor Engine

Mentor composition from Mentor Expertises; seed relevance for InjectSeed; Mentor
versioning.
**Exit:** two Mentors with different Expertises produce observably different,
seed-attributable behavior on the same task.

## Phase 5 · GuruSeed System

Full seed lifecycle (draft → active → refined → retired), teaching loop from
Executive UI, seed performance signals.
**Exit:** a seed taught in one session measurably changes behavior in later
sessions, and its effect is visible to the Pilot.

## Phase 6 · Self-improving Architecture

The system proposes its own refinements — new seeds, retirements, workflow
optimizations — always as *proposals* through Executive Mode (Principles 1 & 6).
**Exit:** at least one system-proposed, Pilot-approved improvement with measured
positive effect.
