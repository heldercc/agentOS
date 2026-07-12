// Canonical layout of the product shell, resolved once from this file's
// location. The workspace is the Pilot's live project data (gitignored);
// the mailbox is the transient ADR-0013 bridge.
//
// RULE A (ADR-0023, test isolation): the workspace root is resolvable PER
// CALL via PRODUCT_WORKSPACE_DIR so scripted/smoke/verify runs redirect the
// ENTIRE data tree away from the Pilot's live workspace by construction —
// never by name-based filtering. Relative values resolve under product/.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // src/
export const PKG_ROOT = resolve(HERE, ".."); // product/
export const REPO_ROOT = resolve(PKG_ROOT, ".."); // repo root
export const MAILBOX_DIR = resolve(PKG_ROOT, "mailbox");

/** The Pilot's live workspace — the default when no isolation is requested. */
export const LIVE_WORKSPACE_DIR = resolve(PKG_ROOT, "workspace");

/** The active workspace root (env-aware, read per call — RULE A). */
export function workspaceRoot(): string {
  const env = process.env["PRODUCT_WORKSPACE_DIR"];
  return env ? resolve(PKG_ROOT, env) : LIVE_WORKSPACE_DIR;
}

export function projectDir(projectId: string): string {
  return resolve(workspaceRoot(), projectId);
}

export function iterationDir(projectId: string, iteration: number): string {
  return resolve(projectDir(projectId), "iterations", `it-${String(iteration).padStart(3, "0")}`);
}

export function workOrdersDir(projectId: string, iteration: number): string {
  return resolve(iterationDir(projectId, iteration), "workorders");
}

export function artifactsDir(projectId: string, iteration: number): string {
  return resolve(projectDir(projectId), "artifacts", `it-${String(iteration).padStart(3, "0")}`);
}

export function stateDir(projectId: string): string {
  return resolve(projectDir(projectId), "state");
}
