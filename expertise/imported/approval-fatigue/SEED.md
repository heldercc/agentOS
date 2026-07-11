<!-- AgentOS provenance: origin=imported | source=Anthropic engineering (how-we-contain-claude; claude-code-auto-mode; ~93% of permission prompts rubber-stamped), via docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-1.md | admitted=2026-07-11 Session 005 | gate=Pilot (distillation delegated in-session) -->
---
name: approval-fatigue
kind: seed
description: "A gate that is always approved is not a gate. The ROI is in shrinking what needs asking, not in asking more."
---

# Approval Fatigue

Measured in production: users rubber-stamp ~93% of permission prompts. Past a
low threshold, each additional approval gate produces *less* safety and *more*
false confidence — the human is no longer deciding, only clicking.

The corrective is not fewer principles but fewer prompts: **shrink the space
of actions that require asking** (containment, scoped grants, safe defaults)
so that the prompts that remain are rare enough to be read.

**Where it applies in AgentOS:** Executive Mode's core promise is governance
in minutes a day (O1) — it dies by a thousand approval dialogs. Kernel v0
design rule: every proposed gate must argue why it won't be rubber-stamped;
pre-granted scopes (Article 1's explicit grants, the authority-matrix seed)
are the mechanism that keeps the remaining gates meaningful.
