// Blind anchor repeats — ADR-0016 §3. An already-closed round is re-presented
// with a fresh letter shuffle; the owner's anchor verdicts are logged with
// anchor:true, invisible to the distiller and to improvement metrics, and
// feed exactly one number: Consistency (does the same winner win again?).

import { existsSync } from "node:fs";

import { readSessionEvents } from "./evidence.js";
import { roundDir } from "./propose.js";
import { abs, readJson, readText, sha256, writeJson } from "./stores.js";
import type { EvidenceEvent, RoundMapping } from "./types.js";

export interface AnchorMapping {
  anchorId: string;
  session: string;
  decisionId: string;
  round: number;
  /** display letter → original letter of the anchored round. */
  display: Record<string, string>;
}

function anchorDir(runsDir: string, session: string, anchorId: string): string {
  return abs(runsDir, session, "anchors", anchorId);
}

/** Closed rounds available to anchor: (decision, round) pairs with a real select. */
export function anchorableRounds(
  runsDir: string,
  session: string,
): Array<{ decisionId: string; round: number }> {
  const out: Array<{ decisionId: string; round: number }> = [];
  for (const e of readSessionEvents(runsDir, session)) {
    if (e.action === "select" && !e.anchor) {
      out.push({ decisionId: e.decisionId, round: e.round });
    }
  }
  return out;
}

/** Create a blind anchor over one closed round; reshuffled, sealed to disk. */
export function createAnchor(
  runsDir: string,
  session: string,
  decisionId: string,
  round: number,
): AnchorMapping {
  const orig = readJson<RoundMapping>(
    abs(roundDir(runsDir, session, decisionId, round), "mapping.sealed.json"),
  );
  const origLetters = Object.keys(orig.letters).sort();
  const anchorId = `anchor-${decisionId}-r${round}-${Date.now()}`;
  // Deterministic reshuffle keyed on the anchor id — new blind order.
  const shuffled = origLetters
    .map((l) => ({ l, key: sha256(`${anchorId}:${l}`) }))
    .sort((a, b) => a.key.localeCompare(b.key));
  const display: Record<string, string> = {};
  shuffled.forEach(({ l }, i) => {
    const displayLetter = String.fromCharCode(65 + i);
    display[displayLetter] = l;
  });
  const mapping: AnchorMapping = { anchorId, session, decisionId, round, display };
  writeJson(abs(anchorDir(runsDir, session, anchorId), "mapping.sealed.json"), mapping);
  return mapping;
}

export function loadAnchor(
  runsDir: string,
  session: string,
  anchorId: string,
): AnchorMapping | null {
  const path = abs(anchorDir(runsDir, session, anchorId), "mapping.sealed.json");
  return existsSync(path) ? readJson<AnchorMapping>(path) : null;
}

/** The anchored round's bodies in display order, blind. */
export function anchorBodies(
  runsDir: string,
  mapping: AnchorMapping,
): Array<{ letter: string; body: string }> {
  const dir = roundDir(runsDir, mapping.session, mapping.decisionId, mapping.round);
  return Object.keys(mapping.display)
    .sort()
    .map((displayLetter) => ({
      letter: displayLetter,
      body: readText(abs(dir, mapping.display[displayLetter] ?? "", "proposal.md")),
    }));
}

/** Resolve a blind anchor click to the underlying approach, server-side. */
export function resolveAnchorClick(
  runsDir: string,
  mapping: AnchorMapping,
  displayLetter: string,
): { originalLetter: string; approachId: string } {
  const originalLetter = mapping.display[displayLetter];
  if (!originalLetter) throw new Error(`unknown anchor option ${displayLetter}`);
  const orig = readJson<RoundMapping>(
    abs(
      roundDir(runsDir, mapping.session, mapping.decisionId, mapping.round),
      "mapping.sealed.json",
    ),
  );
  const approachId = orig.letters[originalLetter];
  if (!approachId) throw new Error(`anchor maps to unknown letter ${originalLetter}`);
  return { originalLetter, approachId };
}

export interface ConsistencyReport {
  anchorsCompleted: number;
  agreements: number;
}

/**
 * Consistency (ADR-0016 §3): for each anchor with a select verdict, does the
 * winning approach match the original round's winner? Reported separately
 * from Improvement — the two are never mixed into one score.
 */
export function consistency(events: EvidenceEvent[]): ConsistencyReport {
  const originals = new Map<string, string>(); // decision:round → approachId
  for (const e of events) {
    if (e.action === "select" && !e.anchor && e.approachId) {
      originals.set(`${e.decisionId}:${e.round}`, e.approachId);
    }
  }
  let done = 0;
  let agree = 0;
  for (const e of events) {
    if (e.action === "select" && e.anchor && e.approachId) {
      done += 1;
      if (originals.get(`${e.decisionId}:${e.round}`) === e.approachId) agree += 1;
    }
  }
  return { anchorsCompleted: done, agreements: agree };
}
