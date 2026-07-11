# ADR-0004: A Constitution Supersedes the Principles

- **Status:** Accepted
- **Date:** 2026-07 (Session 003)
- **Deciders:** Pilot

## Context

Revisions 1–2 carried seven "Principles" mixing philosophy (human decides) with
engineering rules (version everything, Kernel meters cost). Philosophy and
engineering age differently: the former should be nearly immovable, the latter
must be able to evolve with the architecture.

## Decision

Split them. Philosophical commitments become the **Constitution** (Chapter II):
seven articles, amendable only by an ADR arguing on philosophical terms.
Engineering rules become **architectural invariants** (Chapter IV), owned by the
architecture and evolvable through ordinary ADRs.

## Alternatives Considered

- **Keep a single Principles list** — rejected: one list gives one change
  process, either too rigid for engineering or too loose for philosophy.
- **Constitution only, no invariants** — rejected: engineering rules stated as
  philosophy become vague; "no execution outside a work order" must stay testable.

## Consequences

- Two documents to keep consistent; the Constitution links to its lineage.
- Amendment friction is now intentional and asymmetric.
- Future reviews can challenge invariants freely without reopening philosophy.
