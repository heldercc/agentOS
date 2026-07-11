# Review — "SavePoint R5 Proposal" (founding Copilot)

Session 004. The proposal arrived as structure (one-line placeholders), not
content; reviewed idea by idea. Verdict taxonomy used below is the proposal's
own suggestion — adopted with thanks: **Accepted · Rejected · Incubator ·
Future ADR · Constitution Candidate.**

## Accepted
- **engineering/ skeleton** (kernel, scheduler, runtime, ui, probes) — exactly
  the Book II layout; adopted now as placeholders so Phase 1 code has a home.
  One addition: probes/ will host the Effort Probe.
- **Review verdict taxonomy** — every review now ends with one of the five
  verdicts. Adopted from this review onward.

## Rejected (Pilot may override)
- **book/ as a second canonical tree** — docs/ chapters I–VI already are the
  book; two trees guarantee drift. One canon.
- **Replace feature roadmap with era-based evolution** — the Session 004
  roadmap has testable exit criteria; eras are narrative, not falsifiable.
  The roadmap stays. (Era names may decorate phases later; they may not
  replace exits.)
- **NOT_YET.md rename** — the Incubator already is the not-yet, with a
  promotion path that has now been exercised twice. Rename adds nothing.
- **philosophy/ as separate top-level** — philosophy lives in Chapters I–II;
  extracting one-line aphorisms into a parallel folder dilutes the book.

## Incubator
- **heritage/ substructure** (founding / historical_sessions /
  major_decisions) — premature at 3 heritage documents; adopt when heritage
  outgrows a flat folder.

## Constitution Candidate (awaits Pilot ratification — Copilot cannot amend)
- **"Complexity must justify itself."** — genuinely good, arguably the article
  this Constitution is missing (it is the spirit behind ADR-0004's split and
  the three-planes rejection of the chain). Proposed as Article 8. The Pilot
  decides; until then it is recorded here, not in Chapter II.

## Also noted
- "Records" as the State Plane's name — considered; "State" retained (Records
  suggests only the audit log; the plane also holds living state).
- The badly-placed root files and the zip on the remote are superseded by
  this tree; the proposal's content survives via heritage, per Article 3's
  spirit: nothing the project learned is lost, everything is inspectable.
