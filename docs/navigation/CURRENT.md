# CURRENT

## Mission
Build AgentOS — an operating system for reusable human expertise.

## Current Heading
The PRODUCT phase is open and the Foundation is SOVEREIGN (ADR-0020, the
Pilot's audit, Session 010): AgentOS is a governed system for capturing,
organising, selecting, applying and evaluating HUMAN intelligence — models
are interchangeable engines, agents are temporary vessels, expertise is the
durable asset. The minimum complete product is redefined: no loop is
complete without expertise scheduling. The corrective Human Intelligence
slice is BUILT (GuruSeeds + Mentors on disk in the gitignored
product/human-intelligence/ library, per-Work-Order Seed Resolver with
reasons, Decision Surfaces, Inteligência Humana UI; smoke 52/52) but not
yet proven on the real cli runtime — that live proof gates everything.
Product freeze holds (ADR-0020 measure 1): only the corrective slice and
grave defects until the gap closes. Then: the Songoku Beta lived INSIDE
the product; the rigs stay frozen.

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
  → stop and interview the Pilot (ADR-0014); clarified by ADR-0020: blocking
  uncertainty asks, non-blocking records assumptions, the Pilot may declare
  context sufficient at any time.
- The Foundation is sovereign; later doctrine is application. Minimum
  complete product redefined around expertise scheduling; Mentor naming
  restored; the Human Intelligence Library is gitignored in the public
  repo — its versioning is the Pilot's private call (ADR-0020).

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
The Two Grand Objectives are explicit (docs/OBJECTIVES.md): (A) token
economy — the Kernel; (B) taste governance by clicks — the user's loop.
The product shell (ADR-0018/0019/0020) is the spine; the rigs feed it
evidence. In order: (1) LIVE PROOF of the Human Intelligence slice on the
real cli runtime — Resolver selecting the migrated seed into a real Work
Order, provenance on the artifact, evidence returning to the seed
(ADR-0020, Consequences: the Songoku Beta resumes only after this);
(2) the Pilot judges the 4 real ascensao-t2 rounds at localhost:4700 and
answers the 2 aggregated questions (Beta 2 evidence, still owed);
(3) the Songoku Beta run INSIDE the product shell (Operating Model §11 —
nothing pre-authored); (4) what kernel.ts proves out gets specified in
engineering/ as Kernel v0 (Book II). Pilot's earlier flags remain:
Constitution polish pass; SavePoint structural criteria when indexing begins.

## Sync Doctrine
The Pilot builds multi-agent with GitHub as the shared drive: `origin/main`
is the single shared truth for every Copilot (Claude, GPT, future cloud
agents). Therefore **every commit is pushed immediately** — an unpushed
commit is invisible state and breaks the model. (Pilot's standing grant,
2026-07-12.)

## Last Updated
Session 011 (2026-07-12, afternoon) — picked up Session 010's thread after
its account ran out of tokens mid-close: verified its Human Intelligence
slice independently (tsc strict clean, smoke 52/52), wrote diary addendum
10, updated this compass. Session 010's substance: the Pilot's
foundation-to-product gap audit, ADR-0020 (Foundation sovereign),
GOVERNANCE-INTERACTION-MODEL + HUMAN-INTELLIGENCE-LIBRARY doctrine, and
the corrective HI slice (hi.ts, resolver.ts, Decision Surfaces,
Inteligência Humana UI). Detail: docs/navigation/2026/2026-07.md addenda
8–10.
