# CURRENT

## Mission
Build AgentOS — an operating system for reusable human expertise.

## Current Heading
Foundation Revision 8 — Book I complete + Book II charter (Chapter VI). Next stop: code.

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
- **Repo visibility** — currently PUBLIC, contradicting the Session 001
  decision. Revert to private, or supersede by ADR + scrub business details.

## Open Questions — dispositioned at Phase 0 close
- **Brand** — DEFERRED by the Pilot; "AgentOS" remains the working name.
  Revisit before anything becomes public.
- **Seed Resolver determinism** — DEFERRED to a design ADR owed before the
  scheduler matures (Phase 3).
- **Seed lifecycle** — DEFERRED to a design ADR owed before Phase 6 seed
  evolution; founding 7-state sketch is the working draft.
- **Deployment model** — DECIDED: local-first, file-based, running via Claude
  Code on the Pilot's machine (Session 004).
- **Stack** — DECIDED: TypeScript strict engine + Tool Runner for
  language-agnostic tools, Python first; native only where measured
  (ADR-0010, Session 004).
- **Marketplace vs. single-Pilot** — DEFERRED; blocks only the Marketplace
  idea leaving the Incubator.

## Next Bearing
First: a Constitution improvement pass (Pilot's instruction — polish the eight
articles before any code). Pilot also flagged: revisit the structural criteria
rejected in the SavePoint review when indexing work begins. Then CODE. Phase 1 (Kernel): file-based stores, work orders, audit log, effort
metering v0, zero domain words in the engine (ADR-0008) — via Claude Code on
the Pilot's PC. Then Phase 2: the daily Executive Loop with Seed Composer v0
and Mentor management v0. Roadmap (Chapter V) is the build plan.

## Last Updated
Session 004 — ADR-0010 (stack) ratified. Phase 1 unblocked: next session writes kernel/.
