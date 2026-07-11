# ADR-0002: Mentor Expertises Replace Personas

- **Status:** Accepted
- **Date:** 2026-07 (Session 001; formalized in Revision 2, Session 002)
- **Deciders:** Pilot

## Context

The common industry pattern configures agents as "personas" — a name, a tone, a
loose character description. Personas are untestable, unversionable and conflate
style with competence. AgentOS needs agent capability to be explicit, composable
and governable.

## Decision

Agents (Mentors) are configured with **Mentor Expertises**: named, versioned bundles
of capability — the GuruSeeds, context rules and behavioral constraints that define
how a Mentor thinks in a domain. Personality, if any, is presentation; Expertise is
substance, and only substance is architectural.

## Alternatives Considered

- **Keep personas** — rejected: no answer to "which version of this persona produced
  that decision?"
- **Per-task ad-hoc prompts** — rejected: expertise would not compound (violates the
  Manifesto's reusability requirement).

## Consequences

- Mentor behavior becomes attributable: Artifact → Mentor → Expertise version →
  seeds injected.
- Requires an Expertise composition model in the Mentor Engine (Phase 4).
- Migration cost: any earlier persona-flavored notes must be recast as Expertises.
