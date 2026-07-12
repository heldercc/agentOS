# Chapter IV — Architecture

> Status: conceptual (Foundation Revision 8). This chapter fixes responsibilities
> and boundaries. Technology choices are deliberately deferred to Phase 1+ ADRs.

## Why This Shape

The Vision commits the system to two disciplines: context is *scheduled* (Article
5) and everything the Pilot owns is *governable* (Articles 1–4). The architecture
is the smallest structure that honors both. Its guiding question is never "what
can this component do?" but "who is allowed to know what, and who answers for it?"

## On Layer Chains

A proposal considered for this revision arranged the system as a single vertical
chain:

    Kernel → Sensei → Sensei Expertise → Seed Resolver → Agents
    → Artifacts → Project State → Memory → Navigation

This chain is rejected, for one reason worth recording: **it is a list, not an
architecture.** It places actors (Kernel, Senseis), configurations (Expertise),
mechanisms (Seed Resolver), outputs (Artifacts) and stores (Project State,
Memory) into a single hierarchy where the arrow means nothing consistent —
sometimes "commands", sometimes "produces", sometimes "is stored in". An
architecture must say what kind of thing each element is before saying how they
relate. The separation below keeps every concept from the chain, sorted by kind.

## The Three Planes (plus one)

```
┌───────────────────────────────────────────────────────────┐
│ GOVERNANCE PLANE — the Kernel                              │
│ Work orders · approval gates · Effort Probe · context      │
│ scheduling (via Seed Resolver) · audit log · versioning.   │
│ Presented to the Pilot through Executive Mode.             │
├───────────────────────────────────────────────────────────┤
│ INTELLIGENCE PLANE — Senseis                               │
│ Senseis composed from Sensei Expertises execute Workflows: │
│ model calls, tool use, sandboxed operations.               │
├───────────────────────────────────────────────────────────┤
│ STATE PLANE — the stores                                   │
│ GuruSeeds · Project State · Memory · Artifacts.            │
│ All inspectable; versioning & retention policy per store.  │
└───────────────────────────────────────────────────────────┘

  NAVIGATION — outside the runtime entirely.
  The Pilot/Copilot instrument for building AgentOS itself.
  The running system does not depend on it.
```

Navigation is deliberately excluded from the runtime planes. It governs the
*construction* of AgentOS, not its operation. Placing it inside the runtime (as
the rejected chain did) confuses the project with the product — though it is a
happy fact that Navigation is a working prototype of Project State.

## Plane Responsibilities & Boundaries

### Governance Plane — Kernel
The Constitution, embodied. Sole authority to: authorize execution (work orders),
estimate and meter effort (Effort Probe), schedule context (invoking the Seed
Resolver and assembling the working set), and write the audit log. The Kernel
does no intelligent work. Keeping it small and boring is a design goal.
*Executive Mode is the Kernel's face:* the surface where situation, options,
recommendation and effort meet the Pilot's decision. It renders governance; it
has no privileged path around it.

### Intelligence Plane — Senseis
All intelligent work happens here, and only here. A Sensei receives a work order
with an assembled Context and produces Artifacts plus a Project State delta.
Senseis are stateless between work orders: everything they know arrived through
scheduled context; everything they conclude leaves as versioned output.
*Boundary:* a Sensei cannot exceed the scope or effort budget stamped on its work
order, cannot reach a store directly, and cannot alter a seed (Article 4).

### State Plane — Stores
Four stores, four lifetimes: **GuruSeeds** (owner's judgment — outlives
everything), **Memory** (durable facts — outlives projects), **Project State**
(one project's knowledge — lives with the project), **Artifacts** (outputs —
immutable once produced). *Boundary:* policies are **per store**, not
plane-wide — seeds are strictly versioned and never silently mutated
(Article 4); Artifacts are immutable once produced; Project State is a living
document with versioned checkpoints; Memory is append-mostly with audited
retirement. Versioning is a property of each store, not a discipline asked of
its users.

## Canonical Flow (one Workflow)

1. The Pilot issues intent through Executive Mode.
2. The Kernel drafts a work order and runs the **Effort Probe**: estimated
   tokens, time and refinement rounds; expected quality gain; a recommendation
   (proceed / reduce scope / abstain).
3. The Pilot decides. (For pre-granted scopes, the Kernel decides within the
   grant and records that it did.)
4. The Kernel schedules context: the **Seed Resolver** selects relevant
   GuruSeeds; the Kernel assembles seeds + Project State + Memory + input into
   an enumerated Context and logs exactly what was placed.
5. A Sensei executes the Workflow within the work order; the Effort Probe meters
   actuals continuously and can halt at budget.
6. Artifacts and a Project State delta return through the Kernel, with full
   provenance.
7. Executive Mode presents outcome, actual effort versus estimate, and
   provenance. The Pilot approves, rejects, or teaches — a new or refined seed —
   closing the loop. The estimate/actual gap feeds Effort Probe calibration.

## The Effort Probe

The Cost Probe of earlier revisions measured what work *did* cost. The Effort
Probe exists because governance needs to know what work *will* cost — before
consenting to it. It answers, for any proposed work: what will this demand
(tokens, time, refinement effort), what will it likely return (quality gain),
and is it worth it (recommendation).

Two disciplines keep this honest:

- **Estimates are calibrated, not asserted.** Every estimate is later compared
  with the measured actual; the gap is the probe's own quality signal. An
  estimator that is never checked against reality is decoration.
- **Precision is bounded by honesty.** Token and time estimates can be grounded
  early. "Expected quality gain" and "ROI" are speculative until enough
  estimate/actual pairs exist; until then the probe reports ranges and
  confidence, never a single confident number. A probe that manufactures
  certainty violates Article 2.

## Architectural Invariants

Engineering rules the Constitution implies; any violation is a defect.

- No execution outside a Kernel work order.
- No context element that is not enumerated, by reference, in the audit log.
- No Artifact without provenance by reference (IDs/versions of seeds and
  context that produced it — never copies).
- No component other than the Kernel spends effort budget.
- No mutation of seeds, expertises or workflows without an approval record
  (Article 4).
- Everything versioned: seeds, context, expertises, artifacts, decisions.
- The Pilot can halt anything, at any time, and the system remains consistent.
- No domain knowledge in the engine: the Kernel and App shell are blind to
  what is being produced; domain lives only in governed data (ADR-0008).
- Senseis are data, not code: creating, editing, improving or retiring a
  worker is a governed, versioned, auditable operation (ADR-0008).

## Deliberately Undecided (deferred to future ADRs)

- Technology stack (language, storage, model providers).
- Local-first versus server deployment.
- Seed Resolver strategy (retrieval, ranking, determinism guarantees).
- Effort Probe estimation model and calibration mechanics.
- Multi-Pilot / multi-tenant support.
