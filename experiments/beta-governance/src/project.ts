// Loads a governed project's corpus: decisions, approaches, and the learned
// seeds the owner has admitted so far. Several projects can run side by side
// (data/projects/<id>/); all domain vocabulary lives in the data files.

import { existsSync, readdirSync, statSync } from "node:fs";

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

export interface ProjectInfo {
  id: string;
  name: string;
}

export interface Project {
  id: string;
  name: string;
  /** The project's data directory (decisions.json, approaches.json, learned/). */
  dir: string;
  decisions: Decision[];
  approaches: Approach[];
  learned: LearnedSeed[];
  learnedDir: string;
}

export function listProjects(projectsDir: string): ProjectInfo[] {
  if (!existsSync(projectsDir)) return [];
  const out: ProjectInfo[] = [];
  for (const id of readdirSync(projectsDir).sort()) {
    const dir = abs(projectsDir, id);
    if (!statSync(dir).isDirectory()) continue;
    if (!existsSync(abs(dir, "decisions.json"))) continue;
    let name = id;
    const meta = abs(dir, "project.json");
    if (existsSync(meta)) {
      try {
        name = readJson<{ name?: string }>(meta).name ?? id;
      } catch {
        name = id;
      }
    }
    out.push({ id, name });
  }
  return out;
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
  projectsDir: string,
  projectId: string,
  learnedDirOverride?: string,
): Project {
  const dir = abs(projectsDir, projectId);
  if (!existsSync(abs(dir, "decisions.json"))) {
    throw new Error(`unknown project "${projectId}" under ${projectsDir}`);
  }
  const decisions = readJson<DecisionFile>(abs(dir, "decisions.json")).decisions;
  const approaches = readJson<ApproachFile>(abs(dir, "approaches.json")).approaches;
  if (decisions.length === 0) throw new Error("no decisions in decisions.json");
  if (approaches.length < 2) {
    throw new Error("need at least 2 approaches for selection to mean anything");
  }
  let name = projectId;
  if (existsSync(abs(dir, "project.json"))) {
    try {
      name = readJson<{ name?: string }>(abs(dir, "project.json")).name ?? projectId;
    } catch {
      name = projectId;
    }
  }
  const learnedDir = learnedDirOverride ?? abs(dir, "learned");
  return {
    id: projectId,
    name,
    dir,
    decisions,
    approaches,
    learned: loadLearned(repoRoot, learnedDir),
    learnedDir,
  };
}
