# ADR-0020 — Reconciliation: the Foundation Is Sovereign

- **Status:** Ratified (the Pilot's audit and directives, Session 010,
  2026-07-12 — measures 1–8; implemented starting the same session)
- **Pole:** both, by restoration: (A) context scheduling now includes human
  expertise resolution; (B) governance now produces leverage, not burden.
- **Doctrine:** Book I (VISION, CONSTITUTION, ARCHITECTURE) — sovereign;
  docs/FOUNDATION-CORRECTION.md; docs/GOVERNANCE-INTERACTION-MODEL.md;
  docs/HUMAN-INTELLIGENCE-LIBRARY.md; the audit in
  docs/reviews/FOUNDATION-TO-PRODUCT-GAP-AUDIT.md.

## Question

The product shell works — and drifted. It shipped the peripheral circuit
(workflow, questions, state, runtime, artifacts) without the central organ
(reusable human intelligence, resolved per Work Order, provable in every
artifact). New doctrine accumulated in parallel to the Foundation instead of
under it. How is sovereignty restored without discarding what works?

## Decisions

### 1. The Foundation is sovereign; later doctrine is application

Book I (VISION, CONSTITUTION, ARCHITECTURE, TERMINOLOGY) remains the
constitution. OPERATING-MODEL.md, PRODUCT-LOOP.md, FOUNDATION-CORRECTION.md
and GOVERNANCE-INTERACTION-MODEL.md are hereby positioned as applications of
the Foundation — where any of them conflicts with Book I, Book I wins unless
an explicit ADR revises Book I first (Article 6: evidence may revise
architecture through explicit decision, never by fait accompli). This ADR is
the reconciliation the shell should have had before calling itself a product.

### 2. The minimum complete product is redefined

The AgentOS minimum is NOT `intent → questions → state → execution →
artifact`. It is:

intent → resolve project context → **resolve human expertise** → assemble
governed Work Order → execute through temporary model role → return artifact
**with provenance** → Pilot judges → **candidate human learning** → Pilot
admits/scopes/rejects → **admitted expertise affects later work**.

Without the second half, the shell is a governed executor — not the
accumulating brain that was founded. No loop may be declared complete without
expertise scheduling. (ADR-0018's "no seeds yet" admission is hereby
recognized as having disqualified the completeness claim.)

### 3. Article 9 is clarified

Article 9 (Certainty Precedes Action) governs **governing intent**, not
completeness. The operational rule:

- **Material, blocking uncertainty** → ask (a Clarification Question).
- **Non-blocking uncertainty** → proceed and record an explicit assumption
  the Pilot can inspect and overturn.
- **The Pilot may declare context sufficient at any time** — "enough; build
  with what you have and show the assumptions" is a first-class governance
  act, and the system obeys it.
- The system never needs 90% certainty about everything; it needs it about
  what the Pilot is governing. Interviews that pursue completeness are a
  failure to digest the project (GOVERNANCE-INTERACTION-MODEL).

### 4. Workflow legibility is an invariant

A capability is not governed if the user cannot perceive its path and state
through the product. The project page must permanently answer: Where am I?
What happened? What needs me? What happens next. The eight questions of the
Foundation Correction are the acceptance test. Navigable areas: Overview,
Journey, Work & Outputs, Human Intelligence, Artifacts & Decisions.

### 5. The Decision Surface is a first-class concept

As defined in GOVERNANCE-INTERACTION-MODEL.md: the Kernel's governed
presentation of one consequential choice — distinct options, assumptions,
trade-offs, recommendation, expertise applied, refinement capability,
provenance, and the Pilot's final choice. Only the Kernel addresses the
Pilot through a Decision Surface; agents never present themselves directly.

### 6. Naming: Mentor, not "expertise agent"

The user-authored, evolving composition of GuruSeeds is a **Mentor**
(ADR-0002 vocabulary, restored). A Mentor is human intelligence with a name
— e.g. a director-Mentor the Pilot builds and enriches over time — and the
product shows which Mentor shaped which option. A Mentor is NOT an AI agent:
temporary model roles remain vessels; the Mentor is what they carry.

### 7. Placement and privacy of the library

The Human Intelligence Library materializes at `product/human-intelligence/`
per HUMAN-INTELLIGENCE-LIBRARY.md (seeds/, mentors/, tools/, workflows/,
candidates/, retired/, index/). Because this repository is PUBLIC and
GuruSeeds are the owner's personal judgement, the library folder is
**gitignored here** — it is its own git-able unit on the Pilot's disk.
Surfaced explicitly for the Pilot's decision (nothing silent): if he wants
it versioned, `git init` inside it or a private repo are both compatible;
the engine treats the folder as canonical either way.

### 8. Product freeze (Measure 1) and conformance gates (Measure 8)

Until the Human Intelligence slice is complete: no new agents, panels,
metrics, automatisms, runtime generalization or visual decoration — only
grave defects and the corrective slice itself. Every product commit must
answer, in its message: (1) which Foundation article/invariant it serves;
(2) what human context becomes visible or reusable; (3) whether the user
can perceive the change without logs; (4) whether any architectural decision
was introduced silently; (5) whether it improves AgentOS or merely makes a
generic workflow app. No convincing answers → no commit.

### 9. ADR-0019's store is superseded, not discarded

The flat expertise store (ADR-0019) was the right instinct with the wrong
grain. It is superseded by GuruSeeds (the unit), Mentors (the composition)
and the Seed Resolver (per-Work-Order selection with reasons). Its proven
pieces — user-only admission, the appliedIn trail, manifest visibility —
carry forward unchanged in spirit. Existing records migrate mechanically.

## Consequences

- The corrective slice (Measure 5) is the only product expansion allowed:
  reject/refine → candidate GuruSeed → Pilot edits/admits → Resolver selects
  it → manifest records version+reason → temporary role applies it →
  artifact declares provenance → UI shows "human intelligence used" →
  the Pilot evaluates → evidence returns to the seed.
- The Songoku Beta resumes only after that slice works.
- The rig stays frozen; its distiller remains the future automatic SOURCE of
  candidates — the slice builds the governed path first.

## The orienting sentence

AgentOS is not complete when it can produce an artifact. It is complete when
it can produce an artifact applying governed human intelligence, show the
user how it did it, and learn again from their judgement.
