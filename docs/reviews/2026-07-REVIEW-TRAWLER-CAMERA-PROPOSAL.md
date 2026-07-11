# Review — the Trawler+Camera proposal (external Copilot, GPT)

Session 006. The Pilot forwarded GPT's architectural review of the fishing
system: a Pilot→Trawler-fleet→Catch-Normalizer→Camera→Adversarial-Gate→Pilot
pipeline, with an Expedition Manifest, per-candidate records, budget/stop
rules, and cost-per-admitted-drop as the primary metric. The Pilot asked for
an adversarial verdict, not an implementation. Article 8 presides.

## What already exists (most of it)

The proposal is, in its core, a description of what expedition 1 already did
— method invented by the Pilot ("a rede pode ser uma Sonnet, a câmara um
Fable 5"), on record in docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-1.md:

| Proposal element | Existing doctrine |
|---|---|
| Trawlers with high recall, no authority | Expedition 1's three Sonnet nets; FISHING-PROMPT: "the external model admits nothing" |
| Camera examines, does not admit | Fable 5 camera gate, expedition 1 |
| Claude as standing adversarial gate | Curation doctrine; every review in docs/reviews/ |
| Pilot final authority (Promote/Candidate/Discard) | O5 — one gate; admitted/noted/rejected tally |
| Provenance to original waters, not the boat | Seed provenance headers (source + via-expedition) |
| Exclusion of already-held knowledge | The 21-finding exclusion list in FISHING-PROMPT-FOR-GPT.md |
| No separate candidate store | Session-005 decision: reviews are the yard; a store would rot |
| "Recall is not learning" | CEO-forreta doctrine: admit only with concrete use in owed ADRs |

GPT reviewed a public repo and mirrored much of it back with new vocabulary.
That is not a fault — independent convergence is evidence the pattern is
sound — but it must not be booked as novelty.

## What is genuinely new — adopted (zero infrastructure)

1. **Expedition Manifest.** Question, waters, exclusions, budget, stop rule,
   minimum primary sources — written at the top of the next fishing prompt
   before casting. Formalizes what the prompt already does ad hoc. Cost: one
   header block.
2. **Cost per admitted drop as the primary metric.** Recorded per expedition
   in its review (first records now in the expedition-2 review: exp 1 ≈ 25k
   tokens/drop; exp 2 ≈ 0 marginal + gate). Kills expeditions that stop
   paying.
3. **Counterevidence query families.** "When did this fail? What result
   contradicts this? Which simple baseline won?" — added to the next prompt's
   research phase. Directly counters the net reinforcing our own beliefs.
4. **Deduplication as an explicit gate step.** Merge same-mechanism drops,
   flag same-query clusters. Done by the camera *reading*, not by built
   tooling — at 10–24 candidates per expedition, a deterministic Catch
   Normalizer is a component for a scale we do not have (Article 8).

## What is rejected

- **Building any of it as a platform.** An expedition is a prompt plus a
  review document. That is its strength: fully observable, zero maintenance,
  disposable. `engineering/` dirs stay empty until their ADR exists, and no
  fishing ADR is owed.
- **A model-routing fleet.** No routing surface exists in any owed ADR; the
  fleet is two hand-picked roles (cheap net, strong camera). The routing
  papers in the expedition-2 catch fell with this.
- **Per-candidate structured records (12 fields).** The four-line
  DROP/WHY GOLD/SOURCE/CONFIDENCE format plus the gate review carries the
  same information at our scale. More schema is bureaucracy without a reader.

## Verdict

**The architecture is already ours; adopt the four controls above into the
fishing pattern; build nothing.** Belongs in navigation (the fishing prompt
gains a manifest header at next casting) — not Engineering, not the
Incubator, no ADR. Minimum experiment: expedition 3, when a new hungry water
opens, runs with manifest + counterevidence queries + the metric — then
compare its cost-per-admitted-drop against expeditions 1–2.

One caution back at the proposal, on its own terms: its risk #3
("summarization launders weak evidence") applies to the *proposal itself* —
eloquent structure around ideas mostly already held. The gate's job stays
what it was: read the original, not the rewrite.
