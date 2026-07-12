// The evidence log — every governance click is one appended JSONL event.
// Append-only by construction: this module exposes no way to edit or delete.
// The log is the experiment's raw data (ADR-0015): metrics, the distiller and
// the audit trail all fold over it and nothing else.

import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import { dirname } from "node:path";

import { abs, readText } from "./stores.js";
import type { EvidenceEvent } from "./types.js";

export function appendEvent(runsDir: string, event: EvidenceEvent): void {
  const path = abs(runsDir, event.session, "evidence.jsonl");
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(event) + "\n", "utf8");
}

export function readSessionEvents(runsDir: string, session: string): EvidenceEvent[] {
  const path = abs(runsDir, session, "evidence.jsonl");
  if (!existsSync(path)) return [];
  return readText(path)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as EvidenceEvent);
}

/**
 * All evidence across sessions. Scripted (smoke) sessions are excluded unless
 * `session` is given — scripted evidence never leaks into real learning.
 */
export function readAllEvents(runsDir: string, session?: string): EvidenceEvent[] {
  if (session) return readSessionEvents(runsDir, session);
  if (!existsSync(runsDir)) return [];
  const out: EvidenceEvent[] = [];
  for (const name of readdirSync(runsDir).sort()) {
    if (name.startsWith("smoke-")) continue;
    if (!statSync(abs(runsDir, name)).isDirectory()) continue;
    out.push(...readSessionEvents(runsDir, name).filter((e) => !e.scripted));
  }
  return out;
}
