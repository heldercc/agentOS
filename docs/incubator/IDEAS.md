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
