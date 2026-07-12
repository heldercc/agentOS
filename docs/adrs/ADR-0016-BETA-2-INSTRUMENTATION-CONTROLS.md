# ADR-0016: Beta 2 Instrumentation Controls

- **Status:** Ratified (by the Pilot, Session 006 — "o que podemos fazer se
  for fácil para mitigar este ruído" → agreed control list → "Commita aqui")
- **Date:** 2026-07-12
- **Deciders:** Pilot (interviewed the expedition-3 catch live) + Claude
  Fable 5 (gate + implementation)
- **Related:** ADR-0015 (the experiment this instruments), O4/O5,
  docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-3.md (provenance of all
  three controls)

## Context

ADR-0015's metric (approval rate per round) admits rival explanations: an
improvement can come from better seeds — or from easier tasks, different
options shown, different presentation order, abandoned hard cases, or
natural drift in the owner's criterion. Expedition 3 surfaced the mechanisms
(selection bias in elicitation, task-selection effects, evaluator drift);
the Pilot reframed them in engineering terms: **if the evaluator's inputs
change during the experiment, the metric stops identifying the cause.**

Timing legitimacy: ADR-0015 is ratified and its rig built, but **no real
evidence exists yet** (only scripted smoke). Instrumenting now redefines
none of ADR-0015's frozen terms — "improve", "signal" and the exits stand.
This is the last legitimate moment; after real verdicts arrive, adding
controls would look like moving goalposts. Hence this ADR tonight.

## Decision

Instrument the Beta 2 evidence log so rival explanations are separable.
Four controls, all instrumentation, zero new components:

1. **Choice-set provenance.** Every generated round appends a `present`
   event: the options shown (letters + content hashes), their display order,
   and the active learned-seed versions. A click is only evidence relative
   to what was on the table.
2. **Recorded order randomization.** The blind letter assignment is already
   a per-round deterministic shuffle; the `present` event records the order
   so position effects are analyzable ("A wins often" must be
   distinguishable from "first wins often").
3. **Blind anchor repeats, excluded from learning.** Occasionally an
   already-closed round is re-presented blind with a reshuffled mapping.
   Anchor events carry `anchor:true` and are invisible to the distiller and
   to the improvement metrics. They feed one number only: **Consistency**
   (does the same winner win again?), reported separately from
   **Improvement** (approval rate / rounds-to-selection on new work). The
   two are never mixed into one score.
4. **Pre-registered corpus per cohort.** The decision set is committed (git)
   before its condition runs. Refusals and abandonment stay in the log as
   outcomes. New decisions enter a labelled second cohort, never silently
   the first.

## Alternatives considered

- **Psychological modelling of the owner / bias-detection component** —
  rejected by the Pilot on the spot: engineering, not sentiment; also
  Article 8.
- **Inverse-propensity weighting and statistical correction by default** —
  rejected: first measure whether the bias exists; correcting an unmeasured
  bias is a new bias.
- **Do nothing until Beta 2 results look suspicious** — rejected: after real
  verdicts, adding controls is goalpost-moving; before them, it is free.

## Consequences

- The evidence log grows two event kinds (`present`, anchored verdicts) and
  a `pilot_note` channel (the owner initiating direction, not only picking —
  expedition-3 note 4 in miniature). Distiller and metrics filter anchors.
- Metrics split permanently into Improvement vs Consistency.
- The smoke suite proves all of it at zero cost, same discipline as before.
- Analysis gains work later (someone must actually read the order/position
  data); accepted — logging now costs nothing, reconstructing later is
  impossible.
