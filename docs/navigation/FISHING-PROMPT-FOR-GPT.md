# Fishing Prompt — for a non-Claude Copilot (GPT)

> Navigation instrument (ADR-0001: Copilot-agnostic). The Pilot pastes the
> block below into a GPT with web search. A different model family fishes
> different waters and has different blind spots — that diversity is the
> point. The catch comes back to this repo, where the standing gate
> (adversarial review + the Pilot / delegated Claude) makes the final call:
> **the external model's own gate does not admit anything here** (O5 — one
> gate). Expedition 1's method and results: docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-1.md.

---

## The prompt (paste everything below into GPT)

You are running a two-stage research operation: a TRAWLER and a CAMERA.

CONTEXT — who is asking: a solo founder ("the Pilot") building AgentOS, a
governed operating system for reusable human expertise. Core ideas: a human
governs everything through explicit approval gates; expertise lives as small,
versioned, curated "seeds" (judgment, not facts); context for LLM work is
scheduled/resolved, never bulk-reloaded; every action has an audit trail and
provenance. Philosophy: brutal curation — of 355 candidate skills reviewed,
2 were admitted.

STAGE 1 — TRAWLER. Search the web (2024–2026 material) in these four
fisheries. Serious sources only: AI-lab engineering blogs, practitioner
postmortems, papers with practical findings, essays with concrete mechanisms.
No product marketing, no listicles, no "10 tips" content.

1. Blind evaluation methodology for LLM outputs — human blind judging,
   A/B protocols, LLM-as-judge pitfalls, small-N evaluation honesty.
2. Versioned state & long-running project memory for AI systems — project
   state deltas, checkpoints, knowledge-base rot and its countermeasures.
3. Cost engineering of LLM products — estimation before spending,
   metering honesty, budget enforcement patterns, estimate-vs-actual
   calibration.
4. AI-assisted creative production pipelines — governance of multi-step
   creative work (film/animation/design specs), human taste as the quality
   gate, spec-completeness as a deliverable.

STAGE 2 — CAMERA. For each candidate you found, attack it before reporting:
Is it specific and non-obvious, or dressed-up common sense? Is the source
primary and credible, or a single unverified anecdote? Would a stingy CEO pay
for this sentence? Discard what fails. Mark anything single-sourced as
UNVERIFIED honestly — do not silently launder weak sourcing.

DO NOT bring these — already held (your catch must not duplicate them):
approval fatigue / rubber-stamping stats; the lethal trifecta; just-in-time
context loading & context rot; keep failure traces in context; recognition-
over-recall expert elicitation; embodied/tacit knowledge doesn't transfer;
circuit breakers; authority matrices (may/must-ask/forbidden); risk-beside-
cost approval; adversarial review doctrine; KV-cache economics; lost-in-the-
middle position effects; curated-context-beats-RAG decision rules.

OUTPUT — return 6–10 survivors, exactly this format, whole answer under 800
words, no intro, no conclusion:

DROP: one-sentence statement of the judgment/finding/mechanism
WHY GOLD: one sentence — what makes it non-obvious and actionable
SOURCE: URL + who says it
CONFIDENCE: PRIMARY (lab blog/paper/measured) or UNVERIFIED (single source)

---

## Return path

The Pilot pastes GPT's answer back to Claude in the AgentOS session. Claude
runs the standing adversarial gate (same bar as expedition 1), routes notes
to owed ADRs, and admits survivors to expertise/imported/ with provenance
`source=<original source>, via GPT expedition` — the fisherman is recorded,
but provenance points to the fish's waters, not the boat.
