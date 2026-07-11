# ADR-0009: Learned Seeds — the Seed Harvester

- **Status:** Accepted (capability decided by the Pilot, Session 004;
  the name "Seed Harvester" is the Copilot's proposal — Pilot may rename)
- **Date:** 2026-07 (Session 004)
- **Deciders:** Pilot

## Context

Until now expertise had one entrance: the Pilot teaches (Seed Composer,
ADR-0007). But the factory generates evidence daily — outputs selected
repeatedly, features approved again and again. Letting that evidence evaporate
contradicts the founding complaint; letting it self-incorporate would violate
Article 4. The Pilot's stated goal: a brain that grows use by use, where
validated success becomes his knowledge.

## Decision

Introduce the **Seed Harvester**: a mechanism that observes governance
outcomes (approvals, repeated selection of an agent's output or feature,
rejection patterns), detects recurring success, and distills it into a
**candidate seed** presented to the Pilot *with its evidence*. The Pilot
validates, edits or discards. Only upon validation is the seed incorporated —
into a Mentor's Expertise or at system level — with provenance marked
`origin: learned`, versus `origin: taught` for Composer seeds. Two origins,
one gate: the Pilot. This promotes the Incubator's "Automatic Seed Evolution"
to the roadmap, per the Incubator's own promotion path.

## Alternatives Considered

- **Silent auto-incorporation of successful patterns** — rejected outright:
  violates Articles 1, 3 and 4; drift wearing the costume of learning.
- **Ignore success signals (taught-only expertise)** — rejected: wastes the
  richest data the factory produces and caps the compounding the Pilot wants.

## Consequences

- The audit log becomes training data for candidate seeds — one more reason
  it must be complete.
- Seed provenance gains an origin field; the store must answer "who created
  it, from what evidence, validated when, incorporated where" (Objective O5).
- The seed pipeline reaches its full symmetry: **Composer** (taught in) ·
  **Harvester** (learned in) · **Resolver** (out to context).
- Success-signal thresholds (how many selections make a pattern?) owe a
  design decision in Book II — deliberately not fixed here.
