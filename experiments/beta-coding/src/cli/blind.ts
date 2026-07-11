// Blind evaluation (ADR-0012, parameter 2): the Pilot judges the two paths'
// outputs without knowing which is which. For each task the two artifacts are
// randomly labelled A/B (seeded RNG, seed stored for reproducibility). The sheet
// carries the outputs verbatim with no path names; the A/B→path map is sealed in
// a separate file. The Pilot fills verdicts.json BEFORE opening the seal, and
// commits verdicts first, so git history proves the order (anti-moving-goalpost).
//
// Usage: tsx src/cli/blind.ts --run <runId> [--seed <int>]

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { loadProject } from "../project.js";
import { abs, readText, writeArtifactOnce, writeJson } from "../stores.js";
import type { PathName } from "../types.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..", "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const DATA_DIR = abs(PKG_ROOT, "data");
const RUNS_DIR = abs(PKG_ROOT, "runs");

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

interface Args {
  runId: string;
  seed: number;
}
function parseArgs(argv: string[]): Args {
  let runId = "";
  let seed = 1;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--run") runId = argv[++i] ?? "";
    else if (argv[i] === "--seed") seed = Number(argv[++i] ?? "1");
  }
  if (!runId) throw new Error("--run <runId> is required");
  if (!Number.isFinite(seed)) throw new Error("--seed must be an integer");
  return { runId, seed };
}

const PATHS: readonly PathName[] = ["full-reload", "scheduled"];

function artifactPath(runDir: string, path: PathName, taskId: string): string {
  return abs(runDir, path, taskId, "artifact.md");
}

async function main(): Promise<void> {
  const { runId, seed } = parseArgs(process.argv.slice(2));
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const runDir = abs(RUNS_DIR, runId);
  const evalDir = abs(runDir, "eval");

  // Both paths must have an artifact for every task before we can judge.
  for (const task of project.tasks) {
    for (const p of PATHS) {
      const ap = artifactPath(runDir, p, task.id);
      if (!existsSync(ap)) {
        throw new Error(
          `missing artifact for blind eval: ${p}/${task.id}. Run both paths first.`,
        );
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
    // Coin flip decides whether path order is (A=full-reload, B=scheduled) or reversed.
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
  writeArtifactOnce(abs(evalDir, "mapping.sealed.json"),
    JSON.stringify({ runId, rngSeed: seed, mapping }, null, 2) + "\n");
  writeJson(abs(evalDir, "verdicts.json"), { runId, verdicts: verdictTemplate });

  console.log(`blind sheet written → runs/${runId}/eval/`);
  console.log(`  sheet.md            — judge from this (no path names)`);
  console.log(`  verdicts.json       — fill A/B/tie per task, then commit`);
  console.log(`  mapping.sealed.json — do NOT open until verdicts are committed`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
