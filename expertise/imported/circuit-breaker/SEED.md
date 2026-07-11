<!-- AgentOS provenance: origin=imported | source=aiskill.market "Skill guardrails & constraints" (Duke Wood), via docs/reviews/2026-07-REVIEW-CAREER-SKILLS-AND-GUARDRAILS.md | admitted=2026-07-11 Session 005 | gate=Pilot (review+distillation delegated in-session: "de resto vê") -->
---
name: circuit-breaker
kind: seed
description: "Failure escalates automatically: repeated failures trip caution, then a halt. Never infinite retry."
---

# Circuit Breaker

A component that fails once may retry. A component that fails **repeatedly**
must not keep trying at full speed as if nothing happened: after N
consecutive failures it enters a cautious mode (slower, louder, smaller
scope), and after M it **halts and surfaces** — the failure becomes the
Pilot's decision, not the machine's loop.

Infinite retry is the machine quietly spending budget on a problem it has
already proven it cannot solve. The breaker converts repetition into
escalation.

**Where it applies in AgentOS:** the Beta's mailbox worker already practices
a crude form (3 attempts per job, then stop and report). The Kernel v0 ADR
inherits the pattern for work orders: consecutive failure thresholds, an
explicit cautious state, and a halt that lands in Executive Mode with the
failure history attached (Article 2 — the halt must explain itself).
