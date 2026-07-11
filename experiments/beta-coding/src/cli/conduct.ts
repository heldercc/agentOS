// The conductor — one command to drive a full comparison. Runs the baseline,
// then the scheduled path (baseline-first is enforced), then builds the blind
// sheet. The Pilot then judges and runs results. This is the engine-side
// orchestration the beta.bat launcher wraps in clicks.
//
// Usage: tsx src/cli/conduct.ts --run <runId> --model fake|manual [--seed <int>]

import { buildBlind } from "../eval.js";
import { runPath } from "../experiment.js";

function parseArgs(argv: string[]): { runId: string; model: string; seed: number } {
  let runId = "";
  let model = "fake";
  let seed = 1;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--run") runId = argv[++i] ?? "";
    else if (argv[i] === "--model") model = argv[++i] ?? "fake";
    else if (argv[i] === "--seed") seed = Number(argv[++i] ?? "1");
  }
  if (!runId) runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  if (!Number.isFinite(seed)) throw new Error("--seed must be an integer");
  return { runId, model, seed };
}

async function main(): Promise<void> {
  const { runId, model, seed } = parseArgs(process.argv.slice(2));

  console.log(`\n=== conductor · run ${runId} · model ${model} ===\n`);
  console.log("[1/3] baseline (full reload)");
  await runPath({ runId, path: "full-reload", modelArg: model });

  console.log("\n[2/3] scheduled");
  await runPath({ runId, path: "scheduled", modelArg: model });

  console.log("\n[3/3] blind evaluation sheet");
  buildBlind(runId, seed);

  console.log(`\n=== done ===`);
  console.log(`Next: judge runs/${runId}/eval/sheet.md, fill verdicts.json, then`);
  console.log(`      tsx src/cli/results.ts --run ${runId}`);
  // Emit the run id on its own last line so the launcher can capture it.
  console.log(`RUN_ID=${runId}`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
