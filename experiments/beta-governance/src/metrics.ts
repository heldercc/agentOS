// Metrics — ADR-0015 rigor parameter 3, folded from the evidence log alone:
// (a) approval rate per round index (does round 2 approve more than round 1?),
// (b) rounds until the winning selection per decision,
// (c) whether any admitted seed exists whose provenance is selection evidence.

import type { Decision, DecisionProgress, EvidenceEvent } from "./types.js";

export interface RoundRate {
  round: number;
  proposals: number;
  approvals: number;
  /** approvals / proposals, 0..1 */
  rate: number;
}

export function decisionProgress(
  decisions: Decision[],
  events: EvidenceEvent[],
): DecisionProgress[] {
  return decisions.map((d) => {
    // Improvement metrics read new work only — anchors are consistency's food.
    const mine = events.filter((e) => e.decisionId === d.id && !e.anchor);
    const rounds = mine.reduce((n, e) => Math.max(n, e.round || 0), 0);
    const approvals = mine.filter((e) => e.action === "approve").length;
    const win = mine.find((e) => e.action === "select");
    return {
      decisionId: d.id,
      rounds,
      approvals,
      closed: win !== undefined,
      roundsToSelection: win ? win.round : null,
    };
  });
}

export function approvalRateByRound(events: EvidenceEvent[]): RoundRate[] {
  const byRound = new Map<number, { proposals: number; approvals: number }>();
  for (const e of events) {
    if (e.anchor) continue; // Improvement vs Consistency stay separate (ADR-0016)
    if (e.action !== "approve" && e.action !== "reject") continue;
    const r = byRound.get(e.round) ?? { proposals: 0, approvals: 0 };
    r.proposals += 1;
    if (e.action === "approve") r.approvals += 1;
    byRound.set(e.round, r);
  }
  return [...byRound.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, r]) => ({
      round,
      proposals: r.proposals,
      approvals: r.approvals,
      rate: r.proposals === 0 ? 0 : r.approvals / r.proposals,
    }));
}
