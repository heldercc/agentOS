# ADR-0011: Article 6 Amended — Architecture Precedes Commitment

- **Status:** Accepted (ratified by the Pilot, Session 004)
- **Date:** 2026-07
- **Deciders:** Pilot

## Context

Article 6 read "concepts, boundaries and vocabulary are settled before code
exists". An external review (preserved in heritage) argued this is too rigid:
implementation also produces knowledge, and a constitution that pretends
certainty before experiment invites either paralysis or hypocrisy. The
amendment process of ADR-0004 requires arguing on philosophical terms — this
qualifies: the article's purpose is to prevent code from deciding architecture
silently, not to forbid learning from code.

## Decision

Article 6 becomes: **"Architecture precedes commitment. Prototypes explore;
evidence may revise architecture — always explicitly, through an ADR, never
by fait accompli."** The protected value is unchanged (no silent decisions by
implementation); the acknowledgment of evidence is new.

## Alternatives Considered

- **Keep the rigid wording** — rejected: Phase 1's own experiment is designed
  to produce evidence about the Resolver and the scheduler; a constitution
  that cannot absorb its results honestly is decorative.

## Consequences

- Exploratory code is legitimate before doctrine is final, provided its
  lessons return as ADRs.
- ADR-0000's spirit survives intact; its letter is superseded where stricter.
