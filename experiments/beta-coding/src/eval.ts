// Evaluation core (ADR-0012): the blind judgment sheet and the results
// aggregation. Extracted from the CLIs so the conductor can call them directly.

import { existsSync } from "node:fs";

import { loadProject } from "./project.js";
import { DATA_DIR, REPO_ROOT, RUNS_DIR } from "./paths.js";
import { abs, readJson, readText, writeArtifactOnce, writeJson } from "./stores.js";
import type { MeterRecord, PathName } from "./types.js";

const PATHS: readonly PathName[] = ["full-reload", "scheduled"];

/** Deterministic PRNG (mulberry32) so a stored seed reproduces the labelling. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function artifactPath(runDir: string, path: PathName, taskId: string): string {
  return abs(runDir, path, taskId, "artifact.md");
}

/**
 * Build the blind evaluation sheet + sealed A/B→path map + verdicts template.
 * Requires both paths' artifacts for every task. Idempotent-safe: the sheet and
 * sealed map are write-once, so a second call throws rather than reshuffling.
 */
export function buildBlind(runId: string, seed = 1): void {
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const runDir = abs(RUNS_DIR, runId);
  const evalDir = abs(runDir, "eval");

  for (const task of project.tasks) {
    for (const p of PATHS) {
      if (!existsSync(artifactPath(runDir, p, task.id))) {
        throw new Error(`missing artifact for blind eval: ${p}/${task.id}. Run both paths first.`);
      }
    }
  }

  const rng = mulberry32(seed);
  const mapping: Record<string, { A: PathName; B: PathName }> = {};
  const verdictTemplate: Array<{ taskId: string; verdict: "A" | "B" | "tie" | "" }> = [];

  let sheet =
    `# Blind evaluation — run ${runId}\n\n` +
    `> The two outputs below came from two different context strategies. You are not\n` +
    `> told which is which. For each task, decide which output is better (A, B, or tie)\n` +
    `> and record it in \`verdicts.json\`. Do NOT open \`mapping.sealed.json\` until every\n` +
    `> verdict is filled and committed.\n\n`;

  for (const task of project.tasks) {
    const reversed = rng() < 0.5;
    const forA: PathName = reversed ? "scheduled" : "full-reload";
    const forB: PathName = reversed ? "full-reload" : "scheduled";
    mapping[task.id] = { A: forA, B: forB };
    verdictTemplate.push({ taskId: task.id, verdict: "" });

    const outA = readText(artifactPath(runDir, forA, task.id)).trim();
    const outB = readText(artifactPath(runDir, forB, task.id)).trim();
    sheet +=
      `---\n\n## Task: ${task.title} (${task.id})\n\n` +
      `**Instruction:** ${task.instruction}\n\n` +
      `### Output A\n\n${outA}\n\n### Output B\n\n${outB}\n\n` +
      `**Verdict (A / B / tie):** _____\n\n`;
  }

  writeArtifactOnce(abs(evalDir, "sheet.md"), sheet);
  writeArtifactOnce(
    abs(evalDir, "mapping.sealed.json"),
    JSON.stringify({ runId, rngSeed: seed, mapping }, null, 2) + "\n",
  );
  writeJson(abs(evalDir, "verdicts.json"), { runId, verdicts: verdictTemplate });
}

interface SealedMap {
  mapping: Record<string, { A: PathName; B: PathName }>;
}
interface Verdicts {
  verdicts: Array<{ taskId: string; verdict: "A" | "B" | "tie" | "" }>;
}

function meter(runDir: string, path: PathName, taskId: string): MeterRecord {
  return readJson<MeterRecord>(abs(runDir, path, taskId, "meter.json"));
}

function pct(a: number, b: number): string {
  if (a === 0) return "n/a";
  return `${(((a - b) / a) * 100).toFixed(1)}%`;
}

