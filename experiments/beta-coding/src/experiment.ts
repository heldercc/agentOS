// The experiment core: run every task through one context path, writing a full
// audit trail per work order (workorder, manifest, meter, artifact + provenance).
// Extracted from the CLI so both run.ts and the conductor call the same code.

import { existsSync } from "node:fs";

import { assembleFullReload } from "./assemble/fullReload.js";
import { assembleScheduled } from "./assemble/scheduled.js";
import { verifyManifestCompleteness } from "./manifest.js";
import { makeMeterRecord } from "./meter.js";
import { resolveModel } from "./model.js";
import { loadProject } from "./project.js";
import { DATA_DIR, MAILBOX_DIR, REPO_ROOT, RUNS_DIR } from "./paths.js";
import { abs, sha256, writeArtifactOnce, writeJson } from "./stores.js";
import type {
  ArtifactProvenance,
  ContextManifest,
  PathName,
  WorkOrder,
} from "./types.js";

const MAX_TOKENS = 8000;

export interface RunPathOptions {
  runId: string;
  path: PathName;
  modelArg: string;
  /** Where to log progress; defaults to console.log. */
  log?: (msg: string) => void;
}

function baselineExists(runDir: string, taskIds: string[]): boolean {
  return taskIds.every((id) =>
    existsSync(abs(runDir, "full-reload", id, "meter.json")),
  );
}

/** Run one path (full-reload | scheduled) for a run. Returns the task count. */
export async function runPath(opts: RunPathOptions): Promise<number> {
  const log = opts.log ?? ((m: string) => console.log(m));
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const runDir = abs(RUNS_DIR, opts.runId);
  const { port, model } = resolveModel(opts.modelArg, { mailboxDir: MAILBOX_DIR });

  // ADR-0012: baseline measured first. The scheduled path refuses to run until a
  // full-reload baseline exists for every task in this run.
  if (opts.path === "scheduled") {
    const ids = project.tasks.map((t) => t.id);
    if (!baselineExists(runDir, ids)) {
      throw new Error(
        `ADR-0012: run the full-reload baseline for run "${opts.runId}" before ` +
          `the scheduled path. Missing baseline meters under ${runDir}/full-reload/.`,
      );
    }
  }

  const assemble =
    opts.path === "scheduled" ? assembleScheduled : assembleFullReload;

  log(`run ${opts.runId} · path ${opts.path} · model ${model} · ${project.tasks.length} tasks`);

  for (const task of project.tasks) {
    const woId = `${opts.path}--${task.id}`;
    const woDir = abs(runDir, opts.path, task.id);

    const workOrder: WorkOrder = {
      id: woId,
      runId: opts.runId,
      taskId: task.id,
      path: opts.path,
      model,
      maxTokens: MAX_TOKENS,
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
      jobId: `${opts.runId}--${woId}`,
    });
    const durationMs = Date.now() - started;

    const meter = makeMeterRecord(woId, model, result.usage, durationMs);
    const withTokens: ContextManifest = {
      ...manifest,
      measuredInputTokens: meter.inputTokens,
    };
    writeJson(abs(woDir, "manifest.json"), withTokens);
    writeJson(abs(woDir, "meter.json"), meter);
    writeArtifactOnce(abs(woDir, "artifact.md"), result.text);

    const provenance: ArtifactProvenance = {
      artifactId: `${woId}--artifact`,
      workOrderId: woId,
      taskId: task.id,
      path: opts.path,
      contextManifest: "manifest.json",
      producedBy: { model, requestId: meter.requestId },
      sha256: sha256(result.text),
      createdAt: new Date().toISOString(),
    };
    writeJson(abs(woDir, "artifact.provenance.json"), provenance);

    workOrder.status = "executed";
    writeJson(abs(woDir, "workorder.json"), workOrder);

    const flag = meter.estimated ? " (est)" : "";
    log(`  ${task.id}: in=${meter.inputTokens} out=${meter.outputTokens} tok${flag} · ${manifest.elements.length} ctx`);
  }

  return project.tasks.length;
}
