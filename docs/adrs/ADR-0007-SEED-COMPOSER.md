# ADR-0007: Teaching and Resolution Are Distinct Mechanisms (Seed Composer)

- **Status:** Accepted (ratified by the Pilot, Session 004)
- **Date:** 2026-07 (Session 004)
- **Deciders:** Pilot

## Context

The founding conception had two seed mechanisms: teaching (the Pilot puts
expertise in — originally called InjectSeed) and, implicitly, retrieval at
execution time. Revisions 2–4 formalized the retrieval side (Seed Resolver,
ADR-0005) but lost the teaching side as a named concept, leaving Article 3's
most important verb — *teach* — without a mechanism.

## Decision

Name the teaching mechanism the **Seed Composer**: the Pilot-facing flow where
expertise enters the system in natural language and the system interprets,
structures, asks confirmation, saves and versions. The Pilot never writes
formats (founding requirement). Composer writes to the seed store; Resolver
reads from it; the Kernel schedules what the Resolver selects.

## Alternatives Considered

- **Reclaim the name "InjectSeed" for teaching** — rejected: the name now has
  two contradictory historical meanings; reusing it guarantees confusion.
- **Leave teaching as an Executive Mode feature without a name** — rejected: an
  unnamed mechanism cannot be designed, versioned or held to Article 3.

## Consequences

- The seed pipeline becomes symmetric: Composer (in) / Resolver (out).
- Phase 2 (Executive UI) inherits a concrete obligation: the Composer flow.
- ADR-0005's context section is corrected by the reconciliation record; its
  decision is unaffected.
