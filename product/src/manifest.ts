// Context is a schedulable resource (Operating Model §7, ADR-0003/0012): for
// every Work Order, select only relevant state, record the manifest, control
// the token budget, explain what was selected. Nothing enters context that is
// not enumerated here — the invariant the rig proved, carried into the shell.

import { makeRef, sha256 } from "./stores.js";
import { REPO_ROOT } from "./paths.js";
import type { ContextElement, ContextManifest } from "./types.js";

interface Piece {
  element: ContextElement;
  text: string;
  required: boolean;
}

export interface AssembledContext {
  text: string;
  elements: ContextElement[];
  /** Optional pieces the budget refused, by id — visible, never silent. */
  dropped: string[];
}

/**
 * Builds one Work Order's context. Required pieces always enter; optional
 * pieces enter newest-first until the effort level's char budget is spent.
 */
export class ContextBuilder {
  #pieces: Piece[] = [];
  #budgetChars: number;

  constructor(budgetChars: number) {
    this.#budgetChars = budgetChars;
  }

  add(args: {
    kind: ContextElement["kind"];
    id: string;
    absPath: string;
    content: string;
    reason: string;
    required: boolean;
  }): void {
    this.#pieces.push({
      element: {
        ref: makeRef(REPO_ROOT, args.absPath, args.id, args.content),
        kind: args.kind,
        chars: args.content.length,
        selectionReason: args.reason,
      },
      text: `## [${args.kind}] ${args.id}\n\n${args.content.trim()}\n`,
      required: args.required,
    });
  }

  build(): AssembledContext {
    const chosen: Piece[] = this.#pieces.filter((p) => p.required);
    const dropped: string[] = [];
    let optionalSpent = 0;
    for (const p of this.#pieces.filter((x) => !x.required)) {
      if (optionalSpent + p.element.chars <= this.#budgetChars) {
        chosen.push(p);
        optionalSpent += p.element.chars;
      } else {
        dropped.push(p.element.ref.id);
      }
    }
    // Preserve insertion order — the caller composes the narrative.
    const ordered = this.#pieces.filter((p) => chosen.includes(p));
    return {
      text: ordered.map((p) => p.text).join("\n"),
      elements: ordered.map((p) => p.element),
      dropped,
    };
  }
}

export function buildManifest(workOrderId: string, ctx: AssembledContext): ContextManifest {
  return {
    workOrderId,
    elements: ctx.elements,
    assembledSha256: sha256(ctx.text),
  };
}
