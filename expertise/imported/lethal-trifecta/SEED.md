<!-- AgentOS provenance: origin=imported | source=Simon Willison, "The lethal trifecta" (simonwillison.net, 2025-06-16), via docs/reviews/2026-07-REVIEW-FISHING-EXPEDITION-1.md | admitted=2026-07-11 Session 005 | gate=Pilot (distillation delegated in-session) -->
---
name: lethal-trifecta
kind: seed
description: "Private data, untrusted content, and external communication must never co-occur in one agent. Detection is a treadmill; elimination is a decision."
---

# The Lethal Trifecta

Prompt injection is not reliably detectable — and even 95% detection is an
unacceptable failure rate for a security boundary. Stop betting on the
classifier. The exploitable condition is the **co-occurrence** of three
capabilities in one agent/session:

1. access to private data,
2. exposure to untrusted content,
3. ability to communicate externally.

Remove any one leg and the injection has nowhere to go. That is a one-time
architectural decision instead of an arms race.

**Where it applies in AgentOS:** Tool Runner and runtime design ADRs — a work
order's capability set is checked against the trifecta before execution; a
Mentor that reads the open web does not also hold the Pilot's private stores
and an outbound channel. Composes with the authority-matrix seed: "forbidden"
lists exist precisely to break this triangle.
