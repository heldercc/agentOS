// The measurement extractor (parecer 2026-07-12 noite, ponto E): everything
// the app logs to disk, condensed into honest per-project numbers so the
// Copilot can follow every test the Pilot runs and, later, compare the
// governed product against the same brief in a single terminal prompt.
// Read-only: this script never mutates the workspace.
//
//   npx tsx src/cli/metrics.ts                → every real project
//   npx tsx src/cli/metrics.ts <project-id>   → one project

import { existsSync, readdirSync } from "node:fs";

import { readEvents } from "../evidence.js";
import { senseiVictories, listSenseis } from "../hi.js";
import {
  getProject,
  listArtifacts,
  listProjects,
  readQuestions,
  readSurfaces,
  readWorkOrders,
} from "../kernel.js";
import { workOrdersDir } from "../paths.js";
import { abs, readJson } from "../stores.js";
import type { MeterRecord } from "../types.js";

interface ProjectMetrics {
  project: string;
  name: string;
  status: string;
  iterations: number;
  wallClock: { firstEvent: string | null; lastEvent: string | null; spanMinutes: number };
  interview: {
    asked: number;
    answered: number;
    deferred: number;
    open: number;
    distinctAskers: number;
  };
  workOrders: {
    total: number;
    byKind: Record<string, number>;
    byEffort: Record<string, number>;
    errors: number;
  };
  tokens: {
    input: number;
    output: number;
    total: number;
    estimated: boolean;
    modelSeconds: number;
  };
  decisions: {
    surfaces: number;
    decided: number;
    optionsGenerated: number;
    refinements: number;
    senseiVoicedPicks: number;
    genericPicks: number;
  };
  humanIntelligence: {
    seedApplications: number;
    candidateSeedsExtracted: number;
    evidenceReturned: number;
  };
  artifacts: { count: number; chars: number };
  /** Time the human spent deciding: minutes between consecutive pilot acts. */
  pilotActs: number;
}

function metricsFor(projectId: string): ProjectMetrics {
  const project = getProject(projectId);
  const events = readEvents(projectId);
  const questions = readQuestions(projectId);
  const surfaces = readSurfaces(projectId);
  const artifacts = listArtifacts(projectId);

  const byKind: Record<string, number> = {};
  const byEffort: Record<string, number> = {};
  let errors = 0;
  let input = 0;
  let output = 0;
  let estimated = false;
  let modelMs = 0;
  let woTotal = 0;
  for (let it = 1; it <= project.iteration; it++) {
    for (const w of readWorkOrders(projectId, it)) {
      woTotal += 1;
      byKind[w.kind] = (byKind[w.kind] ?? 0) + 1;
      byEffort[w.effortLevel] = (byEffort[w.effortLevel] ?? 0) + 1;
      if (w.status === "error") errors += 1;
      const meterPath = abs(workOrdersDir(projectId, it), w.id, "meter.json");
      if (!existsSync(meterPath)) continue;
      const m = readJson<MeterRecord>(meterPath);
      input += m.inputTokens;
      output += m.outputTokens;
      modelMs += m.durationMs;
      if (m.estimated) estimated = true;
    }
  }

  const decided = surfaces.filter((d) => d.status === "decided");
  let senseiVoicedPicks = 0;
  let genericPicks = 0;
  for (const d of decided) {
    const sel = d.options.find(
      (o) => o.id === d.selected?.optionId && o.version === d.selected?.version,
    );
    if (!sel) continue;
    if (sel.senseiId) senseiVoicedPicks += 1;
    else genericPicks += 1;
  }

  const first = events[0]?.ts ?? null;
  const last = events[events.length - 1]?.ts ?? null;
  return {
    project: projectId,
    name: project.name,
    status: project.status ?? "active",
    iterations: project.iteration,
    wallClock: {
      firstEvent: first,
      lastEvent: last,
      spanMinutes:
        first && last
          ? Math.round((new Date(last).getTime() - new Date(first).getTime()) / 60000)
          : 0,
    },
    interview: {
      asked: questions.length,
      answered: questions.filter((q) => q.status === "answered").length,
      deferred: questions.filter((q) => q.status === "deferred").length,
      open: questions.filter((q) => q.status === "open").length,
      distinctAskers: new Set(questions.flatMap((q) => q.askedBy)).size,
    },
    workOrders: { total: woTotal, byKind, byEffort, errors },
    tokens: {
      input,
      output,
      total: input + output,
      estimated,
      modelSeconds: Math.round(modelMs / 1000),
    },
    decisions: {
      surfaces: surfaces.length,
      decided: decided.length,
      optionsGenerated: surfaces.reduce((n, d) => n + d.options.length, 0),
      refinements: events.filter((e) => e.action === "option_refined").length,
      senseiVoicedPicks,
      genericPicks,
    },
    humanIntelligence: {
      seedApplications: countApplications(projectId),
      candidateSeedsExtracted: events.filter((e) => e.action === "seed_candidate_extracted")
        .length,
      evidenceReturned: events.filter((e) => e.action === "seed_evidence").length,
    },
    artifacts: {
      count: artifacts.length,
      chars: artifacts.reduce((n, a) => n + a.chars, 0),
    },
    pilotActs: events.filter((e) => e.actor === "pilot").length,
  };
}

/** How many times any seed entered this project's work orders (from manifests). */
function countApplications(projectId: string): number {
  const project = getProject(projectId);
  let n = 0;
  for (let it = 1; it <= project.iteration; it++) {
    const dir = workOrdersDir(projectId, it);
    if (!existsSync(dir)) continue;
    for (const wo of readdirSync(dir)) {
      const p = abs(dir, wo, "manifest.json");
      if (!existsSync(p)) continue;
      const m = readJson<{ elements: { kind: string }[] }>(p);
      n += m.elements.filter((el) => el.kind === "expertise").length;
    }
  }
  return n;
}

const arg = process.argv[2];
const ids = arg
  ? [arg]
  : listProjects()
      .map((p) => p.id)
      .filter((id) => !id.startsWith("smoke-"));

const report = {
  generatedFrom: "disk — evidence.jsonl, meters, manifests, surfaces (read-only)",
  senseiRanking: listSenseis()
    .map((s) => ({ id: s.id, title: s.title, victories: senseiVictories(s.id).length }))
    .sort((a, b) => b.victories - a.victories),
  projects: ids.map(metricsFor),
};
console.log(JSON.stringify(report, null, 2));
