// Effort management (Operating Model §9, ADR-0017): not every iteration
// deserves the strongest model. Five hard-coded levels for this Beta — the
// smallest adequate model and agent set — plus the Effort Probe, which
// estimates cost before execution from the actual meters of past rounds and
// records estimate-vs-actual after, so later estimates improve on their own.
//
// Spend intelligence where judgement matters. Use cheap execution elsewhere.

import { existsSync, readdirSync, statSync } from "node:fs";

import { abs, readJson } from "./stores.js";
import type { Approach, Decision, MeterRecord } from "./types.js";

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
  /** Model the worker CLI is asked to use (manual port); recorded either way. */
  workerModel: string;
  /** Cap on alternatives fanned out (bounded further by relevant approaches). */
  maxAlternatives: number;
  /** Whether a secondary adversarial critic pass runs per alternative. */
  critic: boolean;
  /** Budget (chars) for optional context: admitted seeds + prior feedback. */
  contextBudgetChars: number;
  /** Generation budget per alternative. */
  maxTokens: number;
  /** Extra attempts allowed when a generation fails or times out. */
  retryBudget: number;
  /** Per-generation timeout. */
  timeoutMs: number;
  /** Honest one-line expectation, shown to the owner. */
  expectedQuality: string;
  intendedFor: string;
}

const SPECS: Record<EffortLevel, EffortSpec> = {
  minimal: {
    level: "minimal",
    workerModel: "haiku",
    maxAlternatives: 1,
    critic: false,
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
    maxAlternatives: 2,
    critic: false,
    contextBudgetChars: 4_000,
    maxTokens: 2_000,
    retryBudget: 1,
    timeoutMs: 150_000,
    expectedQuality: "cheap and shallow but real — enough to steer",
    intendedFor: "development default; early rounds",
  },
  balanced: {
    level: "balanced",
    workerModel: "sonnet",
    maxAlternatives: 3,
    critic: false,
    contextBudgetChars: 8_000,
    maxTokens: 4_000,
    retryBudget: 1,
    timeoutMs: 240_000,
    expectedQuality: "the working mode: useful alternatives, one validation pass",
    intendedFor: "normal governed iteration",
  },
  high: {
    level: "high",
    workerModel: "opus",
    maxAlternatives: 3,
    critic: true,
    contextBudgetChars: 12_000,
    maxTokens: 6_000,
    retryBudget: 2,
    timeoutMs: 360_000,
    expectedQuality: "stronger model, adversarial critique on every alternative",
    intendedFor: "decisions that resist; late rounds",
  },
  maximum: {
    level: "maximum",
    workerModel: "opus",
    maxAlternatives: 4,
    critic: true,
    contextBudgetChars: 20_000,
    maxTokens: 8_000,
    retryBudget: 2,
    timeoutMs: 600_000,
    expectedQuality: "the strongest permitted set — only when explicitly chosen",
    intendedFor: "explicitly chosen by the owner, never by automation",
  },
};

export function effortSpec(level: EffortLevel): EffortSpec {
  return SPECS[level];
}

/**
 * The authority threshold (Operating Model §5): automation may run at or
 * below this level; anything above requires the owner's own explicit choice.
 */
export const AUTO_MAX_LEVEL: EffortLevel = "balanced";

export function levelIndex(level: EffortLevel): number {
  return EFFORT_LEVELS.indexOf(level);
}

/**
 * Consult only the agents whose responsibility is most relevant: rank
 * approaches by tag overlap with the decision, then let the effort level cap
 * how deep the consultation goes. Relevance orders, effort cuts — low effort
 * hears only the closest specialists, high effort widens the table. A hard
 * filter would also skew the distiller's appearance statistics; a cap keeps
 * every subset honest (the present event records what was on the table).
 */
export function relevantApproaches(
  approaches: Approach[],
  decision: Decision,
  spec: EffortSpec,
): Approach[] {
  const overlap = (a: Approach): number =>
    a.tags.filter((t) => decision.tags.includes(t)).length;
  const ranked = [...approaches].sort((x, y) => overlap(y) - overlap(x));
  return ranked.slice(0, Math.max(1, spec.maxAlternatives));
}

// ---------------------------------------------------------------------------
// The Effort Probe.

export interface EffortEstimate {
  level: EffortLevel;
  alternatives: number;
  criticPasses: number;
  /** Total across alternatives (and critic passes), input + output. */
  expectedTokens: number;
  expectedDurationMs: number;
  /** Subscription pressure, not wallet cost — the Beta runs on the owner's plan. */
  pressure: "negligible" | "light" | "moderate" | "heavy";
  expectedQuality: string;
  confidence: "low" | "medium" | "high";
  basedOnRuns: number;
  recommendation: EffortLevel;
  recommendationReason: string;
}

