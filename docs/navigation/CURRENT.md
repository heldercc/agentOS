# CURRENT

## Mission
Build AgentOS — an operating system for reusable human expertise.

## Current Heading
Foundation Revision 6 — primary objective registered: the AgentOS App.

## Current State
Copilot transition complete (founding Copilot → current Copilot); founding
knowledge export received, preserved in docs/heritage/ and reconciled
(docs/reviews/2026-07-RECONCILIATION-FOUNDING-SESSIONS.md). Teaching mechanism
restored as Seed Composer (ADR-0007, Proposed). Seed lifecycle upgraded to the
founding 7-state sketch. Repository named Book I of a four-book arc.
Strategic objectives fixed by the Pilot: (2) AgentOS as internal factory
producing vertical products; (3) expertise/case-study itself as a sellable
asset.

PRIMARY OBJECTIVE (Pilot, Session 004 — registered verbatim in intent):
build the **AgentOS App** — a governance cockpit where the Pilot launches an
objective and refines it across many daily sessions. The Pilot creates,
selects and improves workers (Mentors); the system proposes detail per layer
of the work (story, characters, shots, style, production); the Pilot governs —
evaluate, approve, delete — and the cycle restarts, every day. A scheduler
economizes tokens by reusing everything already decided (seeds + Project
State) instead of re-consuming context. First objective to run through the
App: a 15-second anime-style fight scene (original characters; style homage
only). The App's product is not the video — it is the **Render Order**: an
Artifact so complete, after weeks of governance, that any rendering system
can execute it. Rendering is the last worker on the line, deliberately
commoditized and swappable.

## Major Decisions
- Repository remains private.
- Architecture before implementation (ADR-0000; Article 6).
- Navigation is the Pilot/Copilot compass — Copilot-agnostic (ADR-0001).
- Mentor Expertises replace personas (ADR-0002).
- Context is a scheduled resource (ADR-0003; Article 5).
- Constitution supersedes Principles (ADR-0004).
- Seed Resolver renames InjectSeed (ADR-0005).
- Effort Probe supersedes Cost Probe (ADR-0006).

## Pilot Decisions Pending
- **ADR-0007 (Seed Composer)** — approve name and concept, or rename.

## Open Questions
- **Brand** — "AgentOS" is generic, collision-prone, and (noted irony) the
  Foundation barely uses the word Agent. Pilot decision.
- **Seed Resolver determinism** — most load-bearing unproven claim; design ADR
  owed before Phase 4 (see review, R3).
- **Seed lifecycle** — design ADR owed before Phase 5.
- **Deployment model** — local-first vs. server; ADR owed before Phase 1 code.
- **Marketplace vs. single-Pilot assumption** — must be reconciled before that
  idea leaves the Incubator (see review, R4).

## Next Bearing
Phase 0 closes (ADR-0007 ratified in session; remaining questions to disposition).
Phase 1 (Kernel) + Phase 2 (Executive UI) now aim directly at the AgentOS App:
minimal Kernel (work orders, stores, scheduler, Effort Probe) + the daily
governance loop, running via Claude Code on the Pilot's PC. Rendering stack
(ComfyUI/Wan) deferred until the Render Order exists — GPU details parked.

## Last Updated
Session 004 (cont.) — Foundation Revision 6.
