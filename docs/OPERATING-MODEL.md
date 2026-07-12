<!-- AgentOS provenance: origin=taught | producer=the Pilot (verbatim directive, Session 007, 2026-07-12 night) | gate=none needed — this is the owner's voice | status=DOCTRINE. Registered by the Copilot with two implementation notes at the end. -->

# The Operating Model of AgentOS

Read this as the operating model of AgentOS.

Do not treat AgentOS as:
- a chat app;
- a project manager;
- a dashboard;
- a multi-agent demo;
- a prompt exporter;
- a workflow builder;
- or a wrapper around Claude Code.

AgentOS is a governed operating layer for turning human intent into iterative work.

Its core loop is:

Pilot intent
→ Kernel digestion
→ agent deliberation
→ governed options
→ Pilot choice
→ execution
→ artifacts and evidence
→ updated Project State
→ next iteration

The system exists to keep this loop coherent, cheap, resumable and governable.

## 1. The Pilot

The Pilot is the authority.

The Pilot does not micromanage plumbing.

The Pilot governs through:
- intent;
- choices;
- approvals;
- corrections;
- scope;
- effort;
- final judgement.

The Pilot should not need to:
- manually coordinate agents;
- transport prompts;
- rebuild context;
- inspect internal orchestration;
- approve every technical movement.

The system may automate movement.

It may not automate authority.

## 2. The Kernel

The Kernel is not "the smart agent".

The Kernel is the governor and organiser of work.

It:
- receives Pilot intent;
- maintains the smallest sufficient Project State;
- schedules relevant context;
- convenes the required agents;
- aggregates their needs;
- creates Work Orders;
- controls boundaries;
- records evidence;
- surfaces decisions;
- advances the project after governance.

The Kernel owns authority boundaries.

It does not own taste.

It does not silently reinterpret the Pilot.

## 3. Agents

Agents are bounded specialists.

They may:
- inspect;
- reason;
- propose;
- critique;
- execute;
- evaluate;
- request information.

They do not speak independently to the Pilot.

They do not change authoritative state.

They do not admit expertise.

They do not decide project direction.

Many agents may deliberate.

Only the Kernel addresses the Pilot.

## 4. Questions

Agents may discover missing information.

Those needs become Question Needs.

The Kernel:
- collects them;
- deduplicates them;
- merges overlaps;
- ranks them;
- detects contradictions;
- asks one clear question at a time;
- distributes the answer back to relevant agents.

The visible interview is singular.

The internal demand for context is plural.

A question is asked only when the answer materially improves the next decision or execution.

Do not interview for completeness.

Interview to unblock useful work.

## 5. Governance

Governance is not a final approval screen.

Governance is the structure of the entire loop.

Every important transition should answer:

- What is being proposed?
- Why?
- Based on which context?
- What alternatives exist?
- What is the scope?
- What changes if accepted?
- What remains reversible?
- Who has authority?

Governance examples:

For creative direction:
- agents propose options;
- the Pilot judges;
- the selected option becomes authoritative.

For Project State:
- the system may propose an update;
- the Pilot approves consequential changes.

For Seeds:
- repeated behaviour creates a candidate;
- evidence is shown;
- the Pilot admits, scopes or discards it.

For execution:
- low-risk internal movement may run automatically;
- destructive, external, expensive or scope-changing work requires approval.

For effort:
- the Effort Probe recommends a level;
- the Pilot may adjust it;
- the system chooses the smallest adequate model and agent set.

Governance means:
automation below the authority line,
human judgement above it.

## 6. Project State

Project State is not the full history.

It is the smallest sufficient account of the project now.

It should contain:
- objective;
- current phase;
- approved decisions;
- active artifacts;
- unresolved questions;
- constraints;
- next meaningful action.

History, evidence and logs remain available separately.

The Pilot should be able to leave and return without reconstructing the project mentally.

## 7. Context

Context is a schedulable resource.

Do not feed every agent the whole project.

