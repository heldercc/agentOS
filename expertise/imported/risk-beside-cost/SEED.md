<!-- AgentOS provenance: origin=imported | source=ISO/IEC 42001:2023 (impact-assessment requirement), via docs/reviews/2026-07-REVIEW-ISO-42001-VS-CONSTITUTION.md | admitted=2026-07-11 Session 005 | gate=Pilot (decision delegated to Claude in-session: "diz-me tu"; admitted 2 of 3 candidates) -->
---
name: risk-beside-cost
kind: seed
description: "Every approval of work answers two questions, not one: what will this cost, and what could this break?"
---

# Risk Beside Cost

Every card that asks the owner to approve work must answer **two** questions,
not one:

1. **What will this cost?** — tokens, time, effort (the Effort Probe's job).
2. **What could this break?** — the plausible harm if the work goes wrong:
   state corrupted, decision misled, budget burned, trust spent.

Cost without risk invites cheap-but-dangerous work; risk without cost invites
safe-but-wasteful work. Consent is only informed when both are on the card.

**Where it applies in AgentOS:** the Effort Probe's design ADR (owed) adds a
risk line to the work-order approval surface. Same honesty discipline as
estimates: named plainly, calibrated against what actually broke, never
manufactured certainty (Article 2).
