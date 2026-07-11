# CURRENT

## Mission
Build AgentOS — an operating system for reusable human expertise.

## Current Heading
Foundation Revision 2 — consolidation.

## Current State
Foundation documents refined from skeleton (Rev 1) to substantive (Rev 2):
- All terminology defined (roles / runtime / expertise capture / state / governance).
- Conceptual architecture written: 5 layers, canonical flow, invariants, explicit
  deferred decisions.
- ADR process operating: template + ADR-0000/0001/0002 accepted.
- Roadmap phased with exit criteria; Phase −1 closed, Phase 0 in progress.
- Incubator ideas structured with promotion path.

## Major Decisions
- Repository remains private.
- Architecture before implementation (ADR-0000).
- Navigation is the Pilot/Copilot compass (ADR-0001).
- Mentor Expertises replace personas (ADR-0002).
- GuruSeeds represent reusable heuristics (definition fixed in TERMINOLOGY).

## Open Questions
- **Brand** — is "AgentOS" the final name? (Generic; collision risk. Pilot decision.)
- **Seed lifecycle** — draft → active → refined → retired is sketched in
  TERMINOLOGY; needs its own design doc + ADR before Phase 5.
- **Mentor evolution** — how Expertises version and improve over time; depends on
  Phase 4 composition model.
- **Deployment model** — local-first vs. server (deferred in ARCHITECTURE.md).

## Next Bearing
Close remaining Phase 0 exit criteria (see ROADMAP): resolve or formally defer the
open questions above, then declare Foundation complete and open Phase 1 (Kernel)
with its first design ADRs.

## Last Updated
Session 002 — Foundation Revision 2.
