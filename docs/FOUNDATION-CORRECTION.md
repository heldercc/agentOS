<!-- AgentOS provenance: origin=taught | producer=the Pilot (verbatim directive, Session 009, 2026-07-12 morning) | gate=none needed — the owner's voice | status=DOCTRINE. Supersedes any reading of AgentOS as "a multi-agent system". Registered by the Copilot with implementation notes at the end. -->

# Foundation Correction

AgentOS is not primarily a multi-agent system.

AgentOS is a governed system for capturing, organising, selecting, applying
and evaluating human intelligence.

Models are interchangeable execution engines.

Agents are temporary role configurations.

Human expertise is the durable asset.

The Kernel's central responsibility is to schedule:
- project context;
- human expertise;
- tools;
- effort;
- authority boundaries.

Every meaningful output must be traceable to:
- user intent;
- selected context;
- applied human expertise;
- responsible work order;
- resulting artifact or decision.

The product must make this visible to the user.

A workflow that functions but is not understandable to the user is incomplete.

The user must be able to inspect:
- their own inputs;
- AI outputs by phase;
- expertise applied;
- state changes;
- decisions;
- artifacts;
- next action.

AgentOS becomes a brain not by storing agents or transcripts, but by
accumulating and reusing governed human judgement. The product engine is now
real, but the product experience is still too weak.

The current UI proves the loop, but it feels like a technical laboratory
interface rather than a usable personal operating system.

The user needs to understand and navigate the story of each project.

For every project, the UI should make visible:

- the original user intent;
- the user's prompts and answers;
- the questions asked over time;
- the agents consulted in each phase;
- each agent's mandate;
- the context and human expertise applied;
- the outputs produced at every stage;
- candidate and approved Project State changes;
- decisions made by the user;
- execution artifacts;
- evaluations and next iterations.

Do not expose private model reasoning.

Expose operational provenance.

The user should always be able to answer:

- What did I ask for?
- What did the system understand?
- Who worked on it?
- What expertise was used?
- What did each phase produce?
- What changed?
- Why am I being asked to decide this?
- What happens next?

The UI should evolve from a single technical control page into a project
workspace with a clear timeline:

Intent
→ Questions
→ Answers
→ Agent contributions
→ Candidate State
→ User governance
→ Execution
→ Artifacts
→ Evaluation
→ Next iteration

Also correct the conceptual model of agents.

AgentOS should not primarily build a library of fixed agents.

Agents are temporary operational vessels.

The durable asset is reusable human expertise.

The product needs an Expertise Library showing:

- admitted expertise;
- candidate expertise;
- project-local expertise;
- reusable expertise;
- provenance;
- scope;
- supporting evidence;
- where it was applied;
- where it succeeded or failed;
- which projects and artifacts it influenced.

A runtime agent should be composed from:

mandate
+ relevant project context
+ applicable human expertise
+ tools
+ effort budget

Therefore:

Do not think:
"Which permanent agent do we have?"

Think:
"What expertise is needed, and what temporary agent should apply it?"

The product should let the user see, for each execution:

- which temporary agents were convened;
- which expertise each one received;
- why that expertise was selected;
- what output it influenced.

This is how AgentOS becomes a brain:

not by storing personalities,
but by accumulating, governing and reusing human judgement.

---

## Copilot's registration notes (Session 009)

1. **This corrects emphasis, not machinery.** The shell's mechanics already
   trace every output to a work order, a manifest (selected context with
   reasons) and evidence events — what was missing is (a) human expertise as
   a first-class scheduled element, (b) the traceability SURFACED to the
   user, and (c) the vocabulary: the roster is not "the agents we have", it
   is the temporary vessels convened this phase. ADR-0002 (Mentor Expertises
   replace personas — the entity is now the Sensei, ADR-0021) said this in
   Book I; the correction makes it product law.
2. **Continuity:** the rig's learned-seeds line (ADR-0015 distiller → tray →
   admitted seeds re-entering context) is the same asset under an earlier
   name. The Expertise Library is its product form; seeds distilled from
   governed clicks remain a future SOURCE of candidate expertise, alongside
   the user's own hands.
3. **Implementation registered as ADR-0019** (expertise store + composition,
   the project timeline, operational provenance in the UI).
