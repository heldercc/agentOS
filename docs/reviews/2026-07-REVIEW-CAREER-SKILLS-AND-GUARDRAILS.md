# Review — two articles: "6 AI career skills" (MindStudio) and "Skill guardrails & constraints" (aiskill.market)

Session 005. Mandate from the Pilot (delegated: "de resto vê", stingy-CEO
bar): attack both, distill only what has concrete near-term use. Discipline:
the `adversarial-review` seed, admitted earlier this session. Both sources
are product marketing (MindStudio sells a no-code platform; aiskill.market
sells a skill marketplace) — that alone rejects nothing, but raises the bar.

## Article 1 — MindStudio, "6 skills to future-proof your career"

**Rejected 6 of 6. Zero drops.**

| Claimed skill | Verdict |
|---|---|
| Be the AI person at work | Generic career advice; no technique |
| Prompt engineering (role + context + constraints) | Commodity; Mentor Expertises are already the systematized, stronger form (ADR-0002) |
| No-code AI workflows | Product pitch; our workflows are governed work orders |
| Critical evaluation of AI output | Held stronger: Article 2 + `adversarial-review` seed |
| Data literacy | Irrelevant to the engine; generic |
| Multiple income streams | The Pilot's strategy already fixes objectives (factory + sellable expertise); listicle adds nothing |

Rejection is free; admission costs maintenance forever. Nothing here earns it.

## Article 2 — aiskill.market, "Skill guardrails & constraints"

Marketing wrapper, but the middle is real engineering. Verdicts by technique:

**Admitted (2) → seeds:**
- **Circuit breaker** → `expertise/imported/circuit-breaker`. Failure
  escalates automatically: repeated failures trip caution, then a halt —
  never infinite retry. Concrete near-term use: the Beta's mailbox worker
  already implements a crude one (3 attempts, then stop); the Kernel v0 ADR
  inherits the pattern for work orders.
- **Decision authority matrix** → `expertise/imported/authority-matrix`.
  An autonomy grant is written as three explicit lists: decides alone / must
  ask / forbidden. Operationalizes Article 1 ("explicit, scoped, revocable")
  — the article supplies the *form* our article only demands in principle.
  Concrete near-term use: Kernel v0 work-order grants; Executive Mode.

**Noted for future ADRs (not seeds — implementation hygiene):**
- Input allowlists, path-traversal patterns, secret redaction → Tool Runner
  design ADR (sandboxing was already its mandate, ADR-0010).
- Error taxonomy (`recoverable` flag, `partialResults`, suggestions) → Tool
  Runner / Kernel error contract.

**Rejected as duplicates (already held, mostly stronger):**
- Resource/token budgets → work orders + Effort Probe (ADR-0006).
- Uncertainty handling ("express confidence, ask when unsure") → Article 9.
- Audit trail with reasoning → Article 2 + audit invariants; ADRs already
  record alternatives considered.
- Output schemas/limits → per-contract engineering detail, not judgment.

## Tally

12+ techniques reviewed across two articles; **2 admitted** (both from
article 2), 2 noted for owed ADRs, the rest rejected as commodity,
marketing, or weaker duplicates of standing doctrine. Consistent with the
curation doctrine: só as pingas douradas.
