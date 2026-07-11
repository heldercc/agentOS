# AgentOS — Book I: Foundation

> An Operating System for Reusable Human Expertise.

This repository is not documentation. It is the **Foundation Book** of AgentOS:
the philosophy, vocabulary, architecture and decision record of the project,
written before any production code, intended to remain legible in ten years.

Code that is written before its architecture is understood becomes legacy on the
day it compiles. This book exists so that never happens here.

## Status

**Foundation — Revision 8 (Book I complete; Book II chartered in Chapter VI).**

This repository is **Book I — Foundation** of a declared four-book arc:
Foundation, Engineering, Implementation, Evolution. Only Book I exists; the
others are named so the shelf is honest about what is missing.

## The Book

Read in order. Each chapter explains *why* before *how*.

| Chapter | File | Question it answers |
|---|---|---|
| I | `docs/VISION.md` | Why does AgentOS exist? |
| II | `docs/CONSTITUTION.md` | What will never be compromised? |
| III | `docs/TERMINOLOGY.md` | What do our words mean? |
| IV | `docs/ARCHITECTURE.md` | How is responsibility divided? |
| V | `docs/ROADMAP.md` | In what order is it built? |
| VI | `docs/OBJECTIVES.md` | What must the code prove? |
| — | `docs/adrs/` | Why was each decision made? |
| — | `docs/navigation/` | Where is the project right now? |
| — | `docs/incubator/` | What is alive but not committed? |
| — | `docs/reviews/` | What did each architectural review conclude? |
| — | `docs/heritage/` | What did the founding sessions actually say? |

## Governance

- The **Pilot** — the human owner — is the final authority. Always.
- Significant decisions become **ADRs**. ADRs record *why*, never implementation.
  Once accepted, an ADR is immutable; it can only be superseded.
- **Navigation** preserves direction between sessions. Any session — with any
  Copilot — begins by reading `navigation/CURRENT.md` and ends by updating it.
