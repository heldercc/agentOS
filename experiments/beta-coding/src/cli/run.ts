// Run one context path for one run. Thin CLI over experiment.runPath.
//
// Usage: tsx src/cli/run.ts --path full-reload --model fake|manual [--run <runId>]

import { runPath } from "../experiment.js";
import type { PathName } from "../types.js";

function parseArgs(argv: string[]): { path: PathName; model: string; runId: string } {
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
  if (!runId) runId = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return { path, model, runId };
}

async function main(): Promise<void> {
  const { path, model, runId } = parseArgs(process.argv.slice(2));
  await runPath({ runId, path, modelArg: model });
  console.log(`\ndone → runs/${runId}/${path}/`);
}

main().catch((err) => {
  console.error(`\nERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
