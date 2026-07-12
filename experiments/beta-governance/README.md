# Beta 2 — Governance (ADR-0015)

Grand Objective B's experiment: **can governed selection measurably improve
what the system proposes — taste captured as seeds, entirely through clicks
in the UI?**

## The loop

1. The owner opens a decision → the engine fans it into **blind proposals**,
   one per approach (angle), with a sealed per-round mapping. Every proposal
   carries a context manifest and a meter record.
2. The owner judges each proposal **in isolation** (approve/reject), then —
   only after all are judged, only among approved — selects the winner.
   Pointwise before pairwise, enforced server-side: the comparison protocol
   must not fabricate the winner.
3. Every click is one append-only **evidence event** (`runs/<day>/evidence.jsonl`).
   The evidence log is the experiment's raw data — metrics and learning fold
   over it and nothing else.
4. The **distiller** turns repeated wins (≥2 selections of the same angle)
   into a candidate seed shown in the tray with its evidence. Nothing is
   admitted automatically (O5): the owner clicks Admit or Discard.
5. Admitted seeds land in `data/learned/` (write-once, full provenance) and
   enter every later proposal's context — the manifests prove the loop closed
   (O4, miniature).
6. Iteration: a rejected round stays visible to the next one (failures stay
   visible); metrics track approval rate per round and rounds-to-selection.

## Run it

```
npm install
npm run smoke        # end-to-end verification on the fake model, zero cost
npm run dashboard    # http://localhost:4700 — the governance surface
npm run typecheck
npm run check:domain # ADR-0008: the engine stays domain-blind
```

Models: `fake` (deterministic, free), `manual` (spawned Claude Codes on the
owner's subscription via the mailbox — ADR-0013; no API wallet), or a real
model id with `ANTHROPIC_API_KEY` set.

## Honesty rules inherited from the Beta 1 rig

- Provenance by reference; artifacts write-once; manifests enumerate
  everything that entered a context.
- `src/` is domain-blind (ADR-0008) — the experiment's subject lives in
  `data/` only, enforced by `check:domain`.
- Smoke evidence is `scripted:true` inside a `smoke-*` session with a
  sandboxed learned store; real learning never reads it.
- `src/model.ts` and `src/stores.ts` are copies of the Beta 1 rig's, with
  provenance headers — rigs are disposable science and stay uncoupled.

## Data status

`data/decisions.json` and `data/approaches.json` are **placeholders** in the
first-cargo domain. The Pilot replaces them before any real run; the
corpus-shaping anti-bias review (engineering/OVERVIEW.md §6) applies here
exactly as it does to Beta 1.