/** Priors used when no history exists yet (chars/4-shaped, deliberately round). */
const PRIOR_TOKENS_PER_ALTERNATIVE = 900;
const PRIOR_DURATION_MS = 25_000;

interface MeterSample {
  tokens: number;
  durationMs: number;
}

/** Walk runs/session/decision/round-N/letter/meter.json, skipping smoke runs. */
export function collectMeterSamples(runsDir: string): MeterSample[] {
  const out: MeterSample[] = [];
  if (!existsSync(runsDir)) return out;
  for (const session of readdirSync(runsDir)) {
    if (session.startsWith("smoke-")) continue;
    const sDir = abs(runsDir, session);
    if (!statSync(sDir).isDirectory()) continue;
    for (const decision of readdirSync(sDir)) {
      const dDir = abs(sDir, decision);
      if (!existsSync(dDir) || !statSync(dDir).isDirectory()) continue;
      for (const round of readdirSync(dDir)) {
        if (!/^round-\d+$/.test(round)) continue;
        const rDir = abs(dDir, round);
        for (const option of readdirSync(rDir)) {
          const meterPath = abs(rDir, option, "meter.json");
          if (!existsSync(meterPath)) continue;
          const m = readJson<MeterRecord>(meterPath);
          out.push({
            tokens: m.inputTokens + m.outputTokens,
            durationMs: m.durationMs,
          });
        }
      }
    }
  }
  return out;
}

/**
 * Estimate before execution. History is the estimator: real meters from past
 * rounds of this project average into the per-alternative expectation, and the
 * recorded estimate-vs-actual gap (effort-actual.json) is visible evidence of
 * how trustworthy the probe currently is.
 */
export function probeEffort(args: {
  runsDir: string;
  approaches: Approach[];
  decision: Decision;
  level: EffortLevel;
  /** Rounds this decision has already been through (recommendation input). */
  priorRounds: number;
}): EffortEstimate {
  const spec = effortSpec(args.level);
  const fanned = relevantApproaches(args.approaches, args.decision, spec).length;
  const criticPasses = spec.critic ? fanned : 0;
  const calls = fanned + criticPasses;

  const samples = collectMeterSamples(args.runsDir);
  const perCallTokens =
    samples.length > 0
      ? Math.round(samples.reduce((n, s) => n + s.tokens, 0) / samples.length)
      : PRIOR_TOKENS_PER_ALTERNATIVE;
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

  // Recommendation: escalate with resistance, never past the authority line.
  const wanted: EffortLevel =
    args.priorRounds === 0 ? "low" : args.priorRounds === 1 ? "balanced" : "high";
  const capped =
    levelIndex(wanted) > levelIndex(AUTO_MAX_LEVEL) ? AUTO_MAX_LEVEL : wanted;
  const reason =
    wanted === capped
      ? args.priorRounds === 0
        ? "first round: start cheap, escalate only if the work resists"
        : "prior rounds exist: one step up buys real quality here"
      : `round ${args.priorRounds + 1} suggests "${wanted}", but above ` +
        `"${AUTO_MAX_LEVEL}" is the owner's call, not the probe's`;

  return {
    level: args.level,
    alternatives: fanned,
    criticPasses,
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

/** Written beside each round after execution: what the probe said vs. what happened. */
export interface EffortActual {
  level: EffortLevel;
  estimate: EffortEstimate;
  actualTokens: number;
  actualDurationMs: number;
  alternatives: number;
  criticPasses: number;
  retriesUsed: number;
  outcome: "ok" | "error";
  /** (actual − estimate) / estimate, rounded percent; the probe's report card. */
  tokensDeltaPct: number;
  durationDeltaPct: number;
}

export function buildActual(args: {
  estimate: EffortEstimate;
  spec: EffortSpec;
  meters: MeterRecord[];
  criticMeters: MeterRecord[];
  retriesUsed: number;
  outcome: "ok" | "error";
}): EffortActual {
  const all = [...args.meters, ...args.criticMeters];
  const actualTokens = all.reduce((n, m) => n + m.inputTokens + m.outputTokens, 0);
  const actualDurationMs = all.reduce((n, m) => n + m.durationMs, 0);
  const pct = (actual: number, est: number): number =>
    est > 0 ? Math.round(((actual - est) / est) * 100) : 0;
  return {
    level: args.spec.level,
    estimate: args.estimate,
    actualTokens,
    actualDurationMs,
    alternatives: args.meters.length,
    criticPasses: args.criticMeters.length,
    retriesUsed: args.retriesUsed,
    outcome: args.outcome,
    tokensDeltaPct: pct(actualTokens, args.estimate.expectedTokens),
    durationDeltaPct: pct(actualDurationMs, args.estimate.expectedDurationMs),
  };
}
