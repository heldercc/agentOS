# Book II — Engineering Overview

> Answers the founding Book II brief
> ([heritage](../docs/heritage/2026-07-GPT-BOOK-II-ENGINEERING-BRIEF.md)),
> reconciled against ratified Book I. Written 2026-07-11. Owner: the Pilot.
> Discipline: Articles 6, 8, 9 — evidence revises architecture only through
> ADRs; complexity justifies itself; doubt triggers an interview.

## 1 · Purpose of Book II

Book I fixed *why* and *what*: Vision, Constitution (nine articles),
conceptual architecture (three planes), objectives O1–O9, roadmap. Book II
turns those into designs and code — **hypothesis-first**. The only original,
unproven bet in the whole architecture is Article 5 made measurable by O7:

> **Context is a schedulable resource** — a scheduler can resolve stored
> decisions into working context and beat the full-reload strategy on tokens
> without losing quality.

Everything else (governance gates, versioned stores, blind judgment) works
almost by construction. So Book II spends its first effort where the thesis
can die, and only then builds outward. This ordering was ratified as ADR-0012
before any code existed.

**Status at the time of writing — the brief's mission is partly discharged:**
the vertical slice it asks for is *built, verified and committed* as
`experiments/beta-coding/` (ADR-0012 rig, ADR-0013 manual model port, local
dashboard). What the hypothesis still owes is not design but **evidence**:
the Pilot's real corpus, a real run, and the Pilot's blind verdicts.

## 2 · Component Breakdown

The brief names nine components. Book I's architecture (Chapter IV) sorts
them by kind — actors, contracts, stores, mechanisms — and that sorting is
binding: a component list is not an architecture. Each component below states
its responsibility, its boundary, its current status, and the design ADR it
owes before real (non-experiment) code. Placeholder directories under
`engineering/` stay empty until that ADR exists — standing doctrine.

### Actors

**Kernel** *(Governance Plane)* — the Constitution, embodied. Sole authority
to authorize execution (work orders), meter and later estimate effort,
schedule context (invoking the Seed Resolver), write the audit log. Does no
intelligent work; small and boring by design.
*Boundary:* nothing executes outside a Kernel work order; only the Kernel
spends budget.
*Status:* proto-Kernel exists inside the Beta (work-order writer, runner,
baseline-first enforcement, audit manifests). *Owes:* ADR — Kernel v0 design
(Phase 1) after Beta evidence.

**Context Scheduler** *(a Kernel function, not a separate actor)* — assembles
the working context for a work order by resolving stored knowledge instead of
reloading it. In the Beta it is deliberately crude: two strategies
(`full-reload`, `scheduled`) behind one interface.
*Boundary:* may only place elements it enumerates in the manifest; caching
that corrupts token accounting is forbidden.
*Status:* Beta v0 running. *Owes:* the real Scheduler design ADR (Phase 3) —
**explicitly deferred until O7 evidence exists** (ADR-0012 boundary; do not
design it before the Beta answers).

**Tool Runner** *(Intelligence Plane edge)* — executes language-agnostic
tools for Mentors (ADR-0010: TypeScript engine, tools in any language, Python
first).
*Boundary:* runs only what a work order authorizes; results return through
the Kernel.
*Status:* decided, **not built — correctly**. The Beta's Mentor needs no
tools. Per the brief's own rule ("if something is unnecessary, remove it"):
no Tool Runner code until a governed workflow needs a tool (Phase 2+).
*Owes:* design ADR when first needed.

### Contracts

**Work Order** — the authorization to do one unit of work: id, task, path,
model, budget, status. It is data, not code.
*Status:* exists (`workorder.json` per task in the Beta, typed schema).
*Owes:* lifecycle extension (approval gate states; today the Pilot
pre-authorizes by launching) in the Kernel v0 ADR.

### Stores (State Plane — policy is per store)

**Project State** — one project's accumulated, governed knowledge; a living
document with versioned checkpoints.
*Status:* static slices in the Beta (`data/project/state/`). *Owes:*
delta/checkpoint design in the Kernel v0 ADR (Phase 2 needs writes).

**Artifact Store** — outputs, immutable once produced, provenance by
reference.
*Status:* **component-grade already** — write-once enforced in code, sha256
provenance, per-run audit trail (`runs/`). Smallest store; done first;
pattern for the rest.

**Expertise Store** — GuruSeeds: the owner's judgment as versioned,
inspectable artifacts; never silently mutated (Article 4). Two origins,
taught and learned, one gate: the Pilot (O5).
*Status:* seeds live as governed data (`data/project/seeds/` in the Beta;
curated seeds in `expertise/`). *Owes:* seed lifecycle ADR (the founding
7-state sketch, deferred at Phase 0 close) before Phase 6.

### Mechanisms

**Seed Resolver** — given a task, selects which seeds/state enter context.
Beta v0: exact tag intersection plus `core`, no embeddings, no scoring — if
crude-already-wins, the thesis has legs.
*Boundary:* selection must be explainable (`selectionReason` per element in
the manifest).
*Owes:* determinism & selection-semantics ADR (deferred question from Phase 0)
before the Phase 3 Scheduler.

**Effort Probe** — governance needs to know what work *will* cost before
consenting (ADR-0006). Two disciplines: estimates are calibrated against
actuals; precision is bounded by honesty.
*Status:* metering v0 exists and is honest (real/estimated flags, cache
tokens asserted zero, estimated counts never claimed as metered). *Owes:*
estimation + calibration ADR (Phase 3).

