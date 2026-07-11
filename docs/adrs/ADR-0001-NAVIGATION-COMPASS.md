# ADR-0001: Navigation as the Long-Term Architectural Compass

- **Status:** Accepted
- **Date:** 2026-07 (Session 001; formalized in Revision 2, Session 002)
- **Deciders:** Pilot

## Context

AgentOS is built across many sessions, with different Copilots (different AI models,
different days, no shared memory). The project's own founding complaint — context
evaporates between sessions — applies to building the project itself.

## Decision

Maintain a Navigation system inside the repository: a `CURRENT.md` file (mission,
heading, state, major decisions, open questions, next bearing) plus per-month
session logs (`navigation/YYYY/YYYY-MM.md`). Every working session starts by reading
CURRENT.md and ends by updating it.

## Alternatives Considered

- **Rely on chat history / AI memory features** — rejected: tool-specific, not
  versioned, not portable across Copilots.
- **Issue tracker as source of truth** — rejected for Foundation: issues track
  tasks, not heading. May complement Navigation later.

## Consequences

- Any session — human or AI — can resume with full context from the repo alone.
- Navigation discipline costs a few minutes per session; skipping the update is a
  process defect.
- Navigation is also a live prototype of the Project State concept: the project is
  its own first user.
