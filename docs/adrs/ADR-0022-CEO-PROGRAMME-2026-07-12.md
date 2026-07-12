# ADR-0022 — The CEO Programme of 2026-07-12

- **Status:** Ratified (the Pilot completed the CEO decision interview,
  2026-07-12; the approved programme arrived as one consolidated work order
  through the Pilot's architectural hand (GPT). This ADR is the governed
  register of those decisions — the decisions themselves are the Pilot's.)
- **Pole:** both — (A) the Kernel's economics and safety; (B) faster, more
  honest human governance.
- **Doctrine:** ADR-0020 (Foundation sovereign) unchanged; this programme is
  application, not revision, of Book I.

## What is registered

The Pilot approved a thirty-point programme. The full decision list and the
mandatory phase precedence live in the work order itself; this ADR fixes the
three things that must never be silently reinterpreted:

### 1. Approved decisions (summary register)

Approved in full: atomic persistence; resumable partial operations; local
security; versioned schemas + migration registry; canonical Seed–Sensei
ownership; remaining observability gaps; test-data isolation; Architecture
Module Registry; module contract versioning; Project Engine; Slicer /
dependency graph / eventual child projects; governed back-and-forth; project
rename + versioned effective intent; progressive modular decomposition of
large files; three coherent questions per submission; aggregated reconsult;
route-a-question-to-Decide; interview-growth containment inside the Project
Engine; exact option-count contract; multiple sequential decisions per slice;
Expertise dos Senseis UI with correct candidate separation; Final Project
Review; governed Sensei evolution; Mode Edit; Haiku-vs-strong-model A/B;
authenticated mobile access; video/scene factory vertical;
research-grounded Reference Guild. Terminology: SENSEI final (ADR-0021).

Approved simplified: **minimal CI now** — npm ci, typecheck, deterministic
tests, smoke, no paid model calls; the test pyramid grows with each module,
no giant testing platform before product work continues.

### 2. Explicit deferral — hard budget enforcement (decision 5)

**DEFERRED by the Pilot.** The system continues to measure and disclose
token/time estimates honestly, but the complete budget-enforcement
architecture is NOT implemented in this campaign. **No document, UI surface
or commit message may claim that budgets are currently enforced.** They are
measured and disclosed only.

Reopen trigger — budget enforcement returns to the table only after ALL of:
- the Project Engine MVP is stable;
- versioned operation records exist;
- resumable Work Orders are proven;
- the interaction flow is stable enough to measure fairly;

and it must be resolved BEFORE production scaling or exposing autonomy
beyond the local Pilot.

### 3. Mandatory precedence

Phases 0–7 execute in order: (0) decisions become governed rules;
(1) observability closed honestly + test isolation; (2) data and transition
safety; (3) module registry, versioning, minimal CI; (4) Project Engine MVP
and Project Map; (5) Compreender/Decidir improvements; (6) Review, Mode
Edit, Sensei evolution; (7) controlled evidence tests and verticals
(A/B, mobile, video, Reference Guild research).

Standing prohibitions of the precedence:
- no Project Engine on fragile persistence;
- no child projects before the Project Map and dependency model are
  understood;
- no Sensei evolution before outcome-linked Project Reviews exist;
- no mobile exposure before local security is proven;
- no video-domain logic in the Kernel — ever (RULE E, ADR-0023).

### 4. Addendum (same interview, later the same evening) — the Project
### Engine is a Kernel mechanism, never a second orchestrator

The Pilot ratified this as a **central invariant of the revision, not an
optional detail**. The Slicer is not a new AI brain beside the Kernel; it
is a governed capability OF the Kernel, using the circuits that already
exist (Work Orders, context manifests, Decision Surfaces, Project State,
evidence).

Division of responsibility:

- **AI proposes.** A temporary agent, under an authorized slicing Work
  Order, may propose a **Candidate Project Map**: possible slices,
  dependencies, material decisions, expected Artifacts, impact risks.
  A proposal is all it ever is.
- **The Kernel governs.** It authorizes the slicing Work Order, supplies
  only the needed context, validates the proposal's schema and invariants,
  compares against existing Project State, presents MATERIAL changes to
  the Pilot via Decision Surface, persists the approved version, uses the
  map to schedule later work, and records every transition.
- **The Pilot decides** material things: main structure, materially
  separate slices, changes that invalidate work, creation of child
  projects, conclusion/abandonment of slices. He does NOT approve every
  trivial relation — obvious, reversible relations are recorded as
  authorized movement, not surfaced as bureaucracy.

After the map is approved, graph operations are **deterministic and cost
zero tokens**: next unblocked slice, dependency lookup, marking dependents
affected, blocking execution of a blocked slice, preserving unaffected
slices, navigating back, resuming completed Work Orders. No model walks a
graph. AI re-enters only for semantic judgment ("does this change touch
only the final scene or the whole arc?") — and even then it produces a
proposal, never mutates the map alone.

The Project Map is an **extension of Project State**, not a second truth:
Project State remains the smallest sufficient summary and holds the
reference to the approved Map; the Map holds the detailed topology and
enters context only when needed.

**Audit rule for Phase 4:** if the Project Engine acquires its own
executor, its own audit log, its own context assembly, its own authority,
a concurrent FSM, or direct communication with agents — it is wrong and
has drifted from the Foundation. The binding shape:

```
Project Engine = Kernel mechanism
Project Map    = governed state
Slicer         = authorized Workflow
AI             = temporary proponent
Pilot          = authority
```

## Consequences

- The standing engineering rules the programme creates are ADR-0023.
- Each phase lands as independent committed+pushed slices; every slice
  states the invariant and CEO decision it serves and answers ADR-0020 §8's
  five questions.
- The Slicer/child-projects area (Phase 4B) is explicitly recognized by the
  Pilot as a potential Pandora's box: approved, but its first design is not
  final; unresolved questions and counterexamples are recorded, not hidden.
- Do not redesign AgentOS under cover of this programme; the Foundation and
  the authority line are preserved.
