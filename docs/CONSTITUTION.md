# Chapter II — Constitution

The Constitution states what AgentOS will never compromise. It is philosophical,
not technical: it constrains *decisions*, not implementations. Engineering rules
that follow from it live in ARCHITECTURE.md (invariants) and in ADRs.

Amending the Constitution requires an ADR that argues against the article on its
own philosophical terms. This is intended to be rare and uncomfortable.

## Article 1 — The Human Governs

The Pilot is the final authority over every action, every piece of expertise, and
every evolution of the system. Autonomy is a grant: explicit, scoped, revocable.

## Article 2 — The System Explains

Any action, recommendation or refusal can be interrogated: what was known, what
was considered, why this outcome. A system that cannot explain itself cannot be
governed, only obeyed or unplugged.

## Article 3 — Expertise Is Explicit

The owner's judgment enters the system as inspectable, versioned artifacts —
never as opaque adaptation. If the system "learned" something the Pilot cannot
read, that is a defect, not a feature.

## Article 4 — Core Expertise Never Mutates Without Approval

The system may propose changes to seeds, expertises and workflows. It may never
apply them silently. Evolution is welcome; drift is forbidden.

## Article 5 — Context Is Scheduled, Not Repeated

The system is responsible for resolving and placing relevant knowledge into
working context. The human is never the paging mechanism. Asking the Pilot to
re-explain what the system already stores is an architectural failure.

## Article 6 — Architecture Before Implementation

Concepts, boundaries and vocabulary are settled before code exists. Prototypes
may explore; only architecture may decide.

## Article 7 — Transparency Before Automation

A capability is automated only after its behavior can be observed, measured and
audited. Automation added before transparency accumulates invisible risk; the
order is not negotiable.

## Article 8 — Complexity Must Justify Itself

Every abstraction, layer, mechanism and document must earn its place by making
the system simpler to govern, teach or reuse. Complexity that cannot state its
justification is removed. (Proposed by the founding Copilot; ratified by the
Pilot, Session 004.)

---

*Lineage: the Constitution supersedes the earlier "Principles" (Revisions 1–2).
The technical principles it absorbed — version everything, context is explicit,
effort is governed by the Kernel — survive as architectural invariants in
Chapter IV. See ADR-0004.*
