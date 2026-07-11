// Path A — full reload. The honest baseline (ADR-0012): dump the entire project
// corpus into context on every task. No selection, no cleverness. Whatever the
// scheduled path later saves is measured against this.

import type { AssemblyElement } from "../manifest.js";
import { buildManifest } from "../manifest.js";
import type { LoadedElement, Project } from "../project.js";
import type { ContextManifest, ElementKind, Task } from "../types.js";

// A fixed, data-free framing sent as the system prompt. It is identical across
// both paths and every task, so it cannot bias the comparison. All actual
// context (including the Mentor) travels in the user prompt and is enumerated
// in the manifest.
export const SYSTEM_FRAME =
  "You are executing one work order. The user message contains, in order: the " +
  "Mentor definition you adopt, project context, and the task. Produce the task's " +
  "artifact and nothing else.";

function toElement(el: LoadedElement, kind: ElementKind, reason: string): AssemblyElement {
  const header = `## [${kind}] ${el.title} (${el.ref.id}@${el.ref.version})`;
  return {
    ref: el.ref,
    kind,
    chars: el.body.length,
    selectionReason: reason,
    bodyForPrompt: `${header}\n\n${el.body}`,
  };
}

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
    toElement(project.mentor, "mentor", "full-reload: everything"),
    ...project.docs.map((d) => toElement(d, "doc", "full-reload: everything")),
    ...project.seeds.map((s) => toElement(s, "seed", "full-reload: everything")),
    ...project.state.map((s) => toElement(s, "state", "full-reload: everything")),
    {
      ref: { id: task.id, version: "task", path: `data/tasks/${task.id}`, sha256: "" },
      kind: "task",
      chars: task.instruction.length,
      selectionReason: "full-reload: the task",
      bodyForPrompt: `## [task] ${task.title} (${task.id})\n\n${task.instruction}`,
    },
  ];

  const { manifest, prompt } = buildManifest(workOrderId, "full-reload", elements);
  return { system: SYSTEM_FRAME, prompt, manifest };
}
