# ADR-0015: The Beta 2 Governance Question

- **Status:** Ratified (by the Pilot, Session 006 — "siga tudo fast";
  registered one-line concession: rig construction starts immediately, not
  waiting for Beta 1's run to be underway, since Beta 1's unblocker is the
  Pilot's own data and the rig work is independent)
- **Date:** 2026-07-12
- **Deciders:** Pilot (direction ordered in Session 006) + Claude Fable 5 (draft)
- **Related:** Grand Objectives A/B (docs/OBJECTIVES.md), O1, O4, O5, ADR-0009
  (Seed Harvester), ADR-0012 (the discipline this ADR copies), ADR-0013 (the
  port it runs on)

## Context

Beta 1 (ADR-0012) tests Grand Objective A's riskiest bet: the Context
Scheduler. Grand Objective B — taste governance by clicks — has no experiment
yet. Its bet is different and also falsifiable: that the Pilot's click
decisions in the UI (approve / reject / select among proposals) are a strong
enough signal to measurably steer future proposals, without API fine-tuning,
without m2m automation — selection evidence distilled into candidate seeds
that only the Pilot admits (O4 + O5, at miniature scale).

The Session 006 order: real simulations, iterated by the Pilot in the Beta 1
UI (the dashboard is the disposable sketch of the App shell). Same discipline
as ADR-0012: the question freezes before the first line of code.

## The Question

> **Can governed selection measurably improve what the system proposes —
> with taste captured as seeds, entirely through clicks in the UI?**

## Rigor parameters (frozen before code)

1. **The signal.** Every Pilot click is logged as evidence: approve, reject,
   and — where multiple proposals are shown — which was selected. Proposals
   are judged **in isolation first** (pointwise-before-pairwise seed: the
   comparison protocol can fabricate the winner), comparison after.
2. **The learning path.** Repeated selection patterns are distilled into
   **candidate seeds** presented to the Pilot with their evidence (ADR-0009
   mechanics, miniature). Nothing is admitted automatically — O5 holds. No
   API fine-tuning, no preference model: the "learning" is seeds + selection
   statistics, embedded in the app (ADR-0013 boundary).
3. **Measured improvement.** Across N governed iterations of realistic tasks
   (same corpus family as Beta 1): (a) approval rate trend, (b) iterations
   until approval per decision, (c) at least one candidate seed harvested
   from selection evidence and admitted by the Pilot's explicit decision,
   with provenance saying so (O4's proof, small).
4. **Scale.** One objective, 5–10 governed decisions, iterated across
   multiple days/sessions — the loop, not the volume, is what is under test.

## Committed exits (before the ball is kicked)

- **"No"** — clicks alone are too weak a signal; taste capture needs the
  richer Seed Composer path (O3) as primary. The App design changes; Article
  6 exists for this.
- **"Yes"** — Grand Objective B has a proven miniature; the Executive Mode
  ADR inherits a working loop instead of a hope.
- **"Depends"** — the map of where selection-learning works (e.g., layers
  with clear repetition) and where it does not (e.g., one-off creative
  choices). The map feeds the App shell ADR.

## Anti-moving-goalposts rule

As in ADR-0012: these parameters and exits freeze at ratification. Nobody —
Pilot, Claude, Copilot or other — redefines "improve", "signal" or the
success criterion once results start arriving.

## Alternatives considered

- **Preference fine-tuning via API** — rejected: violates the ADR-0013
  boundary and the Pilot's standing human-in-the-loop doctrine; also makes
  taste vendor-locked, against O6 (the asset must be portable seeds).
- **Wait for the full App shell** — rejected: Article 6 wants the risky bet
  tested small first; the dashboard already exists as the disposable UI.
- **Fold into Beta 1** — rejected: ADR-0012's question is frozen; mixing a
  second variable into a sealed experiment would contaminate both answers.

## Consequences

- Order preserved: **Beta 1's real run remains first** — same unblocker (the
  Pilot's real fight-scene corpus), and its rig is the substrate Beta 2
  extends. Beta 2 code (experiments/beta-governance/) may begin once this
  ADR is ratified and Beta 1's run is underway.
- The dashboard grows the governance loop surface (proposals, clicks,
  evidence log, candidate-seed tray) — still a disposable sketch, still
  experiments/, not engineering/ (promotion only via the Executive Mode ADR).
- We commit to logging every governance click with provenance from day one —
  the audit trail is the experiment's raw data.

---
*Second question of Book II. Grand Objective A got its experiment first
(ADR-0012); this is Grand Objective B's.*
