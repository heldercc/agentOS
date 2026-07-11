# Reconciliation — Revision 8 vs. External Review

Session 004. Input: external review of R8 (heritage/2026-07-EXTERNAL-REVIEW-R8.md).
Method: verdict per theme; history checked against this repository, which is
the only canon. Result table:

| Theme | Review claimed (as "R4") | Book (R8) | Final decision |
|---|---|---|---|
| GuruSeed vs Seed | "R4 adopted Seed" — **false**; R4 used GuruSeed throughout | GuruSeed | **GuruSeed stays.** Pilot's founding term, provenance in heritage. |
| Resolver requirement | attributable | deterministic | **Attributable & auditable** — determinism aspirational, deterministic *replay* the guaranteed floor. Book corrected; matches Session 003's own risk R3. |
| Project State | smallest sufficient | "everything the system knows" | **Corrected: smallest sufficient description.** Article 8 applied to state. |
| Provenance | material | total/copies | **Corrected: by reference** (IDs/versions). Provenance must never cost more than the work. |
| Third plane name | "R4 chose Records" — **false**; Records was a SavePoint proposal, rejected on record | State Plane | **State Plane stays**; adopted the good nuance — policies per store, not plane-wide. |
| Article 6 | precedes commitment | before implementation | **Amended (ADR-0011, Pilot ratified):** architecture precedes commitment; evidence may revise via ADR. |
| Vendor in roadmap | remove | "via Claude Code" in Phase 1 | **Corrected:** replaceable development operator; vendor lives in Navigation. Own rule (I4) applied to ourselves. |
| O7 metric | vs. full-reload baseline | vs. previous session | **Corrected:** scheduler must beat full reload for equivalent task/quality; tokens avoided, reuse ratio, cost per approved decision. |
| Vision absolutes | soften | "no longer the bottleneck", "forever, near-zero" | **Softened**; claims now defensible and themselves governed. |
| OBJECTIVES.md | keep (reviewer withdrew old objection) | exists | Kept. |

## Process note

Two of the review's premises misattributed its own SavePoint proposals to
"Revision 4". Verified against git history and heritage; recorded without
prejudice — the technical merits were judged independently, and most were
accepted. This is the provenance system doing its job.

## Status after reconciliation

Book I is reconciled and stable. Next commit opens Book II with the single
vertical experiment: one work order · minimal Project State · simple Resolver
· one Mentor · one Artifact · real metering · full-reload vs. scheduled
context. The experiment tests the heart before building the factory.
