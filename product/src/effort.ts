// COPIED-with-adaptation from experiments/beta-governance/src/effort.ts
// (ADR-0017 rig) — a copy with provenance beats an import. Effort management
// (Operating Model §9): five hard-coded levels, the Effort Probe estimating
// from the real meters of past work orders, and the estimate-vs-actual report
// card written after execution so later estimates improve on their own.
//
// Spend intelligence where judgement matters. Use cheap execution elsewhere.

import { existsSync, readdirSync, statSync } from "node:fs";

import { abs, readJson } from "./stores.js";
import type { MeterRecord } from "./types.js";

export type EffortLevel = "minimal" | "low" | "balanced" | "high" | "maximum";

export const EFFORT_LEVELS: EffortLevel[] = [
  "minimal",
  "low",
  "balanced",
  "high",
  "maximum",
];

/** Everything one effort level controls. Hard-coded for the Beta (no dynamic routing). */
export interface EffortSpec {
  level: EffortLevel;
  /** Model the runtime is asked to use. */
  workerModel: string;
  /** Cap on agents fanned out per operation. */
  maxAgents: number;
  /** Budget (chars) for optional context: answers, prior responses, artifacts. */
  contextBudgetChars: number;
  /** Generation budget per work order. */
  maxTokens: number;
  /** Extra attempts allowed when a generation fails or times out. */
  retryBudget: number;
  /** Per-generation timeout. */
  timeoutMs: number;
  /** Honest one-line expectation, shown to the Pilot. */
  expectedQuality: string;
  intendedFor: string;
}

const SPECS: Record<EffortLevel, EffortSpec> = {
  minimal: {
    level: "minimal",
    workerModel: "haiku",
    maxAgents: 1,
    contextBudgetChars: 2_000,
    maxTokens: 1_000,
    retryBudget: 0,
    timeoutMs: 90_000,
    expectedQuality: "plumbing-grade: proves the loop moves, not the work",
    intendedFor: "UI testing and plumbing",
  },
  low: {
    level: "low",
    workerModel: "haiku",
    maxAgents: 2,
    contextBudgetChars: 4_000,
    maxTokens: 2_000,
    retryBudget: 1,
    timeoutMs: 150_000,
    expectedQuality: "cheap and shallow but real — enough to steer",
    intendedFor: "development default; early iterations",
  },
  balanced: {
    level: "balanced",
    workerModel: "sonnet",
    maxAgents: 3,
    contextBudgetChars: 8_000,
    maxTokens: 4_000,
    retryBudget: 1,
    timeoutMs: 240_000,
    expectedQuality: "the working mode: useful work, one validation pass",
    intendedFor: "normal governed iteration",
  },
  high: {
    level: "high",
    workerModel: "opus",
    maxAgents: 4,
    contextBudgetChars: 12_000,
    maxTokens: 6_000,
    retryBudget: 2,
    timeoutMs: 360_000,
    expectedQuality: "stronger model, wider table",
    intendedFor: "work that resists; late iterations",
  },
  maximum: {
    level: "maximum",
    workerModel: "opus",
    maxAgents: 5,
    contextBudgetChars: 20_000,
    maxTokens: 8_000,
    retryBudget: 2,
    timeoutMs: 600_000,
    expectedQuality: "the strongest permitted set — only when explicitly chosen",
    intendedFor: "explicitly chosen by the Pilot, never by automation",
  },
};

export function effortSpec(level: EffortLevel): EffortSpec {
  return SPECS[level];
}

/**
 * The authority threshold (Operating Model §5): automation may spend at or
 * below this level on its own; anything above is the Pilot's explicit choice.
 */
export const AUTO_MAX_LEVEL: EffortLevel = "balanced";

export function levelIndex(level: EffortLevel): number {
  return EFFORT_LEVELS.indexOf(level);
}

/** Clamp an effort level to what automation may spend on its own. */
export function clampAutoEffort(level: EffortLevel): EffortLevel {
  return levelIndex(level) > levelIndex(AUTO_MAX_LEVEL) ? AUTO_MAX_LEVEL : level;
}

// ---------------------------------------------------------------------------
// The Effort Probe.

export interface EffortEstimate {
  level: EffortLevel;
  calls: number;
  /** Total across planned calls, input + output. */
  expectedTokens: number;
  expectedDurationMs: number;
  /** Subscription pressure, not wallet cost — the Beta runs on the Pilot's plan. */
  pressure: "negligible" | "light" | "moderate" | "heavy";
  expectedQuality: string;
  confidence: "low" | "medium" | "high";
  basedOnRuns: number;
  recommendation: EffortLevel;
  recommendationReason: string;
}

/** Priors used when no history exists yet (chars/4-shaped, deliberately round). */
const PRIOR_TOKENS_PER_CALL = 900;
const PRIOR_DURATION_MS = 25_000;

