# Architecture

> Status: **conceptual** (Foundation Revision 2). Boundaries and responsibilities are
> being fixed here; technology choices are deliberately deferred to Phase 1+ ADRs.

## Layered View

```
┌─────────────────────────────────────────────────────────┐
│  EXECUTIVE UI                                            │
│  Pilot-facing. Executive Mode: situation → options →     │
│  recommendation → cost → decision. Teaching UX for       │
│  GuruSeeds. Review & audit views.                        │
├─────────────────────────────────────────────────────────┤
│  KERNEL                                                  │
│  Governance core. Approval gates · budget enforcement    │
│  (Cost Probe) · scope limits · audit log · seed          │
│  injection (InjectSeed) · versioning of everything.      │
├──────────────────────┬──────────────────────────────────┤
│  MENTOR ENGINE       │  RUNTIME                          │
│  Mentor lifecycle,   │  Execution of Workflows: model    │
│  Mentor Expertise    │  calls, tool access, sandboxing,  │
│  composition, seed   │  scheduling, retries.             │
│  relevance.          │                                   │
├──────────────────────┴──────────────────────────────────┤
│  STATE LAYER                                             │
│  GuruSeed store · Project State · Memory · Artifacts ·   │
│  ADRs/Navigation. Everything versioned, everything       │
│  inspectable.                                            │
└─────────────────────────────────────────────────────────┘
```

## Layer Responsibilities & Boundaries

### Executive UI
The only surface the Pilot needs. It never executes work itself — it renders Kernel
state and captures Pilot decisions and teaching. *Boundary:* the UI has no privileged
path to the Runtime; every action flows through the Kernel.

### Kernel
The embodiment of the Principles in code. It is the **only** component allowed to:
authorize execution, spend budget, inject seeds into context, and write to the audit
log. *Boundary:* the Kernel does no intelligent work — it governs it. Keeping the
Kernel small and boring is a design goal.

### Mentor Engine
Composes Mentors from Mentor Expertises, resolves which GuruSeeds are relevant to a
task (feeding InjectSeed), and manages Mentor versioning. *Boundary:* proposes seed
selections; the Kernel performs the injection and logs it.

### Runtime
Executes Workflows: LLM calls, tool invocations, sandboxed operations. Stateless by
design — all state it needs arrives via Kernel-approved context; all state it
produces returns as Artifacts and Project State updates. *Boundary:* the Runtime
cannot exceed the scope or budget stamped on the work order it received.

### State Layer
Persistence for the five stores (seeds, project state, memory, artifacts,
navigation/ADRs). *Boundary:* append-mostly; destructive edits are exceptional and
audited. Versioning is a property of the store, not a discipline asked of its users.

## Canonical Flow (one Workflow execution)

1. **Pilot** issues intent via Executive UI.
2. **Kernel** creates a work order: scope + budget + approval requirements.
3. **Mentor Engine** selects the Mentor (Expertise) and proposes relevant GuruSeeds.
4. **Kernel / InjectSeed** assembles the explicit Context (Project State + seeds +
   memory + input) and logs exactly what was injected.
5. **Runtime** executes the Workflow within the work order limits; **Cost Probe**
   meters continuously.
6. Artifacts + a Project State delta return to the **Kernel**.
7. **Executive UI** presents outcome, cost and provenance; Pilot approves, rejects
   or teaches (new/refined GuruSeed) — closing the learning loop.

## Architectural Invariants

- No execution outside a Kernel work order.
- No context element that is not enumerated in the audit log.
- No Artifact without provenance (seeds + context versions that produced it).
- No component other than the Kernel spends budget.
- The Pilot can halt anything, at any time, and the system remains consistent.

## Deliberately Undecided (deferred to future ADRs)

- Technology stack (language, storage, model providers).
- Local-first vs. server deployment model.
- Seed relevance algorithm (retrieval strategy for InjectSeed).
- Multi-Pilot / multi-tenant support.
