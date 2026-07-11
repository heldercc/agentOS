// Loads the on-disk project corpus (mentor, docs, seeds, state, tasks) into
// memory with by-reference provenance. Shared by the runner and the validator.
// Domain-blind: it knows "seed" and "slice", never what they contain.

import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { abs, makeRef, readJson, readText } from "./stores.js";
import type {
  ElementRef,
  Seed,
  SeedIndex,
  StateIndex,
  StateSlice,
  Task,
  TaskFile,
} from "./types.js";

export interface LoadedElement {
  ref: ElementRef;
  title: string;
  tags: string[];
  body: string;
}

export interface Project {
  repoRoot: string;
  dataDir: string;
  mentor: LoadedElement;
  docs: LoadedElement[];
  seeds: LoadedElement[];
  state: LoadedElement[];
  tasks: Task[];
}

function listMarkdown(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries
    .filter((f) => f.endsWith(".md"))
    .map((f) => join(dir, f))
    .filter((p) => statSync(p).isFile())
    .sort();
}

export function loadProject(repoRoot: string, dataDir: string): Project {
  const projectDir = abs(dataDir, "project");

  const mentorPath = abs(projectDir, "mentor.md");
  const mentorBody = readText(mentorPath);
  const mentor: LoadedElement = {
    ref: makeRef(repoRoot, mentorPath, "mentor", mentorBody),
    title: "Mentor",
    tags: ["core"],
    body: mentorBody,
  };

  const docs: LoadedElement[] = listMarkdown(abs(projectDir, "docs")).map((p) => {
    const body = readText(p);
    const id = `doc:${p.split(/[\\/]/).pop()}`;
    return { ref: makeRef(repoRoot, p, id, body), title: id, tags: [], body };
  });

  const seedIndex = readJson<SeedIndex>(abs(projectDir, "seeds", "index.json"));
  const seeds: LoadedElement[] = seedIndex.seeds
    .slice()
    .sort((a: Seed, b: Seed) => a.id.localeCompare(b.id))
    .map((s: Seed) => {
      const p = abs(projectDir, "seeds", s.path);
      const body = readText(p);
      return { ref: makeRef(repoRoot, p, s.id, body), title: s.title, tags: s.tags, body };
    });

  const stateIndex = readJson<StateIndex>(abs(projectDir, "state", "index.json"));
  const state: LoadedElement[] = stateIndex.slices
    .slice()
    .sort((a: StateSlice, b: StateSlice) => a.id.localeCompare(b.id))
    .map((s: StateSlice) => {
      const p = abs(projectDir, "state", s.path);
      const body = readText(p);
      return { ref: makeRef(repoRoot, p, s.id, body), title: s.title, tags: s.tags, body };
    });

  const taskFile = readJson<TaskFile>(abs(dataDir, "tasks", "tasks.json"));
  const tasks: Task[] = taskFile.tasks;

  return { repoRoot, dataDir, mentor, docs, seeds, state, tasks };
}
