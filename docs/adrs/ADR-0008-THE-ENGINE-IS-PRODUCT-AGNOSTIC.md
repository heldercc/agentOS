# ADR-0008: The Engine Is Product-Agnostic; Mentors Are Governed Data

- **Status:** Accepted
- **Date:** 2026-07 (Session 004)
- **Deciders:** Pilot

## Context

The first objective to run through AgentOS is a creative production (a
15-second animation spec). The temptation is obvious: build a video tool. The
Pilot's stated goal is the opposite — build the engine that can produce *any*
governed product, of which the video is merely the first cargo, and in which
the workers themselves can be created, edited, improved and retired by the
Pilot.

## Decision

Two commitments, jointly:

1. **The Kernel is domain-blind.** No domain concept — shot, character,
   invoice, firmware — ever appears in Kernel code or in the App shell. All
   domain knowledge lives in governed data: Mentor Expertises, GuruSeeds,
   Project State, Workflow definitions. Switching the factory from "anime
   fight" to "fiscal vertical" must require zero engine changes.
2. **Mentors are governed artifacts, not code.** A Mentor (its Expertise,
   seeds, constraints, prompts) is data in the State Plane: created, edited,
   improved and retired by the Pilot through the same Executive loop that
   governs any other decision — versioned, auditable, Article 4 protected.

## Alternatives Considered

- **Vertical-first (build the video tool, generalize later)** — rejected:
  generalization "later" never survives contact with a working vertical; the
  domain leaks into the engine and never leaves.
- **Mentors as code (config files edited by hand)** — rejected: violates the
  founding requirement that the Pilot governs workers without writing formats,
  and makes Mentor evolution invisible to the audit log.

## Consequences

- The Roadmap gains a mandatory proof: a second, unrelated objective must run
  through the same engine with zero Kernel changes (Phase 5).
- Executive Mode inherits Mentor management as a first-class flow (create /
  edit / improve / retire a worker), alongside Seed Composer.
- The engine stays small; the ecosystem of Expertises does the growing.
