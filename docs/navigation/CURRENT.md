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
slice is BUILT and its MECHANICS are proven on the real cli runtime
(Session 011, diary addendum 11; declaration corrected in addendum 12):
GuruSeeds + Senseis (then Mentors) on disk in the gitignored product/human-intelligence/
library, per-Work-Order Seed Resolver with reasons, Decision Surfaces,
artifact provenance sidecars, evidence returning to the seed, the "Chega"
sufficiency act, Inteligência Humana UI. Provenance is IMMUTABLE (Session
012): recoverable version history, telemetry in append-only sidecars,
verifiable hashes. THE HUMAN PROOF LANDED (Session 013): the Pilot ran his
first true test alone — a children's story from one messy sentence to a
CONCLUDED project in 100 minutes, "Chega" exercised by his own hand — and
returned a ten-point parecer. Executing it produced the SENSEI REFORM: the
expert entity is the Sensei (ex-Mentor), every seed belongs to exactly ONE
Sensei (transversality is dead), the picked option's victory returns to
the Sensei who voiced it (append-only), graduation derives from use, and
reference Senseis keep a write-once base photo for sanity measurement.
Plus: per-phase effort profile, visible tokens+timer, Pilot-controlled
table size (2–4 options), the 5-craft reference Guild shipped as candidate
seeds, and the read-only metrics extractor. Smoke 88/88. The rigs stay
frozen.

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
selects and improves workers (Senseis); the system proposes detail per layer
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
- Mentor Expertises replace personas (ADR-0002); the entity is canonically the SENSEI since ADR-0021 — CLOSED, no Copilot reopens the name.
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
**The CEO programme (ADR-0022) is the governing order since Session 015:**
PHASE 2 data/transition safety → PHASE 3 module registry + minimal CI →
PHASE 4 Project Engine MVP (a Kernel mechanism — the Pilot's addendum is a
central invariant) → PHASE 5 Compreender/Decidir → PHASE 6 Review/Mode
Edit/Sensei evolution → PHASE 7 verticals (A/B, mobile, video factory,
researched Reference Guild). Hard budget enforcement is EXPLICITLY
deferred (measure and disclose only) until its registered reopen trigger.

The Two Grand Objectives remain explicit (docs/OBJECTIVES.md): (A) token
economy — the Kernel; (B) taste governance by clicks — the user's loop.
The product shell (ADR-0018/0019/0020) is the spine; the rigs feed it
evidence. The earlier order set by the Pilot's + GPT's parecer
(2026-07-12) stays valid INSIDE that programme:
(1) the Pilot decides where the Human Intelligence Library lives durably
(private repo vs local versioned storage with backup — it is gitignored
here and must be shared between Copilots without exposing his asset);
(2) the FIRST TRUE BETA, governed by the Pilot inside the App: the anime
fight with ORIGINAL characters (Aran — no borrowed IP), nothing
pre-authored, the Pilot initiates; the Copilot operates below the
authority line. Measure during it: questions asked vs avoided; context
reused and tokens saved vs full reload; genuinely distinct options; ease
of choosing/refining; time per approved decision; seeds candidate /
admitted / rejected; whether the Pilot can tell which expertise shaped
each Artifact;
(3) fix what the Beta exposes — already owed: semantic question dedup and
role-shaped execution outputs (addendum 8);
(4) the first researched Reference Sensei (e.g. Spielberg-informed
Directing: real sources, claims linked to sources, confidence, scope,
contradictions, admission by the Pilot);
(5) only after that evidence, Kernel v0 specified in engineering/ (Book II).
Still pending: the Pilot judges the 4 real ascensao-t2 rounds at
localhost:4700 + the 2 aggregated questions; Constitution polish pass;
SavePoint structural criteria when indexing begins.

## Sync Doctrine
The Pilot builds multi-agent with GitHub as the shared drive: `origin/main`
is the single shared truth for every Copilot (Claude, GPT, future cloud
agents). Therefore **every commit is pushed immediately** — an unpushed
commit is invisible state and breaks the model. (Pilot's standing grant,
2026-07-12.)

