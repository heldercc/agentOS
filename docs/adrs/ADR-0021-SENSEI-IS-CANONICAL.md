# ADR-0021 — Sensei Is the Canonical Name of the Expert Entity

- **Status:** Ratified (the Pilot's explicit decision — baptized in Session
  013 (2026-07-12, parecer PARECER-PILOTO-2026-07-12-NOITE.md, point A) and
  confirmed as FINAL in the CEO decision interview of 2026-07-12.
  **CLOSED — Pilot decision; no Copilot reopens or re-interviews the name.**)
- **Pole:** (B) governance — the Pilot names his own instruments.
- **Supersedes:** the "Mentor" naming of ADR-0002 and ADR-0020 §6 (the
  *substance* of both decisions — expertise bundles replace personas; the
  entity is human intelligence with a name, not an AI agent — is untouched).

## Question

ADR-0002 named the expert entity "Mentor Expertise"; ADR-0020 §6 restored
"Mentor". In Session 013 the Pilot, exercising the authority those ADRs
reserve to him, baptized the entity **Sensei** and the product shipped the
reform (seed ownership, victories, graduation, base photo — commit 3f9638b,
migration mentors/ → senseis/ executed live). The doctrine still said
"Mentor". Which name is canonical?

## Decision

1. **SENSEI is canonical and final.** Every active document — Terminology,
   Architecture, Vision, Objectives, Roadmap, doctrine specs, engineering,
   product code and UI — uses Sensei. Composite terms follow: the reference
   guild is the **Guilda dos Senseis**; a seed belongs to exactly one Sensei.
2. **Mentor survives only as history and migration compatibility.** ADRs,
   heritage, reviews and diary entries are immutable records and keep the
   word. Code may keep `mentor` identifiers solely where reading old on-disk
   records requires it, and such sites must say so.
3. **What the name carries is unchanged:** a Sensei is NOT an AI agent. It is
   the user-authored, evolving composition of GuruSeeds — human intelligence
   with a name. Temporary model roles remain vessels; the Sensei is what
   they carry (ADR-0020 §6, substance preserved).

## Consequences

- TERMINOLOGY.md, ARCHITECTURE.md, VISION.md, OBJECTIVES.md, ROADMAP.md,
  FOUNDATION-CORRECTION.md are updated in the same commit as this ADR.
- HUMAN-INTELLIGENCE-LIBRARY.md is the Pilot's verbatim design; it receives
  a naming note at the top instead of a rewrite of his voice.
- The on-disk library already migrated (senseis/, Session 013); no further
  data migration is owed by this ADR.
- Any future document that writes "Mentor" for the living entity is a
  doctrine defect.
