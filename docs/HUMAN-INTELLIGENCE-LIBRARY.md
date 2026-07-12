<!-- AgentOS provenance: origin=taught | producer=the Pilot (verbatim design, Session 010, 2026-07-12) | gate=none needed — the owner's voice | status=DOCTRINE-SPEC. Registered by the Copilot's subagent. -->

# The Human Intelligence Library

> **Naming note (ADR-0021, 2026-07-12):** the expert entity is canonically
> the **SENSEI** — the Pilot's final decision. This document is his verbatim
> design and keeps his original voice; read every "Mentor" below as
> "Sensei". The on-disk library migrated `mentors/` → `senseis/` in Session
> 013; `mentors/` paths below are historical.

Read this as the specification of the on-disk Human Intelligence Library.

## 0. Principle

The library is not a prompt trick.

It is not hidden in session memory.

It is not "magic personalization" happening somewhere behind the model.

The library must be materialized on disk as a real library — files you can
open, read, diff, version and audit like any other asset AgentOS owns.

It holds five separated categories:

- **GuruSeeds** — atomic units of judgement.
- **Mentor Expertises (Mentors)** — governed compositions of GuruSeeds.
- **Tools** — capability, not knowledge.
- **Recipes / Workflows** — how context, expertise, model, tools and gates combine.
- **Evidence & Provenance** — where each piece came from, and where it has been used.

None of these categories substitute for another. A Mentor is not a bigger
Seed. A Tool is not a Seed with side effects. A Workflow is not a Mentor
with steps. Keeping them separate is what keeps the library governable.

## 1. Disk Layout

```
human-intelligence/
├── seeds/
│   ├── creative-direction/
│   │   ├── restraint-before-impact/
│   │   │   ├── seed.yaml            (current version + content_hash)
│   │   │   ├── versions/v<N>.yaml   (immutable history, write-once)
│   │   │   ├── explanation.md
│   │   │   ├── examples/
│   │   │   ├── counterexamples/
│   │   │   ├── evidence.jsonl       (append-only telemetry)
│   │   │   └── applications.jsonl   (append-only telemetry)
│   │   └── avoid-generic-staging/
│   ├── cinematography/
│   └── pt-pt-voice/
├── expertises/   (implemented as mentors/ — see naming note;
│                  each mentors/<id>.yaml has mentors/history/<id>/v<N>.yaml)
├── tools/
├── workflows/
├── candidates/
├── retired/
└── index/
```

Disk is the source of truth. Every other view — UI, Kernel selection,
search index — is derived from what lives in these folders.

### 1.1 Immutability (correction of 2026-07-12)

The versioned **content** of a Seed or Mentor — rule, why, scope,
composition — is write-once per version. Revision bumps the version and
writes a new snapshot under `versions/` (Seeds) or `history/` (Mentors);
no previous version is ever edited or deleted, so any Artifact that names
"seed X v2" can recover exactly what v2 said, forever.

**Telemetry never lives inside the versioned content.** Where a seed was
applied (`applications.jsonl`) and what the Pilot's verdicts were
(`evidence.jsonl`) are append-only sidecars, hydrated onto the record at
read time. A version's `content_hash` (sha256 of the content) therefore
never drifts, and every Artifact provenance sidecar records the hash of
the artifact text, of the Work Order's context manifest, and of each seed
version it applied — the declaration is verifiable, not just legible.

## 2. GuruSeed Record

A GuruSeed is an atomic unit of judgement: one rule, one reason, one scope,
one trail of evidence. It must be human-readable, git-versionable and
machine-usable at once — the same file a person reads is the same file the
Kernel schedules into a Work Order.

```yaml
id: restraint-before-impact
title: Restraint before impact
kind: judgement
status: admitted
scope:
  domains: [creative-direction, cinematography]
owner: the Pilot
version: 1
rule: >
  Prefer the smaller gesture that lands over the bigger gesture that
  announces itself. Impact is earned by restraint, not by volume.
why: >
  Loud staging reads as insecurity about whether the idea works. When the
  idea is right, the quiet version proves it faster and ages better.
provenance:
  origin: taught
  source_project: ascensao-t2
  admitted_by: the Pilot
  admitted_at: 2026-07-12
evidence:
  supporting:
    - it-004/option-b preferred over option-a (louder staging) — round 2
  contradicting: []
applicability:
  use_when:
    - the scene's emotional beat is already clear from context
    - the audience has been given time to understand stakes
  avoid_when:
    - the scene is the audience's first exposure to the stakes
    - restraint would read as indecision rather than confidence
```