## Last Updated
Session 015 (2026-07-12, late night) — THE CEO PROGRAMME LANDED as one
consolidated work order (the interview the Pilot completed with his
architectural hand): thirty decisions approved, registered as governed law
in ADR-0022 (with the EXPLICIT deferral of hard budget enforcement and its
reopen trigger, and the Pilot's addendum: the Project Engine is a Kernel
mechanism, never a second orchestrator), ADR-0021 (SENSEI canonical and
CLOSED, propagated to every active Book I document) and ADR-0023 (standing
engineering rules A–E). PHASE 1 executed and pushed slice by slice:
product-aware staleness (a docs-only commit never again marks the product
stale — pure-tested acceptance gates), RULE A test isolation by
construction (PRODUCT_WORKSPACE_DIR; smoke → workspace-smoke/, verify →
workspace-verify/; the three scripted projects relocated out of the
Pilot's home, classified, nothing deleted), the Kernel cancel boundary
(OpCancelledError passes intact, WOs record status "interrupted", the
shell's substring hack retired), complete operation visibility (operation
ID, agent, honest phases queued→launching→awaiting-model→response-received
→validating-parsing→persisting, live token count exact/estimated) with
per-operation actuals persisted to operations.jsonl, hardened polling
(monotonic sequence, one in flight, data-error vs connection banners,
poll-logic.ts pure twin), and the PHASE 7D immediate correction (the 20
unsourced Guild candidates quarantined and relabelled honestly; the one
scripted-origin candidate classified). Smoke 112/112, tsc strict, live
proofs on :4901. Next: PHASE 2 (atomic writes, runtime validation,
migration registry, resumable WOs, canonical Seed–Sensei, local security),
then module registry + minimal CI (3), Project Engine MVP (4), Compreender/
Decidir (5), Review/Edit/evolution (6), verticals (7). Detail:
docs/navigation/2026/2026-07.md Session 015; docs/adrs/ADR-0021..0023.

Prior save (Session 014) — the GPT observability parecer: the two blocks
delivered verbatim were executed (the appendix items arrived later as the
CEO programme above; the S014 claim "executed in full" is hereby corrected
to "the delivered blocks executed"): the running version is visible (build
SHA, start time,
staleness vs repo HEAD), the live operation card shows honest phases /
work order N of M / model+effort / heartbeat from real child-process
activity, "Parar esta operação" is a governed halt (operation_cancelled,
actor pilot, completed work orders preserved), polling failure is visible
(a hung fetch never rejects — the banner derives from the age of the last
good poll), no user text is ever lost, and metrics.ts opens with the
TEST-CONDITION DISCLOSURE (the story project testifies: all haiku/low,
30 reconsults vs 4 consults — the runaway interview is now measured).
Smoke 96/96, tsc strict, the 11 browser checks of the parecer pass; the
live :4900 RESTARTED onto 56dee5b and self-reports its build. First
session under the fan-out directive (sonnet implements under spec; the
worker verifies and commits). Owed next from the GPT appendix (arriving
as one consolidated prompt): interview-growth containment, three coherent
questions per submission, aggregated reconsult, mandatory Project Review
on close, Mode Edit. Detail: docs/navigation/2026/2026-07.md Session 014;
docs/reviews/PARECER-GPT-2026-07-12-OBSERVABILIDADE.md.

Prior save (Session 013): the Pilot's first HUMAN test, measured (100 min,
27k tokens, 23 questions, 15 deferred by "Chega", concluded); the SENSEI
REFORM (ownership, victories, graduation, base photo), per-phase effort
profile, 2–4 option control, the 5-craft reference Guild (candidates
awaiting admission), the metrics extractor. ROADMAP: Absorption menu and
system-suggested Sensei evolutions, both Pilot-governed. Detail: addendum
Session 013; docs/reviews/PARECER-PILOTO-2026-07-12-NOITE.md.
