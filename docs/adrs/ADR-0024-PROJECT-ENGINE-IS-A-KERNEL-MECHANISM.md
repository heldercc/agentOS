# ADR-0024 — Project Engine and Project Map

- **Status:** Ratified by implementation authority already granted in
  ADR-0022 §4; this ADR fixes the contract before durable code.
- **Pole:** both — token economy through deterministic movement; taste
  governance through material Project Maps the Pilot can understand.
- **Parent:** Kernel, Governance Plane. This is not a fourth plane and not a
  second orchestrator.

## Problem

The current loop repeatedly returns to a global Compreender stage. It has no
durable account of how a project divides into independently governable work,
which parts depend on which, what may proceed, and what a later correction
invalidates. A model can propose such structure, but must not become the
structure's permanent walker or authority.

## Decision

The **Project Engine** is an internal Kernel mechanism. It owns no executor,
context assembler, agent channel, audit log, authority or parallel FSM.

The **Project Map** is governed State: a versioned, domain-free DAG of
Project Slices. Project State remains the smallest sufficient description and
contains only a reference to the approved Map; the Map enters context only
when a Work Order needs topology.

A **Project Slice** is the smallest unit that can be understood, governed,
executed and evaluated independently enough to have its own purpose,
dependencies, expected Artifacts, material decisions and lifecycle status.
It is not a prompt, an agent, a phase name or a domain object.

The **Slicer** is an authorized Workflow:

1. Kernel creates one slicing Work Order and an enumerated context manifest.
2. A temporary model role proposes a Candidate Project Map.
3. Kernel validates IDs, references, acyclicity, reachability and status.
4. Kernel compares it with the approved Map and surfaces material change.
5. Pilot approves or rejects. Only approval creates a new Map version.
6. Kernel records the transition in its existing evidence stream.

After approval, graph mechanics are deterministic and use zero model tokens:
find the next unblocked Slice; block work with unmet dependencies; preserve
unaffected work; mark downstream dependents affected; navigate backward;
resume from completed Work Orders. AI re-enters only when semantic impact
cannot be derived from the graph, and returns another proposal.

## Authority and concurrency

- Initial structure, added/removed Slices, dependency changes, child-project
  creation, invalidation of completed work and abandonment are material.
- Candidate approval requires the expected current Map version. A stale tab
  receives a conflict; it never overwrites newer authority.
- Reversible status movement allowed by the approved graph is Kernel movement
  under the Pilot's chosen action and is recorded, not re-decided by a model.
- Child projects are not part of the MVP. A Slice may become a candidate for
  extraction later, but no child is created before a separate governed gate.

## Invariants

- Every model call has a Kernel Work Order and context manifest.
- Candidate Maps never schedule work.
- Approved Maps are immutable versions; current is an atomic pointer/value.
- Slice IDs are stable inside a project; dependencies reference existing IDs;
  cycles are invalid.
- Project State and Project Map cannot silently diverge.
- No domain word or vertical policy enters Project Engine code.
- No model is called for graph traversal or lifecycle bookkeeping.

## Pandora boundary

Slicing and child projects remain explicitly exploratory. MVP proves one
level of Slices, dependencies, approval, deterministic traversal and impact.
Nested Slices are representable through `parentId`; automatic child-project
creation, resource scheduling across projects and semantic auto-reslicing are
deferred until real use produces counterexamples.
