// Build the blind evaluation sheet + sealed A/B map. Thin CLI over eval.buildBlind.
//
// Usage: tsx src/cli/blind.ts --run <runId> [--seed <int>]

import { buildBlind } from "../eval.js";

function parseArgs(argv: string[]): { runId: string; seed: number } {
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

function main(): void {
  const { runId, seed } = parseArgs(process.argv.slice(2));
  buildBlind(runId, seed);
  console.log(`blind sheet written → runs/${runId}/eval/`);
  console.log(`  sheet.md            — judge from this (no path names)`);
  console.log(`  verdicts.json       — fill A/B/tie per task, then commit`);
  console.log(`  mapping.sealed.json — do NOT open until verdicts are committed`);
}

main();
