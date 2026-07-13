<!-- AgentOS provenance: origin=authored | producer=Copilot (Session 008, 2026-07-12 night) | gate=smoke 33/33 + browser pass | status=Beta shell -->

# product/ — the AgentOS shell

This is the emerging **product**: the 13-step Product Loop of
[docs/PRODUCT-LOOP.md](../docs/PRODUCT-LOOP.md), implemented per
[ADR-0018](../docs/adrs/ADR-0018-THE-PRODUCT-SHELL.md). Not the frozen
experiment rig (that is `experiments/`), not yet the durable Kernel (that is
Book II, `engineering/`).

```
npm install
npm run smoke       # the whole loop on the fake runtime, zero cost
npm run shell       # http://localhost:4900
```

The Beta shell binds explicitly to `127.0.0.1`. It is local-only and must
never be exposed directly to a LAN or the public internet; remote/mobile access
arrives only through the future authenticated design registered for Phase 7.

The runtime is chosen by env var:

| `PRODUCT_RUNTIME` | what runs the Work Orders |
| --- | --- |
| `cli` (default) | Claude Code through PowerShell (`claude -p --model <effort>`) — needs a logged-in `claude` |
| `mailbox` | human-in-the-middle file drop (ADR-0013): prompts in `mailbox/outbox/`, answers in `mailbox/inbox/` |
| `fake` | deterministic placeholder, zero cost — smoke and UI testing |

The loop, as the user lives it: create a project from a name and free text →
the Kernel convenes a bounded team and collects their Question Needs → you
answer **up to three coherent governed questions per submission** (each
affected agent is re-consulted once with the relevant batch; a question may
be routed to Decidir for concrete options) → the Kernel builds a candidate
Project State and proposes a governed Project Map → you
approve it (or reject it with direction) → you choose effort (probe first,
spend after) and execute → artifacts return to `workspace/<project>/` by
themselves → the iteration advances and the loop repeats.

`workspace/` and `mailbox/` are gitignored: the repo carries the shell,
your projects stay yours. Every Work Order leaves a manifest (what entered
context and why), a meter (what it cost), and evidence (who moved: you or
the Kernel).
