# Chapter VI — Objectives for Book II (Code)

Book I fixed the philosophy and the architecture. This chapter fixes what the
code must *prove*. Each objective is concrete, testable, and owned by the
Pilot; Book II (Engineering) begins by turning these into designs, and every
future demo is measured against this list — nothing else.

## The Two Grand Objectives

Registered by the Pilot, 2026-07-12 (Session 006), as the two poles that
everything below serves. Neither is new — both were already distributed
across O1–O9 — but the hierarchy is now explicit: when priorities collide,
these two win, and every owed ADR must say which pole it feeds.

**Grand Objective A — Token economy (the Kernel; pure engineering).**
Saving and better use of tokens. Not a cliché: the system is designed to
scale, and at scale context cost is the survival variable. Everything
already decided points here — context as a scheduled resource (ADR-0003),
the Beta question frozen on exactly this bet (ADR-0012), the Effort Probe
(ADR-0006), O7 as the proof. Evidence from the expertise store:
just-in-time-context (over-loading degrades *reasoning*, not just cost — the
scheduler may win on quality, not merely hold it).
*Served by: O7, and the Kernel/Scheduler/Effort-Probe ADRs owed in
engineering/OVERVIEW.md §5.*

**Grand Objective B — Taste governance by clicks (the user's loop).**
The agentOS user improves their own agents with their own taste, entirely in
governance mode: go to the app, verify results, approve, iterate — "kit kat,
back to the app" — day after day. Selection is the teaching signal: work the
Pilot chooses more often is suggested more often, distilled into candidate
seeds the Pilot validates (never auto-admitted — O5). Deliberate workaround:
no direct API access, no fine-tuning, no m2m — the learning lives embedded
in the agentOS UI as seeds plus selection evidence, so iteration is *easy
with clicks* (ADR-0013 spirit). Evidence from the expertise store:
recognition-over-recall (experts teach best by correcting concrete cases —
which is exactly what an approve/reject click is) and approval-fatigue
(clicks must stay few and meaningful, or the gate stops being a gate).
*Served by: O1, O2, O3, O4, O5, O6; surface owed as the Executive Mode /
App shell ADR.*

The two poles check each other: A without B is a cheap engine nobody can
steer; B without A is a governance toy that dies at scale.

## O1 — The Daily Governance Loop

Open the App → the Kernel loads Project State (nothing re-explained) → open
decisions presented per layer → the Pilot evaluates, approves, deletes → the
Mentors work the consequences → tomorrow, new proposals are waiting.
**Proven when:** the Pilot governs a real objective in minutes a day, across
many days, and the thread never breaks between sessions.

## O2 — Workers Are Governed, Not Coded

The Pilot creates, edits, improves and retires Mentors through the same loop
— never by writing formats or touching code (ADR-0008).
**Proven when:** a new agent with a new skill exists for a new project, and
the audit log shows it was born and shaped entirely through governance.

## O3 — Taught Expertise (Seed Composer)

The Pilot expresses judgment in natural language; the system structures,
confirms, versions (ADR-0007).
**Proven when:** a seed taught today visibly changes a Mentor's proposals
tomorrow, and its provenance says "taught by the Pilot".

## O4 — Learned Expertise (Seed Harvester)

The system observes its own work and detects recurring success — an agent's
output selected repeatedly, a feature approved again and again — and distills
the pattern into a **candidate seed**, presented to the Pilot with its
evidence (ADR-0009). The Pilot validates, edits or discards; only then is it
incorporated — into a Mentor, or into the system itself.
**Proven when:** at least one seed in active use was *harvested from observed
success* and *integrated by the Pilot's explicit decision*, and its provenance
says so.

## O5 — One Gate for All Expertise

Two origins — taught and learned — one gate: the Pilot. Nothing enters a
Mentor or the system without validation (Article 4). Every seed carries its
origin, its evidence, and its integration decision.
**Proven when:** the seed store can answer, for every seed: who created it,
from what, validated when, incorporated where.

## O6 — The Compounding Brain

Use by use, day by day: seeds accumulate, Mentors improve, new agents appear
for new projects — and all of it is the Pilot's asset: explicit, versioned,
portable, independent of any model vendor. The Kernel is fed by the Pilot's
taste, whether implemented directly or learned-and-validated.
**Proven when:** month N's factory is measurably more capable than month 1's,
and the difference is enumerable as seeds and Mentor versions — not vibes.

## O7 — The Scheduler Beats Full Reload

Approved decisions, seeds and state are *resolved* into context, never
re-consumed (Article 5). The honest baseline is not yesterday's session — a
harder project may legitimately need more context — but the **full-reload
strategy** for the same task.
**Proven when:** for equivalent task and quality, scheduled context consumes
measurably less than full reload — tracked as tokens avoided vs. baseline,
reuse ratio, and cost per approved decision — with quality constant or
better, and the reused context explicit in the audit log.

## O8 — First Cargo: the Render Order

The 15-second fight spec accumulates through governed refinement until any
rendering system could execute it (Phase 4).
**Proven when:** Render Order v1 exists with full provenance.

## O9 — The Agnosticism Proof

A second, unrelated objective runs through the same engine with zero Kernel
changes (Phase 5, ADR-0008).
**Proven when:** the proof holds, or every leak has become a corrective ADR.
