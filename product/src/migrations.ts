// Versioned migration registry and boot safety decision (ADR-0023 RULE D).
// A migration is never "best effort": an open/failed ledger entry or data
// ahead of this build puts the shell in visible read-only safe mode.

import { appendFileSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { readJson, readJsonl, writeJson } from "./stores.js";
import { withTransition } from "./transitions.js";

export interface Migration {
  id: string;
  fromSchema: number;
  toSchema: number;
  /** Exact canonical files the migration may touch; used for checkpoints. */
  dryRun(root: string): string[];
  apply(root: string): void;
  validate(root: string): void;
}

export interface MigrationLedgerEntry {
  id: string;
  fromSchema: number;
  toSchema: number;
  status: "started" | "completed" | "failed";
  at: string;
  error?: string;
}

export interface SafeModeDecision {
  safeMode: boolean;
  dataSchemaVersion: number;
  migrationVersion: string;
  reason: string | null;
}

function metaDir(root: string): string { return resolve(root, "_meta"); }
function schemaPath(root: string): string { return resolve(metaDir(root), "schema.json"); }
function ledgerPath(root: string): string { return resolve(metaDir(root), "migrations.jsonl"); }

function ledger(root: string): MigrationLedgerEntry[] {
  const path = ledgerPath(root);
  return existsSync(path) ? readJsonl<MigrationLedgerEntry>(path) : [];
}

export function inspectMigrationState(root: string, codeSchemaVersion: number): SafeModeDecision {
  let dataVersion = 1;
  let entries: MigrationLedgerEntry[] = [];
  try {
    dataVersion = existsSync(schemaPath(root))
      ? readJson<{ version: number }>(schemaPath(root)).version
      : 1;
    entries = ledger(root);
  } catch (e) {
    return {
      safeMode: true,
      dataSchemaVersion: dataVersion,
      migrationVersion: "unreadable",
      reason: `metadados de migração ilegíveis: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
  if (!Number.isInteger(dataVersion) || dataVersion < 1) {
    return { safeMode: true, dataSchemaVersion: dataVersion, migrationVersion: "invalid", reason: "versão de dados inválida" };
  }
  const byId = new Map<string, MigrationLedgerEntry[]>();
  for (const entry of entries) byId.set(entry.id, [...(byId.get(entry.id) ?? []), entry]);
  for (const [id, events] of byId) {
    const last = events[events.length - 1];
    if (last?.status !== "completed") {
      return {
        safeMode: true,
        dataSchemaVersion: dataVersion,
        migrationVersion: id,
        reason: `migração ${id} ficou ${last?.status ?? "sem estado final"}`,
      };
    }
  }
  if (dataVersion > codeSchemaVersion) {
    return {
      safeMode: true,
      dataSchemaVersion: dataVersion,
      migrationVersion: entries.at(-1)?.id ?? "none",
      reason: `dados v${dataVersion} são mais recentes do que esta App v${codeSchemaVersion}`,
    };
  }
  return {
    safeMode: false,
    dataSchemaVersion: dataVersion,
    migrationVersion: entries.at(-1)?.id ?? "none",
    reason: null,
  };
}

function appendLedger(root: string, entry: MigrationLedgerEntry): void {
  const path = ledgerPath(root);
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, JSON.stringify(entry) + "\n", "utf8");
}

/** Apply the contiguous registered path. Completed migrations are no-ops. */
export function applyMigrations(
  root: string,
  codeSchemaVersion: number,
  registry: readonly Migration[],
): SafeModeDecision {
  let state = inspectMigrationState(root, codeSchemaVersion);
  if (state.safeMode) return state;
  const completed = new Set(ledger(root).filter((entry) => entry.status === "completed").map((entry) => entry.id));
  for (const migration of registry) {
    if (completed.has(migration.id)) continue;
    if (migration.fromSchema !== state.dataSchemaVersion) continue;
    const files = migration.dryRun(root);
    appendLedger(root, {
      id: migration.id,
      fromSchema: migration.fromSchema,
      toSchema: migration.toSchema,
      status: "started",
      at: new Date().toISOString(),
    });
    try {
      for (const file of files) {
        if (existsSync(file)) copyFileSync(file, `${file}.migration-${migration.id}.bak`);
      }
      withTransition(root, `migration-${migration.id}`, [...files, schemaPath(root)], () => {
        migration.apply(root);
        migration.validate(root);
        writeJson(schemaPath(root), { version: migration.toSchema, migration: migration.id });
      });
      appendLedger(root, {
        id: migration.id,
        fromSchema: migration.fromSchema,
        toSchema: migration.toSchema,
        status: "completed",
        at: new Date().toISOString(),
      });
      state = inspectMigrationState(root, codeSchemaVersion);
    } catch (e) {
      appendLedger(root, {
        id: migration.id,
        fromSchema: migration.fromSchema,
        toSchema: migration.toSchema,
        status: "failed",
        at: new Date().toISOString(),
        error: e instanceof Error ? e.message : String(e),
      });
      return inspectMigrationState(root, codeSchemaVersion);
    }
  }
  return state;
}

/**
 * v2 introduces the optional ProjectState.projectMap reference and the
 * separate governed Project Map store. Existing v1 records remain readable,
 * so the data migration is declarative/no-op; the ledger still records the
 * compatibility boundary explicitly.
 */
const projectMapReferenceV2: Migration = {
  id: "002-project-map-reference",
  fromSchema: 1,
  toSchema: 2,
  dryRun: () => [],
  apply: () => undefined,
  validate: () => undefined,
};

export const MIGRATIONS: readonly Migration[] = [projectMapReferenceV2];
