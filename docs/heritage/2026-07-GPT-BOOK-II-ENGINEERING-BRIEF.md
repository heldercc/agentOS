# Heritage — GPT Book II Engineering Brief (July 2026)

> Received by the Pilot from the founding GPT line and handed to Claude on
> 2026-07-11 with the instruction to keep the governance discipline and proceed.
> Preserved verbatim below. **Reconciliation:** answered by
> [engineering/OVERVIEW.md](../../engineering/OVERVIEW.md). Note that the
> "Constitutional Principle" section restates the pre-Constitution *Principles*
> wording — superseded by Constitution Articles 1–2 (ADR-0004); it is preserved
> here as lineage, not readopted. Where the brief asks for things Book I already
> ratified or the Beta already built, the reconciliation points at them instead
> of duplicating.

---

## Constitutional Principle

### The Pilot Governs

The Pilot retains final authority.

The system exists to augment judgement, not replace it.

AI components may observe, analyse, propose, implement and critique.

They shall never silently redefine the Pilot's intent.

Final decisions remain the responsibility of the Pilot.

The quality of the system is measured not by the number of decisions it makes, but by the quality of the decisions it enables.

## Próximos passos

We are now entering Book II — Engineering.

Book I (Foundation) is considered sufficiently stable.

Your mission is no longer to improve philosophy.

Your mission is to design the engineering architecture required to validate the AgentOS hypothesis.

Rules:

- Do not revisit the Foundation unless a contradiction is found.
- Do not introduce new concepts without necessity.
- Architecture must remain as simple as possible.
- Every component must justify its existence.
- Prefer one working vertical slice over many incomplete systems.

## Mission

Create the engineering plan for Beta 1.

The objective is to validate the central hypothesis:

"Context is a schedulable resource."

Produce the engineering documents required for implementation.

Expected output:

1. **Engineering Overview** — Explain the purpose of Book II.

2. **Component Breakdown** — Define the first engineering components.

   Expected initial components:

   - Kernel
   - Context Scheduler
   - Work Order
   - Project State
   - Artifact Store
   - Expertise Store
   - Seed Resolver
   - Effort Probe
   - Tool Runner

   Describe the responsibility and boundaries of each.

3. **Vertical Slice** — Design the smallest end-to-end workflow capable of
   validating the hypothesis.

   Input → Scheduler → LLM → Artifact → Measurement

4. **Beta Success Criteria** — Define measurable success. Examples: reduced
   tokens; equivalent or better quality; reduced context loading; explainable
   context selection; human approval preserved.

5. **ADR Candidates** — Identify new engineering ADRs required before
   implementation.

6. **Risks** — List architectural risks that may invalidate the hypothesis.

7. **Repository Structure** — Review the repository. Suggest the engineering
   folder structure required for implementation.

## Important

Think like a systems architect.

Avoid implementation details unless necessary.

The objective is not to build AgentOS.

The objective is to design the minimum engineering architecture required to prove or disprove its central hypothesis.

Be critical.

If something is unnecessary, remove it.

If something is missing, justify it.

Remember:

Engineering starts now.
