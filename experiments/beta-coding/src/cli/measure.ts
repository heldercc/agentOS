// Free token measurement — the "reduce?" half of ADR-0012, answered without
// spending any generation budget. For the real model it uses Anthropic's
// count_tokens endpoint (free); for --model fake it estimates at ~4 chars/token.
// No artifacts, no generation — just the context-token comparison per task.
//
// Usage: tsx src/cli/measure.ts [--model fake|claude-opus-4-8]

import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { assembleFullReload } from "../assemble/fullReload.js";
import { assembleScheduled } from "../assemble/scheduled.js";
import { loadProject } from "../project.js";
import { abs } from "../stores.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(HERE, "..", "..");
const REPO_ROOT = resolve(PKG_ROOT, "..", "..");
const DATA_DIR = abs(PKG_ROOT, "data");

function parseModel(argv: string[]): string {
  const i = argv.indexOf("--model");
  return i >= 0 ? (argv[i + 1] ?? "fake") : "fake";
}

/** Returns a token counter: real count_tokens for a live model, else an estimate. */
async function makeCounter(
  model: string,
): Promise<(system: string, prompt: string) => Promise<number>> {
  if (model === "fake") {
    const est = (s: string): number => Math.max(1, Math.ceil(s.length / 4));
    return async (system, prompt) => est(system) + est(prompt);
  }
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey) {
    throw new Error(
      `real model "${model}" requested but ANTHROPIC_API_KEY is not set. ` +
        `Use --model fake for a zero-cost estimate.`,
    );
  }
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey });
  return async (system, prompt) => {
    const r = await client.messages.countTokens({
      model,
      system,
      messages: [{ role: "user", content: prompt }],
    });
    return r.input_tokens;
  };
}

function pct(a: number, b: number): string {
  if (a === 0) return "n/a";
  return `${(((a - b) / a) * 100).toFixed(1)}%`;
}

async function main(): Promise<void> {
  const model = parseModel(process.argv.slice(2));
  const project = loadProject(REPO_ROOT, DATA_DIR);
  const count = await makeCounter(model);

  const kind = model === "fake" ? "estimated (chars/4)" : `count_tokens (${model}, free)`;
  console.log(`measure · ${kind}\n`);
  console.log(
    `${"task".padEnd(24)} ${"full-reload".padStart(12)} ${"scheduled".padStart(12)} ${"reduction".padStart(10)}`,
  );

  let sumA = 0;
  let sumB = 0;
  for (const task of project.tasks) {
    const a = assembleFullReload(project, task, `measure--${task.id}`);
    const b = assembleScheduled(project, task, `measure--${task.id}`);
    const ta = await count(a.system, a.prompt);
    const tb = await count(b.system, b.prompt);
    sumA += ta;
    sumB += tb;
    console.log(
      `${task.id.padEnd(24)} ${String(ta).padStart(12)} ${String(tb).padStart(12)} ${pct(ta, tb).padStart(10)}`,
    );
  }

  console.log(
    `\n${"POOLED".padEnd(24)} ${String(sumA).padStart(12)} ${String(sumB).padStart(12)} ${pct(sumA, sumB).padStart(10)}`,
  );
  console.log(
    model === "fake"
      ? "\nNote: estimates only. Run with --model claude-opus-4-8 for exact free counts (needs ANTHROPIC_API_KEY)."
      : "\nExact context-token reduction. No generation budget was spent (count_tokens is free).",
  );
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
