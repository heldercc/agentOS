# ADR-0005: Seed Resolver Renames InjectSeed

- **Status:** Accepted
- **Date:** 2026-07 (Session 003)
- **Deciders:** Pilot

## Context

Revision 2 named the seed-selection mechanism "InjectSeed". The name described
the wrong half of the operation: *injection* (placing content into a working
set) is a Kernel act of context scheduling; the mechanism's actual job is
*resolution* — deciding which seeds are relevant to a task, deterministically
and accountably.

## Decision

Rename the mechanism **Seed Resolver**. Resolution (which seeds, and why) is the
mechanism's responsibility; injection (placement into Context) remains the
Kernel's, as part of context scheduling (ADR-0003).

## Alternatives Considered

- **Keep InjectSeed** — rejected: a name that misstates a boundary erodes the
  boundary.
- **"Seed Scheduler"** — rejected: scheduling is the Kernel's word; reusing it
  one level down invites exactly the confusion the rename removes.

## Consequences

- Terminology and architecture updated; older logs retain the historical name.
- The resolution/injection boundary is now visible in the vocabulary itself.
