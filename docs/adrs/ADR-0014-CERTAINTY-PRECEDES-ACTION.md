# ADR-0014: Certainty Precedes Action (Article 9)

- **Status:** Ratified
- **Date:** 2026-07-11
- **Deciders:** Pilot
- **Relacionado:** Article 1 (The Human Governs), Article 5 (Context Is Scheduled), ADR-0004 (Constitution supersedes Principles)

## Context

The Pilot issued a standing directive, in his own words:

> "nunca avançar sem certeza maior que 95%. Nunca assumir nada, qualquer dúvida,
> entrevistar para esclarecer e ter certeza mais que 95%"

and, before ratification, revised the bar:

> "secalhar 95% é limitador, aponta para 90%"

The directive was interviewed before drafting (practicing the rule it creates):

- **Scope** — the Pilot chose *both*: the rule binds the agents building AgentOS
  (Claude, Copilot, any future collaborator) **and** the AgentOS system itself at
  runtime (Kernel, Mentors).
- **Threshold** — 90%, revised down from the original 95% by the Pilot.

The Constitution already implies pieces of this — Article 1 makes the Pilot the
final authority, Article 2 demands explainability — but nothing states the
*pre-action* obligation: that doubt must be resolved by asking, before acting,
not explained away after.

## Decision

Add **Article 9 — Certainty Precedes Action** to the Constitution:

> No actor in this system — an agent building AgentOS, or the system itself at
> work — advances on an assumption. When confidence in the governing intent falls
> below ninety percent, the actor stops and interviews the Pilot until the doubt
> is resolved. Asking is never a failure; guessing is.

On the number: 90% is not a measured probability — no honest actor can compute
it. It is a named bar of humility: the moment an actor notices it is *filling a
gap with a guess about what the Pilot wants*, it is below the bar and must
interview. The article's enforceable content is the interview obligation; the
figure exists so the Pilot can tune it (as he already did once, 95 → 90).

## Consequences

- **Dev-time:** before any ambiguous work on this repo, the working agent
  interviews the Pilot (structured questions, options, a recommendation). "Where
  was the interview?" becomes a legitimate review question for any change built
  on an interpretation.
- **Runtime:** any autonomy granted under Article 1 must come with an interview
  mechanism — a way for the Kernel or a Mentor to stop and ask the Pilot when
  intent is unclear. A capability that cannot ask cannot be trusted to act.
  (The Beta's data doctrine already practices this: undecided facts are flagged,
  never invented.)
- **Cost accepted:** more questions, slower starts on ambiguous tasks. The Pilot
  explicitly prefers this cost to the cost of silent assumptions.

## Alternatives Considered

- **Keep it as a working convention, not an article** — rejected: conventions
  drift; the Pilot asked for it at constitutional level, binding every actor.
- **95% threshold** — the original figure; revised to 90% by the Pilot as too
  limiting before ratification.
