# Incubator

Ideas that are alive but not committed. Promotion path: *incubating → candidate →
roadmap (via ADR)*. Ideas here have no exit criteria and create no obligations.

## AgentOS Lab — incubating

A sandboxed space inside the system where the Pilot can run Workflows against
experimental seeds/Mentors without touching production state. Cheap A/B for
expertise: same task, two seed sets, compare Artifacts.

## Automatic Seed Evolution — PROMOTED to roadmap (ADR-0009)

Promoted per the Incubator's own path (incubating → candidate → roadmap via
ADR). Now lives as the Seed Harvester: ADR-0009, Objective O4, Phase 6.

## Mentor Marketplace — candidate

If Mentor Expertises are truly portable bundles, they can be shared or sold between
owners. Big open questions: trust model, seed provenance across owners, and whether
owner-centric design (see VISION non-goals) survives multi-party expertise. Parked
until Phase 4 proves the Expertise format.

## Sub-agent Hierarchies — incubating

Mentors orchestrating subordinate executor agents (the implicit structure in the
rejected Revision 3 chain). Would introduce a second actor class; requires its
own governance story (who audits the subordinate?). Not a Foundation concept.

## Effort Probe ROI Modeling — incubating

An economic layer over the Effort Probe: quality gain per unit of effort,
portfolio-level "is this workflow worth automating?" analysis. Depends on a
calibrated probe (ADR-0006) producing enough estimate/actual pairs. Research
until then; the word "ROI" stays out of core documents until the probe earns it.

## Executive Health Check — incubating

Founding-session idea: Executive Mode surfaces project health indicators —
budget burn vs. estimate, seed hit-rate, stale open decisions, drift signals.
A dashboard for governing, not working. Natural Phase 2+ extension; recovered
via the founding knowledge export (Session 004).

## Senior Knowledge Capture (factories) — incubating, parked by Pilot

Point the engine at retiring senior experts in industrial SMEs: Seed Composer
as interview tool, their heuristics captured as validated seeds before they
walk out the door. Real market, hard extraction problem. Parked by explicit
Pilot decision (Session 004) — focus stays on the agnostic engine; candidate
for the Phase 5 vertical alongside the fiscal niches.


## Seed Hygiene Checklist — incubating (harvested insight)

From the rejected knowledge-ops skill: seed stores rot like SOP wikis — no
owner, no last-reviewed date, vague success signals, orphans, glossary drift.
The seed lifecycle ADR inherits this failure-mode checklist. (Review:
2026-07-REVIEW-SKILL-IMPORT.)

## Skill Import via Composer — incubating

SKILL.md (agentskills.io standard) → GuruSeed/Expertise import flow in the
Seed Composer; format is ~80% compatible. Design in Phase 2; origin
`imported`, always through the gate.

## Expertise: Cozinha da Maria Rolanda — incubating (first family expertise)

The Pilot's mother is a genuinely great cook; her decades of kitchen judgment
should live in the system. First real application of the interview-mode Seed
Composer (see Senior Knowledge Capture): capture the *judgment* — heuristics,
timing calls, ingredient triage — knowing the embodied craft stays with her.
Seeds with provenance `taught by: Maria Rolanda`. Candidate for the first
taught-Expertise once the App's daily loop exists; family heritage
preservation as the most honest test of the founding thesis.

## Researched Seeds — the fertile first garden — incubating

The Pilot's metaphor (2026-07-11): a project's first garden grows faster on
fertile ground. Before a project starts, a **Research Mentor** surveys the
state of the art of each craft dimension the project will touch (for the
first cargo: writing, costume, makeup, and the existing layers — story,
characters, shots, style, production) and proposes **candidate seeds** that
form the project's base layer.

Constitutional fit — clean, with three conditions already in doctrine:
1. **One gate (O5):** the agent *proposes*, never plants. Candidates arrive
   with evidence; the Pilot curates. The proven filter is the curation
   doctrine — só as pingas douradas (0.6% acceptance is a feature).
2. **Provenance by reference (Article 3):** every researched seed carries its
   sources. Origin taxonomy stays small: `imported`, sub-provenance
   `researched by <Mentor> from <sources>` — the seed lifecycle ADR decides
   the exact encoding.
3. **Separation of judgment:** researched seeds are commodity knowledge — the
   project's *soil*, not the Pilot's differentiated judgment (GuruSeeds).
   They must never masquerade as the owner's taste; origin makes the
   difference inspectable.

Timing: natural fit for Phase 4 — the layer Mentors could be *born* with a
researched base layer. Needs the Seed Composer intake (Phase 2) and the seed
lifecycle ADR first. Complements, not replaces, taught (O3) and learned (O4):
three acquisition pipelines, one gate.

## Multimodal Expertise Interview Pipeline — incubating (unifier)

One pipeline, many faces: person + environment + camera/audio capture +
interview questions → transcription (e.g. Whisper, local) → candidate seeds →
the Pilot's gate. Environment-agnostic by design; output is always the same —
validated seeds with provenance (`taught by: <person>`). Unifies three
incubator ideas: Cozinha da Maria Rolanda, Senior Knowledge Capture, and
skill interviews of any expert. Capture on phone, processing at the factory
(PC), tools in Python via the Tool Runner (ADR-0010). Execute at the right
moment — after the vertical experiment and the daily loop; raw material
(recordings) can be gathered before the factory exists.
