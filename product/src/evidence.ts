// COPIED-with-adaptation from experiments/beta-governance/src/evidence.ts
// (ADR-0015 rig) — a copy with provenance beats an import. The evidence log:
// every Pilot click and every Kernel movement is one appended JSONL event.
// Append-only by construction: this module exposes no way to edit or delete.

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { projectDir } from "./paths.js";
import { abs, readJsonl } from "./stores.js";
import type { EvidenceEvent } from "./types.js";
import { validateEvidenceEvent } from "./validate.js";

export function appendEvent(event: EvidenceEvent): void {
  const path = abs(projectDir(event.projectId), "evidence.jsonl");
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(event) + "\n", "utf8");
}

export function readEvents(projectId: string): EvidenceEvent[] {
  const path = abs(projectDir(projectId), "evidence.jsonl");
  if (!existsSync(path)) return [];
  // Torn-tail tolerant (ADR-0023 RULE D): a crash mid-append must not make
  // the whole log unreadable — only the last line may be skipped.
  return readJsonl<unknown>(path).map((event, index) =>
    validateEvidenceEvent(event, `${path}[${index}]`),
  );
}
