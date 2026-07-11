// Self-contained smoke test for the pipeline's honesty guarantees. No network,
// no API key, no committed run needed. Exercises the invariants the experiment
// depends on:
//   1. manifest completeness — the hash equals the exact assembled prompt
//   2. determinism — assembling the same task twice is byte-identical
//   3. write-once artifacts — a second write to an artifact path throws
//   4. meter honesty — nonzero cache tokens are rejected

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assembleFullReload } from "../assemble/fullReload.js";
import { verifyManifestCompleteness } from "../manifest.js";
import { makeMeterRecord } from "../meter.js";
import { loadProject } from "../project.js";
import { abs, writeArtifactOnce } from "../stores.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..", "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const DATA_DIR = abs(PKG_ROOT, "data");

function check(name: string, ok: boolean): void {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) process.exitCode = 1;
}

function expectThrow(name: string, fn: () => void): void {
  let threw = false;
  try {
    fn();
  } catch {
    threw = true;
  }
  check(name, threw);
}

function main(): void {
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const task = project.tasks[0];
  if (!task) {
    console.error("smoke: no tasks in corpus");
    process.exit(1);
  }

  // 1. completeness
  const a = assembleFullReload(project, task, "wo-smoke");
  check("manifest completeness (hash == assembled prompt)",
    verifyManifestCompleteness(a.manifest, a.prompt));

  // 2. determinism
  const b = assembleFullReload(project, task, "wo-smoke");
  check("assembly determinism (identical prompt bytes)", a.prompt === b.prompt);
  check("assembly determinism (identical manifest hash)",
    a.manifest.assembledSha256 === b.manifest.assembledSha256);

  // 3. write-once
  const dir = mkdtempSync(join(tmpdir(), "beta-smoke-"));
  const artifact = join(dir, "artifact.md");
  writeArtifactOnce(artifact, "first");
  expectThrow("write-once artifact (second write rejected)", () =>
    writeArtifactOnce(artifact, "second"));

  // 4. meter honesty
  expectThrow("meter rejects nonzero cache tokens", () =>
    makeMeterRecord("wo", "fake", {
      inputTokens: 10,
      outputTokens: 5,
      cacheCreationInputTokens: 0,
      cacheReadInputTokens: 7,
      requestId: null,
    }, 1));
  const goodMeter = makeMeterRecord("wo", "fake", {
    inputTokens: 10,
    outputTokens: 5,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
    requestId: null,
  }, 1);
  check("meter accepts zero-cache usage", goodMeter.inputTokens === 10);

  console.log(
    process.exitCode ? "\nsmoke: FAILED" : "\nsmoke: OK — invariants hold",
  );
}

main();
