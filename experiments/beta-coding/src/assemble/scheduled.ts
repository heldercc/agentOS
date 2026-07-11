// Path B — scheduled. The claim under test (ADR-0012): a simple resolver can
// select only the context a task needs, cutting tokens while holding quality.
// Deliberately simple — exact lowercase tag matching, no embeddings, no scoring.
// If a beta this crude already beats full reload, the thesis has legs.

import type { AssemblyElement } from "../manifest.js";
import { buildManifest } from "../manifest.js";
import type { LoadedElement, Project } from "../project.js";
import type { ContextManifest, ElementKind, Task } from "../types.js";
import { SYSTEM_FRAME, taskElement, toElement } from "./common.js";

const CORE_TAG = "core";

function lower(tags: string[]): Set<string> {
  return new Set(tags.map((t) => t.toLowerCase()));
}

/** Does this element earn a place in context, and why? */
function decide(
  el: LoadedElement,
  taskTags: Set<string>,
): { include: boolean; reason: string } {
  const elTags = lower(el.tags);
  if (elTags.has(CORE_TAG)) {
    return { include: true, reason: "scheduled: core (always included)" };
  }
  const matched = [...elTags].filter((t) => taskTags.has(t));
  if (matched.length > 0) {
    return { include: true, reason: `scheduled: tag-match [${matched.sort().join(", ")}]` };
  }
  return { include: false, reason: "" };
}

/**
 * Assemble the scheduled context for one task. The Mentor is always included
 * (it is the worker). Seeds and state slices enter only if tagged `core` or if
 * their tags intersect the task's tags. Order is deterministic (mentor, then
 * selected elements sorted by id, then the task) so the same task assembles to
 * byte-identical bytes every run.
 */
export function assembleScheduled(
  project: Project,
  task: Task,
  workOrderId: string,
): { system: string; prompt: string; manifest: ContextManifest } {
  const taskTags = lower(task.tags);

  const selected: AssemblyElement[] = [];
  for (const [kind, pool] of [
    ["seed", project.seeds],
    ["state", project.state],
  ] as const satisfies ReadonlyArray<readonly [ElementKind, LoadedElement[]]>) {
    for (const el of pool) {
      const { include, reason } = decide(el, taskTags);
      if (include) selected.push(toElement(el, kind, reason));
    }
  }
  selected.sort((a, b) => a.ref.id.localeCompare(b.ref.id));

  const elements: AssemblyElement[] = [
    toElement(project.mentor, "mentor", "scheduled: the worker (always included)"),
    ...selected,
    taskElement(task.id, task.title, task.instruction, "scheduled: the task"),
  ];

  const { manifest, prompt } = buildManifest(workOrderId, "scheduled", elements);
  return { system: SYSTEM_FRAME, prompt, manifest };
}
