<!-- AgentOS provenance: origin=taught | producer=the Pilot (verbatim directive, Session 010, 2026-07-12) | gate=none needed — the owner's voice | status=DOCTRINE. The interaction model of governance: questions are one instrument, not the interface. Registered by the Copilot; two orienting sentences and registration notes at the end. -->

# Governance Is Not Primarily an Interview

Correct the current interaction model.

AgentOS must not reduce governance to a sequence of questions.

Questions are only one governance instrument.

The Kernel's responsibility is to digest the project, reduce complexity and
surface the smallest useful interaction to the Pilot.

The Pilot should not be required to invent solutions from a blank page when
the system can responsibly formulate concrete alternatives.

Use three main interaction modes:

1. CLARIFICATION QUESTION
   Use only when a material information gap prevents responsible progress.

2. GOVERNED OPTION SET
   Use when enough context exists to formulate distinct viable directions.

3. ADJUSTABLE RECOMMENDATION
   Use when the Kernel has a strong recommendation but the Pilot should be able
   to refine details before approval.

The governing principle is:

Ask when something essential is unknown.
Offer choices when the decision space can be bounded.
Recommend when one direction is clearly stronger.
Never make the Pilot do synthesis the system can already perform.

## The Kernel Must Chew the Problem

Before addressing the Pilot, the Kernel should:

- collect relevant project context;
- resolve applicable human expertise;
- consult bounded temporary specialists;
- identify the actual decision;
- reduce duplicates and noise;
- identify assumptions;
- generate distinct options where appropriate;
- compare consequences;
- formulate a recommendation;
- surface only the decision that requires human judgement.

The Pilot should receive a decision surface, not internal orchestration.

Example:

Decision:
How should the transformation buildup feel?

Option A — Suppressed physical tension
The body reacts before any visible energy.
Best for emotional weight and realism.

Option B — Environmental pressure
The world begins responding before the character does.
Best for scale and anticipation.

Option C — Immediate iconic signal
A recognisable visual cue begins almost immediately.
Best for clarity and genre impact, but carries greater genericity risk.

Recommendation:
Option A, because the approved Project State prioritises emotional consequence
before spectacle.

Human expertise applied:
- restraint before impact;
- physical consequence before spectacle;
- avoid generic staging.

## Option Set Requirements

An option set must contain genuinely distinct alternatives.

Do not generate three paraphrases of the same idea.

Each option should record:

- option ID;
- title;
- concise description;
- underlying direction;
- assumptions;
- benefits;
- trade-offs;
- risks;
- expected effort;
- reversibility;
- affected Project State fields;
- expertise applied;
- producing Work Orders;
- recommendation status.

The Kernel may present two, three or four options depending on the decision.

Do not force three options when only two honest alternatives exist.

Do not invent weak options merely to fill a layout.

## Refinement Directly on an Option

Every option should include a lightweight refinement field.

The Pilot may write a small instruction such as:

- "Keep this option but make it less dramatic."
- "Use option B, but preserve the ending from option A."
- "Reduce the camera movement."
- "Make the language more natural and less formal."
- "Everything is right except the final beat."

The user should not need to rewrite the full solution.

The system should:

1. preserve the original option;
2. create a new version derived from it;
3. apply the refinement using the same governing context;
4. show what changed;
5. preserve provenance;
6. allow comparison with the original;
7. let the Pilot approve the refined version as the selected option.

Possible actions:

- Select
- Refine
- Compare
- Combine
- Save as custom option
- Reject
- Explain recommendation

## Option Versioning

Options and refinements must be versioned.

Example:

option-b:v1
→ Pilot refinement: "less dramatic, more physical"
→ option-b:v2

The system must preserve:

- source option;
- refinement instruction;
- context version;
- expertise versions;
- model and effort used;
- resulting changes;
- Pilot verdict.

Never overwrite the original option.

## Combining Options

Where the decision permits it, the Pilot may combine parts of alternatives.

Example:

"Use the structure of option A, the sound direction of option B, and remove
the final camera move."

The Kernel should produce a new custom candidate, not silently mutate one of
the originals.

The resulting option must state:

- source elements;
- conflicts resolved;
- assumptions introduced;
- expertise applied;
- changes from each source.

## UI: Decision Surfaces

The product should display governed decisions as clear visual cards.

Each decision surface should show:

- what part of the project was processed;
- what decision is being made;
- why it matters;
- whether it blocks progress;
- the available options;
- the Kernel recommendation;
- expertise applied;
- expected consequences;
- one small refinement field per option;
- one dominant selection action.

The user should be able to understand the differences without reading raw
agent outputs.

Suggested card structure:

Option title
One-line direction

What this changes
A short list of affected project elements.

Why choose it
Primary benefit.

Watch out for
Main trade-off or risk.

Human intelligence used
Relevant admitted expertise.

Actions
Select
Refine
Details

## Questions and Options Must Work Together

A question may unlock an option set.

Example:

Question:
"Should the transformation feel tragic or triumphant?"

After the answer, the Kernel produces three concrete treatments.

Likewise, an option set may reveal one final material question.

Example:

The Pilot chooses an intimate direction.

Kernel:
"To execute this responsibly, one detail remains: is the opponent visible?"

