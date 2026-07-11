# ADR-0003: Context Is a Scheduled Resource

- **Status:** Accepted
- **Date:** 2026-07 (Session 003)
- **Deciders:** Pilot

## Context

Every session with a contemporary AI system re-consumes context: the owner
re-explains, the system forgets, the cycle repeats. The human acts as the paging
mechanism of their own tools. AgentOS's founding complaint is precisely this.

## Decision

Treat context as an operating-system resource. The Kernel owns *context
scheduling*: resolving what a Mentor needs to know (Seed Resolver + stores),
assembling it into an enumerated working set, and logging what was placed. The
system, never the human, is responsible for context continuity. This becomes
Article 5 of the Constitution and the central motivation of the architecture.

## Alternatives Considered

- **Bigger context windows solve it** — rejected: window size changes how much
  can be repeated, not whether repetition is the mechanism. Scheduling is a
  responsibility, not a capacity.
- **Implicit memory features of AI vendors** — rejected: opaque, unversioned,
  non-portable; violates Articles 2 and 3.

## Consequences

- The Kernel gains its most demanding responsibility; the Seed Resolver becomes
  a first-class mechanism with its own future design ADR.
- "The Pilot had to re-explain" becomes a reportable defect class.
- Context assembly must be enumerable and logged, which constrains every future
  runtime choice.
