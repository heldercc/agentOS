<!-- AgentOS provenance: origin=imported | source=Manus engineering, "Context Engineering for AI Agents" (manus.im), via docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-1.md | admitted=2026-07-11 Session 005 | gate=Pilot (distillation delegated in-session) -->
---
name: failures-stay-visible
kind: seed
description: "Leave failed attempts and error traces in the working context; scrubbing them makes the agent repeat the mistake."
---

# Failures Stay Visible

The instinct is to keep working context "clean": remove the failed tool call,
the error trace, the dead end, and present the agent a tidy history. Measured
in production, that instinct is wrong — an agent that can *see* its own
failure updates on the evidence and stops repeating it. The mess is a
functioning training signal inside the episode.

Cleanliness is for the artifact; the working record keeps its scars.

**Where it applies in AgentOS:** Kernel/Mentor loop design — a work order's
retry carries the failure history of the previous attempt, by reference, into
context. Rhymes with two standing pieces of doctrine: the audit log never
forgets (Article 2), and the adversarial-review seed's rule that acceptance
carries its scars as provenance.
