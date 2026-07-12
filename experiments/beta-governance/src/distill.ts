// The distiller — folds selection evidence into approach statistics and, when
// a preference has enough weight, drafts a candidate seed for the tray.
// It only drafts. Admission is a click the owner makes (O5: one gate); the
// admitted file is written write-once with full provenance (O4, miniature).

import { existsSync } from "node:fs";

import type { EvidenceEvent } from "./types.js";
import type { Approach, ApproachStats, CandidateSeed } from "./types.js";
import { abs, writeArtifactOnce } from "./stores.js";

/** A preference needs at least this many wins before it becomes a candidate. */
export const MIN_SELECTIONS = 2;

export function foldStats(
  approaches: Approach[],
  events: EvidenceEvent[],
): ApproachStats[] {
  const byId = new Map<string, ApproachStats>(
    approaches.map((a) => [
      a.id,
      { approachId: a.id, appearances: 0, approvals: 0, selections: 0 },
    ]),
  );
  const seenRound = new Set<string>();
  for (const e of events) {
    if (e.anchor) continue; // ADR-0016 §3: anchors never teach
    if (!e.approachId) continue;
    const s = byId.get(e.approachId);
    if (!s) continue;
    const roundKey = `${e.session}:${e.decisionId}:${e.round}:${e.approachId}`;
    if ((e.action === "approve" || e.action === "reject") && !seenRound.has(roundKey)) {
      seenRound.add(roundKey);
      s.appearances += 1;
    }
    if (e.action === "approve") s.approvals += 1;
    if (e.action === "select") s.selections += 1;
  }
  return [...byId.values()];
}

/** Approaches the owner has already ruled on (admitted or discarded) drop out. */
function ruledOut(events: EvidenceEvent[]): Set<string> {
  const out = new Set<string>();
  for (const e of events) {
    if (e.action === "admit_seed" || e.action === "discard_seed") {
      if (e.candidateId) out.add(e.candidateId.replace(/^cand-/, ""));
    }
  }
  return out;
}

export function draftCandidates(
  approaches: Approach[],
  events: EvidenceEvent[],
): CandidateSeed[] {
  const stats = foldStats(approaches, events);
  const done = ruledOut(events);
  const out: CandidateSeed[] = [];
  for (const s of stats) {
    if (s.selections < MIN_SELECTIONS || done.has(s.approachId)) continue;
    const approach = approaches.find((a) => a.id === s.approachId);
    if (!approach) continue;
    const today = new Date().toISOString().slice(0, 10);
    const body =
      `<!-- AgentOS provenance: origin=learned | evidence=selection statistics ` +
      `(${s.selections} wins / ${s.appearances} appearances / ${s.approvals} approvals), ` +
      `evidence.jsonl | approach=${approach.id} | drafted=${today} | ` +
      `admitted=by the owner's explicit click (O4/O5, ADR-0015) -->\n` +
      `# Learned preference — ${approach.title}\n\n` +
      `Across governed rounds, work produced under the angle "${approach.title}" ` +
      `was selected as the winner ${s.selections} times in ${s.appearances} ` +
      `appearances. The owner's revealed preference, distilled:\n\n` +
      `> ${approach.hint}\n\n` +
      `Apply this angle by default on decisions tagged: ${approach.tags.join(", ") || "(any)"}.\n`;
    out.push({
      id: `cand-${approach.id}`,
      approachId: approach.id,
      title: approach.title,
      body,
      stats: s,
    });
  }
  return out;
}

/** Admission: the owner clicked. Write-once into the learned store. */
export function admitCandidate(learnedDir: string, candidate: CandidateSeed): string {
  const path = abs(learnedDir, `${candidate.approachId}.md`);
  if (existsSync(path)) {
    throw new Error(`learned seed already admitted: ${path}`);
  }
  writeArtifactOnce(path, candidate.body);
  return path;
}
