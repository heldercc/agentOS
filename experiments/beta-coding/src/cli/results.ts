// Aggregate meters + sealed map + verdicts into RESULTS.md. Thin CLI over
// eval.aggregateResults.
//
// Usage: tsx src/cli/results.ts --run <runId>

import { aggregateResults } from "../eval.js";

function parseRunId(argv: string[]): string {
  const i = argv.indexOf("--run");
  const id = i >= 0 ? argv[i + 1] : undefined;
  if (!id) throw new Error("--run <runId> is required");
  return id;
}

function main(): void {
  const runId = parseRunId(process.argv.slice(2));
  const reduction = aggregateResults(runId);
  console.log(`results written → runs/${runId}/RESULTS.md`);
  console.log(`  pooled input reduction: ${reduction}`);
}

main();
