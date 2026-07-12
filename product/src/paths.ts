// Canonical layout of the product shell, resolved once from this file's
// location. The workspace is the Pilot's live project data (gitignored);
// the mailbox is the transient ADR-0013 bridge.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // src/
export const PKG_ROOT = resolve(HERE, ".."); // product/
export const REPO_ROOT = resolve(PKG_ROOT, ".."); // repo root
export const WORKSPACE_DIR = resolve(PKG_ROOT, "workspace");
export const MAILBOX_DIR = resolve(PKG_ROOT, "mailbox");

export function projectDir(projectId: string): string {
  return resolve(WORKSPACE_DIR, projectId);
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
