# Terminology

The shared vocabulary of AgentOS. Terms are used consistently across all documents;
if a document needs a concept not listed here, this file is updated first.

## Roles

- **Pilot** — the human owner of the system. Sets direction, teaches expertise,
  approves decisions. The final authority (Principle 1).
- **Copilot** — an AI collaborator working *with* the Pilot on the system itself
  (architecture, docs, code). Distinct from Mentors, which work *inside* the system.

## Core Runtime Concepts

- **Kernel** — the governing core. Enforces principles at runtime: cost budgets,
  scope limits, approval gates, audit logging. Nothing executes outside the Kernel.
- **Agent** — any autonomous executor operating under Kernel governance. Mentors
  are the primary kind of Agent.
- **Mentor** — an Agent configured with one or more Mentor Expertises. Mentors do
  the intelligent work: analyzing, drafting, deciding-within-scope.
- **Mentor Expertise** — a named, versioned bundle of capability: the seeds, context
  rules and behavioral constraints that define *how a Mentor thinks* in a domain.
  Replaces the older, vaguer notion of "personas" (see ADR-0002).
- **Workflow** — a defined multi-step unit of work, executed by one or more Mentors
  under Kernel supervision, producing Artifacts.
- **Runtime** — the execution environment where Mentors run Workflows: scheduling,
  tool access, sandboxing.

## Expertise Capture

- **GuruSeed** — the atomic unit of captured expertise: an explicit, versioned
  heuristic ("when X, prefer Y, because Z"). Written and owned by the Pilot;
  reviewable, testable, retirable.
- **InjectSeed** — the mechanism that selects and injects relevant GuruSeeds into a
  Mentor's context at execution time. Selection is deterministic and logged: it is
  always knowable which seeds were active for a given action.
- **Seed lifecycle** — the states a GuruSeed moves through: *draft → active →
  refined (new version) → retired*. (Exact lifecycle under design — see
  navigation/CURRENT.md open questions.)

## State & Output

- **Project State** — the explicit, versioned snapshot of everything the system
  knows about an ongoing project: goals, constraints, decisions, progress. The
  antidote to context evaporation between sessions.
- **Context** — the full set of information available to a Mentor for a given
  action: Project State + injected seeds + memory + task input. Always explicit,
  always enumerable (Principle 4).
- **Memory** — persisted knowledge that outlives a single Workflow, distinct from
  Project State (which is per-project) and from seeds (which are judgment, not facts).
- **Artifact** — any output produced by a Workflow: document, code, decision record,
  analysis. Every Artifact is traceable to the seeds and context that produced it.

## Interaction & Governance

- **Executive Mode** — the Pilot-facing interaction model: the system presents
  situation → options → recommendation → cost, and the Pilot decides. Designed for
  governing work, not doing it.
- **Navigation** — the long-term architectural compass: session logs plus a CURRENT
  state file, enabling any session (human or Copilot) to resume with full context.
- **Cost Probe** — the Kernel instrument that measures the real cost (tokens, money,
  time) of any operation before and after execution. Feeds budget enforcement
  (Principle 7).
