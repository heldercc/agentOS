# Vision

## Why

Current AI systems accumulate **information**. Conversations end, context evaporates,
and the same expertise is re-explained to the machine every single day.

AgentOS aims to accumulate **reusable human expertise**: the judgment, heuristics and
taste of its owner, captured in explicit, versioned, teachable form — so that every
hour spent teaching the system compounds instead of evaporating.

## Core Thesis

- **AI works.** Model capability is no longer the bottleneck; capturing and governing
  expertise is.
- **Humans govern.** The system proposes, the Pilot decides. Autonomy is granted
  explicitly, per scope, and is always revocable.
- **Expertise compounds.** A heuristic taught once (a GuruSeed) is applied forever,
  refined over time, and auditable at every step.
- **Architecture precedes implementation.** The cost of a wrong abstraction grows
  with every line of code built on top of it.

## What Success Looks Like

An owner can:

1. **Teach** — encode a piece of judgment as a GuruSeed in minutes, not by
   fine-tuning models but by writing explicit, reviewable heuristics.
2. **Delegate** — hand a Workflow to a Mentor and trust that the Kernel enforces
   cost, scope and safety limits.
3. **Review** — see exactly which seeds, which context and which decisions produced
   any Artifact.
4. **Evolve** — observe which seeds perform, retire the ones that don't, and watch
   the system's competence grow session over session.

## Long-term Goal

Create an operating system capable of orchestrating intelligent work while allowing
its owner to explicitly **teach, review, evolve and govern** the intelligence inside it.

## Non-Goals

- Replacing human judgment. AgentOS amplifies the owner's thinking; it does not
  substitute it.
- Fully autonomous agents. Unbounded autonomy is explicitly out of scope.
- A general-purpose framework for everyone. AgentOS is opinionated and owner-centric
  by design; generalization is a possible future, not a requirement.
- Model training. Expertise lives in explicit seeds and context, not in weights.