(The `evidence:` block above is the hydrated view the product shows; on
disk those lines live in `evidence.jsonl`, the application trail lives in
`applications.jsonl`, and `seed.yaml` carries only the versioned content
plus its `content_hash` — see §1.1.)

## 3. Mentor Expertise (Mentor)

A Mentor Expertise is not another intelligence. It is a governed
composition of GuruSeeds — a named, versioned bundle that pins which
seeds apply and how conflicts among them are handled.

```yaml
id: creative-direction
version: 3
seeds:
  - id: restraint-before-impact
    version: 1
  - id: avoid-generic-staging
    version: 2
selection_notes: >
  Prefer project-local seeds when relevant. Surface contradictions instead
  of silently choosing.
```

### Naming note

The Pilot rebaptized "agent expertise" as **Mentor Expertise** to avoid
confusion with AI agents — the product word for the composed bundle is
**Mentor** (per ADR-0002, Mentor Expertises replace personas). A Mentor is
authored and evolved by the user — for example, a director-like Mentor that
is enriched over time as more seeds are admitted into it. At suggestion
time, the product shows **which Mentor produced each option**, so taste is
always attributable to the human who built it, not to an anonymous model
call.

## 4. Tools

A Tool is capability, not knowledge, and is kept as its own category so it
is never confused with judgement. A Tool does the same deterministic thing
every time; a Seed changes what is preferred.

```yaml
id: spoken-duration-checker
kind: deterministic-tool
inputs:
  - text
  - language
  - target_seconds
outputs:
  - estimated_seconds
  - overrun_seconds
  - suggested_cuts
permissions:
  filesystem: none
  network: false
implementation: invoke.ps1
```

The `implementation` field points to the actual executable surface —
a script such as `invoke.ps1`, or local code — that the Kernel invokes when
a Work Order requires the tool. The record itself carries no logic; it
only declares contract and permissions.

## 5. Recipes / Workflows

A Workflow describes how to combine context, expertise, model, tools,
outputs and gates into a repeatable multi-step recipe.

```yaml
id: critique-and-revise
steps:
  - role: writer
    produces: draft
  - role: critic
    consumes: [draft]
    produces: critique
  - role: synthesizer
    consumes: [draft, critique]
    produces: revised-artifact
required_expertise:
  - creative-direction
optional_tools:
  - artifact-comparator
```

## 6. What Enters a Work Order

The Kernel selects only the necessary. It never copies the whole library
into a Work Order — that would defeat context scheduling and make every
run expensive and untraceable.

```json
{
  "workOrderId": "wo-0142",
  "role": "critic",
  "expertise": [
    {
      "id": "creative-direction",
      "version": 3,
      "reason": "scope tag matches project domain: cinematography"
    }
  ],
  "tools": [
    { "id": "spoken-duration-checker", "version": 1 }
  ]
}
```

This is the proof artifact: which intelligence was used, which version,
why, by which temporary agent, with which tool, in which resulting
artifact. Without this record, "the model did something clever" is not an
auditable claim.

## 7. Required UI Views

- **Library** — all Mentors and Seeds, with status, scope, version and origin.
- **Candidates** — edit, admit, scope-to-project, or reject.
- **Used in this project** — what applied, where it entered, which artifacts
  it influenced, and related decisions.
- **Impact** — where it helped or failed, use counts, whether it reduced
  corrections or effort.
- **Relationships** — seeds that reinforce or contradict each other, the
  Mentors that include them, and the Workflows that use them.

A library that cannot answer these five questions from its UI is
incomplete, no matter how good the underlying judgement is.

## 8. Closing Principle

The disk folder is the source of truth. The UI is a view over the library.

Disk = canonical intelligence.
UI = inspection and governance.
Kernel = selection and scheduling.
Model = temporary application.
Pilot = authority.

It must feel like a living library where you can see what AgentOS knows,
who taught it, why it believes it, where it applies, what it influenced,
and whether it is still valid.

## 9. Implementation Status

v0 was implemented in Session 010, in `product/human-intelligence/`:
seeds, mentors, candidates and index are live. Tools and workflows are
registered categories in this spec but are stubs only for now — no
executable Tool or multi-step Workflow record ships yet.

**Privacy note, flagged for the Pilot's explicit decision:** the library
currently lives inside the public repo's gitignore boundary. Personal
judgement is the Pilot's IP; the `human-intelligence/` folder is its own
git-able unit if the Pilot wants it versioned separately from the public
repo. No decision has been made on this yet — it is recorded here so it is
not lost, not resolved.
