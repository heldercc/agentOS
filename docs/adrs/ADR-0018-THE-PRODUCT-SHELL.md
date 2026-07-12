# ADR-0018 — The Product Shell

- **Status:** Implemented (the Pilot's verbatim directive is
  docs/PRODUCT-LOOP.md, Session 007; the shell was built Session 008,
  2026-07-12 night, smoke 33/33, browser-verified on the fake runtime)
- **Pole:** both. (A) token economy — every Work Order carries a manifest and
  a meter, effort is chosen before any spend; (B) taste governance by clicks —
  the whole loop is the user's clicks: answer, approve, reject, choose effort.
- **Doctrine:** docs/PRODUCT-LOOP.md (the 13 steps, User = Pilot, placement
  discipline); docs/OPERATING-MODEL.md §1–§9, §12.

## Question

Can the 13-step Product Loop exist as a real product surface — intent in,
governed questions and choices out, artifacts back — without retrofitting the
frozen experiment rig and without pre-authoring any creative answer?

## Decision

### 1. Placement: a new top-level `product/`, rig untouched

The shell lives in `product/`, created this session, exactly as the
placement decision in PRODUCT-LOOP.md demands. `experiments/beta-governance/`
stays frozen; nothing was imported across folders. Proven mechanisms entered
by **copy-with-provenance** (the standing rig-uncoupling rule):

| copied into product/src/ | from (rig) | proves |
| --- | --- | --- |
| `stores.ts` | ADR-0012/0015 | write-once artifacts, provenance-by-reference |
| `evidence.ts` | ADR-0015 | append-only JSONL evidence, per project |
| `runtime.ts` | ADR-0013 `model.ts` + dashboard worker | the Claude Code boundary |
| `effort.ts` | ADR-0017 | 5 levels, Effort Probe, estimate-vs-actual |
| manifest discipline | ADR-0012 | enumerated context, budget, visible drops |

What the shell adds that no rig has: Project Init from free text (step 1),
first-class Question Needs with automatic re-consultation (steps 4–8), the
candidate Project State with user approval (steps 9–10), and artifacts
returning into a per-project workspace (step 12).

### 2. The Kernel is code, not a model

`src/kernel.ts` governs: it convenes, aggregates, dedupes, ranks, persists,
re-consults, and advances — deterministically. Models produce content
(roster proposals, consultations, the candidate state text, artifacts);
the Kernel decides *what happens next* and records why. Authority stays
with the user: approval, rejection-with-direction, answers, effort above
`balanced`, and iteration advance are clicks, never automation.

### 3. The runtime boundary (Operating Model §8)

Three ports behind one interface. `fake` is deterministic and kind-aware so
the whole loop smoke-tests at zero cost. `cli` invokes Claude Code locally
through PowerShell (`claude -p --model <effort-model>`, prompt on stdin) —
the product-normal path, one spawn per Work Order. `mailbox` is the ADR-0013
human-in-the-middle bridge, kept because it saved both Betas when the CLI
was not logged in. `PRODUCT_RUNTIME` selects; the shell surfaces the login
hint when `cli` fails rather than pretending.

### 4. The interview is singular (Operating Model §4)

Agents end every consultation with a structured `{"questions": [...]}` block
(bullet-list fallback for chatty workers, max 3 per agent). The Kernel
normalizes, dedupes across agents, ranks by demand, and shows exactly ONE
question. Answering it persists the answer and automatically re-consults the
agents that raised it, at clamped effort — movement below the line. An
answered need never reopens.

### 5. Project State is the product's memory (Operating Model §6)

The candidate is synthesized from founding intent + answers + the agents'
latest reads; the user approves or rejects with a note, and the rejection
note is required context for the rebuild — the strongest signal it has.
The approved state enters every later Work Order's context as a required
element. The user can leave and return: the state, not the transcript,
carries the project.

### 6. Workspace is cargo, not repo

`product/workspace/` (live projects: work orders, meters, manifests,
evidence, artifacts, states) and `product/mailbox/` are gitignored. The repo
carries the shell; the user's projects belong to the user's disk. Smoke
projects carry a `smoke-` prefix and never feed the Effort Probe.

## Consequences

- The Songoku Beta (Operating Model §11) can now be run INSIDE the product:
  create the project from free text, answer the aggregated questions, govern,
  execute. Nothing of the scene is pre-authored anywhere in `product/`.
- The rig's `check:domain` guard was not ported — the shell has no `data/`
  corpus to leak into; its engine prompts are generic by construction and
  review carries the rule until a real guard is owed.
- The Kernel design (Book II, `engineering/`) now has a living reference:
  what `kernel.ts` proves out is what gets specified as the durable Kernel —
  the shell remains a Beta.
- Known limits, deliberate for this Beta: one in-flight operation per
  project; roster convened once (no re-convene flow yet); reconsultation
  effort fixed at `low`; no seeds/distiller in the shell yet (the rig's
  distiller waits for real selection evidence to justify the port).

## Verification

- `npm run smoke` — 33/33: all 13 steps asserted on the fake runtime,
  including dedup across agents, rejection-with-direction, artifact
  immutability, evidence completeness, and smoke-meter isolation.
- `tsc --noEmit` strict, clean.
- Browser pass as the user (fake runtime): project from free text → 3
  answers one-at-a-time → candidate approved → execution → 2 artifacts
  returned → iteration 2 opened with the approved state in context; the
  probe's confidence rose low → high on the project's own meters.
