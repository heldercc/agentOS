<!-- AgentOS provenance: origin=taught | producer=the Pilot (verbatim directive, Session 007, 2026-07-12) | gate=none needed — the owner's voice | status=DOCTRINE. The next implementation target. Registered by the Copilot with the placement decision the directive demands. -->

# The Product Loop — the next implementation target

The recent rigs are evidence infrastructure. The next task is the operating
product. Stop expanding the existing governance rig unless a direct blocker
appears. The next implementation target is not more measurement.

It is the actual AgentOS product loop:

1. Create a project from name + free-text description.
2. Invoke Claude Code locally through PowerShell.
3. Spawn bounded project agents.
4. Collect their Question Needs.
5. Let the Kernel aggregate and deduplicate them.
6. Show one governed question to the Pilot.
7. Persist the answer.
8. Re-consult relevant agents automatically.
9. Build a candidate Project State.
10. Let the Pilot approve it.
11. Continue into governed execution.
12. Return artifacts automatically into the project workspace.
13. Update candidate state and repeat.

Add the Effort Probe slider before agent execution.

Do not require the Pilot to transport prompts or dumps.

Do not pre-author the creative answer.

Do not build another experimental control unless this loop requires it.

## Terminology: User = Pilot

The Pilot is not a separate administrator, operator, reviewer or external
role. The Pilot is the actual user of AgentOS. Every person using AgentOS is
the Pilot of their own projects. In this Beta, Hélder is the Pilot because he
is the user operating AgentOS.

All product language and architecture assume:

- the user states intent;
- the user answers questions;
- the user chooses effort;
- the user approves, rejects and corrects;
- the user governs project direction;
- the user admits or discards Seeds;
- the user decides what becomes authoritative.

Do not design a second hidden "Pilot" role behind the user. Do not require an
administrator to mediate the user's decisions. Do not treat governance as a
back-office function. Governance is the normal product interaction between
AgentOS and its user.

## Placement discipline

Do not retrofit the product loop into the existing Beta rig by endlessly
extending it. The current rig is experimental evidence infrastructure. When
implementing Project Init, the Claude Code runtime, Question Needs and the
live project loop, decide explicitly which parts belong in the disposable
experiment, the emerging product shell, and the Kernel design. Reuse proven
mechanisms. Do not accidentally turn the experiment folder into the permanent
application architecture.

---

## Copilot's registration notes (Session 007)

### The explicit three-layer placement decision

**Disposable experiment (`experiments/beta-governance/` — FROZEN except for
direct blockers):** the ADR-0015/0016/0017 rig as committed. It keeps its
job: producing the Beta 2 evidence (does governed selection improve
proposals?). Nothing new lands here.

**Emerging product shell (`product/` — NEW top-level folder, to be created):**
the 13-step loop above. It reuses, by copy-with-provenance (the standing
rig-uncoupling rule, never imports across folders):

- the mailbox/PowerShell-spawn pattern (ADR-0013) as the Claude Code runtime
  boundary — step 2;
- the context manifest + meter discipline (ADR-0012) for every Work Order —
  steps 3, 12;
- the effort spec/probe/actuals mechanism (ADR-0017) for the slider before
  execution;
- the "Perguntas ao Pilot" extraction + aggregation (ADR-0016 pilot_note +
  ADR-0017 aggregation) grown into first-class Question Needs — steps 4–8;
- the evidence-event append-only log for every user click.

What the shell adds that no rig has: Project Init from free text (step 1),
the candidate Project State with user approval (steps 9–10), and artifacts
returning into a per-project workspace (step 12).

**Kernel design (`engineering/`, Book II):** the aggregation, scheduling and
boundary logic the shell proves out gets specified there before any of it is
called "the Kernel". The shell is still a Beta; the Kernel is the durable
thing.

### Status

Registered Session 007, immediately after the four real rounds were
committed. The product shell build starts at the top of the next working
session with fresh context — it deserves a whole tank, not a reserve.
