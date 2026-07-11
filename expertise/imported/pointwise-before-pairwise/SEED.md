<!-- AgentOS provenance: origin=imported | source=Jeong et al., "The Comparative Trap / PRePair" (arXiv 2406.12319) + Tripathi et al., "Pairwise or Pointwise?" (arXiv 2504.14716), via GPT expedition, docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-2.md | admitted=2026-07-12 Session 006 | gate=Claude (delegated by the Pilot in warm-start order) -->
---
name: pointwise-before-pairwise
kind: seed
description: "Pairwise comparison amplifies verbosity and authoritative tone; judge each output in isolation first, then compare. The eval protocol can fabricate the winner."
---

# Pointwise Before Pairwise

Direct A/B comparison is not a neutral instrument. Two independent findings,
one mechanism:

- LLM judges favor superficial attributes — verbosity, authoritative tone —
  and pairwise comparison *amplifies* this: the judge anchors on the contrast
  instead of the content (arXiv 2406.12319).
- Pairwise preferences were flipped by distractor attributes in ~35% of
  cases, versus ~9% under absolute (pointwise) scoring of each output alone
  (arXiv 2504.14716).

The defense is a protocol, not vigilance: **score each candidate in
isolation first, then compare the scored candidates** (hybrid
pointwise-then-pairwise). And treat the choice of protocol as an
experimental variable — a "blind A/B" result is only as neutral as the
instrument that produced it.

**Where it applies in AgentOS:** every future evaluation instrument — O7
eval design at Scheduler scale, Mentor output evaluation in the App, any
LLM-as-judge. Standing caution on the Beta (ADR-0012): its blind judging is
pairwise by frozen design with a human judge — the parameters stay frozen
(ADR law), but the verdicts are read knowing the protocol's bias family.
Composes with adversarial-review: the attack must include the instrument.