For every Work Order:
- select only relevant state;
- include required evidence;
- include applicable Seeds;
- record the manifest;
- control token budget;
- explain what was selected.

The system should reduce repeated loading while preserving quality.

This is not an optimisation added later.

It is a central architectural responsibility.

## 8. Execution

For the current Beta, Claude Code is the local execution runtime.

AgentOS lives above it.

AgentOS:
- prepares Work Orders;
- invokes Claude Code;
- allows Claude Code to spawn bounded subagents;
- captures structured results;
- stores artifacts and evidence;
- updates candidate state;
- continues the loop.

Claude Code executes.

AgentOS governs.

The Pilot should not manually copy prompts or move dumps in the normal path.

The local filesystem remains visible and durable.

## 9. Effort

Not every iteration deserves the strongest model.

The Effort Probe should estimate:
- complexity;
- token need;
- agent need;
- time;
- expected gain;
- risk.

The UI exposes a simple effort slider.

The chosen level controls:
- model;
- number of agents;
- context budget;
- turns;
- alternatives;
- critique depth;
- retries.

Development defaults to low effort.

Spend intelligence where judgement matters.

Use cheap execution elsewhere.

## 10. Learning

Clicks and choices are evidence.

They are not automatically expertise.

A pattern may become a candidate Seed.

The Seed must preserve:
- where it came from;
- where it won;
- where it failed;
- project;
- scope;
- dates;
- prompt versions;
- supporting evidence.

The Pilot decides whether it is:
- local to the project;
- reusable;
- deferred;
- discarded.

The real proof of learning is downstream:

Did the Seed enter later context?
Did it change a proposal?
Did the Pilot prefer the result?
Did it reduce retries or effort?

## 11. The Songoku Beta

Songoku is the hard-coded test case.

The workflow is hard-coded.

The creative answer is not.

The Pilot enters AgentOS and creates Songoku.

Inside AgentOS, the Pilot:
- describes the intended scene;
- answers aggregated questions;
- sees the project become clearer;
- governs creative options;
- chooses effort;
- lets agents execute;
- receives artifacts;
- reviews what changed;
- continues the next iteration.

The scene must be conceived inside AgentOS.

Do not pre-author:
- the final scene;
- the shot list;
- the emotional arc;
- the camera plan;
- the sound design;
- the transformation sequence.

Hard-code the experiment.

Do not hard-code the answer.

## 12. Product Experience

The product should feel like:

"I state what I want.
The system digests it.
A team works underneath.
I see only the questions and choices that matter.
I decide.
The work continues.
I can leave and return.
The system becomes more useful without taking control away from me."

That is AgentOS.

## 13. Implementation Test

Before adding any feature, ask:

Does this improve one of these?

- understanding Pilot intent;
- scheduling context;
- coordinating agents;
- reducing cognitive reload;
- surfacing governed choices;
- executing bounded work;
- preserving evidence;
- learning reusable judgement;
- controlling effort;
- resuming the project.

If not, it is probably drift.

Final principles:

The Pilot governs.
The Kernel coordinates.
Agents deliberate and execute.
Context is scheduled.
Evidence is preserved.
Learning is admitted, not assumed.
Automation moves the work.
Human judgement directs it.

---

## Copilot's registration notes (Session 007)

1. **§11 was applied the night it arrived.** The pre-authored scene draft
   (SCENE-DRAFT.md, produced by a subagent in Session 006) was deleted before
   ever being committed: it was exactly what §11 forbids — the answer written
   before the loop ran. The test cargo keeps only the hard-coded workflow
   (six pre-registered decisions, three approaches); the scene itself will be
   conceived decision by decision inside the governed loop.
2. **Naming.** The committed test cargo uses an original hero (Aran,
   `ascensao-t2`) per the Pilot's same-night decision on the IP flag —
   "genericize and commit". The workflow is the Songoku Beta's workflow,
   verbatim; only the character name differs in the public artifact. If the
   Pilot wants the name restored in his local runs, that is a data-file edit,
   not a code change.
