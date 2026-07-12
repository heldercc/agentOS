# ADR-0023 — Standing Engineering Rules (A–E)

- **Status:** Ratified (registered from the Pilot's CEO programme,
  2026-07-12 — ADR-0022). These are permanent engineering law, not
  campaign tasks: every future slice is judged against them.
- **Pole:** (A) a Kernel that cannot lose or corrupt work; (B) governance
  the Pilot can trust without reading code.

## RULE A — Test isolation

Scripted, smoke, fixture and verification data must NEVER enter: the
Pilot's live project list; live metrics; permanent expertise; Sensei
victories; normal evidence; the Pilot's workspace. Tests run in an isolated
workspace/library/runtime **by construction** (a separate data root), not
by filtering. No future test project may require a UI name-based exclusion
hack. Existing scripted records are classified honestly, not deleted —
evidence is never destroyed.

## RULE B — Module registration

No durable implementation module exists without: a parent Foundation
component/plane; a contract; an authority boundary; owned state;
input/output definition; event and schema ownership; observability; tests;
governing ADRs. (The registry itself is Phase 3; the rule binds from now.)

## RULE C — Module versioning

Four version identities are maintained separately and never conflated:
module **contract** version; persistent **schema** version;
**implementation/build** commit; **doctrine/ADR** authority. Versions do
not bump for CSS or private refactors; they bump when behavior, authority,
schema, event semantics or compatibility changes.

## RULE D — Canonical data safety

Canonical state changes are atomic, recoverable and validated. A failed
migration or partial transition must never allow the App to continue as
though the data were healthy — the system enters a visible safe mode
instead of serving half-migrated data.

## RULE E — No domain leakage

The Project Engine may understand slices, dependencies and Artifacts. It
may NOT know about princesses, video, tax, cooking or any other domain.
Verticals are acceptance cases and products built ON generic mechanisms;
domain vocabulary in Kernel or Project Engine code is a defect
(reaffirms ADR-0008).

## Consequences

- Phase 1 must retire the current violation of RULE A (smoke/verify
  projects living in the Pilot's live workspace).
- The Phase 3 Module Registry is the mechanical enforcement of RULES B–C.
- Phase 2's atomic-write + migration work is the mechanical enforcement of
  RULE D.
- The Project Engine ADR (Phase 4) must show its vocabulary is domain-free
  before durable implementation (RULE E).
