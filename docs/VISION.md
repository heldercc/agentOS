# Chapter I — Vision

## Two Observations

AgentOS begins with two observations about how intelligent systems fail their
owners today.

### First observation: context is consumed, not scheduled

Every conversation with an AI system begins near zero. The owner re-explains the
project, the constraints, the taste, the history — and the system consumes that
context, produces work, and forgets. The next session repeats the ritual. Context
is treated as fuel: burned once, gone.

An operating system does not treat memory this way. It treats memory as a
**managed resource**: allocated, scheduled, paged in when relevant, paged out when
not, never re-created from scratch when it already exists.

AgentOS applies the same discipline to context. **Context is an operating-system
resource.** The system's job is *context scheduling* — deciding what a working
Mentor needs to know, resolving it from versioned stores, and placing it into the
working window at the right moment — instead of *context repetition*, where the
human is the paging mechanism.

This is the technical heart of the project. Everything else follows from it.

### Second observation: expertise evaporates with its projects

Projects end. The judgment developed inside them — what to prefer, what to avoid,
what "good" looks like in this domain — usually ends with them. It lives in one
head, is applied one decision at a time, and is recreated at full price by the
next project, or the next hire, or the next conversation.

**Expertise compounds — if it has somewhere to live.** AgentOS gives it a home:
explicit, versioned, teachable units (GuruSeeds) that outlive the projects that
produced them. An hour spent teaching the system is an hour invested, not spent.

## Thesis

- Today, capturing, scheduling and governing expertise is a tighter
  bottleneck than raw model capability — and the gap widens as models improve.
- The human governs. The system proposes, explains and executes within granted
  scope; the Pilot decides.
- Expertise captured once applies wherever it is relevant, for as long as it
  stays valid, at low marginal cost — and its validity is itself governed
  (reviewed, refined, retired).
- Architecture precedes implementation, because a wrong abstraction grows more
  expensive with every line built upon it.

## What Success Looks Like

An owner can:

1. **Teach** — encode a piece of judgment as a GuruSeed in minutes.
2. **Delegate** — hand a Workflow to a Mentor, trusting the Kernel to enforce
   effort, scope and approval limits.
3. **Review** — trace any Artifact to the exact seeds, context and decisions that
   produced it.
4. **Evolve** — see which seeds perform, retire those that don't, and watch
   competence grow session over session — without ever re-explaining.

## Non-Goals

- Replacing human judgment. The system amplifies its owner's thinking.
- Unbounded autonomy. Autonomy is granted per scope and always revocable.
- A framework for everyone. AgentOS is opinionated and owner-centric by design.
- Model training. Expertise lives in explicit seeds and scheduled context,
  not in weights.
