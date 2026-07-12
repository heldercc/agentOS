// Loads the experiment's corpus: decisions, approaches, and the learned seeds
// the Pilot has admitted so far. All domain vocabulary lives in the data files.

import { existsSync, readdirSync } from "node:fs";

import { abs, makeRef, readJson, readText } from "./stores.js";
import type {
  Approach,
  ApproachFile,
  Decision,
  DecisionFile,
  ElementRef,
} from "./types.js";

export interface LearnedSeed {
  id: string;
  ref: ElementRef;
  body: string;
}

export interface Project {
  decisions: Decision[];
  approaches: Approach[];
  learned: LearnedSeed[];
}

export function loadLearned(repoRoot: string, learnedDir: string): LearnedSeed[] {
  if (!existsSync(learnedDir)) return [];
  const out: LearnedSeed[] = [];
  for (const name of readdirSync(learnedDir).sort()) {
    if (!name.endsWith(".md")) continue;
    const path = abs(learnedDir, name);
    const body = readText(path);
    const id = name.replace(/\.md$/, "");
    out.push({ id, ref: makeRef(repoRoot, path, id, body), body });
  }
  return out;
}

export function loadProject(
  repoRoot: string,
  dataDir: string,
  learnedDir: string,
): Project {
  const decisions = readJson<DecisionFile>(abs(dataDir, "decisions.json")).decisions;
  const approaches = readJson<ApproachFile>(abs(dataDir, "approaches.json")).approaches;
  if (decisions.length === 0) throw new Error("no decisions in data/decisions.json");
  if (approaches.length < 2) {
    throw new Error("need at least 2 approaches for selection to mean anything");
  }
  return { decisions, approaches, learned: loadLearned(repoRoot, learnedDir) };
}
