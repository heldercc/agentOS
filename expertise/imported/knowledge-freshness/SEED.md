<!-- AgentOS provenance: origin=imported | source=OpenAI Cookbook, "Temporal Agents with Knowledge Graphs" (developers.openai.com/cookbook/examples/partners/temporal_agents_with_knowledge_graphs/temporal_agents), via GPT expedition, docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-2.md | admitted=2026-07-12 Session 006 | gate=Claude (delegated by the Pilot in warm-start order) -->
---
name: knowledge-freshness
kind: seed
description: "Freshness is a system operation, not a property of the store: claims need explicit temporal validation and invalidation. Better retrieval cannot compensate for a stale base."
---

# Knowledge Freshness

A knowledge base rots by default. Time-sensitive claims (prices, APIs, best
practices, measured findings) become false without any edit being made — and
improving *retrieval* (semantic search, reranking) does not help: finding a
wrong entry more reliably still yields a wrong answer.

Freshness therefore has to be an explicit **operation of the system**, not
an assumed property of the store: new information must be checked against
held claims, and claims it invalidates must be marked or retired
(invalidation is a first-class step, alongside ingestion).

**Where it applies in AgentOS:** the owed seed-lifecycle ADR — revalidation
belongs in the lifecycle as an operation (the founding 7-state sketch gains
its "why" for a stale/retired path). Seed provenance headers already carry
admission dates, which is the raw material; what is owed is the operation
that reads them. Composes with the Seed Hygiene note (near-duplicate
proliferation) — hygiene is deduplication *plus* freshness. Also constrains
Navigation practice: memory that names files, flags or decisions is verified
against the repo before being acted on, never trusted on age.
