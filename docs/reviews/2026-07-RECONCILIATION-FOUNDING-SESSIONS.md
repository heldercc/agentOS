# Reconciliation — Founding Sessions vs. Foundation Revision 4

Session 004. Input: the founding Copilot's knowledge export
(docs/heritage/2026-07-CHATGPT-KNOWLEDGE-EXPORT.md). Question answered here:
what did the founding sessions contain that Revision 4 lost, contradicted, or
never knew?

## Finding 1 — Revision 4 conflated teaching with resolution (material)

In the founding conception, **InjectSeed was the teaching tool**: the
Pilot-facing act of putting expertise *into* the system ("Inject Seed → Target:
Movie Mentor → Text: ..."), with the system interpreting, structuring, asking
confirmation, saving and versioning — the Pilot never writes formats.

Revision 2 redefined InjectSeed as the *runtime* mechanism that selects seeds
into context, and ADR-0005 then renamed that mechanism Seed Resolver — with a
rationale ("the name described the wrong half of the operation") built on the
Revision 2 misreading, not on the original intent. ADR-0005's *decision* stands
(the runtime mechanism is well named Seed Resolver); its *context section* is
historically inaccurate, which this record corrects. ADRs are immutable; errors
in them are corrected by record, not by edit.

Net effect: the original teaching-side concept was left without a name in
Revision 4 — reduced to the phrase "teaching UX". It is restored as a
first-class mechanism, **Seed Composer** (name proposed by the current Copilot,
pending Pilot approval — see ADR-0007, Proposed). The seed pipeline is now
symmetric and honest to the founding idea:

    Pilot → Seed Composer → GuruSeed store → Seed Resolver → Context → Mentor

## Finding 2 — The founding seed lifecycle was richer (adopted as sketch)

Founding sketch: Idea → Draft → Candidate → Approved → Core → Deprecated →
Archived. Revision 4 carried a thinner draft → active → refined → retired.
The founding version contains two ideas worth keeping: **Candidate** (a seed on
probation, applied but watched) and the **Core / non-Core** distinction (some
seeds become constitutional to a Mentor's behavior; Article 4 protects exactly
these). TERMINOLOGY now carries the founding sketch as the working draft. The
lifecycle ADR owed before Phase 5 must reconcile both, and now has its raw
material.

## Finding 3 — "Revision 3 never existed as files" (confirmed)

The founding Copilot confirms no Revision 3 file set was ever produced — only
decisions and a brief. This retroactively validates the Session 003 method
(reviewing the brief's concepts) and closes the reconciliation offer that
Session 003 left open. It also records a principle worth keeping, stated by the
founding Copilot: a revision exists only when the whole set is consistent.

## Finding 4 — Smaller recoveries

- **GuruSeed anatomy** (intent, domain, human knowledge, application context,
  explanation, refinability, history) — never formalized, now preserved in
  TERMINOLOGY as the founding sketch. Deliberately not frozen into JSON; that
  belongs to the seed lifecycle ADR.
- **Executive Mode Health Check** — project health indicators surfaced to the
  Pilot. Real idea, not Foundation-critical → Incubator.
- **Book Philosophy** (Books I–IV: Foundation, Engineering, Implementation,
  Evolution) — adopted as naming: this repository is **Book I — Foundation**.
  Books II–IV are declared, not written.
- **Project State founding fields** (mission, current objective, artifacts,
  decisions, next steps, open questions, state) — match Navigation's CURRENT.md
  structure almost exactly, confirming the Revision 2 observation that
  Navigation is a working prototype of Project State.
- **Founding examples of seeds** — three implicit examples preserved in
  heritage; notably one is film-craft ("create emotional tension before the
  reveal"), which the first production line (the anime-style short) will use.

## Finding 5 — Authorship record

The export is scrupulous about attribution: GuruSeed (name and concept),
Context Scheduler hypothesis, Constitution (word and rejection of
"Constraints"), AgentOS Lab — Pilot. Book Philosophy — founding Copilot.
Navigation — joint. This record matters for one architectural reason: the
system being built exists to preserve exactly this kind of provenance. The
founding sessions practiced, informally, what the Artifact provenance invariant
will later enforce.

## Consistency check after amendments

No Constitution article touched. No new plane, no new actor. One mechanism
restored (Seed Composer, Proposed), one lifecycle sketch upgraded, one
Incubator entry added, heritage preserved. Scope: narrower than it looks —
everything here recovers founding intent rather than inventing.
