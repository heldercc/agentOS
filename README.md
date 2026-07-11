# AgentOS

> An Operating System for Reusable Human Expertise.

AgentOS is an architecture-first research project exploring how human expertise can
become **reusable, teachable and governable** through intelligent systems.

This repository intentionally begins with philosophy, architecture and engineering
decisions before any production code. Code that is written before its architecture
is understood becomes legacy on the day it compiles.

## Status

**Foundation — Revision 2** (architecture exploration, pre-implementation).

## Repository Map

```
docs/
├── VISION.md          Why AgentOS exists and where it is going
├── MANIFESTO.md       The beliefs behind the project
├── PRINCIPLES.md      Non-negotiable rules that constrain every decision
├── TERMINOLOGY.md     The shared vocabulary — read this first
├── ARCHITECTURE.md    Conceptual architecture (layers, boundaries, flows)
├── ROADMAP.md         Phased plan with objectives and exit criteria
├── adrs/              Architecture Decision Records (immutable once accepted)
├── navigation/        The Pilot/Copilot compass — session logs and CURRENT state
└── incubator/         Ideas not yet promoted to the roadmap
```

## How to Read This Repository

1. **TERMINOLOGY.md** — the vocabulary everything else depends on.
2. **VISION.md → MANIFESTO.md → PRINCIPLES.md** — the why.
3. **ARCHITECTURE.md** — the what.
4. **navigation/CURRENT.md** — where the project stands right now.

## Governance

- The **Pilot** (human owner) is the final decision maker. Always.
- Every significant decision becomes an **ADR**. ADRs are never edited after
  acceptance — they are superseded by new ADRs.
- The **Navigation** system records where the project has been and where it is
  heading, so any session (human or AI copilot) can resume with full context.
