// Path A — full reload. The honest baseline (ADR-0012): dump the entire project
// corpus into context on every task. No selection, no cleverness. Whatever the
// scheduled path later saves is measured against this.

import type { AssemblyElement } from "../manifest.js";
import { buildManifest } from "../manifest.js";
import type { Project } from "../project.js";
import type { ContextManifest, Task } from "../types.js";
import { SYSTEM_FRAME, taskElement, toElement } from "./common.js";

const REASON = "full-reload: everything";

/**
 * Assemble the full-reload context for one task. Deterministic order:
 * mentor, docs, seeds, state (each already sorted by loadProject), then the task.
 */
export function assembleFullReload(
  project: Project,
  task: Task,
  workOrderId: string,
): { system: string; prompt: string; manifest: ContextManifest } {
  const elements: AssemblyElement[] = [
    toElement(project.mentor, "mentor", REASON),
    ...project.docs.map((d) => toElement(d, "doc", REASON)),
    ...project.seeds.map((s) => toElement(s, "seed", REASON)),
    ...project.state.map((s) => toElement(s, "state", REASON)),
    taskElement(task.id, task.title, task.instruction, "full-reload: the task"),
  ];

  const { manifest, prompt } = buildManifest(workOrderId, "full-reload", elements);
  return { system: SYSTEM_FRAME, prompt, manifest };
}
