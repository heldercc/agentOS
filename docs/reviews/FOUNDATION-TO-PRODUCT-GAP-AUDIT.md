<!-- AgentOS provenance: origin=taught | producer=the Pilot's audit (Session 010, 2026-07-12), registered by the Copilot's subagent | status=REVIEW -->

# Foundation-to-Product Gap Audit

Session 010. The Pilot audited the product shell (`product/`, built per
ADR-0018 and ADR-0019) against Book I of the Foundation — VISION.md,
CONSTITUTION.md, ARCHITECTURE.md, TERMINOLOGY.md — plus OPERATING-MODEL.md,
PRODUCT-LOOP.md, FOUNDATION-CORRECTION.md and the two ADRs themselves. This
document registers his verdict faithfully, gives it evidence against the
repository as it stands, and lists the corrective measures he ordered.

## The verdict

> We did not fail because the Foundation forgot human intelligence. We
> failed because we built the product without obeying the center of the
> Foundation itself. We built the peripheral circuit — workflow, questions,
> state, runtime, artifacts — and started calling it the product before
> wiring the central organ: reusable human intelligence. And a second
> error: we did not require that the user could see and understand that
> circuit.

The Foundation was right all along. The failure is one of construction
order, not of doctrine.

- **Vision.** The book's second founding observation is that "expertise
  evaporates with its projects" and that GuruSeeds are "explicit, versioned,
  teachable units... that outlive the projects that produced them." The
  Vision's own success criterion opens on *Teach* — "encode a piece of
  judgment as a GuruSeed" — before *Delegate*, *Review* or *Evolve*.
- **Constitution.** Article 3, Expertise Is Explicit: "the owner's judgment
  enters the system as inspectable, versioned artifacts — never as opaque
  adaptation." Article 4 forbids core expertise from mutating without
  approval. Article 5 assigns context resolution to the system, never to
  Pilot repetition.
- **Architecture.** The Canonical Flow is explicit about where human
  judgment sits in the loop: the Kernel schedules context by invoking the
  **Seed Resolver**, which selects from **GuruSeeds + Project State +
  Memory** into an enumerated Context; a temporary **Mentor** executes;
  **Artifacts** and a **Project State delta** return with full provenance;
  the Pilot approves, rejects, or **teaches** — closing the loop.

None of this was missing from the book. It was missing from the build.

## Gap matrix

| Foundation commitment | Where implemented today | Evidence | Gap severity | Corrective measure |
|---|---|---|---|---|
| Explicit expertise (Vision; Constitution Art. 3) | Not present at ADR-0018 time. ADR-0019 added a flat expertise store. | `product/src/expertise.ts`: one record type (id, title, body, scope tags, status `candidate/admitted/discarded`, reach, provenance note, `appliedIn`). No GuruSeed anatomy (intent, domain, application context, explanation, refinement history) and no seed lifecycle (idea → draft → candidate → approved → core → deprecated → archived, TERMINOLOGY.md). | Critical | Human Intelligence slice: build GuruSeeds with real anatomy and lifecycle, not a flat store. |
| Seed Resolver (Architecture; TERMINOLOGY.md) | Absent. Manifests carry project context plus flat expertise filtered by scope-tag overlap. | `product/src/kernel.ts` §2 composition rule (ADR-0019 §2): "applicable = admitted, and scope tags overlap the agent's tags." No attributable/auditable *resolution* mechanism distinct from a tag filter; no per-work-order resolver as its own governed step. | Critical | Implement per-Work-Order Seed Resolver as a first-class Kernel responsibility, not an inline filter. |
| Seed provenance on artifacts (TERMINOLOGY.md: "every Artifact carries provenance by reference") | Absent. | Artifacts in `product/src/kernel.ts` are written as plain markdown files (`writeArtifactOnce`, `ArtifactInfo`); no `types.ts` artifact record carries expertise or seed IDs. `appliedIn` on an expertise record points from expertise → work order, not from artifact → expertise. | Critical | Manifest + artifact provenance: every artifact must reference the expertise IDs and versions that shaped it. |
| Teach loop (reject/correct → candidate → admit → reuse) | Absent in the product. Present in the frozen experimental rig. | `experiments/beta-governance/src/distill.ts` (ADR-0009/ADR-0015: selection evidence → candidate seed → Pilot admits) has no counterpart under `product/src/`. ADR-0019 §Consequences records this explicitly as "owed next, recorded not built." | Critical | Candidate → admit → reuse slice, ported from the rig's proven mechanism, not reinvented. |
| Executive Mode legibility (Architecture; FOUNDATION-CORRECTION.md) | Partial. | One action per stage is enforced by the Kernel (ADR-0018 §4). A "História" (history/journey) tab exists in the shell UI (`product/src/cli/shell.ts`), and `storyOf()` (ADR-0019 §3) assembles the phase timeline the correction demanded. But the eight legibility questions are answered from a single technical page, not from a designed Executive Mode surface. | Insufficient | Project Journey + Decision Surfaces, built to the Foundation-Correction's eight questions as an acceptance test, not as a side tab. |
| Context scheduled (Vision; Article 5; ADR-0003) | Partial. | Project State, effort budget and manifests are real (`product/src/manifest.ts`, `effort.ts`). Expertise resolution is not — see the Seed Resolver row above. | Missing expertise resolution | Resolve both context and expertise through the same scheduled, audited mechanism. |
| Human governs (Article 1; Constitution) | Present. | Questions, approvals, effort choice and expertise admission are all Pilot clicks; the Kernel never admits (ADR-0019 §1, "same law as the rig's seed tray"). | Good | Keep. |
| Article 9 — Certainty Precedes Action | Tension, not yet resolved. | The 90% rule ("no actor advances on an assumption... stops and interviews") sits against the interview-to-unblock discipline (OPERATING-MODEL.md §4: "Do not interview for completeness. Interview to unblock useful work.") and against the Pilot's own authority to say "enough — build with what you have and show assumptions." The three are not reconciled in any single document. | Conflict | Clarify via ADR-0020. |

