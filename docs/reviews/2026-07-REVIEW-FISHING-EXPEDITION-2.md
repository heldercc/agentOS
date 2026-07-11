# Review — Fishing Expedition 2: the GPT net, same three waters

Session 006. Method: docs/navigation/FISHING-PROMPT-FOR-GPT.md (commit
`bc80972`) pasted by the Pilot into GPT — a different model family fishing
the same three waters as expedition 1, with the 21 held findings excluded.
The catch returned as 10 candidates; the standing adversarial gate (Claude,
delegated by the Pilot in-session) examined them against the expedition-1
bar. Marginal cost of the net: ~0 (Pilot's GPT subscription) plus this gate.

**Tally: 10 candidates → 2 admitted (20%), 3 noted to owed ADRs, 5 rejected.**

## Catch quality — findings about the net itself

- **Format violation: no URLs.** The prompt demanded `SOURCE: URL + author or
  organization`; every drop arrived with author+title only. The gate
  independently located and verified the sources of all admitted and noted
  items; rejected items were taken at face value for rejection purposes only.
- **Correlated cluster.** Four of ten drops (routing: Panda et al.,
  OmniRouter, R2-Router, token-budget recalibration) are one mechanism family,
  almost certainly one query family — the exact failure GPT's own accompanying
  architecture note warns about ("cheap models share blind spots"). Unit of
  diversity must be the mechanism, not the item count.
- **Water drift.** Nothing in the catch squarely addresses water 3 (expertise
  capture); the routing cluster sits outside all three waters, adjacent to
  context economics. The net fished where it was comfortable.
- **The exclusion list worked.** Zero overlap with the 21 held findings —
  the corrected prompt did its job.
- All items marked PRIMARY; one carried an honest caveat (InstructPipe,
  N=16). No UNVERIFIED flags used.

## Admitted → expertise/imported/ (provenance: via GPT expedition)

- **pointwise-before-pairwise** — pairwise comparison amplifies superficial
  attributes (verbosity, authoritative tone); pairwise preferences are
  manipulable ~35% vs ~9% for absolute scoring; evaluate each output in
  isolation before comparing. Two independent primary sources, one mechanism
  (drops 1+2 merged at the gate — same finding, two papers). Direct challenge
  to our blind A/B instrument: the protocol itself can fabricate the winner.
  Feeds O7 eval design and any future LLM-judge; flags a caution on
  interpreting the Beta's (frozen, human, pairwise) verdicts.
  Sources: arXiv 2406.12319 (Jeong et al., The Comparative Trap / PRePair);
  arXiv 2504.14716 (Tripathi et al., Pairwise or Pointwise?). Both verified.
- **knowledge-freshness** — memory maintenance requires explicit temporal
  validation and invalidation of claims; better retrieval cannot compensate
  for a stale base ("finding a wrong entry better still yields a wrong
  answer"). Freshness is a system operation, not an implicit property. Feeds
  the owed seed-lifecycle ADR (revalidation as a lifecycle operation) and
  Seed Hygiene. Source: OpenAI Cookbook, Temporal Agents with Knowledge
  Graphs (developers.openai.com/cookbook). Verified.

## Noted — routed to owed ADRs (not seeds)

- **Test oracle for long-running autonomy** (Anthropic, long-running Claude
  for scientific computing) — prolonged autonomous work needs an explicit
  oracle (reference, quantitative target, test suite) to distinguish progress
  from convincing activity; persistence and memory do not fix drift. Our
  system's standing oracle is the Pilot's daily judgment; the note goes to
  the Kernel v0 / App shell ADRs, where week-long objectives (the Render
  Order) need acceptance criteria beyond "seemed useful".
- **Estimator recalibration loop** (Chen et al., token-budget-aware routing)
  — token estimates recalibrated continuously against measured usage per work
  category (moving averages), not left as constant heuristics. This is the
  Effort Probe ADR's calibration loop (estimate → execute → measure →
  correct), stated with a concrete mechanism. → Effort Probe ADR (owed #3).
- **Pipeline-as-governable-artifact** (Google Research, InstructPipe) — in
  AI-assisted creative production, the governable artifact can be the
  editable pipeline of decisions, not the generated output. Corroborates the
  Render Order concept already fixed in intent (Session 004) — external
  validation, not news; human study is small (N=16). → App shell ADR.

## Rejected

- **Audit methodology via repeated runs from identical states against known
  ground truth** (Anthropic, alignment auditing agents) — already our
  practice: the ADR-0012 rig was verified end-to-end on a fake model from
  identical states before any real run. Confirmation, not news.
- **Adaptive routing under budget constraints** (Panda et al.) — no model
  router exists or is owed in any ADR; the fleet is two fixed choices (cheap
  net, strong camera) picked by hand. No near-term surface.
- **OmniRouter, global budget across requests** — same family; the one idea
  worth keeping (budget the expedition, not the cast) survives inside the
  trawler-camera verdict (see companion review), not as a seed.
- **R2-Router, model+reasoning-budget pairs** — same family, same absence of
  a routing surface. Out.
- (The fourth member of the routing cluster, estimator recalibration,
  escaped rejection only because it lands on the owed Effort Probe ADR.)

## Expedition economics (first cost-per-admitted-drop record)

- Expedition 1: ~149k subagent tokens → 6 admitted ≈ **25k tokens per
  admitted drop**, plus the camera/gate session.
- Expedition 2: ~0 marginal (Pilot's GPT subscription) → 2 admitted, cost
  concentrated in this gate (source verification included).
- Diminishing returns are visible and expected: same waters, second pass,
  exclusion list growing. A third expedition in these waters is not justified;
  the next net should be cast only when new ADRs open new hungry waters.

Provenance discipline: admitted seeds cite the original source plus `via GPT
expedition` in the file header; this review is the audit trail; gate
delegated by the Pilot in-session (warm-start order, 2026-07-12).
