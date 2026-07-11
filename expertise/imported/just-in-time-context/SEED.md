<!-- AgentOS provenance: origin=imported | source=Anthropic engineering, "Effective context engineering for AI agents" (Sept 2025); corroborated by Chroma Research "Context Rot" (2025), via docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-1.md | admitted=2026-07-11 Session 005 | gate=Pilot (distillation delegated in-session) | note=sharpens Objective O7 -->
---
name: just-in-time-context
kind: seed
description: "Over-loading context degrades reasoning, not just cost: keep lightweight references, fetch content when needed."
---

# Just-in-Time Context

Bulk pre-loading "everything that might be relevant" is not merely wasteful —
it measurably degrades the model's reasoning even when the right answer is
present in the pile (context rot). So context scheduling is a **correctness
lever, not only a cost lever**: keep lightweight references (paths, ids,
queries) in context and resolve them to content at the moment of need.

**Where it applies in AgentOS:** this is Article 5 and O7 said back to us by
production evidence — with one sharpening the Beta should watch for: the
scheduled path may not merely *hold* quality against full reload; on
context-heavy tasks it may **win** on quality. If the blind verdicts show
that, record it — it upgrades the thesis from "cheaper, no worse" to
"cheaper *and* better", and it belongs in the Scheduler design ADR
(provenance-by-reference is already our JIT mechanism).
