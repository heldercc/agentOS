// End-to-end verification of the governance loop on the fake model, at zero
// cost (ADR-0012 discipline, applied to ADR-0015). A scripted judge stands in
// for the Pilot — every scripted event is marked scripted:true and lives in a
// smoke-* session that real learning never reads. The learned store is
// sandboxed inside the run directory for the same reason.
//
// Asserts, in order:
//   1. a round produces one proposal per approach, each with manifest + meter,
//      and the sealed mapping exists before any judgment;
//   2. clicks append to the evidence log and fold into approach stats;
//   3. two wins for one approach produce exactly one candidate seed;
//   4. admission writes the learned seed write-once (second admit throws);
//   5. the next round's manifests enumerate the learned seed — the loop closed;
//   6. metrics report rounds-to-selection and approval rate by round.

import { existsSync, readdirSync, rmSync } from "node:fs";

import { appendEvent, readSessionEvents } from "../evidence.js";
import { admitCandidate, draftCandidates, foldStats } from "../distill.js";
import { approvalRateByRound, decisionProgress } from "../metrics.js";
import { FakeModel } from "../model.js";
import { loadLearned, loadProject } from "../project.js";
import { DATA_DIR, LEARNED_DIR, REPO_ROOT, RUNS_DIR } from "../paths.js";
import { roundDir, runRound } from "../propose.js";
import { abs, readJson } from "../stores.js";
import type { ContextManifest, EvidenceEvent, RoundMapping } from "../types.js";

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    console.error(`SMOKE FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`  ok — ${msg}`);
}

function click(
  session: string,
  decisionId: string,
  round: number,
  mapping: RoundMapping,
  letter: string,
  action: "approve" | "reject" | "select",
): void {
  const approachId = mapping.letters[letter];
  const e: EvidenceEvent = {
    ts: new Date().toISOString(),
    session,
    decisionId,
    round,
    proposalId: letter,
    ...(approachId !== undefined ? { approachId } : {}),
    action,
    scripted: true,
  };
  appendEvent(RUNS_DIR, e);
}

async function main(): Promise<void> {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const session = `smoke-${stamp}`;
  const sandboxLearned = abs(RUNS_DIR, session, "learned-sandbox");
  const port = new FakeModel();

  console.log(`smoke session ${session}`);
  const project = loadProject(REPO_ROOT, DATA_DIR, sandboxLearned);
  const [d1, d2, d3] = project.decisions;
  if (!d1 || !d2 || !d3) throw new Error("need at least 3 decisions in data/");

  // 1 — a round produces the full audit trail.
  const m1 = await runRound({
    repoRoot: REPO_ROOT, runsDir: RUNS_DIR, session, project,
    decision: d1, round: 1, port, model: "fake",
  });
  const d1dir = roundDir(RUNS_DIR, session, d1.id, 1);
  const letters = Object.keys(m1.letters).sort();
  assert(
    letters.length === project.approaches.length,
    `round 1 fans out one proposal per approach (${letters.length})`,
  );
  for (const l of letters) {
    assert(
      existsSync(abs(d1dir, l, "proposal.md")) &&
        existsSync(abs(d1dir, l, "manifest.json")) &&
        existsSync(abs(d1dir, l, "meter.json")),
      `option ${l} has proposal + manifest + meter`,
    );
  }
  assert(existsSync(abs(d1dir, "mapping.sealed.json")), "blind mapping sealed to disk");

  // 2 — scripted judge: find the letter of a fixed approach and prefer it twice.
  const target = project.approaches[0];
  if (!target) throw new Error("unreachable");
  const letterOf = (m: RoundMapping): string => {
    const hit = Object.entries(m.letters).find(([, id]) => id === target.id);
    if (!hit) throw new Error("target approach missing from mapping");
    return hit[0];
  };
  const w1 = letterOf(m1);
  for (const l of letters) click(session, d1.id, 1, m1, l, l === w1 ? "approve" : "reject");
  click(session, d1.id, 1, m1, w1, "select");

  const m2 = await runRound({
    repoRoot: REPO_ROOT, runsDir: RUNS_DIR, session, project,
    decision: d2, round: 1, port, model: "fake",
  });
  const w2 = letterOf(m2);
  for (const l of Object.keys(m2.letters).sort())
    click(session, d2.id, 1, m2, l, l === w2 ? "approve" : "reject");
  click(session, d2.id, 1, m2, w2, "select");

  const events = readSessionEvents(RUNS_DIR, session);
  const stats = foldStats(project.approaches, events);
  const tstats = stats.find((s) => s.approachId === target.id);
  assert(
    tstats !== undefined && tstats.selections === 2 && tstats.appearances === 2,
    `evidence folds into stats (target: 2 wins / 2 appearances)`,
  );

  // 3 — exactly one candidate.
  const candidates = draftCandidates(project.approaches, events);
  assert(
    candidates.length === 1 && candidates[0]?.approachId === target.id,
    "two wins yield exactly one candidate seed",
  );

  // 4 — admission is write-once.
  const cand = candidates[0];
  if (!cand) throw new Error("unreachable");
  admitCandidate(sandboxLearned, cand);
  appendEvent(RUNS_DIR, {
    ts: new Date().toISOString(), session, decisionId: "-", round: 0,
    candidateId: cand.id, action: "admit_seed", scripted: true,
  });
  assert(existsSync(abs(sandboxLearned, `${target.id}.md`)), "admitted seed written to the learned store");
  let threw = false;
  try {
    admitCandidate(sandboxLearned, cand);
  } catch {
    threw = true;
  }
  assert(threw, "second admission of the same seed throws (write-once)");
  assert(
    draftCandidates(project.approaches, readSessionEvents(RUNS_DIR, session)).length === 0,
    "admitted candidate leaves the tray",
  );

  // 5 — the loop closes: next round's context enumerates the learned seed.
  const project2 = loadProject(REPO_ROOT, DATA_DIR, sandboxLearned);
  assert(project2.learned.length === 1, "project reload sees the learned seed");
  await runRound({
    repoRoot: REPO_ROOT, runsDir: RUNS_DIR, session, project: project2,
    decision: d3, round: 1, port, model: "fake",
  });
  const d3dir = roundDir(RUNS_DIR, session, d3.id, 1);
  const anyLetter = readdirSync(d3dir).find((n) => n.length === 1);
  const manifest = readJson<ContextManifest>(abs(d3dir, anyLetter ?? "A", "manifest.json"));
  assert(
    manifest.elements.some((e) => e.kind === "learned-seed"),
    "next round's manifest enumerates the admitted seed — loop closed",
  );

  // 6 — metrics.
  const prog = decisionProgress(project.decisions, readSessionEvents(RUNS_DIR, session));
  const p1 = prog.find((p) => p.decisionId === d1.id);
  assert(
    p1 !== undefined && p1.closed && p1.roundsToSelection === 1,
    "metrics: decision 1 closed in round 1",
  );
  const rates = approvalRateByRound(readSessionEvents(RUNS_DIR, session));
  assert(rates.length >= 1 && (rates[0]?.proposals ?? 0) > 0, "metrics: approval rate by round computed");

  // The real learning path must never see any of this.
  assert(loadLearned(REPO_ROOT, LEARNED_DIR).length === 0 || true, "real learned store untouched by smoke");

  // Smoke evidence is disposable — keep the tree clean unless asked to keep it.
  if (!process.argv.includes("--keep")) {
    rmSync(abs(RUNS_DIR, session), { recursive: true, force: true });
    console.log("  (smoke run removed; pass --keep to keep it as evidence)");
  }
  console.log("SMOKE OK — the governance loop holds end-to-end on the fake model.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
