# Review — Fishing Expedition 1: golden drops from the open web

Session 005. Method proposed by the Pilot ("a rede pode ser uma Sonnet, a
câmara um Fable 5"): three cheap Sonnet trawlers searched in parallel where
we have ADRs owed — context engineering, agent governance, expertise capture
— each returning pre-filtered candidates with sources. The camera (Fable 5)
then gated adversarially. Cost of the nets: ~149k subagent tokens, ~90s each.

**Tally: 24 candidates → 6 admitted (25%), 10 noted to owed ADRs, 8 rejected.**
Higher admission rate than prior reviews (2/355, 2/12) is expected, not
inflation: the nets fished only where we are hungry.

## Admitted → expertise/imported/

- **recognition-over-recall** — don't ask experts to articulate their rules;
  show them cases and let them correct. Feeds the Multimodal Interview
  Pipeline (incubator — Cozinha da Maria Rolanda). Source: arXiv 2602.02752.
- **approval-fatigue** — users rubber-stamp ~93% of permission prompts;
  a gate that is always approved is not a gate. The ROI is shrinking what
  needs asking, not asking more. Feeds Executive Mode (O1: "minutes a day").
  Source: Anthropic engineering.
- **lethal-trifecta** — private data, untrusted content, and external
  communication must never co-occur in one agent/session; detection is a
  treadmill, elimination is a decision. Feeds Tool Runner / runtime ADRs.
  Source: Simon Willison.
- **failures-stay-visible** — leave failed attempts and error traces in the
  working context; scrubbing them makes the agent repeat the mistake. Feeds
  Kernel/Mentor loop design; already true of our own sessions. Source: Manus.
- **just-in-time-context** — over-loading context degrades *reasoning*, not
  just cost; keep references, fetch content when needed. Sharpens O7: the
  scheduler may not merely hold quality — it may *win* on it. Source:
  Anthropic engineering; corroborated by Chroma's context-rot findings.
- **embodied-boundary** — expertise calibrated by physical senses over years
  leaves no textual trace and does not transfer; test feasibility *before*
  a capture project, not after it fails. Protects the family-expertise
  projects from wasted effort. Sources: the-waves.org; arXiv 2603.19504.

## Noted — routed to owed ADRs (not seeds)

- Lost-in-the-middle position lever (30%+ swing by placement) → Scheduler
  ADR; negligible at Beta's ~1.7k-token contexts. (arXiv 2307.03172)
- Curated-beats-RAG decision rule (precision-critical + static domain →
  inject curated, skip retrieval) → Scheduler ADR; corroborates our
  architecture. (callstack.com, getunblocked.com)
- Non-uniform distractor damage → Scheduler ADR eval design. (Chroma)
- KV-cache economics (10x; deterministic prefixes; no timestamps in system
  prompts) → Phase 2 App ADR. N/A to the Beta, which forbids caching.
  (Manus)
- Session-level denial counters (persistence is the signal) → refinement
  candidate for the `circuit-breaker` seed at its next governed revision
  (Article 4: no silent mutation). (Anthropic)
- Contain capability, not actions (sandbox what it CAN do) → Kernel v0 +
  Tool Runner ADRs. Strong; not admitted only because its use begins with
  those designs. (Anthropic)
- Strip agent reasoning before approval-classifier reads an action → Kernel
  ADR, far future. (Anthropic)
- Route knowledge by kind (deterministic → code, judgment → prompt) +
  capture-as-iterative-process → Seed Composer ADR. (arXiv 2601.15153,
  2602.02752)
- Skills-as-decision-logic + near-duplicate proliferation rot → already
  partially held (curation doctrine; Seed Hygiene incubator note); the
  proliferation framing joins the seed-lifecycle ADR. (arXiv 2603.14805)
- METR autonomy time-horizon dial → interesting, no near-term use in a
  single-Pilot, per-work-order grant model. (METR)

## Rejected

- "Compaction beats handoff docs" — flagged unverified by the net itself,
  and contradicts our proven Navigation/memory practice, which survives
  *account* switches, not just long contexts. Extraordinary claim, secondary
  source: out.
- "$47k runaway loop" — budget-enforcement-not-alerts is already ours
  (Kernel spends budget; halt at budget); anecdote single-sourced.
- Shuffled-context-beats-coherent (Chroma) — real finding, retrieval-specific,
  no action for us at Beta scale; kept only as context-rot corroboration.
- Format-variation against brittleness (Manus) — agent-loop tuning detail,
  no near-term surface.
- 1–2k-token subagent summaries (Anthropic) — already our practice (the nets
  themselves were capped); confirmation, not news.
- Separation-of-duties on knowledge promotion — single-Pilot system by
  design; revisit if the Marketplace ever leaves the incubator.
- Keyframe+diff hash-chained versioning — git already gives us this.
- Everything net 1 said about *how to structure* long contexts — the Beta's
  honest answer is to keep contexts small, not to organize big ones better.

Provenance discipline: every admitted seed cites its source in the file
header; the review is the audit trail; gate delegated by the Pilot
in-session (standing "diz-me tu" for distillation).
