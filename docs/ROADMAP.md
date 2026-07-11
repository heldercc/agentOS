# Chapter V — Roadmap

The destination is fixed (Navigation): the **AgentOS App** — a governance
cockpit where the Pilot launches objectives, governs per-layer proposals
daily, creates and improves the workers themselves, and the scheduler reuses
every decision already made. The engine is product-agnostic (ADR-0008); the
first cargo is the 15-second fight spec, whose terminal Artifact is a
**Render Order**.

What the code must prove is fixed in Chapter VI (OBJECTIVES.md); phases
below are the order of construction. Phases are sequential in commitment,
overlapping in exploration. A phase
closes when its exit criteria are met and recorded in Navigation.

## Phase −1 · The Why ✔
VISION and Constitution stable. *(Closed — Session 001.)*

## Phase 0 · Foundation ✔
Vocabulary, conceptual architecture, decision process, Navigation proven
across sessions, open questions dispositioned. *(Closed — Session 004,
Revision 7. Deferrals recorded in CURRENT.md.)*

## Phase 1 · Kernel (minimum honest engine)
File-based stores (seeds, Project State, Mentors-as-data, Artifacts), work
orders as files, audit log, effort metering v0 (measure actuals; estimation
comes later). Runs via Claude Code on the Pilot's machine — local-first.
**Exit:** one work order flows end-to-end — authorized, executed, metered,
audited — with the engine containing zero domain words.

## Phase 2 · Executive Loop (the daily App)
The governance cycle: open the app → Kernel loads Project State → open
decisions presented per layer → Pilot evaluates / approves / deletes →
Mentors work the consequences → tomorrow, new proposals. Seed Composer v0
(teach in natural language). Mentor management v0 (create / edit / improve /
retire workers through governance — ADR-0008).
**Exit:** the Pilot governs a full daily cycle, including editing a Mentor,
without touching internals or writing formats.

## Phase 3 · Scheduler & Reuse
Context scheduling in earnest (Article 5): approved decisions, seeds and
state are resolved into working context instead of re-consumed; token spend
per session measurably drops as the Project State grows. Effort Probe gains
estimation + calibration (ADR-0006).
**Exit:** session N+1 costs less than session N for equivalent governance,
and the audit log proves why.

## Phase 4 · Production Line 1 — the Render Order
The fight spec as cargo: layer Mentors (story, characters, shots, style,
production) propose; the Pilot governs daily; the Render Order accumulates
with full provenance.
**Exit:** Render Order v1 — complete enough that a rendering system the
engine has never met could execute it.

## Phase 5 · The Agnosticism Proof
A second, unrelated objective (candidate: a fiscal vertical, e.g. FIZ para
TVDE) runs through the same engine: new Expertises and seeds, **zero Kernel
changes**.
**Exit:** the proof holds, or every violation becomes an ADR that removes
domain leakage from the engine.

## Phase 6 · Self-Improvement Under Governance
The Seed Harvester in production (ADR-0009): success signals → candidate
seeds with evidence → Pilot validates → incorporation into Mentors or the
system, provenance `learned`. Plus system-proposed Mentor and workflow
refinements — always proposals through Executive Mode (Articles 1, 2, 4).
**Exit:** Objective O4 proven — at least one harvested seed in active use,
integrated by explicit Pilot decision, plus one measured improvement.

## Rendering (deliberately outside the roadmap)
Executing a Render Order is a swappable downstream step (ComfyUI/Wan today,
anything better tomorrow). It gets planned when Render Order v1 exists —
not before.
