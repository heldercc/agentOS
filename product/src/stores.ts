// COPIED from experiments/beta-governance/src/stores.ts (ADR-0012/0015 rig) —
// rigs are disposable science and stay uncoupled; a copy with provenance beats
// an import. File-based stores: reads, hashing, and the write-once artifact
// guarantee. git is the versioning layer where files are committed; workspace
// files fall back to content hashes so provenance always resolves.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

import type { ElementRef } from "./types.js";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function readText(path: string): string {
  // Strip a leading UTF-8 BOM — editors (and PowerShell) may add one to files
  // the Pilot hand-edits; a BOM breaks JSON.parse.
  return readFileSync(path, "utf8").replace(/^﻿/, "");
}

export function readJson<T>(path: string): T {
  return JSON.parse(readText(path)) as T;
}

/** Write JSON, creating parent dirs. Overwrites freely — records, not artifacts. */
export function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(value, null, 2) + "\n", "utf8");
}

/**
 * Write an artifact body exactly once. A second write to the same path throws —
 * "Artifacts are immutable once produced", enforced in code.
 */
export function writeArtifactOnce(path: string, body: string): void {
  if (existsSync(path)) {
    throw new Error(
      `artifact already exists and is immutable: ${path} — refusing to overwrite`,
    );
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body, { encoding: "utf8", flag: "wx" });
}

/**
 * The version of a data file: its short git hash if committed, otherwise a
 * `sha256:<12>` fallback so uncommitted (workspace) files are still traceable.
 * Never throws — provenance must always resolve to *something*.
 */
export function fileVersion(repoRoot: string, absPath: string, content: string): string {
  try {
    const rel = relative(repoRoot, absPath);
    const out = execFileSync("git", ["log", "-1", "--format=%h", "--", rel], {
      cwd: repoRoot,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (out) return out;
  } catch {
    // fall through to content hash
  }
  return `sha256:${sha256(content).slice(0, 12)}`;
}

/** Build a by-reference pointer to a data element. */
export function makeRef(
  repoRoot: string,
  absPath: string,
  id: string,
  content: string,
): ElementRef {
  return {
    id,
    version: fileVersion(repoRoot, absPath, content),
    path: relative(repoRoot, absPath).split("\\").join("/"),
    sha256: sha256(content),
  };
}

export function abs(...parts: string[]): string {
  return resolve(...parts);
}