## The eight numbered failures

The Pilot's audit identified eight distinct findings, not one:

1. **The product was born without the heart of the architecture.** The
   Product Loop (13 steps) and the shell built from it (ADR-0018) shipped
   workflow, questions, state, runtime and artifacts — the peripheral
   circuit — without the Seed Resolver or GuruSeeds the Architecture places
   at the center of the Canonical Flow.
2. **Project context was confused with accumulated intelligence.**
   Operational context (what this project currently needs) is not the same
   thing as human criteria, taste, heuristics, methods, examples,
   rejections and principles accumulated across projects. The shell built
   the first and mislabeled it as covering the second.
3. **The generated roster replaced the right architecture.** The system
   asked "which agents do we have?" before asking "with what expertise
   should whoever works, work?" — the order FOUNDATION-CORRECTION.md
   explicitly inverts ("Do not think... Think: 'What expertise is needed,
   and what temporary agent should apply it?'"). ADR-0019 corrects the
   vocabulary; the underlying construction order in ADR-0018 had already
   shipped inverted.
4. **Provenance is technically good but intellectually incomplete.** What
   exists answers model, role, state and cost. It does not answer which
   human judgment was applied, why it was selected, what it influenced, or
   what evidence reinforced or contradicted it.
5. **The learning loop was left in the laboratory.** The frozen rig
   (`experiments/beta-governance/`) has selection, rejection, evidence,
   candidates, admission, and seeds re-entering context — the whole cycle.
   The product ported effort, evidence, manifests and questions from it,
   but not the loop that actually differentiates AgentOS from a workflow
   tool.
6. **New doctrine was layered without formal reconciliation.**
   OPERATING-MODEL.md, PRODUCT-LOOP.md and ADR-0018 accumulated as a
   parallel doctrine layer alongside Book I, without an explicit
   reconciliation pass. Constitution Article 6 requires architecture to be
   revised only "explicitly, through an ADR, never by fait accompli" — the
   product doctrine grew adjacent to, rather than through, that discipline.
7. **Article 9 contradicts itself in practice.** The 90%-certainty rule,
   the interview-to-unblock discipline, and the Pilot's authority to declare
   "enough — build with what you have and show assumptions" are three
   different stopping rules that have never been reconciled into one.
8. **User experience was not protected as an invariant.** A capability is
   not governed if the user cannot perceive and understand its path and
   state through the product. Legibility was treated as a UI nicety
   (FOUNDATION-CORRECTION.md, ADR-0019 §4) rather than as a condition of
   the capability being considered complete at all.

## Corrective measures

The Pilot ordered eight measures:

1. **Freeze expansion** of the product shell beyond direct blockers until
   the gap is closed.
2. **This audit**, registered as the record of what went wrong and why.
3. **Reconciliation ADR-0020**, to bring OPERATING-MODEL.md, PRODUCT-LOOP.md,
   ADR-0018 and ADR-0019 into explicit alignment with Book I, per
   Article 6.
4. **Redefine the minimum complete product**: the full loop — resolve
   human expertise → produce an artifact with provenance → the Pilot judges
   → candidate learning → admit → affects later work — not the peripheral
   circuit alone.
5. **One vertical Human Intelligence slice** before any further library
   sophistication: GuruSeeds, Seed Resolver, teach loop, artifact
   provenance, end to end, on a narrow scope, before broadening.
6. **Rebuild the UI around legibility**: four permanent answers — where am
   I, what happened, what needs me, what happens next — across five areas —
   Overview, Journey, Work & Outputs, Human Intelligence, Artifacts &
   Decisions.
7. **Separate Model vs. Temporary Role vs. Human Intelligence** as three
   distinct, never-conflated concepts in both the architecture and the UI.
8. **Foundation-conformance gates on every product commit** — five
   questions asked before any change lands: Which Foundation article does
   this serve? What human context becomes visible or reusable? Can the user
   perceive the change without reading logs? Was any architectural decision
   introduced silently? Does this improve AgentOS, or does it turn it into
   a generic workflow app?

## Closing

AgentOS is not complete when it can produce an artifact. It is complete
when it can produce an artifact applying governed human intelligence, show
the user how it did it, and learn again from their judgement.