/** Aggregate meters + sealed map + verdicts into RESULTS.md. Returns the pooled reduction. */
export function aggregateResults(runId: string): string {
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const runDir = abs(RUNS_DIR, runId);
  const evalDir = abs(runDir, "eval");

  const sumIn = { "full-reload": 0, scheduled: 0 };
  const sumOut = { "full-reload": 0, scheduled: 0 };
  let anyEstimated = false;
  const rows: string[] = [];
  for (const task of project.tasks) {
    const a = meter(runDir, "full-reload", task.id);
    const b = meter(runDir, "scheduled", task.id);
    if (a.cacheReadInputTokens !== 0 || b.cacheReadInputTokens !== 0) {
      throw new Error(`cache tokens must be zero for ${task.id}; comparison invalid`);
    }
    anyEstimated ||= a.estimated || b.estimated;
    sumIn["full-reload"] += a.inputTokens;
    sumIn.scheduled += b.inputTokens;
    sumOut["full-reload"] += a.outputTokens;
    sumOut.scheduled += b.outputTokens;
    rows.push(
      `| ${task.id} | ${a.inputTokens} | ${b.inputTokens} | ${pct(a.inputTokens, b.inputTokens)} | ${a.outputTokens} | ${b.outputTokens} |`,
    );
  }

  const sealedPath = abs(evalDir, "mapping.sealed.json");
  const verdictsPath = abs(evalDir, "verdicts.json");
  let qualitySection: string;
  if (existsSync(sealedPath) && existsSync(verdictsPath)) {
    const sealed = readJson<SealedMap>(sealedPath);
    const verdicts = readJson<Verdicts>(verdictsPath);
    const byTask = new Map(verdicts.verdicts.map((v) => [v.taskId, v.verdict]));
    const tally = { scheduled: 0, "full-reload": 0, tie: 0, unjudged: 0 };
    const detail: string[] = [];
    for (const task of project.tasks) {
      const v = byTask.get(task.id) ?? "";
      const map = sealed.mapping[task.id];
      if (v === "" || !map) {
        tally.unjudged++;
        detail.push(`| ${task.id} | (unjudged) |`);
        continue;
      }
      const winner: PathName | "tie" = v === "tie" ? "tie" : map[v];
      tally[winner]++;
      detail.push(`| ${task.id} | ${winner} |`);
    }
    qualitySection =
      `\n## Quality — the Pilot's blind verdict\n\n` +
      `| task | winner |\n|---|---|\n${detail.join("\n")}\n\n` +
      `Scheduler wins: **${tally.scheduled}** · Baseline wins: **${tally["full-reload"]}** · ` +
      `Ties: **${tally.tie}** · Unjudged: **${tally.unjudged}**\n`;
  } else {
    qualitySection =
      `\n## Quality — the Pilot's blind verdict\n\n` +
      `_Not yet available. Build the blind sheet, fill and commit \`verdicts.json\`, ` +
      `then re-run results._\n`;
  }

  const reduction = pct(sumIn["full-reload"], sumIn.scheduled);
  const estNote = anyEstimated
    ? `\n> **Note:** token counts are chars/4 estimates (fake or manual port), not ` +
      `API-metered. The reduction *ratio* is faithful (same estimator); absolute ` +
      `counts are indicative. Exact counts need count_tokens or a real run. See ADR-0013.\n`
    : "";

  const md =
    `# RESULTS — run ${runId}\n\n` +
    `Answering ADR-0012: can a Context Scheduler reduce context tokens while ` +
    `holding quality, vs full reload?\n` +
    estNote +
    `\n## Context tokens (input) — the reduction\n\n` +
    `| task | full-reload | scheduled | reduction | out (A) | out (B) |\n` +
    `|---|---|---|---|---|---|\n${rows.join("\n")}\n\n` +
    `**Pooled input:** full-reload ${sumIn["full-reload"]} → scheduled ${sumIn.scheduled} ` +
    `= **${reduction} reduction**. Output tokens: ${sumOut["full-reload"]} vs ${sumOut.scheduled}. ` +
    `Cache tokens asserted zero (honest comparison).\n` +
    qualitySection +
    `\n## Outcome (ADR-0012's three committed exits)\n\n` +
    `- **No** → the scheduler doesn't reduce, or quality drops. Change the architecture (Article 6).\n` +
    `- **Yes** → reduction with quality held. Strong foundation for Book II.\n` +
    `- **Depends** (most likely) → record where the scheduler wins (rich history, continuation ` +
    `tasks) and where it loses (first sessions, pure-creative tasks). That map is the real result.\n`;

  writeArtifactOnce(abs(runDir, "RESULTS.md"), md);
  return reduction;
}
