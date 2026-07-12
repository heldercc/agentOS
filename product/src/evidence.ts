// COPIED-with-adaptation from experiments/beta-governance/src/evidence.ts
// (ADR-0015 rig) — a copy with provenance beats an import. The evidence log:
// every Pilot click and every Kernel movement is one appended JSONL event.
// Append-only by construction: this module exposes no way to edit or delete.

import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

import { projectDir } from "./paths.js";
import { abs, readText } from "./stores.js";
import type { EvidenceEvent } from "./types.js";

export function appendEvent(event: EvidenceEvent): void {
  const path = abs(projectDir(event.projectId), "evidence.jsonl");
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(event) + "\n", "utf8");
}

export function readEvents(projectId: string): EvidenceEvent[] {
  const path = abs(projectDir(projectId), "evidence.jsonl");
  if (!existsSync(path)) return [];
  return readText(path)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map((l) => JSON.parse(l) as EvidenceEvent);
}
