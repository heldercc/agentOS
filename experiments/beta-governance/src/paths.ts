// Canonical directory layout, resolved once from this file's location so every
// CLI and library agrees on where the corpus, runs, and mailbox live.

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url)); // src/
export const PKG_ROOT = resolve(HERE, ".."); // experiments/beta-governance
export const REPO_ROOT = resolve(PKG_ROOT, "..", ".."); // repo root (git-based versions)
export const DATA_DIR = resolve(PKG_ROOT, "data");
export const LEARNED_DIR = resolve(DATA_DIR, "learned"); // admitted learned seeds (O4)
export const RUNS_DIR = resolve(PKG_ROOT, "runs");
export const MAILBOX_DIR = resolve(PKG_ROOT, "mailbox"); // manual file-drop port