Do not force the entire project into either interview mode or option mode.

The Kernel chooses the smallest useful interaction at each moment.

## The Pilot Is Not a Prompt Engineer

Add this as a product and architectural principle:

The Pilot must not need to know how to prompt the model well.

The product converts ordinary human direction into governed operational
instructions.

The user may express:

- preference;
- correction;
- rejection;
- combination;
- degree;
- exception;
- emphasis.

AgentOS is responsible for turning that into a complete Work Order with the
necessary context, expertise, constraints and output contract.

A small user refinement must not cause context loss.

The Kernel must preserve everything already decided unless the user explicitly
changes it.

## Learning from Options and Refinements

Selections and refinements are valuable evidence, but not automatic truth.

Record:

- which option was chosen;
- which options were rejected;
- rejection reasons;
- which parts were combined;
- the user's refinement;
- the approved final version;
- the outcome after execution.

A refinement may generate a candidate GuruSeed.

Example:

Observed pattern:
The Pilot repeatedly selects restrained versions but adds stronger physical
consequence.

Candidate expertise:
"In dramatic buildup, Hélder prefers restraint in spectacle but visible
physical cost."

This remains candidate expertise until the Pilot inspects, scopes and admits
it.

Do not infer a permanent preference from one decision.

## Foundation Addition — Minimal Sufficient Interaction

Register this principle in the Foundation:

### The System Minimises Governance Burden

The human governs judgement, not information plumbing or solution synthesis.

For every required interaction, the Kernel must choose the lowest-burden form
that preserves human authority:

- reuse known information before asking;
- ask a question only when an essential unknown remains;
- offer concrete options when the decision space can be bounded;
- recommend when evidence favours one direction;
- allow lightweight refinement instead of requiring complete rewrites;
- preserve all existing context through refinements;
- record every consequential choice and its provenance.

A system that repeatedly asks the Pilot to generate what it could have
responsibly proposed is failing to digest the project.

### Governance Must Produce Leverage

Each Pilot interaction should create more value than burden.

A click, answer, selection or refinement should:

- unblock meaningful work;
- improve the artifact;
- narrow the decision space;
- teach reusable judgement;
- reduce later questions;
- or prevent material risk.

Interactions that do none of these should not reach the Pilot.

## Foundation Addition — The Decision Surface

Define a first-class concept:

Decision Surface

A Decision Surface is the Kernel's governed presentation of one consequential
project choice.

It contains:

- the decision;
- relevant context;
- distinct options;
- assumptions;
- trade-offs;
- recommendation;
- expertise applied;
- effort implications;
- refinement capability;
- provenance;
- the Pilot's final choice.

Only the Kernel addresses the Pilot through a Decision Surface.

Agents may produce candidate material, but they do not present themselves or
their internal deliberation directly to the user.

## Implementation Slice

Implement one complete option-based slice before expanding further.

1. Select one processed project decision.
2. Generate three genuinely distinct options.
3. Show them as visual cards.
4. Include recommendation and expertise used.
5. Allow the Pilot to refine one option with a short natural-language note.
6. Produce a versioned refined option.
7. Show a concise diff.
8. Allow the refined option to be selected.
9. Update candidate Project State from the selected option.
10. Record the whole lineage in evidence.
11. Extract a possible candidate GuruSeed from the selection/refinement.
12. Show that candidate for Pilot governance.

Test acceptance:

- Can the Pilot make a meaningful decision without writing a full prompt?
- Can the Pilot refine a good option in under one sentence?
- Does the refinement preserve all prior context?
- Are the alternatives genuinely distinct?
- Is it clear why the Kernel recommends one?
- Can the user see what expertise shaped each option?
- Can the system trace the final selection back to sources and refinements?
- Does the interaction feel easier than answering open-ended questions?

## Final Product Language

The desired experience is:

"I describe what I want.

AgentOS digests the project.

When it needs facts, it asks only what matters.

When it can formulate solutions, it gives me clear options.

I choose, combine or adjust them in ordinary language.

The system preserves the context, applies my accumulated expertise and
continues the work.

I govern direction without having to perform the system's synthesis."

This is more interactive, not less governed.

It reduces work without reducing authority.

It is the correct expression of:

AI works.
Humans govern.

---

## The two orienting sentences (the Pilot's, for the Foundation)

> O Pilot governa através de respostas, escolhas, correções e refinamentos —
> não através da obrigação de inventar soluções que o sistema já pode
> formular.

> Uma pergunta é apropriada quando falta conhecimento. Uma Decision Surface é
> apropriada quando falta julgamento.

Pergunta resolve incerteza. Opções resolvem decisão. Refinamento resolve
desalinhamento parcial.

---

## Copilot's registration notes (Session 010)

1. This corrects finding 1 of the first real run (diary addendum 8): the
   interview grew because questions were the only instrument the shell had.
   The correction is architectural, not cosmetic — the Kernel now owes a
   choice of instrument per interaction, and the option instruments require
   the Human Intelligence slice (options must display the expertise that
   shaped them).
2. Reconciled with Article 9 in ADR-0020: material blocking uncertainty asks;
   non-blocking uncertainty becomes a recorded assumption; the Pilot may
   declare context sufficient at any time; the system never needs 90%
   certainty about everything — only about governing intent.
