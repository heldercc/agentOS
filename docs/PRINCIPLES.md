# Principles

Non-negotiable constraints. Every ADR, design and line of future code must be
justifiable against this list. If a proposal violates a principle, the proposal
changes — not the principle (changing a principle requires its own ADR).

## 1. Human remains the final decision maker

The Pilot approves, rejects or overrides any system action. Autonomy is granted
explicitly, per scope, and is always revocable. No irreversible action executes
without an approval path.

## 2. Architecture before implementation

Concepts, boundaries and vocabulary are settled before code exists. A prototype may
explore; only architecture may decide.

## 3. Version everything

Seeds, context, decisions, prompts, artifacts and the architecture itself carry
version identity. "What did the system know when it did X?" must always be answerable.

## 4. Context is explicit

No hidden state. Everything a Mentor uses to act — seeds, Project State, memory —
is inspectable and enumerable. If it influenced a decision, it appears in the record.

## 5. Experience is teachable

The owner's judgment enters the system through explicit artifacts (GuruSeeds), not
through opaque adaptation. Teaching is a first-class operation with its own UX.

## 6. Evolution is observable

When the system improves, the owner can see *what* changed, *why*, and *what effect*
it had. Silent drift is a defect.

## 7. Cost is governed by the Kernel

Every operation has a cost (tokens, money, time, risk). The Kernel meters it,
enforces budgets, and refuses work that exceeds them. Cost visibility is not a
feature — it is a precondition for delegation.
