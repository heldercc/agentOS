# Chapter III — Terminology

Words are load-bearing. Every document in this book uses these terms exactly as
defined here; a concept that is not in this chapter does not officially exist.
New concepts enter here first.

## Roles

- **Pilot** — the human owner. Sets direction, teaches expertise, approves
  decisions. The final authority (Article 1).
- **Copilot** — any AI collaborator working *with* the Pilot on AgentOS itself:
  its architecture, book and code. Copilots are deliberately fungible; Navigation
  exists so that any Copilot, on any day, can resume with full context. Distinct
  from Mentors, which work *inside* the running system.

## Actors

- **Agent** — the generic term for an autonomous executor operating under Kernel
  governance. In the Foundation, exactly one kind of Agent exists:
- **Mentor** — an Agent equipped with one or more Mentor Expertises. Mentors do
  the intelligent work. (Hierarchies of subordinate agents are an Incubator idea,
  not a Foundation concept.)
- **Mentor Expertise** — a named, versioned bundle of capability: the seeds,
  context rules and behavioral constraints that define how a Mentor thinks in a
  domain. Substance, not personality (ADR-0002).

## Expertise

- **GuruSeed** — the atomic unit of captured expertise: an explicit, versioned
  heuristic ("when X, prefer Y, because Z"). Owned by the Pilot; reviewable,
  testable, retirable. Founding anatomy sketch (pre-formalization): intent,
  domain, the human knowledge itself, application context, explanation,
  refinement history. Small enough to state a heuristic; rich enough to explain
  a decision.
- **Seed Composer** (ADR-0007) — the teaching mechanism: the
  Pilot expresses expertise in natural language; the system interprets,
  structures, asks confirmation, saves and versions. The Pilot never writes
  formats. Composer puts seeds in; the Resolver takes them out.
- **Seed Harvester** (ADR-0009) — the learning mechanism: observes governance
  outcomes, detects recurring success (an output or feature selected
  repeatedly), distills it into a candidate seed and presents it to the Pilot
  with evidence. Incorporation happens only upon the Pilot's validation.
- **Seed origin** — every GuruSeed records how it entered: `taught` (via
  Composer, directly from the Pilot) or `learned` (via Harvester, from
  observed success, validated by the Pilot). Two origins, one gate.
- **Seed Resolver** — the mechanism that, for a given task, resolves which
  GuruSeeds belong in a Mentor's context. Resolution is deterministic and logged:
  for any action, it is always knowable which seeds were active and why.
  (Renames "InjectSeed" — see ADR-0005.)
- **Seed lifecycle** — founding sketch: idea → draft → candidate (on
  probation, applied but watched) → approved → core (constitutional to a
  Mentor; maximally protected by Article 4) → deprecated → archived. Sketch
  only; full design owes an ADR before Phase 5.

## Context & State

- **Context** — the working set assembled for a Mentor's action: resolved seeds +
  Project State + Memory + task input. Always explicit, always enumerated in the
  audit log. Context is a scheduled resource (Article 5), not something the Pilot
  repeats.
- **Project State** — the versioned snapshot of everything the system knows about
  one ongoing project: goals, constraints, decisions, progress. Scoped to a
  project; ends when the project ends.
- **Memory** — knowledge that outlives projects: durable facts and outcomes.
  Distinct from Project State (per-project) and from seeds (judgment, not facts).
- **Artifact** — any output of a Workflow: document, code, analysis, decision.
  Every Artifact carries provenance: the seed and context versions that produced it.
- **Render Order** — the terminal Artifact of a creative production line: a
  complete, renderer-agnostic specification (story, characters, shots, style,
  production detail), accumulated through governed refinement across sessions.
  So complete that execution (rendering) becomes a swappable commodity step.
  Named for the first production line; the pattern generalizes to any vertical.

## Governance

- **Kernel** — the governance core. The only component that authorizes execution,
  schedules context, spends effort budget and writes the audit log. The Kernel
  does no intelligent work; it governs it.
- **Workflow** — a defined multi-step unit of work, executed by Mentors under a
  Kernel work order, producing Artifacts.
- **Effort Probe** — the Kernel instrument that, before execution, estimates the
  effort a piece of work will demand — tokens, time, refinement rounds — and the
  return it is likely to produce, culminating in a recommendation the Pilot can
  act on. After execution it measures actuals, and the gap between estimate and
  actual calibrates the next estimate. (Supersedes "Cost Probe" — see ADR-0006.)
- **Executive Mode** — the Pilot-facing interaction pattern: situation → options
  → recommendation → effort → decision. Designed for governing work, not doing it.
- **Navigation** — the continuous architectural memory between Pilot and Copilot.
  Not documentation and not history for its own sake: Navigation preserves
  *direction*. `CURRENT.md` stays intentionally small (mission, heading, state,
  open questions, next bearing); monthly logs preserve how the direction evolved.
