# Architectural Review — Foundation Revision 3

Reviewer: second Chief Systems Architect (Copilot, Session 003).
Scope note: Revision 3 was reviewed as specified in the architect brief
(layer chain, Effort Probe, Constitution, Navigation doctrine); the Revision 3
file tree itself was not available to this session.

Mandate: strengthen without complicating. Findings are blunt by request.

## 1. Architecture Risks

**R1 — The Kernel is quietly becoming the whole system.** Work orders, budgets,
approvals, audit, versioning, and now context scheduling *and* effort
estimation. Each addition is individually justified; together they threaten the
"small and boring" goal. Mitigation adopted: the Kernel *owns* these duties but
delegates mechanisms (Seed Resolver resolves; the Probe estimates; the Kernel
only decides and records). Watch this line in every Phase 1 ADR.

**R2 — The Effort Probe can become theater.** "Expected quality gain" and "ROI"
sound rigorous and are, initially, guesses. An uncalibrated probe that prints
confident numbers is worse than no probe: it launders speculation into
authority. Mitigation adopted: calibration loop is constitutive (ADR-0006), and
speculative outputs must carry ranges and confidence. If calibration proves
impractical, cut the speculative fields — keep tokens/time, drop ROI.

**R3 — Determinism of the Seed Resolver is asserted, not designed.** "Selection
is deterministic and logged" is easy to write and hard to build if resolution
ever involves a model. This is the single most load-bearing unproven claim in
the book. It owes a design ADR before Phase 4, and the honest fallback
(deterministic *replay* via logged selection, even if selection itself is
stochastic) should be considered there.

**R4 — Single-Pilot assumptions are everywhere.** Ownership, approval, teaching
all assume one human. Fine — it is a declared non-goal to generalize — but the
Mentor Marketplace idea (Incubator) quietly contradicts it. Either the
Marketplace dies or the single-Pilot assumption gets a boundary. Not urgent;
must be resolved before the Marketplace leaves the Incubator.

## 2. Architectural Inconsistencies Found (and resolved)

**I1 — The Revision 3 layer chain.** Kernel → Mentor → Expertise → Seed Resolver
→ Agents → Artifacts → Project State → Memory → Navigation is a list, not an
architecture: actors, configurations, mechanisms, outputs and stores in one
hierarchy, with an arrow that changes meaning at every step. Rejected;
replaced by three planes sorted by kind (Chapter IV records the rejection so it
is not re-proposed in two years).

**I2 — Mentor vs. Agent.** Revision 2 defined Mentors as the primary Agents; the
Revision 3 chain placed Agents *below* Mentors, implying subordinate executors
— a second actor class introduced by diagram, without a decision. Resolved:
Agent is the generic term; the Mentor is the only Agent in the Foundation;
sub-agent hierarchies go to the Incubator. (Noted irony: a project named
AgentOS whose foundation needs the word "Agent" almost nowhere. This feeds the
open Brand question.)

**I3 — Navigation inside the runtime.** The chain placed Navigation below
Memory, as if the running system depends on it. It does not: Navigation is the
instrument for *building* AgentOS. Confusing the project with the product would
haunt every future diagram. Resolved: Navigation sits explicitly outside the
planes.

**I4 — A named Copilot in a founding document.** "Navigation is the memory
between Pilot Helder Costa and Copilot ChatGPT" fails the ten-year test and was
already false the day it was written — Session 002 ran with a different
Copilot. The entire point of Navigation is that Copilots are fungible. Resolved:
roles are named, vendors are not; session logs record which Copilot served,
as history.

**I5 — Executive Mode vanished from the chain.** The Pilot's entire surface was
absent from the Revision 3 structure. Resolved: Executive Mode is defined as
the Kernel's face — governance rendered — not an independent layer.

**I6 — VISION and MANIFESTO said the same thing twice.** Same thesis, different
rhetoric. Duplication in a founding book is a maintenance debt and an invitation
to drift. Resolved: merged into Chapter I; the Manifesto's voice survives in the
"two observations" opening.

## 3. Move to the Incubator

- **Sub-agent hierarchies** (Mentors orchestrating subordinate executors) — the
  implicit idea inside the Revision 3 chain. Real, possibly valuable, not
  Foundation.
- **ROI modeling for the Effort Probe** — keep tokens/time/refinement estimation
  in core; the economic model of "quality gain per euro" is research, not
  foundation.
- Already resident, still correct: AgentOS Lab, Automatic Seed Evolution,
  Mentor Marketplace (now with the R4 dependency noted).

## 4. Should Become ADRs

Written this session: ADR-0003 (context is a scheduled resource), ADR-0004
(Constitution supersedes Principles), ADR-0005 (Seed Resolver), ADR-0006
(Effort Probe). Owed, and named in the book as debts:

- Seed Resolver design: determinism or deterministic replay (before Phase 4).
- Effort Probe estimation and calibration mechanics (before Phase 1 completes).
- Seed lifecycle (before Phase 5).
- Deployment model: local-first vs. server (before Phase 1 code).

## 5. Should Become Constitution Articles

Adopted as Article 5: *Context Is Scheduled, Not Repeated* — the brief's central
motivation deserved constitutional rank, not a paragraph in a vision statement.
Considered and **not** elevated: "Version everything" and "The Kernel governs
effort" — these are engineering invariants, exactly what ADR-0004 says should
not be constitutionalized. Seven articles is a good number; resist growth.

## 6. Remove Entirely

- The Revision 3 layer-chain diagram (kept only as a recorded rejection).
- MANIFESTO.md and PRINCIPLES.md as files (content merged/superseded; lineage
  recorded in Chapters I–II and ADR-0004).
- Any vendor name outside session logs.
- The word "ROI" from core documents until the probe earns it.

## Verdict

Revision 3's instincts were right — context scheduling as the founding
motivation, a Constitution over a rules list, estimation over accounting, and
the Resolver rename are all improvements. Its structure was wrong: the chain
flattened distinct kinds into a fake hierarchy, and two founding-document
mistakes (a vendor name, a missing Pilot surface) needed removal. Revision 4
keeps every good idea and none of the shape.
