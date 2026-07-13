// COPIED from experiments/beta-governance/src/stores.ts (ADR-0012/0015 rig) —
// rigs are disposable science and stay uncoupled; a copy with provenance beats
// an import. File-based stores: reads, hashing, and the write-once artifact
// guarantee. git is the versioning layer where files are committed; workspace
// files fall back to content hashes so provenance always resolves.

import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

import type { ElementRef } from "./types.js";

export function sha256(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export function readText(path: string): string {
  // Strip a leading UTF-8 BOM — editors (and PowerShell) may add one to files
  // the Pilot hand-edits; a BOM breaks JSON.parse.
  return readFileSync(path, "utf8").replace(/^﻿/, "");
}

/**
 * Read canonical JSON, recovering from a crash mid-writeJson (ADR-0023 RULE
 * D). Recovery is honest, never silent-swap:
 *  - path missing, `.prev` present → the write crashed AFTER the old file
 *    was renamed aside but BEFORE the new one landed. Restore `.prev` → path
 *    (one console.warn) and read the recovered file.
 *  - path present but fails to parse, and `.prev` parses cleanly → the main
 *    file is torn/corrupt with a good previous version sitting right next to
 *    it. This is NOT swapped in automatically — that would hide data loss.
 *    Throw, naming both files; safe-mode recovery arrives with the migration
 *    registry (PHASE 2 follow-up).
 */
export function readJson<T>(path: string): T {
  const prevPath = path + ".prev";
  if (!existsSync(path) && existsSync(prevPath)) {
    console.warn(
      `readJson: ${path} is missing — recovering the previous version from ${prevPath} ` +
        `(a crash likely interrupted a canonical write after the old file was moved aside)`,
    );
    renameSync(prevPath, path);
    return JSON.parse(readText(path)) as T;
  }
  try {
    return JSON.parse(readText(path)) as T;
  } catch (e) {
    if (existsSync(prevPath)) {
      try {
        JSON.parse(readText(prevPath));
      } catch {
        throw e; // .prev is broken too — surface the original error as-is
      }
      throw new Error(
        `readJson: ${path} is corrupt (${e instanceof Error ? e.message : String(e)}) — ` +
          `a recoverable previous version exists at ${prevPath}, but it is not swapped in ` +
          `silently. Restore it by hand if that is the right call.`,
      );
    }
    throw e;
  }
}

/**
 * Parse an append-only JSONL file, tolerating a torn tail: a crash mid-append
 * can leave a half-written final line. Only the LAST line may be skipped
 * (with one console.warn) — an unparsable line anywhere else is real
 * corruption in the middle of the log, not a torn tail, and still throws.
 */
export function readJsonl<T>(path: string): T[] {
  const lines = readText(path)
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "");
  const out: T[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? "";
    try {
      out.push(JSON.parse(line) as T);
    } catch (e) {
      if (i === lines.length - 1) {
        console.warn(`readJsonl: skipping unparsable final line in ${path} (torn tail on crash)`);
      } else {
        throw new Error(
          `readJsonl: corrupt line ${i + 1} of ${lines.length} in ${path}: ` +
            `${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
  return out;
}

/**
 * Write canonical text atomically and recoverably (ADR-0023 RULE D, CEO acceptance
 * gate 4: "crash during canonical write recovers valid data"). Overwrites
 * freely — records, not artifacts — but never TEARS the main file:
 *
 *  1. serialize and write to `path + ".tmp"` (same directory ⇒ same volume);
 *  2. VALIDATE the temp file by reading it back and JSON.parsing it — if
 *     that fails, delete the temp file and throw. A bad write must never
 *     replace good data.
 *  3. if `path` exists, delete any stale `.prev` then rename `path` →
 *     `path + ".prev"` — the recoverable previous version.
 *  4. rename the (validated) tmp → `path` — a same-volume rename, which on
 *     NTFS is the safe atomic replace.
 *  5. on any failure after step 3's rename, restore `.prev` → path before
 *     rethrowing, so a crash here never leaves the Pilot with NO valid file.
 *
 * Crash windows, enumerated: a crash leaves on disk EITHER
 *   (a) only the old `path` (crash before step 3), or
 *   (b) `path + ".prev"` (old, valid) + `path + ".tmp"` (new, valid) — crash
 *       between steps 3 and 4, or
 *   (c) `path + ".prev"` (old, valid) + the new `path` — crash after step 4.
 * Never a torn/partial main file in any window.
 */
export function writeTextAtomic(path: string, text: string, validate: (text: string) => void): void {
  mkdirSync(dirname(path), { recursive: true });
  const tmpPath = path + ".tmp";
  const prevPath = path + ".prev";

  // Step 1+2 — write, then validate before touching the canonical path.
  writeFileSync(tmpPath, text, "utf8");
  try {
    validate(readFileSync(tmpPath, "utf8"));
  } catch (e) {
    try {
      unlinkSync(tmpPath);
    } catch {
      // best effort — the throw below is the honest signal either way
    }
    throw new Error(
      `writeTextAtomic: refusing to replace ${path} — the new write did not validate: ` +
        `${e instanceof Error ? e.message : String(e)}`,
    );
  }

  // Steps 3+4 — move the old file aside, then swap the new one in.
  let renamedPrev = false;
  try {
    if (existsSync(prevPath)) unlinkSync(prevPath);
    if (existsSync(path)) {
      renameSync(path, prevPath);
      renamedPrev = true;
    }
    renameSync(tmpPath, path);
  } catch (e) {
    // Step 5 — restore the previous version before the caller ever sees
    // this failure, so a crash mid-replace never leaves zero valid files.
    if (renamedPrev) {
      try {
        renameSync(prevPath, path);
      } catch {
        // best effort — the rethrow below still carries the real failure
      }
    }
    throw e;
  }
}

export function writeJson(path: string, value: unknown): void {
  const text = JSON.stringify(value, null, 2) + "\n";
  writeTextAtomic(path, text, (candidate) => { JSON.parse(candidate); });
}

/**
 * Resolve `parts` under `root` and require the result to stay inside it —
 * the path-containment gate for every filesystem access driven by a request
 * parameter (ADR-0023 local security slice). Returns null (never throws)
 * when the parts would escape root: `..\`, an absolute path, or a different
 * drive letter all resolve outside root and are rejected.
 */
export function containedPath(root: string, ...parts: string[]): string | null {
  const rootAbs = resolve(root);
  const target = resolve(rootAbs, ...parts);
  const boundary = rootAbs.endsWith(sep) ? rootAbs : rootAbs + sep;
  return target === rootAbs || target.startsWith(boundary) ? target : null;
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
