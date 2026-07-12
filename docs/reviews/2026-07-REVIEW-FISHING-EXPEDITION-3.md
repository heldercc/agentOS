# Review — Fishing Expedition 3: the ADR-0015 waters (GPT net + Pilot interview)

Session 006, late. The external Copilot (GPT) fished specifically around the
Beta 2 governance question with its own manifest (3 trawlers × 8 queries + 4
camera queries, 25 raw candidates, 13 mechanism families, 6 camera finalists,
€0 observed cost, honest disclosure that no real cheap/strong cascade ran).
The Pilot then interviewed the catch live and reframed it in engineering
terms before handing it to the gate. That interview did the heaviest lift —
see "The Pilot's reframe" below.

**Tally: 6 candidates → 0 admitted as seeds, 3 absorbed into ADR-0016
(instrumentation controls, implemented same session), 3 research notes.**
Zero seeds is not a poor catch: per the expedition-1 precedent, findings
whose use *begins with a specific design* go to that design, not to
expertise/. All three actionable finds landed in an ADR the same night.

## Gate note on the report itself

- The report's "canonical state" was stale: it read origin/main at `39ab16d`
  and called ADR-0015 *Proposed*. By gate time the ADR was ratified and its
  rig built and verified (`6ff260c`). The catch survives this: **no real
  evidence has been collected yet** (only scripted smoke runs; the Pilot has
  not judged anything), so adding instrumentation now moves no goalpost —
  the frozen question, parameters and exits of ADR-0015 are untouched.
  ADR-0016 records this timing argument explicitly.
- Sources were spot-checked at the gate: Nature Human Behaviour (human–AI
  feedback loops amplifying bias), Gupta/Oosterhuis/de Rijke (selection bias
  in explicit elicitation), METR Feb-2026 (task-selection effects), HiAgent
  (ACL 2025), Jain et al. (LLM-judge specificity). Plausible and consistent
  with the claims; the three absorbed into ADR-0016 stand on mechanism, not
  on any single paper.

## The Pilot's reframe (registered — it is the doctrine here)

The catch's strongest find arrived framed psychologically ("the loop can
train the Pilot"). The Pilot rejected the framing — "somos engenheiros, não
vamos fazer cenas sentimentais" — and the working formulation became:

> **If the evaluator's inputs change during the experiment, the metric stops
> identifying the cause of the improvement.**

An approval-rate rise has at least six candidate explanations (better seeds,
easier tasks, different options shown, different order, abandoned hard
cases, natural drift of the criterion). The cure is instrumentation, not
psychology: log enough to tell the hypotheses apart.

## Absorbed into ADR-0016 (candidates 1–3)

1. **Blind anchor repeats / taste-stability** (Nature Human Behaviour) —
   reduced from "preference anchors battery" to: occasionally re-present an
   already-judged round, blind, reshuffled, excluded from learning; report
   Consistency separately from Improvement.
2. **Choice-set provenance** (Gupta et al.) — a click without its choice set
   proves nothing: log what was shown, in what order, with which seeds
   active, plus rejections and non-answers — not only the selection.
3. **Pre-registered corpus** (METR) — decisions are fixed (committed) before
   the condition runs; refusals/abandonment are outcomes, not discarded
   data; new tasks enter a second cohort, never silently the first.

## Research notes (candidates 4–6) — kept here, no seeds, no components

4. **Co-creator vs editor** (creative-writing experiments) — governance by
   clicks must not reduce the owner to a reactive editor; benefits appeared
   when humans initiated direction. Note for the **App shell / Executive
   Mode ADR**: the loop needs a "Pilot initiates constraints" surface, not
   only pick-from-N. (The pilot-note mechanism added this session is the
   miniature of exactly this.)
5. **Subgoal-boundary memory compaction** (HiAgent, ACL 2025) — summarize
   completed subgoals, keep detail only for the active one; reported 2×
   success and −3.8 steps on long-horizon tasks. Note for the **Scheduler
   evaluation after O7 evidence**; the Beta is too small for it today.
6. **Judge specificity** (Jain et al.) — an evaluator can accept 96% of
   valid outputs while rejecting <25% of invalid ones and still look
   reliable in aggregate; measure acceptance-of-good and rejection-of-bad
   separately, seeding known-bad mutations. Note for **any future automated
   camera/judge**; the Pilot remains the gate today.

## Where the catch confirmed us (no action)

Pilot as final authority; pointwise-before-pairwise already enforced in
code; full-reload as the honest baseline; provenance discipline; knowledge
freshness already held; routing still surface-less; no auto-promotion
anywhere. The net keeps finding our own doctrine in the wild — expedition 2's
lesson repeats.

## Expedition economics

€0 marginal (Pilot's GPT subscription); gate cost concentrated in this
session. Cost per admitted *drop* is undefined this time (0 seeds) — but
cost per **adopted control** was three-for-one gate session, all landed in
ADR-0016 the same night. The fishing pattern's real product this expedition
was experiment design, not expertise.
