# Beta Coding — the vertical experiment

The first code of Book II. It exists to answer one question, and only one —
[ADR-0012](../../docs/adrs/ADR-0012-THE-BETA-CODING-QUESTION.md):

> **Can a Context Scheduler reduce context tokens while holding quality, versus a
> full-reload baseline?**

This is deliberately *not* the Phase 3 Scheduler (that needs its own design ADR).
It is the smallest honest rig that can make the question falsifiable.

## Frozen parameters (ADR-0012 — do not move once results arrive)

1. **Reduce against what?** Baseline = the full-reload strategy, measured *first*.
   Reduction is expressed as % of context tokens (`usage.input_tokens`) vs baseline.
2. **Quality judged how?** The same tasks run through both paths; the Pilot judges
   the outputs **blind**, not knowing which path produced which. That blind verdict
   is the only quality metric this system recognizes.
3. **How many tasks?** 5–10 realistic tasks from the first cargo (the Render Order).

## The two paths

- **Path A — full reload** (`src/assemble/fullReload.ts`): dump the entire project
  corpus into context on every task. The honest baseline.
- **Path B — scheduled** (`src/assemble/scheduled.ts`, *next slice*): a simple
  tag-matching resolver selects only relevant seeds/state. What it saves is measured
  against A.

## Honesty guarantees (enforced in code)

- **Audit log** — every context element is enumerated by reference in
  `manifest.json`; `assembledSha256` hashes the exact prompt sent (completeness proof).
- **Immutable artifacts** — `artifact.md` is write-once; the store refuses to overwrite.
- **Provenance by reference** — never by copy; data versions ride on git hashes.
- **No cache** — no `cache_control` is ever sent; the meter rejects nonzero cache
  tokens, because caching would corrupt the input-token comparison.
- **Baseline first** — the runner refuses the scheduled path until a committed
  full-reload baseline exists for every task.
- **Domain-blind engine** (ADR-0008) — `npm run check:domain` fails the build if any
  domain word from `data/banned-words.json` appears in `src/`.

## Layout

```
src/            the engine — zero domain words
data/           the entire domain — Mentor, docs, seeds, state, tasks (all PLACEHOLDER)
runs/<runId>/   per-work-order audit trail (committed — results are evidence)
```

## Running it

```sh
npm install
npm run typecheck        # strict TypeScript, no emit
npm run check:domain     # engine contains no domain vocabulary
npm run validate         # data corpus is well-formed
npm run smoke            # invariants: completeness, determinism, write-once, meter honesty
npm run run:baseline     # full-reload path on the FAKE model (zero cost)
```

The real run (Anthropic API, `ANTHROPIC_API_KEY` in the environment — never in a
file) comes in a later slice, once the domain data is authored with the Pilot.

## Status

**Slice 0–2 complete:** scaffold, schemas, full-reload pipeline on the fake model.
Data under `data/` is placeholder, marked for authoring with the Pilot. Not yet
built: the scheduled resolver, blind evaluation, results aggregation, real runs.
