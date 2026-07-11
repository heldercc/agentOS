// Shared assembly helpers used by both context-assembly paths.

import type { AssemblyElement } from "../manifest.js";
import type { LoadedElement } from "../project.js";
import type { ElementKind } from "../types.js";

// A fixed, data-free framing sent as the system prompt. It is identical across
// both paths and every task, so it cannot bias the comparison. All actual
// context (including the Mentor) travels in the user prompt and is enumerated
// in the manifest.
export const SYSTEM_FRAME =
  "You are executing one work order. The user message contains, in order: the " +
  "Mentor definition you adopt, project context, and the task. Produce the task's " +
  "artifact and nothing else.";

/** Build an assembly element (body + provenance) from a loaded corpus element. */
export function toElement(
  el: LoadedElement,
  kind: ElementKind,
  reason: string,
): AssemblyElement {
  const header = `## [${kind}] ${el.title} (${el.ref.id}@${el.ref.version})`;
  return {
    ref: el.ref,
    kind,
    chars: el.body.length,
    selectionReason: reason,
    bodyForPrompt: `${header}\n\n${el.body}`,
  };
}

/** The task itself, always the last element in either path's context. */
export function taskElement(
  taskId: string,
  taskTitle: string,
  instruction: string,
  reason: string,
): AssemblyElement {
  return {
    ref: { id: taskId, version: "task", path: `data/tasks/${taskId}`, sha256: "" },
    kind: "task",
    chars: instruction.length,
    selectionReason: reason,
    bodyForPrompt: `## [task] ${taskTitle} (${taskId})\n\n${instruction}`,
  };
}
