# CURRENT

## Mission
Build AgentOS — an operating system for reusable human expertise.

## Current Heading
Book II open — hypothesis-first. The ADR-0012 vertical slice is built and
verified; the engineering plan is engineering/OVERVIEW.md. What the
hypothesis owes now is evidence: the Pilot's real corpus, one real run, and
the Pilot's blind verdicts.

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
- Repository is public — decided by the Pilot, 2026-07-12; supersedes the
  Session 001 choice. CLOSED: no Copilot re-raises repo visibility.
- Architecture before implementation (ADR-0000; Article 6).
- Navigation is the Pilot/Copilot compass — Copilot-agnostic (ADR-0001).
- Mentor Expertises replace personas (ADR-0002).
- Context is a scheduled resource (ADR-0003; Article 5).
- Constitution supersedes Principles (ADR-0004).
- Seed Resolver renames InjectSeed (ADR-0005).
- Effort Probe supersedes Cost Probe (ADR-0006).
- The Beta Coding question frozen before code (ADR-0012).
- Manual model port — subscription Claude Codes, no API wallet, dev/test only
  (ADR-0013).
- Article 9, Certainty Precedes Action — <90% confidence in governing intent
  → stop and interview the Pilot (ADR-0014).

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
Discharge the Beta (ADR-0012), in order: (1) the Pilot authors the real
fight-scene corpus (data/ placeholders out); (2) review of the authored data
against the corpus-shaping risk (engineering/OVERVIEW.md §6); (3) one real
comparison run through the manual port (dashboard, option 1 in beta.bat);
(4) the Pilot judges blind; (5) RESULTS.md recorded against the three
committed exits; (6) the devil's-advocate review with Fable 5 the Pilot asked
for. Only then: Kernel v0 design ADR (Phase 1). Pilot's earlier flags remain:
Constitution polish pass; SavePoint structural criteria when indexing begins.

## Sync Doctrine
The Pilot builds multi-agent with GitHub as the shared drive: `origin/main`
is the single shared truth for every Copilot (Claude, GPT, future cloud
agents). Therefore **every commit is pushed immediately** — an unpushed
commit is invisible state and breaks the model. (Pilot's standing grant,
2026-07-12.)

## Last Updated
Session 006 (2026-07-12) — Fishing Expedition 2 (GPT net) gated: 10 → 2
admitted (pointwise-before-pairwise, knowledge-freshness), 3 noted, 5
rejected; expertise store at 15. GPT's Trawler+Camera proposal dispositioned:
already our pattern; four zero-infrastructure controls adopted (manifest,
cost-per-admitted-drop, counterevidence queries, dedup at the gate); build
nothing. Net retired until new ADRs open new waters. Next Bearing unchanged:
the Pilot's real fight-scene corpus is still the number-one unblocker.
