# ADR-0013: Human-in-the-Loop Model Port for the Beta

- **Status:** Accepted (dev/test phase only)
- **Date:** 2026-07-11
- **Deciders:** Pilot
- **Relacionado:** ADR-0010 (Tool Runner), ADR-0012 (the Beta Coding question)

## Context

The Beta Coding experiment (ADR-0012) needs a model to execute work orders so the
two context paths can be compared. The obvious backend is the Anthropic API, but
that draws a separate pay-as-you-go token balance — a wallet the Pilot does not
want to open during the dev/test phase. The Pilot already runs Claude Code on a
subscription; that capacity should do the work instead.

## Decision

The engine gains a third model port beside `fake` and the real Anthropic client:
a **manual file-drop port** (`--model manual`). It does not call a metered API.
Per work order it:

1. Writes the assembled prompt to `mailbox/outbox/<jobId>.md`.
2. Waits (polls) for `mailbox/inbox/<jobId>.md`.
3. Collects that file as the artifact and consumes both.

A watcher (`tools/spawn.bat`) spawns one Claude Code per outbox file — on the
Pilot's **subscription**, not the API wallet — and drops each answer into the
inbox. A single launcher (`tools/beta.bat`) wraps the whole loop in clicks: pick
the model, it starts the watcher, runs the conductor (baseline → scheduled →
blind sheet), opens the sheet for judging, and produces the results. The bridge
is managed by the engine; the Pilot clicks and judges.

**Metering honesty.** The manual and fake ports do not receive API token counts,
so tokens are recorded as chars/4 **estimates**, flagged `estimated: true` in
every meter and noted in `RESULTS.md`. The reduction *ratio* between the two
paths is faithful (same estimator applied to both); the absolute counts are
indicative only.

## Relationship to ADR-0012

ADR-0012's frozen parameters — full-reload baseline first, blind Pilot judgment,
5–10 tasks — are all honored by this port; only the token *unit* changes from
API-metered to estimated. Therefore a result produced through the manual port is
**exploratory**, not the ratified answer to the Beta Coding question. A result
claimed as final still owes an exact token count (via `count_tokens`, which is
free, or a real metered run). This ADR does not move ADR-0012's goalposts; it
adds a cheaper way to explore before spending.

## Alternatives Considered

- **Real Anthropic API from the start** — rejected for now: opens the separate
  token wallet the Pilot declined during dev/test. Remains the path to an exact,
  ratified result later.
- **Fake model only** — insufficient: canned output cannot be judged for quality,
  so the experiment's second parameter (blind judgment) can't run.

## Consequences

- The `mailbox/` directory is transient and git-ignored; the audit trail (work
  orders, manifests, meters, artifacts, provenance) still lands in `runs/` exactly
  as with any port.
- `count_tokens`-based measurement (`measure.ts`) remains available for an exact,
  free reduction figure when the Pilot chooses to point it at a real model.
- **Revisit if this becomes a product.** Spawning subscription Claude Codes as a
  batch backend is a dev/test convenience, not a shipping architecture. When
  AgentOS is a product, this port and its wallet question get re-decided.
