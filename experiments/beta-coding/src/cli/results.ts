// Results aggregation (ADR-0012). Joins per-task token meters, the sealed A/B
// map, and the Pilot's blind verdicts into RESULTS.md: token reduction vs the
// full-reload baseline, plus the quality tally. Frames the outcome against the
// three committed exits — "No" / "Yes" / "Depends" (the map of where the
// scheduler wins). Verdicts are optional: without them, only the token half.
//
// Usage: tsx src/cli/results.ts --run <runId>

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProject } from "../project.js";
import { abs, readJson, writeArtifactOnce } from "../stores.js";
import type { MeterRecord, PathName } from "../types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..", "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const DATA_DIR = abs(PKG_ROOT, "data");
const RUNS_DIR = abs(PKG_ROOT, "runs");

interface SealedMap {
  mapping: Record<string, { A: PathName; B: PathName }>;
}
interface Verdicts {
  verdicts: Array<{ taskId: string; verdict: "A" | "B" | "tie" | "" }>;
}

function parseRunId(argv: string[]): string {
  const i = argv.indexOf("--run");
  const id = i >= 0 ? argv[i + 1] : undefined;
  if (!id) throw new Error("--run <runId> is required");
  return id;
}

function meter(runDir: string, path: PathName, taskId: string): MeterRecord {
  return readJson<MeterRecord>(abs(runDir, path, taskId, "meter.json"));
}

function pct(a: number, b: number): string {
  if (a === 0) return "n/a";
  return `${(((a - b) / a) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const runId = parseRunId(process.argv.slice(2));
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const runDir = abs(RUNS_DIR, runId);
  const evalDir = abs(runDir, "eval");

  // --- Token half (always available once both paths ran) ---
  let sumIn = { "full-reload": 0, scheduled: 0 };
  let sumOut = { "full-reload": 0, scheduled: 0 };
  const rows: string[] = [];
  for (const task of project.tasks) {
    const a = meter(runDir, "full-reload", task.id);
    const b = meter(runDir, "scheduled", task.id);
    if (a.cacheReadInputTokens !== 0 || b.cacheReadInputTokens !== 0) {
      throw new Error(`cache tokens must be zero for ${task.id}; comparison invalid`);
    }
    sumIn["full-reload"] += a.inputTokens;
    sumIn.scheduled += b.inputTokens;
    sumOut["full-reload"] += a.outputTokens;
    sumOut.scheduled += b.outputTokens;
    rows.push(
      `| ${task.id} | ${a.inputTokens} | ${b.inputTokens} | ${pct(a.inputTokens, b.inputTokens)} | ${a.outputTokens} | ${b.outputTokens} |`,
    );
  }

  // --- Quality half (only if the seal is opened and verdicts are filled) ---
  const sealedPath = abs(evalDir, "mapping.sealed.json");
  const verdictsPath = abs(evalDir, "verdicts.json");
  let qualitySection = "";
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
      `_Not yet available. Run \`npm run blind\`, fill and commit \`verdicts.json\`, ` +
      `then re-run results._\n`;
  }

  const reduction = pct(sumIn["full-reload"], sumIn.scheduled);
  const md =
    `# RESULTS — run ${runId}\n\n` +
    `Answering ADR-0012: can a Context Scheduler reduce context tokens while ` +
    `holding quality, vs full reload?\n\n` +
    `## Context tokens (input) — the reduction\n\n` +
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
  console.log(`results written → runs/${runId}/RESULTS.md`);
  console.log(`  pooled input reduction: ${reduction}`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
