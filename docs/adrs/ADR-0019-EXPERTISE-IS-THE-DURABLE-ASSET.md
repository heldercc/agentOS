# ADR-0019 — Expertise Is the Durable Asset

- **Status:** Implemented (the Pilot's verbatim directive is
  docs/FOUNDATION-CORRECTION.md, Session 009, 2026-07-12 morning; built the
  same session)
- **Pole:** both. (A) token economy — expertise is a scheduled context
  element under the effort budget, and reuse is the whole point; (B) taste
  governance by clicks — expertise enters, is admitted, scoped and retired
  only by the user's hand.
- **Doctrine:** docs/FOUNDATION-CORRECTION.md; ADR-0002 (Mentor Expertises
  replace personas) now enforced at product level.

## Question

How does the shell stop being "a multi-agent demo that works" and become
what AgentOS is — a governed system for capturing, organising, selecting,
applying and evaluating human intelligence, visibly?

## Decision

### 1. Expertise is a first-class store, governed by the user

`src/expertise.ts`. One record: id, title, body (the judgement itself),
scope tags, status (`candidate` → `admitted` | `discarded`), reach
(`project` | `reusable`), provenance (origin + note: who taught it, where it
came from), and `appliedIn` — the automatic trail of every work order whose
context it entered.

Two stores: `workspace/<project>/expertise.json` (project-local) and
`workspace/_shared/expertise.json` (reusable across projects). The user
adds candidates, admits, scopes and discards in the Expertise Library page;
every transition is a pilot-actor evidence event. The Kernel NEVER admits —
same law as the rig's seed tray (ADR-0015 O5).

### 2. A runtime agent is a composition, not a personality

Every consult, re-consult, synthesis and execution work order is composed
as: **mandate + relevant project context + applicable admitted expertise +
effort budget** (tools arrive when the shell grows them). Applicable =
admitted, and scope tags overlap the agent's tags (untagged expertise
applies project-wide). Expertise enters the context BEFORE other optional
elements — judgement outranks history under a tight budget — and the
manifest records each piece with its selection reason. Drops are visible,
never silent.

The roster is a convening of temporary vessels, and the UI now says so.
The question is never "which permanent agent do we have?" but "what
expertise is needed, and what temporary agent should apply it?"

### 3. The story of the project is a product surface

`storyOf()` in the kernel assembles, per iteration and entirely from disk
(evidence + work orders + manifests + questions + states + artifacts), the
timeline the directive demands: intent → questions → answers → agent
contributions → candidate state → user governance → execution → artifacts →
next action. Each agent contribution shows the mandate, the expertise it
received and why, and the output it produced.

Operational provenance is exposed; private model reasoning is not (the
shell only ever has outputs — responses, artifacts — and manifests; nothing
else is stored, so nothing else can leak).

### 4. The eight questions are the acceptance test of the UI

What did I ask for? What did the system understand? Who worked on it? What
expertise was used? What did each phase produce? What changed? Why am I
being asked to decide this? What happens next? — every one must be
answerable from the project workspace page without opening a file. A
workflow that functions but is not understandable to the user is incomplete.

## Consequences

- The rig's learned-seeds line is this asset's future SOURCE: distilled
  candidates from governed clicks will land in the same tray the user's own
  hands feed. Nothing of the rig was touched today.
- Owed next, recorded not built: success/failure annotation on expertise
  ("where it won, where it failed") wired to evaluations; tools as a
  scheduled element; semantic dedup of question needs; the governed
  "enough questions" exit (finding 1 of the first real run).
- Evidence actions grew: `expertise_added`, `expertise_admitted`,
  `expertise_discarded`.

## Verification

- Smoke extended (fake runtime): candidate added → admitted → next consult's
  manifest carries the expertise element with a reason → `appliedIn` records
  the work order → story endpoint returns the full phase timeline.
- tsc strict clean; browser pass on the workspace page and Expertise Library.
