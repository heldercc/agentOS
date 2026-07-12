# ADR-0017 — Effort Management and Governed Auto-Iteration

- **Status:** Ratified (the Pilot's verbatim directive, Session 007, 2026-07-12
  night — "MODEL EFFORT MANAGEMENT" + "AUTOMATIC ITERATION WITH GOVERNANCE";
  implemented the same night)
- **Pole:** both. (A) token economy — the effort ladder spends the smallest
  adequate model and agent set; (B) taste governance by clicks — automation
  moves the loop so the owner's clicks are the only human cost left.
- **Doctrine:** docs/OPERATING-MODEL.md §5, §8, §9.

## Question

Can the governance loop run cheap and unattended below the authority line —
effort chosen before execution, movement automated — without automation ever
touching what belongs to the owner (judging, selecting, escalating effort)?

## Decision

### 1. Five hard-coded effort levels (no dynamic routing in this Beta)

`src/effort.ts` — minimal / low / balanced / high / maximum. Each level fixes:
worker model (haiku → sonnet → opus), number of alternatives fanned, whether
an adversarial critic pass runs, optional-context char budget, generation
token budget, retry budget, timeout, and an honest one-line quality
expectation. Development and automated tests default to minimal/low.

Relevance orders, effort cuts: approaches are ranked by tag overlap with the
decision and the level caps how many are consulted. A hard filter was
rejected — it would skew the distiller's appearance statistics and could
empty a fan; the cap keeps every subset honest (the present event records
what was on the table, ADR-0016 §1).

### 2. The Effort Probe

Before execution, `probeEffort` estimates: alternatives and critic passes,
expected tokens and duration, subscription pressure, expected quality,
confidence, and a recommendation with its reason. The estimate is shown
beside the Propor/Iterar action in the dashboard.

History is the estimator: expectations average the real `meter.json` records
of past rounds (smoke sessions excluded); with zero history it uses priors
and says so (confidence: low). After every round, `effort-actual.json` is
written beside it — estimate vs. actual, tokens and duration deltas, retries,
outcome. The probe's report card is evidence, and later probes read the
meters those rounds left behind.

The probe recommends escalation with resistance (round 1 → low, round 2 →
balanced, later → high) but never recommends past the authority line: above
`balanced` is the owner's call, and the recommendation says exactly that.

### 3. The effort slider

A five-stop slider in the dashboard, persisted per project. The slider is the
owner's hand: any level chosen there is legitimate, including maximum —
choosing it IS the explicit approval. Only automation is clamped.

### 4. Governed auto-iteration

`src/auto.ts` + a 3-second tick in the dashboard. Per project, armed by the
owner. The automation takes exactly two kinds of step, both movement:

- a decision with no round → open round 1;
- an open round fully judged and fully rejected → open the next round (the
  rejections ride into its context as feedback).

It never judges, never selects (a fully judged round with approvals WAITS),
never exceeds `AUTO_MAX_LEVEL = balanced` (requests above are clamped and the
clamp is reported), and stops dead when every remaining move belongs to the
owner. One movement per tick; one round in flight project-wide.

### 5. Question aggregation (Operating Model §4)

Open proposals' "Perguntas ao Pilot" sections are collected across all open
rounds, deduplicated, ranked by how many options ask them, and shown in one
card — the visible interview is singular. Answers travel through the
existing pilot_note channel into the next round's context.

## Verification (ADR-0012 discipline: zero cost before real spend)

- Smoke grew 15 → 33 assertions, all green on the fake model: minimal fans
  exactly one alternative; probe uses priors at zero history; effort and
  estimate-vs-actual records written; high files critique + critic meter per
  alternative; recommendation refuses to cross the line; auto opens round 1,
  waits on pending judgment, never automates selection, iterates a fully
  rejected round, clamps effort above the line.
- TypeScript strict clean; check:domain OK (engine stays domain-blind).
- Driven end-to-end in a real browser on the placeholder project: slider →
  probe re-estimates; auto armed → opened all round-1s (one per tick) and
  stopped at "a julgar"; disarmed; the Copilot's test run deleted from runs/
  (evidence admits only the owner's clicks).

## Consequences

- The owner's normal day is: arm auto, watch options arrive, judge, select,
  answer the aggregated question — authority only.
- Cost control is structural, not disciplinary: cheap models and small fans
  are the default; expensive paths demand a deliberate slider move.
- The probe's accuracy is auditable forever (effort-actual.json per round).
- In-memory auto state dies with the process by design: a restart moves
  nothing until the owner re-arms — safe-by-default.

## Exits

- **No** (automation crossed the line even once — judged, selected, or spent
  above it): rip out the tick, keep the slider and probe.
- **Yes** (a full real project iterated with the owner touching only
  judgment): promote the pattern to the Kernel design (Book II).
- **Depends** (movement fine, estimates wildly off): keep automation, rework
  the probe's estimator on the accumulated effort-actual evidence.
