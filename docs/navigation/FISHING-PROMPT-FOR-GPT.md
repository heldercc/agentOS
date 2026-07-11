# Fishing Prompt — for GPT (same waters as expedition 1, different brain)

> Navigation instrument (ADR-0001: Copilot-agnostic). Expedition 1
> (docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-1.md) fished three topic
> areas with Claude-family models. This prompt sends GPT to the SAME three
> areas — a different model family searches differently and surfaces
> different findings. Written in plain technical language, no metaphors: the
> external model has none of this repo's context. Its output returns here,
> where the standing adversarial gate (the Pilot / delegated Claude) decides
> what enters — the external model admits nothing (O5 — one gate).

---

## The prompt (paste everything below into GPT)

You are performing a structured web-research task with two phases: RESEARCH,
then FILTERING. Follow both exactly.

BACKGROUND AND OBJECTIVE. I am building a system in which a single human
owner governs AI agents through explicit approval steps. The system stores
professional knowledge as small, versioned text files, each containing ONE
reusable piece of judgment: a heuristic, a decision rule, or a measured
finding with a source. I am collecting candidates for these files. Your job:
search the public web, filter hard, and return only the best candidates in a
fixed format. I make the final acceptance decision myself — you supply
vetted candidates, nothing more.

PHASE 1 — RESEARCH. Use web search. Look for material from 2024-2026 in
these three topic areas:

1. Context management for LLM agents ("context engineering"): how to decide
   what goes into a model's context window per task; retrieval versus
   loading everything; context compression; measured effects of context
   size, order and content on output quality; production lessons from teams
   running agents.
2. Governance of AI agents: human approval workflows, permission and
   autonomy models, audit trails and provenance, containing agent failures,
   enforcing cost/token budgets, keeping multi-session work consistent.
3. Capturing human expertise for AI systems: methods for eliciting tacit
   knowledge from experts, turning expert judgment into reusable
   instructions or rules, curating small high-value knowledge bases,
   versioning and provenance of captured knowledge, limits of what can be
   captured.

Source quality requirements. Acceptable: engineering blogs of AI companies
(OpenAI, Anthropic, Google, production-agent startups), papers with concrete
findings, first-hand practitioner reports with specifics. Not acceptable:
product marketing, SEO listicles, generic advice with no mechanism or data.

PHASE 2 — FILTERING. Before including any candidate, test it against all
four criteria. Discard it if it fails any one:

- SPECIFIC: it states a concrete mechanism, number, protocol, or decision
  rule. General principles fail ("keep context relevant", "keep humans in
  the loop", "document your knowledge" all fail).
- NON-OBVIOUS: a competent practitioner would plausibly not know it already,
  or it contradicts common practice.
- ACTIONABLE: a two-person team could apply it directly when designing an
  agent's context assembly, an approval workflow, or an expert-interview
  process.
- SOURCED: it has an identifiable source. If the only source is one
  non-authoritative page, mark it CONFIDENCE: UNVERIFIED — never present
  weakly-sourced claims as established.

EXCLUSION LIST. I already hold the following findings — do not return them
or close variants of them:

- Context rot: overloading context measurably degrades reasoning even when
  the answer is present; keep references and fetch content just-in-time.
- "Lost in the middle": facts placed mid-context are recalled far worse
  than at the start/end.
- Leaving failed attempts and error traces in the agent's context reduces
  repeated mistakes; do not scrub them.
- KV-cache economics: deterministic prompt prefixes, cache hit rate as the
  key cost metric, ~10x cost difference cached vs uncached.
- Deliberate format variation prevents agents drifting into stale repeated
  action patterns.
- Sub-agents should return short condensed summaries (1-2k tokens) to an
  orchestrator, on clean separate contexts.
- Shuffled/incoherent long contexts can outperform coherent ones for
  retrieval; distractor documents differ enormously in how much damage they
  cause.
- Users rubber-stamp ~93% of permission prompts; the fix is shrinking what
  requires approval, not adding gates.
- Contain what an agent CAN do (sandboxing, egress allowlists) instead of
  reviewing each action; strip the agent's own reasoning before an approval
  classifier reads its proposed action.
- Escalate on repeated denials/failures: counters that trigger caution and
  then a mandatory human stop (circuit breaker).
- Never combine private-data access, untrusted-content exposure, and
  external communication in one agent (prompt-injection containment).
- Autonomy grants written as explicit lists: decides alone / must ask /
  forbidden (authority matrix).
- Approval requests should state estimated cost AND estimated risk.
- Calibrate autonomy budgets with measured model time-horizons (METR).
- Elicit expert knowledge by showing experts concrete cases to correct
  ("recognition over recall"), not asking them to articulate rules.
- Route deterministic rules to code, judgment to prompts; capture is an
  iterative process, not a one-shot interview.
- Knowledge promotion needs a second principal (author cannot self-approve);
  versioning via snapshots+diffs with hash-chained provenance.
- Small curated knowledge sets injected directly beat retrieval pipelines
  when precision matters more than recall and the domain is static.
- The unit of capture is decision logic, not facts; skill libraries fail by
  near-duplicate proliferation.
- Physically-calibrated (sensorimotor) expertise leaves no textual trace and
  cannot be captured; test feasibility before starting.

OUTPUT FORMAT. Return 6 to 10 surviving items. For each item output exactly
these four lines and nothing else:

DROP: <one sentence stating the finding/judgment itself>
WHY GOLD: <one sentence: why it is specific, non-obvious, actionable>
SOURCE: <URL + author or organization>
CONFIDENCE: <PRIMARY or UNVERIFIED>

No introduction, no conclusion, no commentary between items. Whole answer
under 800 words.

---

## Return path

The Pilot pastes GPT's answer back into the AgentOS session. Claude runs the
standing adversarial gate (same bar as expedition 1), routes
useful-but-not-seed items as notes to their owed ADRs, and admits survivors
to expertise/imported/ with provenance pointing at the original source, plus
`via GPT expedition`.
