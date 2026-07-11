# ADR-0000: Architecture Before Implementation

- **Status:** Accepted
- **Date:** 2026-07 (Session 001; formalized in Revision 2, Session 002)
- **Deciders:** Pilot

## Context

AgentOS aims to capture and govern human expertise — a domain where the *concepts*
(seed, mentor, kernel, context) are the product. Wrong abstractions here are
maximally expensive: every later component inherits them. Meanwhile, the pull to
"just start coding" is strong and constant.

## Decision

Build the architecture before the implementation. The Foundation phase produces
vocabulary, principles, conceptual architecture and a decision process — and no
production code. Prototypes are allowed only as disposable exploration; nothing a
prototype does can decide architecture by fait accompli.

## Alternatives Considered

- **Code-first, refactor later** — rejected: refactoring code is cheap, refactoring
  *concepts* that users and documents already depend on is not.
- **Parallel tracks (docs + code)** — rejected for Foundation: code exerts gravity
  on design; decisions start following what is easy to implement.

## Consequences

- Slower visible start; no demo during Foundation.
- Every future component begins with settled vocabulary and boundaries.
- The discipline itself becomes testable: any PR during Foundation containing
  production code is, by definition, wrong.
