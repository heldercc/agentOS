# Review — ISO/IEC 42001 vs the Constitution

Session 005. Mandate from the Pilot: would ISO/IEC 42001 add value to our
Constitution? Sources verified: iso.org/standard/42001 (ISO/IEC 42001:2023,
"Information technology — Artificial intelligence — Management system",
published 2023-12, 51 pages, JTC 1/SC 42) and the Cortex Intelligence
governance article the Pilot supplied. Devil's-advocate mode, Article 8 as
the knife.

## What the standard is

The first international standard for **AI Management Systems (AIMS)**:
requirements for an *organization* to establish, implement, maintain and
continually improve its governance of AI — roles, policies, risk and impact
assessments, controls, monitoring, audits. Family of ISO 9001/27001;
certifiable; aimed at companies and public bodies deploying AI at
organizational scale.

## Mapping — what 42001 asks vs what Book I already holds

| 42001 / governance practice | Ours | Where |
|---|---|---|
| Human oversight, final authority | ✔ stronger (single named human) | Article 1 |
| Transparency, explainability | ✔ | Article 2; manifest + `selectionReason` |
| Explicit, inspectable knowledge | ✔ | Article 3 |
| Change control, no silent drift | ✔ | Article 4; O5 gate |
| Audit trails | ✔ enforced in code | invariants; runs/ |
| AI inventory | ✔ by construction | Mentors are data; stores enumerable |
| Transparency before automation | ✔ | Article 7 |
| Uncertainty discipline | ✔ (ours is novel) | Article 9 |
| Vendor independence | ✔ as objective | O6 |
| Continual improvement | ✔ as objectives | O4, O6; Probe calibration |
| **Risk/impact assessment before deployment** | ✖ partial — Effort Probe estimates *cost*, not *risk/impact* | gap 1 |
| **Recurring adversarial testing (red teaming)** | ✖ practiced (devil's-advocate reviews) but not doctrine | gap 2 |
| **Periodic audit *review*** | ✖ logs exist; nobody is owed a reading of them | gap 3 |
| Certification, org roles, compliance apparatus | ✗ not applicable to a one-Pilot system | — |

## Verdict

**As constitutional text: no.** The Constitution constrains *decisions*,
philosophically; 42001 constrains *organizations*, procedurally. Grafting
management-system language into the Constitution would add exactly the kind
of complexity Article 8 exists to kill, to restate principles Articles 1–9
already hold — mostly in stronger, owner-centric form.

**As an external audit of our blind spots: yes, modest and real.** Three gap
candidates, each adoptable only through its own ADR, none urgent before Beta
results:

1. **Risk joins cost in the Effort Probe.** When the Probe gains estimation
   (its owed ADR), a work order's approval card could carry "what could this
   break?" beside "what will this cost?". One line in an ADR already owed.
2. **Adversarial review as doctrine.** The Pilot already invents this
   instinctively (this review; the SavePoint review; the requested Fable 5
   devil's-advocate pass on Beta results). Worth one sentence of doctrine —
   where, the seed-lifecycle or Kernel ADR decides — so the practice
   outlives the habit.
3. **The audit log gets read.** Logs that nobody reviews are decoration
   (Article 2's spirit). A periodic "read the audit trail" step belongs in
   the Executive Loop design (Phase 2), not the Constitution.

**Future product value — parked.** If AgentOS ever serves organizations,
ISO/IEC 42001 alignment becomes a marketable property, and our audit-first
architecture makes it unusually cheap to claim. That is a Phase 5+ concern;
noted here so it is not rediscovered.

Decision remains the Pilot's; nothing changes without an ADR.

## Gate outcome (same session)

The Pilot delegated the distillation decision ("diz-me tu"). Delegated
verdict, recorded here per Article 1 (autonomy: explicit, scoped, revocable):

- **Admitted — `expertise/imported/risk-beside-cost`** (origin imported,
  source ISO/IEC 42001): approval answers *what will this cost* AND *what
  could this break*. Concrete near-term use: the Effort Probe ADR.
- **Admitted — `expertise/taught/adversarial-review`** (origin **taught** —
  the practice is the Pilot's; ISO merely corroborates): nothing important is
  accepted on its first reading; the attack is recorded.
- **Rejected as seed — "unread logs are decoration."** True, but it is a
  design requirement for the Executive Loop (Phase 2), not portable judgment;
  it is already recorded above and duplicating doctrine as a seed is the same
  self-vandalism the skill-import review refused. Acceptance rate: 2 of 3.
