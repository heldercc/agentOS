# CURRENT

## Mission
Build AgentOS — an operating system for reusable human expertise.

## Current Heading
Foundation Revision 4 — the Foundation Book.

## Current State
Foundation restructured as a book (why before how). Constitution (7 articles)
supersedes Principles; context-scheduling elevated to Article 5 and ADR-0003.
Architecture consolidated into three planes + Navigation outside the runtime;
the Revision 3 linear chain reviewed and rejected on record. Effort Probe
supersedes Cost Probe with a constitutive calibration loop. Seed Resolver
renames InjectSeed. VISION absorbed MANIFESTO. Full review in
docs/reviews/2026-07-REVIEW-OF-REVISION-3.md.

## Major Decisions
- Repository remains private.
- Architecture before implementation (ADR-0000; Article 6).
- Navigation is the Pilot/Copilot compass — Copilot-agnostic (ADR-0001).
- Mentor Expertises replace personas (ADR-0002).
- Context is a scheduled resource (ADR-0003; Article 5).
- Constitution supersedes Principles (ADR-0004).
- Seed Resolver renames InjectSeed (ADR-0005).
- Effort Probe supersedes Cost Probe (ADR-0006).

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
Close Phase 0: resolve or formally defer the open questions, then declare the
Foundation complete and open Phase 1 (Kernel) with the deployment-model and
Effort-Probe design ADRs.

## Last Updated
Session 003 — Foundation Revision 4.
