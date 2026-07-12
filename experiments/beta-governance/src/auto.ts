// Automatic iteration with governance (Operating Model §5/§8, ADR-0017).
// The system automates MOVEMENT — opening the next round when the loop's
// state already dictates it — and never AUTHORITY: it never judges, never
// selects, never escalates effort past the line the owner set. Pure logic,
// exercised directly by the smoke test.

import { AUTO_MAX_LEVEL, levelIndex, type EffortLevel } from "./effort.js";

/** What the auto-pilot needs to know about one decision, derived from disk. */
export interface DecisionLoopState {
  decisionId: string;
  rounds: number;
  closed: boolean;
  /** An open round exists whose options are on the table. */
  judgeable: boolean;
  /** Every option of the open round has a pointwise verdict. */
  allJudged: boolean;
  approvedCount: number;
}

export interface AutoStep {
  decisionId: string;
  round: number;
  reason: string;
}

/**
 * The next governed step automation may take, or null when every remaining
 * move belongs to the owner. Order respects the corpus: earlier decisions
 * first — the workflow is the hard-coded part.
 */
export function nextAutoStep(decisions: DecisionLoopState[]): AutoStep | null {
  for (const d of decisions) {
    if (d.closed) continue;
    if (d.rounds === 0) {
      return {
        decisionId: d.decisionId,
        round: 1,
        reason: "no round exists yet — opening round 1",
      };
    }
    if (d.judgeable) {
      if (!d.allJudged) continue; // the owner still judges — authority, not movement
      if (d.approvedCount > 0) continue; // selection pending — authority, never automated
      return {
        decisionId: d.decisionId,
        round: d.rounds + 1,
        reason: `round ${d.rounds} fully rejected — iterating with the feedback visible`,
      };
    }
  }
  return null;
}

/** Clamp an effort level to what automation is allowed to spend on its own. */
export function clampAutoEffort(level: EffortLevel): EffortLevel {
  return levelIndex(level) > levelIndex(AUTO_MAX_LEVEL) ? AUTO_MAX_LEVEL : level;
}