interface MeterSample {
  tokens: number;
  durationMs: number;
}

/** Walk workspace/<project>/iterations/<it>/workorders/<wo>/meter.json, skipping smoke projects. */
export function collectMeterSamples(workspaceDir: string): MeterSample[] {
  const out: MeterSample[] = [];
  if (!existsSync(workspaceDir)) return out;
  for (const project of readdirSync(workspaceDir)) {
    if (project.startsWith("smoke-")) continue;
    const itsDir = abs(workspaceDir, project, "iterations");
    if (!existsSync(itsDir) || !statSync(itsDir).isDirectory()) continue;
    for (const it of readdirSync(itsDir)) {
      const wosDir = abs(itsDir, it, "workorders");
      if (!existsSync(wosDir)) continue;
      for (const wo of readdirSync(wosDir)) {
        const meterPath = abs(wosDir, wo, "meter.json");
        if (!existsSync(meterPath)) continue;
        const m = readJson<MeterRecord>(meterPath);
        out.push({ tokens: m.inputTokens + m.outputTokens, durationMs: m.durationMs });
      }
    }
  }
  return out;
}

/**
 * Estimate before execution. History is the estimator: real meters from past
 * work orders average into the per-call expectation; the recorded
 * estimate-vs-actual gap (effort-actual.json) shows how trustworthy the probe
 * currently is.
 */
export function probeEffort(args: {
  workspaceDir: string;
  level: EffortLevel;
  /** Work orders the operation plans to spawn. */
  plannedCalls: number;
  /** Iterations this project has already completed (recommendation input). */
  priorIterations: number;
}): EffortEstimate {
  const spec = effortSpec(args.level);
  const calls = Math.max(1, args.plannedCalls);

  const samples = collectMeterSamples(args.workspaceDir);
  const perCallTokens =
    samples.length > 0
      ? Math.round(samples.reduce((n, s) => n + s.tokens, 0) / samples.length)
      : PRIOR_TOKENS_PER_CALL;
  const perCallMs =
    samples.length > 0
      ? Math.round(samples.reduce((n, s) => n + s.durationMs, 0) / samples.length)
      : PRIOR_DURATION_MS;

  const expectedTokens = perCallTokens * calls;
  const pressure =
    expectedTokens < 3_000
      ? "negligible"
      : expectedTokens < 10_000
        ? "light"
        : expectedTokens < 30_000
          ? "moderate"
          : "heavy";

  // Recommendation: escalate with iterations, never past the authority line.
  const wanted: EffortLevel =
    args.priorIterations === 0 ? "low" : args.priorIterations === 1 ? "balanced" : "high";
  const capped = clampAutoEffort(wanted);
  const reason =
    wanted === capped
      ? args.priorIterations === 0
        ? "first iteration: start cheap, escalate only if the work resists"
        : "prior iterations exist: one step up buys real quality here"
      : `iteration ${args.priorIterations + 1} suggests "${wanted}", but above ` +
        `"${AUTO_MAX_LEVEL}" is the Pilot's call, not the probe's`;

  return {
    level: args.level,
    calls,
    expectedTokens,
    expectedDurationMs: perCallMs * calls,
    pressure,
    expectedQuality: spec.expectedQuality,
    confidence: samples.length >= 6 ? "high" : samples.length > 0 ? "medium" : "low",
    basedOnRuns: samples.length,
    recommendation: capped,
    recommendationReason: reason,
  };
}

/** Written beside each operation after execution: what the probe said vs. what happened. */
export interface EffortActual {
  level: EffortLevel;
  estimate: EffortEstimate;
  actualTokens: number;
  actualDurationMs: number;
  calls: number;
  retriesUsed: number;
  outcome: "ok" | "error";
  /** (actual − estimate) / estimate, rounded percent; the probe's report card. */
  tokensDeltaPct: number;
  durationDeltaPct: number;
}

export function buildActual(args: {
  estimate: EffortEstimate;
  level: EffortLevel;
  meters: MeterRecord[];
  retriesUsed: number;
  outcome: "ok" | "error";
}): EffortActual {
  const actualTokens = args.meters.reduce((n, m) => n + m.inputTokens + m.outputTokens, 0);
  const actualDurationMs = args.meters.reduce((n, m) => n + m.durationMs, 0);
  const pct = (actual: number, est: number): number =>
    est > 0 ? Math.round(((actual - est) / est) * 100) : 0;
  return {
    level: args.level,
    estimate: args.estimate,
    actualTokens,
    actualDurationMs,
    calls: args.meters.length,
    retriesUsed: args.retriesUsed,
    outcome: args.outcome,
    tokensDeltaPct: pct(actualTokens, args.estimate.expectedTokens),
    durationDeltaPct: pct(actualDurationMs, args.estimate.expectedDurationMs),
  };
}
