// Validates the on-disk data corpus against the schemas before any run.
// Checks: index ids unique, referenced files exist, tasks well-formed, and warns
// when a task tag matches no seed/slice (which would make the scheduled path
// degenerate to full reload for that task).

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProject } from "../project.js";
import { abs } from "../stores.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..", "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const DATA_DIR = abs(PKG_ROOT, "data");

function main(): void {
  const errors: string[] = [];
  const warnings: string[] = [];

  const project = loadProject(REPO_ROOT, DATA_DIR);

  // unique ids across seeds and state
  const ids = new Map<string, number>();
  for (const el of [...project.seeds, ...project.state]) {
    ids.set(el.ref.id, (ids.get(el.ref.id) ?? 0) + 1);
  }
  for (const [id, n] of ids) if (n > 1) errors.push(`duplicate id: ${id} (${n}×)`);

  // tasks well-formed
  const taskIds = new Set<string>();
  for (const t of project.tasks) {
    if (!t.id) errors.push("a task is missing an id");
    if (taskIds.has(t.id)) errors.push(`duplicate task id: ${t.id}`);
    taskIds.add(t.id);
    if (!t.instruction?.trim()) errors.push(`task ${t.id}: empty instruction`);
    if (!Array.isArray(t.tags)) errors.push(`task ${t.id}: tags must be an array`);
  }
  if (project.tasks.length < 2) {
    warnings.push(
      `only ${project.tasks.length} task(s); ADR-0012 calls for 5–10 in the real run`,
    );
  }

  // orphan tags: a task tag matched by nothing the resolver could select
  const corpusTags = new Set<string>();
  for (const el of [...project.seeds, ...project.state]) {
    for (const tag of el.tags) corpusTags.add(tag.toLowerCase());
  }
  for (const t of project.tasks) {
    const matched = t.tags.filter((tag) => corpusTags.has(tag.toLowerCase()));
    if (t.tags.length > 0 && matched.length === 0) {
      warnings.push(
        `task ${t.id}: no tag matches any seed/slice — scheduled path would fall back to core only`,
      );
    }
  }

  // referenced bodies exist (loadProject already read them, but re-affirm paths)
  for (const el of [...project.seeds, ...project.state]) {
    const p = abs(REPO_ROOT, el.ref.path);
    if (!existsSync(p)) errors.push(`missing body file: ${el.ref.path}`);
  }

  for (const w of warnings) console.log(`  warn: ${w}`);
  if (errors.length === 0) {
    console.log(
      `\nvalidate: OK — ${project.seeds.length} seeds, ${project.state.length} state ` +
        `slices, ${project.docs.length} docs, ${project.tasks.length} tasks`,
    );
    return;
  }
  console.error("\nvalidate: FAILED");
  for (const e of errors) console.error(`  error: ${e}`);
  process.exit(1);
}

main();
