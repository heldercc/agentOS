// The ContextManifest is the audit log: every element placed into a Mentor's
// context, enumerated by reference, plus a hash of the exact assembled prompt.

import { sha256 } from "./stores.js";
import type { ContextElement, ContextManifest, PathName } from "./types.js";

/** An element carrying its body, used only during assembly (not persisted). */
export interface AssemblyElement extends ContextElement {
  bodyForPrompt: string;
}

/**
 * The single place a prompt string is materialized from its elements. Both
 * assembly paths call this, so the manifest's `assembledSha256` is guaranteed
 * to hash exactly what the model receives — the completeness proof.
 */
export function assemblePrompt(elements: AssemblyElement[]): string {
  return elements.map((e) => e.bodyForPrompt).join("\n\n---\n\n");
}

export function buildManifest(
  workOrderId: string,
  path: PathName,
  elements: AssemblyElement[],
): { manifest: ContextManifest; prompt: string } {
  const prompt = assemblePrompt(elements);
  const manifest: ContextManifest = {
    workOrderId,
    path,
    // strip the transient body before persisting — the manifest is by reference
    elements: elements.map(({ bodyForPrompt: _omit, ...rest }) => rest),
    assembledSha256: sha256(prompt),
  };
  return { manifest, prompt };
}

/** Verify a persisted manifest against a prompt: does the hash still match? */
export function verifyManifestCompleteness(
  manifest: ContextManifest,
  prompt: string,
): boolean {
  return manifest.assembledSha256 === sha256(prompt);
}
