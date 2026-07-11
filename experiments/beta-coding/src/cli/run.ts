// The experiment runner. Runs each task through one path, writing a full audit
// trail per work order: workorder.json, manifest.json, meter.json, artifact.md,
// artifact.provenance.json. Artifacts are write-once.
//
// Usage: tsx src/cli/run.ts --path full-reload --model fake [--run <runId>]

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assembleFullReload } from "../assemble/fullReload.js";
import { assembleScheduled } from "../assemble/scheduled.js";
import { verifyManifestCompleteness } from "../manifest.js";
import { makeMeterRecord } from "../meter.js";
import { resolveModel } from "../model.js";
import { loadProject } from "../project.js";
import { abs, sha256, writeArtifactOnce, writeJson } from "../stores.js";
import type {
  ArtifactProvenance,
  ContextManifest,
  PathName,
  WorkOrder,
} from "../types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..", ".."); // experiments/beta-coding
const REPO_ROOT = resolve(PKG_ROOT, "..", ".."); // repo root (for git-based versions)
const DATA_DIR = abs(PKG_ROOT, "data");
const RUNS_DIR = abs(PKG_ROOT, "runs");

interface Args {
  path: PathName;
  model: string;
  runId: string;
}

function parseArgs(argv: string[]): Args {
  let path: PathName = "full-reload";
  let model = "fake";
  let runId = "";
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--path") path = argv[++i] as PathName;
    else if (a === "--model") model = argv[++i] ?? "fake";
    else if (a === "--run") runId = argv[++i] ?? "";
  }
  if (path !== "full-reload" && path !== "scheduled") {
    throw new Error(`--path must be full-reload or scheduled, got "${path}"`);
  }
  if (!runId) {
    // one run per calendar timestamp; groups both paths of a comparison if reused
    runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  }
  return { path, model, runId };
}

function baselineExists(runDir: string, taskIds: string[]): boolean {
  return taskIds.every((id) =>
    existsSync(abs(runDir, "full-reload", id, "meter.json")),
  );
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const runDir = abs(RUNS_DIR, args.runId);
  const { port, model } = resolveModel(args.model);

  // ADR-0012: baseline measured first. The scheduled path refuses to run until a
  // full-reload baseline exists for every task in this run.
  if (args.path === "scheduled") {
    const ids = project.tasks.map((t) => t.id);
    if (!baselineExists(runDir, ids)) {
      throw new Error(
        `ADR-0012: run the full-reload baseline for run "${args.runId}" before ` +
          `the scheduled path. Missing baseline meters under ${runDir}/full-reload/.`,
      );
    }
  }

  const assemble =
    args.path === "scheduled" ? assembleScheduled : assembleFullReload;

  console.log(`run ${args.runId} · path ${args.path} · model ${model}`);
  console.log(`tasks: ${project.tasks.length}\n`);

  for (const task of project.tasks) {
    const woId = `${args.path}--${task.id}`;
    const woDir = abs(runDir, args.path, task.id);

    const workOrder: WorkOrder = {
      id: woId,
      runId: args.runId,
      taskId: task.id,
      path: args.path,
      model,
      maxTokens: 8000,
      createdAt: new Date().toISOString(),
      status: "created",
    };

    const { system, prompt, manifest } = assemble(project, task, woId);
    if (!verifyManifestCompleteness(manifest, prompt)) {
      throw new Error(`manifest completeness check failed for ${woId}`);
    }

    writeJson(abs(woDir, "workorder.json"), workOrder);
    writeJson(abs(woDir, "manifest.json"), manifest);

    const started = Date.now();
    const result = await port.generate({
      system,
      prompt,
      model,
      maxTokens: workOrder.maxTokens,
    });
    const durationMs = Date.now() - started;

    const meter = makeMeterRecord(woId, model, result.usage, durationMs);
    const withTokens: ContextManifest = {
      ...manifest,
      measuredInputTokens: meter.inputTokens,
    };
    writeJson(abs(woDir, "manifest.json"), withTokens);
    writeJson(abs(woDir, "meter.json"), meter);

    const artifactPath = abs(woDir, "artifact.md");
    writeArtifactOnce(artifactPath, result.text);

    const provenance: ArtifactProvenance = {
      artifactId: `${woId}--artifact`,
      workOrderId: woId,
      taskId: task.id,
      path: args.path,
      contextManifest: "manifest.json",
      producedBy: { model, requestId: meter.requestId },
      sha256: sha256(result.text),
      createdAt: new Date().toISOString(),
    };
    writeJson(abs(woDir, "artifact.provenance.json"), provenance);

    workOrder.status = "executed";
    writeJson(abs(woDir, "workorder.json"), workOrder);

    console.log(
      `  ${task.id}: in=${meter.inputTokens} out=${meter.outputTokens} ` +
        `tok · ${manifest.elements.length} context elements`,
    );
  }

  console.log(`\ndone → runs/${args.runId}/${args.path}/`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