*(The brief omits two Book I components that Book II must not lose: the
**Mentor** — the only intelligent actor, stateless between work orders — and
**Executive Mode**, the Kernel's face. Both enter at Phases 1–2; the Beta's
Mentor is a system prompt, which is enough for the hypothesis.)*

## 3 · Vertical Slice

The brief asks for the smallest end-to-end workflow validating the
hypothesis. **It exists** — `experiments/beta-coding/`:

```
Task (data/tasks) 
  → assemble: full-reload | scheduled   (proto-Scheduler + Seed Resolver v0)
  → model port: fake | manual | API     (ADR-0013 — subscription, no wallet)
  → artifact.md (write-once) + meter.json + manifest.json (audit)
  → blind sheet, sealed A/B map         (the Pilot judges blind)
  → RESULTS.md                          (reduction % + verdict tally vs ADR-0012)
```

Honesty is enforced in code, not promised: manifest completeness by hash,
baseline-first refusal, write-once artifacts, no cache tokens, domain-blind
engine (`check:domain`). A local dashboard wraps the loop (run, watch, judge,
results) so governing it takes minutes, not file edits.

**Remaining to discharge the mission — evidence, not engineering:**
1. the Pilot authors the real corpus (replace `data/` placeholders);
2. one real comparison run (manual port; exact tokens via free `count_tokens`
   when claiming a ratified result);
3. the Pilot's blind verdicts → `RESULTS.md` → outcome recorded against
   ADR-0012's three exits.

## 4 · Beta Success Criteria

**Frozen — not redefinable here.** ADR-0012 fixed them before the first line
of code, with an explicit anti-goalpost rule:

- **Reduction:** % of context tokens (`input_tokens`) vs the full-reload
  baseline, measured first.
- **Quality:** same tasks through both paths; the **Pilot's blind judgment**
  is the only quality metric the system recognizes.
- **Scale:** 5–10 realistic tasks from the first cargo.
- **Committed exits:** *No* → change the architecture (Article 6). *Yes* →
  foundation for Book II. *Depends* (likely) → the map of where the scheduler
  wins/loses — worth more than a blind yes.

The brief's other examples are already engineering invariants, satisfied in
code: explainable context selection (manifest + `selectionReason`), reduced
context loading (that *is* the reduction metric), human approval preserved
(blind judgment + the Pilot launches every run).

## 5 · ADR Candidates (owed, in dependency order)

1. **Kernel v0 design** (Phase 1) — file stores, work-order lifecycle with
   approval gates, audit log format. *After* Beta results.
2. **Seed Resolver determinism & selection semantics** — deferred Phase 0
   question; prerequisite for the Phase 3 Scheduler.
3. **Effort Probe estimation + calibration** — turns metering v0 into a probe
   (ADR-0006 direction).
4. **Seed lifecycle (7-state)** — before Phase 6 seed evolution.
5. **Executive Mode / App shell v0** (Phase 2) — the daily loop surface; the
   Beta dashboard is its disposable sketch.
6. **Context Scheduler proper** (Phase 3) — only after O7 evidence; writing
   it earlier would be architecture by faith, which Article 6 forbids.

Not an ADR but pending and worth restating: the **repo visibility**
contradiction (public vs Session 001 decision) still awaits the Pilot.

## 6 · Risks — what could invalidate the hypothesis

- **The crude resolver under-serves quality.** Tag matching may drop context
  the Mentor needed → blind quality falls → *No/Depends*. That is the
  experiment *working*, not failing; the Depends map is a committed exit.
- **Estimated tokens mislead.** The manual port meters chars/4 — the ratio is
  faithful, absolutes are not (ADR-0013). Mitigation: a ratified answer
  requires exact counts (`count_tokens` is free) — already ADR law.
- **Single blind judge, small N.** 5–10 tasks and one Pilot yield a pattern,
  not a proof. Accepted by design; O7 at Phase 3 scale re-tests with the real
  Scheduler.
- **Corpus authored after the rig.** The pipeline pre-exists the data, so data
  could be (even unconsciously) shaped to flatter the scheduler. Mitigations:
  parameters frozen (ADR-0012), judgment blind, tags authored for the *work*,
  not the resolver — reviewed against this risk before the run.
- **Non-determinism blurs the comparison.** Two paths, live model, no caching
  allowed. Mitigation: identical task order, same model and settings, cache
  tokens asserted zero, manifests hash-verified.
- **Extrapolation risk.** A Beta win on a small corpus does not guarantee
  Phase 3 economics on a grown Project State. Recorded limit; O7's exit
  criterion (session N+1 cheaper than N) is the real test.

## 7 · Repository Structure

Reviewed. The shape is already right; Book II changes *nothing* structurally
today (Article 8: a reorganization must justify itself — none does).

```
docs/            Book I: chapters, ADRs, heritage, navigation, reviews
expertise/       curated seeds (the golden drops) with provenance
experiments/     hypothesis rigs — disposable science, committed as evidence
  beta-coding/   the ADR-0012 slice (engine src/, domain data/, runs/, tools/)
engineering/     Book II homes — EMPTY until each design ADR lands
  kernel/  scheduler/  probes/  runtime/  ui/
  OVERVIEW.md    this plan
```

Two standing rules keep it honest: **experiments never graduate silently**
into `engineering/` (promotion requires the component's design ADR, which may
copy code but must re-justify it), and **`engineering/` dirs stay empty**
until their ADR exists. When the Kernel v0 ADR lands, `engineering/kernel/`
is born from what the Beta proved — not from what this document imagines.

---

*Book I ends in philosophy; Book II begins in measurement. The next entry in
this book should be a number: the Beta's reduction percentage, next to the
Pilot's blind verdict.* ⚒️
