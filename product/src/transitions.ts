// Recoverable multi-file transitions (ADR-0023 RULE D). Canonical changes
// that span files are one operation: recovery yields the complete old state
// or the complete new state, never a half-transition served as healthy.

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  unlinkSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import { readJson, writeJson } from "./stores.js";

interface TransitionFile {
  path: string;
  existed: boolean;
  backup: string;
}

export interface TransitionRecord {
  id: string;
  name: string;
  status: "prepared" | "applied" | "completed" | "rolled-back";
  startedAt: string;
  completedAt?: string;
  files: TransitionFile[];
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "transition";
}
function journalDir(root: string): string { return resolve(root, "_meta", "transitions"); }
function recordPath(root: string, id: string): string { return resolve(journalDir(root), `${id}.json`); }

function restore(record: TransitionRecord): void {
  for (const file of record.files) {
    if (file.existed && existsSync(file.backup)) {
      mkdirSync(dirname(file.path), { recursive: true });
      copyFileSync(file.backup, file.path);
    } else if (!file.existed && existsSync(file.path)) {
      unlinkSync(file.path);
    }
  }
}

/** Execute one synchronous canonical transition with before-images. */
export function withTransition<T>(
  root: string,
  name: string,
  files: readonly string[],
  fn: () => T,
): T {
  const id = `${Date.now().toString(36)}-${safeName(name)}`;
  const backupDir = resolve(journalDir(root), `${id}.backups`);
  mkdirSync(backupDir, { recursive: true });
  const tracked: TransitionFile[] = [...new Set(files)].map((path, index) => {
    const backup = resolve(backupDir, `${index}.bak`);
    const existed = existsSync(path);
    if (existed) copyFileSync(path, backup);
    return { path, existed, backup };
  });
  let record: TransitionRecord = {
    id,
    name,
    status: "prepared",
    startedAt: new Date().toISOString(),
    files: tracked,
  };
  writeJson(recordPath(root, id), record);
  try {
    const result = fn();
    record = { ...record, status: "applied" };
    writeJson(recordPath(root, id), record);
    record = { ...record, status: "completed", completedAt: new Date().toISOString() };
    writeJson(recordPath(root, id), record);
    return result;
  } catch (e) {
    restore(record);
    writeJson(recordPath(root, id), {
      ...record,
      status: "rolled-back",
      completedAt: new Date().toISOString(),
    } satisfies TransitionRecord);
    throw e;
  }
}

/**
 * Boot recovery: prepared means the mutation did not reach its commit marker
 * and rolls back; applied means all writes returned and rolls forward by
 * marking complete. Both decisions are deterministic and logged on disk.
 */
export function recoverTransitions(root: string): { rolledBack: number; rolledForward: number } {
  const dir = journalDir(root);
  if (!existsSync(dir)) return { rolledBack: 0, rolledForward: 0 };
  let rolledBack = 0;
  let rolledForward = 0;
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    const path = resolve(dir, file);
    const record = readJson<TransitionRecord>(path);
    if (record.status === "prepared") {
      restore(record);
      writeJson(path, { ...record, status: "rolled-back", completedAt: new Date().toISOString() } satisfies TransitionRecord);
      rolledBack += 1;
    } else if (record.status === "applied") {
      writeJson(path, { ...record, status: "completed", completedAt: new Date().toISOString() } satisfies TransitionRecord);
      rolledForward += 1;
    }
  }
  return { rolledBack, rolledForward };
}

/** Tests/maintenance may remove only completed transition backups. */
export function pruneCompletedTransitions(root: string): number {
  const dir = journalDir(root);
  if (!existsSync(dir)) return 0;
  let removed = 0;
  for (const file of readdirSync(dir).filter((name) => name.endsWith(".json"))) {
    const path = resolve(dir, file);
    const record = readJson<TransitionRecord>(path);
    if (record.status === "completed" || record.status === "rolled-back") {
      rmSync(resolve(dir, `${record.id}.backups`), { recursive: true, force: true });
      removed += 1;
    }
  }
  return removed;
}
