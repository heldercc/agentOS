# ADR-0010: TypeScript Engine, Language-Agnostic Tools

- **Status:** Accepted
- **Date:** 2026-07 (Session 004)
- **Deciders:** Pilot

## Context

Phase 1 requires a stack. The Kernel is a governance layer — I/O-bound and
human-bound: it validates work orders in microseconds, then waits seconds for
models and hours for the Pilot. Its real performance axes are development
speed (a part-time solo Pilot) and iteration speed (the design will change
often early). Meanwhile, the ecosystem will inevitably offer valuable tools in
other languages — Python above all (data work, scraping, and ComfyUI itself,
the eventual renderer).

## Decision

Three commitments:

1. **TypeScript (strict) on Node LTS** for the engine and the App — one
   language for Kernel, Executive UI and integrations. The Chapter III
   vocabulary becomes executable: `GuruSeed`, `WorkOrder`, `Mentor`,
   `RenderOrder` are compiler-enforced types, making "no domain words in the
   engine" (ADR-0008) verifiable in the type system.
2. **Tool Runner** — tools are external processes under a JSON contract
   (work order in via stdin, Artifacts + provenance out via stdout), launched
   and metered by the Kernel. The tool's language is invisible to the engine;
   the first runner is `python`. This is the module pattern the Pilot already
   engineers in hardware: the hub speaks protocol, never internals.
3. **Native only where measured** — if a component ever proves CPU-bound
   (seed indexing, local vector search), that module alone may go native
   behind its interface. Proven by the Effort Probe's numbers, never assumed
   (Article 8).

## Alternatives Considered

- **Rust/Go engine** — rejected: optimizes the microseconds of a system whose
  bottleneck is seconds of API and hours of human; weeks of fight with the
  compiler bought with factory-building time. Complexity without
  justification (Article 8).
- **Python engine** — rejected narrowly: capable, but optional typing erodes
  the book's terminology discipline, and the Executive UI would split the
  system into two languages on day one. Python enters as first-class tool
  citizen instead.
- **Polyglot from day zero** — rejected: two build systems and two idioms for
  one solo Pilot is self-inflicted drag.

## Consequences

- Phase 1 starts immediately: Node LTS + TypeScript strict, file-based
  stores, git as the State Plane's versioning.
- The Kernel gains one early obligation: the Tool Runner contract is designed
  with the first work-order schema, not bolted on later.
- No lock-in in any direction: tools are language-free by contract, and the
  State Plane (files + git) is readable by any future engine.
