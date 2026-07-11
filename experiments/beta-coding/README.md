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
- **Path B — scheduled** (`src/assemble/scheduled.ts`): a deliberately simple
  resolver — the Mentor plus any seed/state tagged `core` or whose tags intersect
  the task's tags. Exact lowercase matching, no embeddings, no scoring. What it
  saves is measured against A. If a beta this crude already beats full reload,
  the thesis has legs.

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

## One-click (recommended): the dashboard

Double-click **`tools/beta.bat`** and pick **[1] Dashboard** (or run
`npm run dashboard`). A local page opens at `http://localhost:4600` where you:

- start a comparison run (fake or manual) with one button — baseline first is
  still enforced by the engine;
- watch progress live (per-task log, mailbox worker status);
- judge the blind sheet with **A / B / Empate** buttons, side by side — no more
  hand-editing `verdicts.json`;
- generate and read `RESULTS.md` rendered in place. Results are write-once:
  generating them closes the verdicts (the UI warns you first).

The dashboard hosts the manual-model worker itself: it spawns one Claude Code
per work order on *your subscription* (no API wallet — ADR-0013) and manages the
mailbox bridge end to end. It requires the Claude Code CLI logged in once
(`claude` in any terminal). If your worker command differs, set `WORKER_CMD`
(default `claude -p`). The server binds to `127.0.0.1` only — nothing leaves
the machine.

The console flow (options 2–4 in `beta.bat`, watcher in `tools/spawn.bat`)
remains as a fallback.

## Running it (manual CLI)

```sh
npm install
npm run typecheck        # strict TypeScript, no emit
npm run check:domain     # engine contains no domain vocabulary
npm run validate         # data corpus is well-formed
npm run smoke            # invariants: completeness, determinism, write-once, meter honesty
npm run measure          # FREE token comparison (chars/4 estimate on fake; count_tokens on a real model)

# One comparison run (fake model, zero cost). Baseline first is enforced in code.
npx tsx src/cli/run.ts --path full-reload --model fake --run demo
npx tsx src/cli/run.ts --path scheduled  --model fake --run demo
npx tsx src/cli/blind.ts --run demo      # blind sheet + sealed A/B map
#   → fill runs/demo/eval/verdicts.json, commit it, THEN open the seal
npx tsx src/cli/results.ts --run demo    # RESULTS.md: reduction + verdict tally
```

**Free reduction check first.** `npm run measure -- --model claude-opus-4-8` uses
Anthropic's `count_tokens` (free — no generation billed) to get the exact
context-token reduction before spending anything on generation. The generation
runs (`--model claude-opus-4-8` on `run.ts`) are the only part that costs budget;
set `ANTHROPIC_API_KEY` in the environment (never in a file) for those.

## Status

**Beta pipeline complete on the fake model:** scaffold, schemas, both context
paths (full-reload + scheduled resolver), real metering, free token measurement,
blind evaluation with a sealed A/B map, and results aggregation against ADR-0012's
three committed outcomes. Verified end-to-end at zero cost.

Data under `data/` is placeholder, marked for authoring with the Pilot. Not yet
done: the real Anthropic runs (need an API key + the Pilot's authored fight-scene
data and blind judgments).
