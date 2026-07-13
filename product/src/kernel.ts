// The Kernel of the product shell (Operating Model §2): the governor and
// organiser of work. It receives Pilot intent, convenes bounded agents,
// aggregates their Question Needs, creates Work Orders, records evidence and
// advances the project after governance. It owns authority boundaries; it
// does not own taste and never silently reinterprets the Pilot.
//
// The 13 steps of docs/PRODUCT-LOOP.md map onto the exported operations:
//   1 initProject · 2-3 runConsult (roster + consults through the runtime)
//   4-5 mergeQuestions/aggregation · 6 topOpenQuestion · 7-8 answerQuestion
//   9 runCandidate · 10 decideCandidate · 11 runExecute
//   12 artifacts auto-return inside runExecute · 13 advanceIteration

import { appendFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";

import { appendEvent, readEvents } from "./evidence.js";
import {
  clampAutoEffort,
  effortSpec,
  levelIndex,
  type EffortLevel,
} from "./effort.js";
import {
  addCandidateSeed,
  admitSeed,
  listCandidates,
  listSeeds,
  recordSeedApplication,
  recordSeedEvidence,
  recordSenseiVictory,
  rejectSeed,
  reviseSeed,
  saveSensei,
  seedContentHash,
  seedYamlPath,
  type GuruSeed,
  type Sensei,
} from "./hi.js";
import {
  applicableSenseis,
  senseiSeeds,
  resolveSeeds,
  type ResolvedSeed,
} from "./resolver.js";
import { buildManifest, ContextBuilder, type AssembledContext } from "./manifest.js";
import {
  artifactsDir,
  projectDir,
  stateDir,
  workspaceRoot,
  workOrdersDir,
} from "./paths.js";
import { abs, readJson, readJsonl, readText, sha256, writeArtifactOnce, writeJson } from "./stores.js";
import { OpCancelledError, OpTimeoutError, type Runtime } from "./runtime.js";
import {
  validateApprovedState,
  validateCandidateState,
  validateDecisionSurface,
  validateOperationActual,
  validateProject,
  validateProjectMapRecord,
  validateQuestionsFile,
  validateWorkOrderRecord,
} from "./validate.js";
import { withTransition } from "./transitions.js";
import {
  candidateProjectMapFromText,
  compareProjectMaps,
  nextUnblockedSlice,
  normalizeProjectMap,
  transitionProjectSlice,
  validateProjectMap,
  type ProjectMapChange,
} from "./project-engine.js";
import type {
  AgentRole,
  ApprovedState,
  CandidateState,
  DecisionSurface,
  EffortProfile,
  EvidenceEvent,
  MeterRecord,
  OperationActual,
  OptionRecord,
  OptionSeedRef,
  Project,
  ProjectMap,
  ProjectSliceStatus,
  ProjectStateDoc,
  QuestionNeed,
  RosterFile,
  WorkOrderKind,
  WorkOrderRecord,
} from "./types.js";

function nowIso(): string {
  return new Date().toISOString();
}

// ---------------------------------------------------------------------------
// Step 1 — Project Init from name + free-text description.

export function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "project";
}

export const DEFAULT_EFFORT_PROFILE: EffortProfile = {
  questions: "low",
  options: "low",
  execution: "low",
};

export function initProject(
  name: string,
  description: string,
  scripted = false,
  effortProfile?: EffortProfile,
): Project {
  let id = slugify(name);
  let n = 2;
  while (existsSync(projectDir(id))) {
    id = `${slugify(name)}-${n}`;
    n += 1;
  }
  const project: Project = {
    id,
    name: name.trim(),
    description: description.trim(),
    createdAt: nowIso(),
    iteration: 1,
    effortProfile: effortProfile ?? { ...DEFAULT_EFFORT_PROFILE },
  };
  writeJson(abs(projectDir(id), "project.json"), project);
  event(project, "pilot", "project_init", scripted, {});
  return project;
}

/**
 * The per-phase effort strategy (parecer 2026-07-12 noite, ponto D). The
 * profile is the Pilot's explicit standing choice, so internal movement may
 * run at it even above the automation line; without one, the pre-reform
 * clamp applies.
 */
export function phaseEffort(project: Project, phase: keyof EffortProfile): EffortLevel {
  return project.effortProfile?.[phase] ?? clampAutoEffort("low");
}

export function setEffortProfile(
  projectId: string,
  profile: EffortProfile,
  scripted = false,
): Project {
  const project = getProject(projectId);
  const updated: Project = { ...project, effortProfile: profile };
  writeJson(abs(projectDir(projectId), "project.json"), updated);
  event(updated, "pilot", "effort_profile_set", scripted, {
    note: `perguntas ${profile.questions} · opções ${profile.options} · execução ${profile.execution}`,
  });
  return updated;
}

export function listProjects(): Project[] {
  if (!existsSync(workspaceRoot())) return [];
  const out: Project[] = [];
  for (const name of readdirSync(workspaceRoot()).sort()) {
    const p = abs(workspaceRoot(), name, "project.json");
    if (statSync(abs(workspaceRoot(), name)).isDirectory() && existsSync(p)) {
      out.push(readJson<Project>(p));
    }
  }
  return out;
}

export function getProject(projectId: string): Project {
  const path = abs(projectDir(projectId), "project.json");
  return validateProject(readJson<unknown>(path), path);
}

// ---------------------------------------------------------------------------
// Readers — the shell UI and the smoke test observe the loop through these.

export function readRoster(projectId: string): RosterFile | null {
  const p = abs(projectDir(projectId), "roster.json");
  return existsSync(p) ? readJson<RosterFile>(p) : null;
}

export function readQuestions(projectId: string): QuestionNeed[] {
  const p = abs(projectDir(projectId), "questions.json");
  return existsSync(p) ? validateQuestionsFile(readJson<unknown>(p), p).questions : [];
}

function writeQuestions(projectId: string, questions: QuestionNeed[]): void {
  writeJson(abs(projectDir(projectId), "questions.json"), { questions });
}

/** Open needs ranked by demand (Operating Model §4), then by age. */
export function openQuestions(projectId: string): QuestionNeed[] {
  return readQuestions(projectId)
    .filter((q) => q.status === "open")
    .sort((a, b) => b.askedBy.length - a.askedBy.length || a.iteration - b.iteration);
}

/** Step 6 — the one governed question on the table. */
export function topOpenQuestion(projectId: string): QuestionNeed | null {
  return openQuestions(projectId)[0] ?? null;
}

export function topOpenQuestions(projectId: string, limit = 3): QuestionNeed[] {
  return openQuestions(projectId).slice(0, Math.max(1, limit));
}

export function routeQuestionToDecision(projectId: string, questionId: string, scripted = false): QuestionNeed {
  const project = getProject(projectId);
  const questions = readQuestions(projectId);
  const question = questions.find((item) => item.id === questionId);
  if (!question || question.status !== "open") throw new Error(`open question ${questionId} not found`);
  question.status = "routed";
  question.routedAt = nowIso();
  writeQuestions(projectId, questions);
  event(project, "pilot", "question_routed_to_decide", scripted, { questionId, note: question.text });
  return question;
}

export function readCandidate(projectId: string): CandidateState | null {
  const p = abs(stateDir(projectId), "candidate.json");
  return existsSync(p) ? validateCandidateState(readJson<unknown>(p), p) : null;
}

export function readApproved(projectId: string): ApprovedState | null {
  const p = abs(stateDir(projectId), "approved.json");
  return existsSync(p) ? validateApprovedState(readJson<unknown>(p), p) : null;
}

/**
 * The artifact's own declaration of what shaped it (gap audit, critical row;
 * TERMINOLOGY: "every Artifact carries provenance by reference"): a sidecar
 * next to the artifact file, so the artifact text stays byte-faithful to the
 * runtime's output while the human intelligence behind it stays provable.
 */
export interface ArtifactProvenance {
  workOrderId: string;
  agentId: string;
  iteration: number;
  effortLevel: string;
  model: string;
  /** sha256 of the artifact text exactly as returned and stored. */
  artifactSha256: string;
  /** sha256 of the work order's manifest.json exactly as written. */
  manifestSha256: string;
  seeds: {
    id: string;
    version: number;
    /** sha256 of the seed's versioned content, as applied. */
    contentHash: string;
    title: string;
    reason: string;
    senseiId?: string;
    senseiTitle?: string;
    /** Pre-reform sidecars used the old name; kept readable, never written anew. */
    mentorId?: string;
    mentorTitle?: string;
  }[];
}

export interface ArtifactInfo {
  iteration: number;
  agentId: string;
  path: string;
  chars: number;
  workOrderId?: string;
  /** The human intelligence that shaped this artifact (provenance by reference). */
  seeds?: ArtifactProvenance["seeds"];
}

export function listArtifacts(projectId: string): ArtifactInfo[] {
  const root = abs(projectDir(projectId), "artifacts");
  if (!existsSync(root)) return [];
  const out: ArtifactInfo[] = [];
  for (const itName of readdirSync(root).sort()) {
    const m = /^it-(\d+)$/.exec(itName);
    if (!m) continue;
    const itDir = abs(root, itName);
    for (const f of readdirSync(itDir).sort()) {
      if (!f.endsWith(".md")) continue;
      const info: ArtifactInfo = {
        iteration: Number(m[1]),
        agentId: f.replace(/\.md$/, ""),
        path: abs(itDir, f),
        chars: readText(abs(itDir, f)).length,
      };
      const provPath = abs(itDir, f.replace(/\.md$/, ".provenance.json"));
      if (existsSync(provPath)) {
        const prov = readJson<ArtifactProvenance>(provPath);
        info.workOrderId = prov.workOrderId;
        info.seeds = prov.seeds;
      }
      out.push(info);
    }
  }
  return out;
}

export function readWorkOrders(projectId: string, iteration: number): WorkOrderRecord[] {
  const dir = workOrdersDir(projectId, iteration);
  if (!existsSync(dir)) return [];
  const out: WorkOrderRecord[] = [];
  for (const wo of readdirSync(dir).sort()) {
    const p = abs(dir, wo, "workorder.json");
    if (existsSync(p)) out.push(validateWorkOrderRecord(readJson<unknown>(p), p));
  }
  return out;
}

export type Stage =
  | "consult"
  | "interview"
  | "decide"
  | "candidate"
  | "approve"
  | "execute"
  | "advance";

/** Where the loop stands — drives the shell's single primary action. */
export function stageOf(projectId: string): Stage {
  const project = getProject(projectId);
  const candidate = readCandidate(projectId);
  // A withdrawn candidate is the Pilot's step BACK (decision 14): it stays
  // on file as evidence but no longer drives the stage — fall through.
  if (candidate && candidate.iteration === project.iteration && candidate.status !== "withdrawn") {
    if (candidate.status === "candidate") return "approve";
    if (candidate.status === "approved") {
      const done = listArtifacts(projectId).some((a) => a.iteration === project.iteration);
      return done ? "advance" : "execute";
    }
    // rejected — rebuild with the Pilot's note in context
    return "candidate";
  }
  const consults = readWorkOrders(projectId, project.iteration).filter(
    (w) => (w.kind === "consult" || w.kind === "reconsult") && w.status === "done",
  );
  if (readRoster(projectId) === null || consults.length === 0) return "consult";
  if (openQuestions(projectId).length > 0) return "interview";
  // An open Decision Surface outranks the candidate build: the selection is
  // authoritative direction the next candidate must fold.
  if (openSurface(projectId) !== null) return "decide";
  return "candidate";
}

// ---------------------------------------------------------------------------
// Evidence helper.

function event(
  project: Project,
  actor: EvidenceEvent["actor"],
  action: EvidenceEvent["action"],
  scripted: boolean,
  extra: Partial<EvidenceEvent>,
): void {
  appendEvent({
    ts: nowIso(),
    projectId: project.id,
    iteration: project.iteration,
    actor,
    action,
    scripted,
    ...extra,
  });
}

export function addPilotNote(projectId: string, note: string, scripted = false): void {
  const project = getProject(projectId);
  event(project, "pilot", "pilot_note", scripted, { note });
}

function pilotNotes(projectId: string): string[] {
  return readEvents(projectId)
    .filter((e) => e.action === "pilot_note" && e.note)
    .map((e) => e.note as string);
}

// ---------------------------------------------------------------------------
// Structured-output parsing — fenced JSON, with a bullet-list fallback for
// questions so a chatty worker still lands.

function extractJsonBlocks(text: string): unknown[] {
  const out: unknown[] = [];
  const re = /```json\s*([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    try {
      out.push(JSON.parse(m[1] ?? ""));
    } catch {
      // a malformed block is simply not a signal
    }
  }
  return out;
}

const MAX_QUESTIONS_PER_AGENT = 3;

export function questionsFrom(text: string): string[] {
  for (const block of extractJsonBlocks(text).reverse()) {
    if (
      typeof block === "object" &&
      block !== null &&
      Array.isArray((block as { questions?: unknown }).questions)
    ) {
      return ((block as { questions: unknown[] }).questions ?? [])
        .filter((q): q is string => typeof q === "string" && q.trim() !== "")
        .slice(0, MAX_QUESTIONS_PER_AGENT);
    }
  }
  // Fallback: a "Perguntas ao Pilot" / "Questions" section with bullets.
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => /perguntas ao pilot|^#+\s*questions/i.test(l));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length && out.length < MAX_QUESTIONS_PER_AGENT; i++) {
    const m = /^\s*(?:\d+[.)]|[-*•])\s*(.+)$/.exec(lines[i] ?? "");
    if (m?.[1]) out.push(m[1].trim());
    else if (out.length > 0 && (lines[i] ?? "").trim() !== "") break;
  }
  return out;
}

function rosterFrom(text: string): AgentRole[] | null {
  for (const block of extractJsonBlocks(text).reverse()) {
    const agents = (block as { agents?: unknown }).agents;
    if (!Array.isArray(agents)) continue;
    const roles: AgentRole[] = [];
    for (const a of agents) {
      const r = a as Partial<AgentRole>;
      if (
        typeof r.id === "string" &&
        typeof r.title === "string" &&
        typeof r.mandate === "string"
      ) {
        roles.push({
          id: slugify(r.id),
          title: r.title,
          mandate: r.mandate,
          tags: Array.isArray(r.tags) ? r.tags.filter((t) => typeof t === "string") : [],
        });
      }
    }
    if (roles.length >= 2) return roles.slice(0, 5);
  }
  return null;
}

function stateFrom(text: string): ProjectStateDoc | null {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  for (const block of extractJsonBlocks(text).reverse()) {
    const b = block as Partial<Record<keyof ProjectStateDoc, unknown>>;
    if (typeof b !== "object" || b === null) continue;
    if (typeof b.objective !== "string" || typeof b.nextAction !== "string") continue;
    return {
      objective: b.objective,
      phase: str(b.phase) || "shaping",
      approvedDecisions: arr(b.approvedDecisions),
      activeArtifacts: arr(b.activeArtifacts),
      unresolvedQuestions: arr(b.unresolvedQuestions),
      constraints: arr(b.constraints),
      nextAction: b.nextAction,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Work Orders — one bounded runtime call, fully audited: prompt, manifest,
// meter, response, record. Retries come from the effort spec.

/**
 * Honest phase reporting for the shell's Busy card (ADR-0022 PHASE 1 items
 * 3/5). Every phase fired here is something that is REALLY happening at the
 * instant it fires — never an invented percentage, and never out of order.
 *
 * runWorkOrder fires ONLY "response-received" — the instant its own runtime
 * call resolves. It deliberately does NOT fire "validating-parsing" or
 * "persisting" itself, even though it does write meter.json/response.md/
 * workorder.json internally: those are bookkeeping, not the moment that
 * matters to the Pilot. The real "validating-parsing" (rosterFrom/
 * questionsFrom/stateFrom/optionFrom) and the real "persisting" (the
 * GOVERNED write — roster.json, questions.json, candidate.json, the
 * Decision Surface, the artifact) both happen in each exported operation's
 * own body, after runWorkOrder returns the raw text. So each caller fires
 * both itself, in the order they actually occur: "validating-parsing"
 * immediately before it parses, "persisting" immediately before its own
 * governed write. (An earlier version fired "persisting" from inside
 * runWorkOrder too, for the workorder.json write — that produced TWO
 * "persisting" events per Work Order, the first of which landed BEFORE
 * "validating-parsing" and broke the honest ordering the Busy card
 * promises. Fixed by keeping "persisting" caller-side, once, always last.)
 * agentId is "" for kernel-level orders (roster/synthesize/recommend have no
 * agentId) — never omitted, so callers can rely on a plain string.
 */
export type WorkOrderPhase = "response-received" | "validating-parsing" | "persisting";
export type OnPhase = (phase: WorkOrderPhase, workOrderId: string, agentId: string) => void;
export type OnMeter = (meter: MeterRecord, agentId: string) => void;

/** exactOptionalPropertyTypes: forward onPhase/onMeter only when set, never
 *  as an explicit `undefined` — the established pattern in this file
 *  (see `...(optionsCount ? { optionsCount } : {})` elsewhere). */
function phaseCallbacks(onPhase?: OnPhase, onMeter?: OnMeter): { onPhase?: OnPhase; onMeter?: OnMeter } {
  return { ...(onPhase ? { onPhase } : {}), ...(onMeter ? { onMeter } : {}) };
}

async function runWorkOrder(args: {
  project: Project;
  kind: WorkOrderKind;
  agentId: string | null;
  system: string;
  ctx: AssembledContext;
  level: EffortLevel;
  runtime: Runtime;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<{ record: WorkOrderRecord; text: string; meter: MeterRecord; retriesUsed: number; reused: boolean }> {
  const spec = effortSpec(args.level);
  const iteration = args.project.iteration;
  const wosDir = workOrdersDir(args.project.id, iteration);
  mkdirSync(wosDir, { recursive: true });
  const suffix = `${args.kind}${args.agentId ? `-${args.agentId}` : ""}`;
  const existingDirs = readdirSync(wosDir).filter((name) => name.endsWith(`-${suffix}`)).sort();
  // v0 resumability is deliberately scoped to governed execution, where
  // immutable Artifact reuse is both necessary and fully proven. Reusing a
  // completed semantic consult/option from a different human relaunch would
  // be stale-context corruption; those kinds await explicit operation-group
  // identity rather than guessing by suffix.
  const resumable = args.kind === "execute" && readdirSync(wosDir).some((name) => {
    const recordPath = abs(wosDir, name, "workorder.json");
    if (!existsSync(recordPath)) return false;
    const record = validateWorkOrderRecord(readJson<unknown>(recordPath), recordPath);
    return record.status === "interrupted" || record.status === "timed-out" || record.status === "error";
  });
  if (resumable) {
    const doneDir = existingDirs.find((name) => {
      const path = abs(wosDir, name, "workorder.json");
      return existsSync(path) && validateWorkOrderRecord(readJson<unknown>(path), path).status === "done";
    });
    if (doneDir) {
      const donePath = abs(wosDir, doneDir);
      const recordPath = abs(donePath, "workorder.json");
      return {
        record: validateWorkOrderRecord(readJson<unknown>(recordPath), recordPath),
        text: readText(abs(donePath, "response.md")),
        meter: readJson<MeterRecord>(abs(donePath, "meter.json")),
        retriesUsed: 0,
        reused: true,
      };
    }
  }
  const restartDir = resumable ? existingDirs.find((name) => {
    const path = abs(wosDir, name, "workorder.json");
    if (!existsSync(path)) return false;
    const status = validateWorkOrderRecord(readJson<unknown>(path), path).status;
    return status === "interrupted" || status === "timed-out" || status === "error";
  }) : undefined;
  const seq = readdirSync(wosDir).length + 1;
  const woId = restartDir ?? `${String(seq).padStart(2, "0")}-${suffix}`;
  const dir = abs(wosDir, woId);
  mkdirSync(dir, { recursive: true });

  writeJson(abs(dir, "manifest.json"), buildManifest(woId, args.ctx));
  writeFileSync(
    abs(dir, "prompt.md"),
    `# system\n\n${args.system}\n\n# context\n\n${args.ctx.text}`,
    "utf8",
  );

  // The application trail (ADR-0020): every GuruSeed that entered this
  // context is recorded on the asset itself, automatically.
  for (const el of args.ctx.elements) {
    if (el.kind !== "expertise") continue;
    recordSeedApplication(el.ref.id, {
      project: args.project.id,
      workOrder: woId,
      ts: nowIso(),
    });
  }

  const activeSlice = args.kind === "slice" ? null : nextProjectSlice(args.project.id);
  const base: Omit<WorkOrderRecord, "status"> = {
    id: woId,
    projectId: args.project.id,
    iteration,
    kind: args.kind,
    agentId: args.agentId,
    ...(activeSlice ? { sliceId: activeSlice.id } : {}),
    model: spec.workerModel,
    effortLevel: args.level,
    createdAt: nowIso(),
  };

  writeJson(abs(dir, "workorder.json"), { ...base, status: "queued" } satisfies WorkOrderRecord);

  let lastError = "";
  for (let attempt = 0; attempt <= spec.retryBudget; attempt++) {
    const t0 = Date.now();
    try {
      writeJson(abs(dir, "workorder.json"), { ...base, status: "running" } satisfies WorkOrderRecord);
      const res = await args.runtime.generate({
        system: args.system,
        prompt: args.ctx.text,
        model: spec.workerModel,
        maxTokens: spec.maxTokens,
        timeoutMs: spec.timeoutMs,
        jobId: `${args.project.id}-it${iteration}-${woId}`,
        kind: args.kind,
      });
      // The runtime call just resolved — real evidence a response exists,
      // fired the instant it is true.
      args.onPhase?.("response-received", woId, args.agentId ?? "");
      const meter: MeterRecord = {
        workOrderId: woId,
        model: `${args.runtime.name}:${spec.workerModel}`,
        requestId: res.usage.requestId,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        cacheCreationInputTokens: res.usage.cacheCreationInputTokens,
        cacheReadInputTokens: res.usage.cacheReadInputTokens,
        timestamp: nowIso(),
        durationMs: Date.now() - t0,
        estimated: res.usage.estimated ?? false,
      };
      args.onMeter?.(meter, args.agentId ?? "");
      writeJson(abs(dir, "meter.json"), meter);
      writeFileSync(abs(dir, "response.md"), res.text, "utf8");
      const record: WorkOrderRecord = { ...base, status: "done" };
      // No onPhase("persisting", ...) here — see the doc comment above.
      // workorder.json is bookkeeping, written unconditionally; the caller
      // fires "persisting" once, for the governed write that actually
      // matters, after it has validated/parsed the text.
      writeJson(abs(dir, "workorder.json"), record);
      return { record, text: res.text, meter, retriesUsed: attempt, reused: false };
    } catch (e) {
      // A cancellation is the Pilot's act, not a failure: it must not burn
      // the retry budget, must not be disguised as "error", and must reach
      // the caller INTACT so no message-substring sniffing is ever needed
      // (ADR-0022 PHASE 1 §4 — the shell's DEVIATION hack retires).
      if (e instanceof OpCancelledError || (e as { name?: string } | null)?.name === "OpCancelledError") {
        const record: WorkOrderRecord = { ...base, status: "interrupted" };
        writeJson(abs(dir, "workorder.json"), record);
        throw e;
      }
      if (e instanceof OpTimeoutError || (e as { name?: string } | null)?.name === "OpTimeoutError") {
        lastError = e instanceof Error ? e.message : String(e);
        if (attempt === spec.retryBudget) {
          const record: WorkOrderRecord = { ...base, status: "timed-out", error: lastError };
          writeJson(abs(dir, "workorder.json"), record);
          throw e;
        }
        continue;
      }
      lastError = e instanceof Error ? e.message : String(e);
    }
  }
  const record: WorkOrderRecord = { ...base, status: "error", error: lastError };
  writeJson(abs(dir, "workorder.json"), record);
  throw new Error(`work order ${woId} failed: ${lastError}`);
}

/**
 * Governed evidence for a Pilot-initiated cancellation (ADR-0022 PHASE 1 §4):
 * the shell may REQUEST a halt, but only the Kernel writes governed evidence.
 * Nothing already completed is touched — interruption preserves work.
 */
export function recordOperationCancelled(projectId: string, op: string, scripted = false): void {
  const project = getProject(projectId);
  appendEvent({
    ts: nowIso(),
    projectId,
    iteration: project.iteration,
    actor: "pilot",
    action: "operation_cancelled",
    note: op,
    scripted,
  });
}

/**
 * The Kernel-owned, append-only record of one operation's real numbers
 * (ADR-0022 PHASE 1 items 3/5) — the shell's Busy record is the live view
 * while an operation runs; this is what survives it. Same append-only
 * pattern as evidence.jsonl (evidence.ts), one project-level sidecar.
 */
export function appendOperationActual(a: OperationActual): void {
  const path = abs(projectDir(a.projectId), "operations.jsonl");
  mkdirSync(projectDir(a.projectId), { recursive: true });
  appendFileSync(path, JSON.stringify(a) + "\n", "utf8");
}

export function readOperationActuals(projectId: string): OperationActual[] {
  const path = abs(projectDir(projectId), "operations.jsonl");
  if (!existsSync(path)) return [];
  // Torn-tail tolerant (ADR-0023 RULE D): a crash mid-append must not make
  // the whole log unreadable — only the last line may be skipped.
  return readJsonl<unknown>(path).map((actual, index) =>
    validateOperationActual(actual, `${path}[${index}]`),
  );
}

// ---------------------------------------------------------------------------
// Context assembly per work-order kind. Required pieces always enter;
// optional pieces respect the effort level's budget (§7).

function baseContext(project: Project, budget: number): ContextBuilder {
  const b = new ContextBuilder(budget);
  const pPath = abs(projectDir(project.id), "project.json");
  b.add({
    kind: "project",
    id: project.id,
    absPath: pPath,
    content:
      `Name: ${project.name}\nIteration: ${project.iteration}\n\n` +
      `The user's founding intent, verbatim:\n\n${project.description}`,
    reason: "the project is the subject of every work order",
    required: true,
  });
  const map = readProjectMap(project.id);
  const slice = map ? nextUnblockedSlice(map) : null;
  if (map && slice) {
    b.add({
      kind: "project-map",
      id: `project-map-v${map.version}`,
      absPath: mapCurrentPath(project.id),
      content: JSON.stringify({
        version: map.version,
        activeSlice: slice,
        dependencies: map.slices.filter((item) => slice.dependsOn.includes(item.id)),
      }, null, 2),
      reason: "the approved Slice bounds this Work Order and its immediate dependencies",
      required: true,
    });
  }
  return b;
}

function addApprovedState(b: ContextBuilder, project: Project, required: boolean): void {
  const approved = readApproved(project.id);
  if (!approved) return;
  b.add({
    kind: "approved-state",
    id: `approved-it${approved.iteration}`,
    absPath: abs(stateDir(project.id), "approved.json"),
    content: JSON.stringify(approved.state, null, 2),
    reason: "the approved Project State is the smallest sufficient account of the project",
    required,
  });
}

function addAnswers(b: ContextBuilder, project: Project, required: boolean): void {
  const answered = readQuestions(project.id).filter((q) => q.status === "answered");
  for (const q of [...answered].reverse()) {
    b.add({
      kind: "answer",
      id: q.id,
      absPath: abs(projectDir(project.id), "questions.json"),
      content: `Q: ${q.text}\nA (from the user): ${q.answer ?? ""}`,
      reason: `the user answered this need (asked by ${q.askedBy.join(", ")})`,
      required,
    });
  }
}

function addPilotNotes(b: ContextBuilder, project: Project): void {
  const notes = pilotNotes(project.id);
  for (const [i, note] of [...notes].reverse().entries()) {
    b.add({
      kind: "pilot-note",
      id: `note-${notes.length - i}`,
      absPath: abs(projectDir(project.id), "evidence.jsonl"),
      content: note,
      reason: "the user's own direction outranks derived context",
      required: false,
    });
  }
}

/**
 * A runtime agent is a composition (FOUNDATION-CORRECTION, ADR-0020 §2):
 * mandate + relevant project context + applicable human intelligence +
 * effort budget. The Seed Resolver selects the admitted GuruSeeds through
 * their owning Senseis — they enter BEFORE other optional elements, because
 * under a tight budget the owner's judgement outranks derived history. Each
 * entry carries the Resolver's reason (and Sensei attribution) into the
 * manifest.
 */
function addExpertise(
  b: ContextBuilder,
  project: Project,
  agentTags: string[],
): ResolvedSeed[] {
  const resolved = resolveSeeds({ projectId: project.id, agentTags });
  for (const r of resolved) {
    b.add({
      kind: "expertise",
      id: r.seed.id,
      absPath: seedYamlPath(r.seed),
      content:
        `${r.seed.title} (GuruSeed v${r.seed.version}, Sensei: ${r.senseiTitle})\n\n` +
        `Rule: ${r.seed.rule}\nWhy: ${r.seed.why}`,
      reason: r.reason,
      required: false,
    });
  }
  return resolved;
}

function addRole(b: ContextBuilder, project: Project, agent: AgentRole): void {
  b.add({
    kind: "agent-role",
    id: agent.id,
    absPath: abs(projectDir(project.id), "roster.json"),
    content:
      `agent-id: ${agent.id}\nTitle: ${agent.title}\nMandate: ${agent.mandate}\n` +
      `Tags: ${agent.tags.join(", ")}`,
    reason: "the bounded mandate this work order runs under",
    required: true,
  });
}

// ---------------------------------------------------------------------------
// System prompts — engine-generic (ADR-0008): no project-domain vocabulary.

const LANG_RULE =
  "Respond in the language of the user's founding intent (the project description).";

const CONVENER_SYSTEM =
  "You are the Kernel's convener inside AgentOS, a governed operating layer " +
  "for turning human intent into iterative work. From the project context, " +
  "propose the smallest sufficient team of bounded specialist agents " +
  "(3 to 5) for this specific project. Each agent gets: id (kebab-case), " +
  "title, mandate (one sentence of bounded responsibility — what it may " +
  "reason about, not more), tags (2-4 keywords). Do not invent work; do not " +
  "pre-answer the project. End with exactly one fenced ```json block: " +
  '{"agents": [{"id", "title", "mandate", "tags"}, ...]}. ' +
  LANG_RULE;

function consultSystem(reconsult: boolean): string {
  return (
    "You are one bounded specialist agent inside AgentOS. You never address " +
    "the user directly — the Kernel mediates everything. Stay strictly inside " +
    "your mandate: inspect the context, state briefly what you understand and " +
    "what you would do next within your mandate, and identify what is missing. " +
    (reconsult
      ? "The user has just answered a question you raised — read the answer, " +
        "update your read, and only ask again if something material is STILL missing. "
      : "") +
    "You may ask at most 3 short questions, and only questions whose answers " +
    "materially improve the next decision or execution — do not interview for " +
    "completeness. Do not decide project direction. Do not produce the final " +
    "work yet. End with exactly one fenced ```json block: " +
    '{"questions": ["...", ...]} (an empty array if nothing material is missing). ' +
    LANG_RULE
  );
}

const SYNTHESIZE_SYSTEM =
  "You are the Kernel of AgentOS building a candidate Project State: the " +
  "smallest sufficient account of the project now — NOT a plan, NOT the work " +
  "itself, NOT the full history. Fold the founding intent, the user's answers " +
  "and the agents' reads into it. Do not invent decisions the user never " +
  "made; unresolved things stay unresolved. End with exactly one fenced " +
  "```json block: {\"objective\", \"phase\", \"approvedDecisions\": [], " +
  '"activeArtifacts": [], "unresolvedQuestions": [], "constraints": [], ' +
  '"nextAction"} — nextAction is the single next meaningful action. ' +
  LANG_RULE;

const EXECUTE_SYSTEM =
  "You are one bounded specialist agent inside AgentOS, executing under an " +
  "approved Project State. Produce the concrete artifact your mandate owes " +
  "toward the state's nextAction — the work itself, not a plan for it, not " +
  "questions about it. Respond with ONLY the artifact content in markdown. " +
  LANG_RULE;

// ---------------------------------------------------------------------------
// Question Needs — collect (4), aggregate & dedupe (5), persist answer (7).

function normalizeQuestion(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function mergeQuestions(
  projectId: string,
  agentId: string,
  texts: string[],
  iteration: number,
): void {
  const questions = readQuestions(projectId);
  let maxId = questions.reduce((n, q) => {
    const m = /^q-(\d+)$/.exec(q.id);
    return m ? Math.max(n, Number(m[1])) : n;
  }, 0);
  for (const text of texts) {
    const key = normalizeQuestion(text);
    if (key === "") continue;
    const hit = questions.find((q) => normalizeQuestion(q.text) === key);
    if (hit) {
      // An answered need never reopens; an open one gains a voice.
      if (hit.status === "open" && !hit.askedBy.includes(agentId)) {
        hit.askedBy.push(agentId);
      }
      continue;
    }
    maxId += 1;
    questions.push({
      id: `q-${maxId}`,
      text: text.trim(),
      askedBy: [agentId],
      iteration,
      status: "open",
    });
  }
  writeQuestions(projectId, questions);
}

// ---------------------------------------------------------------------------
// Project Engine — an internal Kernel mechanism (ADR-0024). The pure graph
// mechanics live in project-engine.ts; only this Kernel boundary may issue a
// Slicer Work Order, persist a Map version or write its evidence.

const SLICER_SYSTEM =
  "You are a temporary Slicer role under an AgentOS Kernel Work Order. " +
  "Propose a compact, domain-neutral Project Map: 3-8 independently governable " +
  "slices, honest dependencies, expected artifacts and material decisions. " +
  "Do not execute work, choose project direction, create child projects, or " +
  "invent domain facts. IDs are stable kebab-case. End with exactly one fenced " +
  "```json block: {\"slices\":[{\"id\",\"title\",\"purpose\",\"parentId\":null," +
  "\"dependsOn\":[],\"expectedArtifacts\":[],\"materialDecisions\":[]}]}. " + LANG_RULE;

function mapCandidatePath(projectId: string): string {
  return abs(stateDir(projectId), "project-map-candidate.json");
}
function mapCurrentPath(projectId: string): string {
  return abs(stateDir(projectId), "project-map.json");
}
function mapVersionPath(projectId: string, version: number): string {
  return abs(stateDir(projectId), "maps", `v${version}.json`);
}

export function readProjectMap(projectId: string): ProjectMap | null {
  const path = mapCurrentPath(projectId);
  return existsSync(path) ? validateProjectMap(validateProjectMapRecord(readJson<unknown>(path), path)) : null;
}

export function readCandidateProjectMap(projectId: string): ProjectMap | null {
  const path = mapCandidatePath(projectId);
  return existsSync(path) ? validateProjectMap(validateProjectMapRecord(readJson<unknown>(path), path)) : null;
}

export async function runProjectSlicer(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<{ candidate: ProjectMap; changes: ProjectMapChange[] }> {
  const project = getProject(args.projectId);
  const spec = effortSpec(args.level);
  const current = readProjectMap(project.id);
  const b = baseContext(project, spec.contextBudgetChars);
  addApprovedState(b, project, false);
  addAnswers(b, project, false);
  addPilotNotes(b, project);
  const ctx = b.build();
  const { record, text } = await runWorkOrder({
    project,
    kind: "slice",
    agentId: null,
    system: SLICER_SYSTEM,
    ctx,
    level: args.level,
    runtime: args.runtime,
    ...phaseCallbacks(args.onPhase, args.onMeter),
  });
  args.onPhase?.("validating-parsing", record.id, "");
  const candidate = candidateProjectMapFromText({
    text,
    projectId: project.id,
    projectIteration: project.iteration,
    priorMapVersion: current?.version ?? null,
    workOrderId: record.id,
  });
  args.onPhase?.("persisting", record.id, "");
  writeJson(mapCandidatePath(project.id), candidate);
  event(project, "kernel", "project_map_proposed", args.scripted ?? false, {
    workOrderId: record.id,
    note: `${candidate.slices.length} slices; ${compareProjectMaps(current, candidate).length} material changes`,
  });
  return { candidate, changes: compareProjectMaps(current, candidate) };
}

function persistApprovedMap(
  project: Project,
  map: ProjectMap,
  action: "project_map_approved" | "project_slice_transitioned",
  note: string,
  scripted: boolean,
): ProjectMap {
  const approvedState = readApproved(project.id);
  if (!approvedState) throw new Error("approve Project State before making a Project Map authoritative");
  approvedState.state.projectMap = {
    version: map.version,
    path: `state/maps/v${map.version}.json`,
  };
  const currentPath = mapCurrentPath(project.id);
  const historyPath = mapVersionPath(project.id, map.version);
  const approvedPath = abs(stateDir(project.id), "approved.json");
  const evidencePath = abs(projectDir(project.id), "evidence.jsonl");
  withTransition(workspaceRoot(), `${action}-${project.id}-v${map.version}`, [currentPath, historyPath, approvedPath, evidencePath], () => {
    writeArtifactOnce(historyPath, JSON.stringify(map, null, 2) + "\n");
    writeJson(currentPath, map);
    writeJson(approvedPath, approvedState);
    event(project, action === "project_map_approved" ? "pilot" : "kernel", action, scripted, { note });
  });
  return map;
}

export function approveCandidateProjectMap(
  projectId: string,
  expectedCurrentVersion: number | null,
  scripted = false,
): ProjectMap {
  const project = getProject(projectId);
  const current = readProjectMap(projectId);
  if ((current?.version ?? null) !== expectedCurrentVersion) {
    throw new Error(`Project Map conflict: expected ${expectedCurrentVersion ?? "none"}, current is ${current?.version ?? "none"}`);
  }
  const candidate = readCandidateProjectMap(projectId);
  if (!candidate) throw new Error("no Candidate Project Map awaiting approval");
  if (candidate.basedOn.priorMapVersion !== expectedCurrentVersion) throw new Error("Candidate Project Map was built from a stale version");
  const approved = normalizeProjectMap({ ...candidate, status: "approved", approvedAt: nowIso() });
  return persistApprovedMap(project, approved, "project_map_approved", `${approved.slices.length} slices approved`, scripted);
}

export function moveProjectSlice(args: {
  projectId: string;
  sliceId: string;
  to: Extract<ProjectSliceStatus, "ready" | "active" | "done" | "abandoned">;
  expectedMapVersion: number;
  reason?: string;
  scripted?: boolean;
}): ProjectMap {
  const project = getProject(args.projectId);
  const current = readProjectMap(project.id);
  if (!current) throw new Error("project has no approved Project Map");
  if (current.version !== args.expectedMapVersion) throw new Error(`Project Map conflict: expected v${args.expectedMapVersion}, current is v${current.version}`);
  const next = transitionProjectSlice({ map: current, sliceId: args.sliceId, to: args.to, ...(args.reason ? { reason: args.reason } : {}) });
  return persistApprovedMap(project, next, "project_slice_transitioned", `${args.sliceId}: ${args.to}${args.reason ? ` — ${args.reason}` : ""}`, args.scripted ?? false);
}

export function nextProjectSlice(projectId: string): ReturnType<typeof nextUnblockedSlice> {
  const map = readProjectMap(projectId);
  return map ? nextUnblockedSlice(map) : null;
}

// ---------------------------------------------------------------------------
// Steps 2–5 — convene the roster (once) and consult every agent through the
// runtime; their Question Needs aggregate into the single visible interview.

export async function runConsult(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<{ consulted: string[]; newQuestions: number }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const spec = effortSpec(args.level);

  let roster = readRoster(project.id);
  if (!roster) {
    const b = baseContext(project, spec.contextBudgetChars);
    addPilotNotes(b, project);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "roster",
      agentId: null,
      system: CONVENER_SYSTEM,
      ctx,
      level: args.level,
      runtime: args.runtime,
      ...phaseCallbacks(args.onPhase, args.onMeter),
    });
    // The actual parsing starts now — fired here, not inside runWorkOrder,
    // because this IS where rosterFrom(text) runs.
    args.onPhase?.("validating-parsing", record.id, "");
    const agents = rosterFrom(text);
    if (!agents) {
      throw new Error(
        `roster work order ${record.id} returned no parseable {"agents": [...]} block`,
      );
    }
    roster = { agents, workOrderId: record.id };
    args.onPhase?.("persisting", record.id, "");
    writeJson(abs(projectDir(project.id), "roster.json"), roster);
    event(project, "kernel", "roster_ready", scripted, {
      workOrderId: record.id,
      note: agents.map((a) => a.id).join(", "),
    });
  }

  const before = readQuestions(project.id).length;
  const table = roster.agents.slice(0, spec.maxAgents);
  const consulted: string[] = [];
  for (const agent of table) {
    const b = baseContext(project, spec.contextBudgetChars);
    addRole(b, project, agent);
    addApprovedState(b, project, true);
    addExpertise(b, project, agent.tags);
    addAnswers(b, project, false);
    addPilotNotes(b, project);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "consult",
      agentId: agent.id,
      system: consultSystem(false),
      ctx,
      level: args.level,
      runtime: args.runtime,
      ...phaseCallbacks(args.onPhase, args.onMeter),
    });
    args.onPhase?.("validating-parsing", record.id, agent.id);
    const consultQs = questionsFrom(text);
    args.onPhase?.("persisting", record.id, agent.id);
    mergeQuestions(project.id, agent.id, consultQs, project.iteration);
    consulted.push(agent.id);
    event(project, "kernel", "consulted", scripted, {
      workOrderId: record.id,
      agentId: agent.id,
    });
  }
  return { consulted, newQuestions: readQuestions(project.id).length - before };
}

// ---------------------------------------------------------------------------
// Steps 7–8 — persist the user's answer, then automatically re-consult the
// agents that raised the need. Movement, not authority: effort is clamped.

export async function answerQuestion(args: {
  projectId: string;
  questionId: string;
  answer: string;
  runtime: Runtime;
  scripted?: boolean;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<{ reconsulted: string[] }> {
  return answerQuestions({
    projectId: args.projectId,
    answers: [{ questionId: args.questionId, answer: args.answer }],
    runtime: args.runtime,
    ...(args.scripted !== undefined ? { scripted: args.scripted } : {}),
    ...phaseCallbacks(args.onPhase, args.onMeter),
  });
}

export async function answerQuestions(args: {
  projectId: string;
  answers: { questionId: string; answer: string }[];
  runtime: Runtime;
  scripted?: boolean;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<{ reconsulted: string[] }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const questions = readQuestions(project.id);
  const answered: QuestionNeed[] = [];
  for (const item of args.answers) {
    const q = questions.find((x) => x.id === item.questionId);
    if (!q) throw new Error(`unknown question ${item.questionId}`);
    if (q.status !== "open") throw new Error(`question ${q.id} is not open`);
    if (!item.answer.trim()) throw new Error(`answer for ${q.id} is empty`);
    q.status = "answered";
    q.answer = item.answer.trim();
    q.answeredAt = nowIso();
    answered.push(q);
  }
  writeQuestions(project.id, questions);
  for (const q of answered) event(project, "pilot", "question_answered", scripted, { questionId: q.id });

  // Automatic re-consult of the agents whose need this was (§8) — internal
  // movement runs at the Pilot's standing "questions" effort (ponto D): his
  // explicit profile choice, not the automation clamp.
  const level = phaseEffort(project, "questions");
  const spec = effortSpec(level);
  const roster = readRoster(project.id);
  const reconsulted: string[] = [];
  const agents = [...new Set(answered.flatMap((question) => question.askedBy))];
  for (const agentId of agents) {
    const agent = roster?.agents.find((a) => a.id === agentId);
    if (!agent) continue;
    const b = baseContext(project, spec.contextBudgetChars);
    addRole(b, project, agent);
    const agentAnswers = answered.filter((question) => question.askedBy.includes(agentId));
    b.add({
      kind: "answer",
      id: `batch-${agentAnswers.map((question) => question.id).join("-")}`,
      absPath: abs(projectDir(project.id), "questions.json"),
      content: agentAnswers.map((question) => `Q (yours): ${question.text}\nA (from the user): ${question.answer}`).join("\n\n"),
      reason: "the coherent answer batch that triggered this single re-consultation",
      required: true,
    });
    addApprovedState(b, project, false);
    addExpertise(b, project, agent.tags);
    addAnswers(b, project, false);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "reconsult",
      agentId: agent.id,
      system: consultSystem(true),
      ctx,
      level,
      runtime: args.runtime,
      ...phaseCallbacks(args.onPhase, args.onMeter),
    });
    args.onPhase?.("validating-parsing", record.id, agent.id);
    const reconsultQs = questionsFrom(text);
    args.onPhase?.("persisting", record.id, agent.id);
    mergeQuestions(project.id, agent.id, reconsultQs, project.iteration);
    reconsulted.push(agent.id);
    event(project, "kernel", "reconsulted", scripted, {
      workOrderId: record.id,
      agentId: agent.id,
      questionId: agentAnswers.map((question) => question.id).join(","),
    });
  }
  return { reconsulted };
}

/**
 * ADR-0020 §3 — the Pilot may declare context sufficient at any time; it is
 * a first-class governance act, not a shortcut. Every open question is
 * DEFERRED — kept on file, never silently dropped — and the loop moves on;
 * the candidate build carries the deferred needs as explicit unresolved
 * matter the user can inspect and overturn.
 */
export function declareContextSufficient(
  projectId: string,
  note?: string,
  scripted = false,
): number {
  const project = getProject(projectId);
  const questions = readQuestions(project.id);
  let deferred = 0;
  for (const q of questions) {
    if (q.status !== "open") continue;
    q.status = "deferred";
    deferred += 1;
  }
  writeQuestions(project.id, questions);
  event(project, "pilot", "context_sufficient", scripted, {
    note:
      (note?.trim() ? `${note.trim()} — ` : "") +
      `${deferred} pergunta(s) adiada(s) pela minha mão`,
  });
  return deferred;
}

/**
 * The mirror of declareContextSufficient — governed back-and-forth (ADR-0022
 * decision 14): the Pilot returns to Compreender by REOPENING his deferred
 * questions. A pure data move: zero tokens, zero Work Orders, zero model
 * calls — navigation never spends; only new consults do.
 */
export function reopenDeferredQuestions(projectId: string, scripted = false): number {
  const project = getProject(projectId);
  const questions = readQuestions(project.id);
  let reopened = 0;
  for (const q of questions) {
    if (q.status !== "deferred") continue;
    q.status = "open";
    reopened += 1;
  }
  if (reopened > 0) {
    writeQuestions(project.id, questions);
    event(project, "pilot", "questions_reopened", scripted, {
      note: `${reopened} pergunta(s) adiada(s) reaberta(s) pela minha mão — voltar a Compreender`,
    });
  }
  return reopened;
}

// ---------------------------------------------------------------------------
// Step 9 — build the candidate Project State.

export async function runCandidate(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<CandidateState> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const spec = effortSpec(args.level);
  const roster = readRoster(project.id);
  if (!roster) throw new Error("no roster yet — consult first");

  const b = baseContext(project, spec.contextBudgetChars);
  b.add({
    kind: "roster",
    id: "roster",
    absPath: abs(projectDir(project.id), "roster.json"),
    content: roster.agents.map((a) => `- ${a.id} (${a.title}): ${a.mandate}`).join("\n"),
    reason: "who deliberated — the candidate folds their reads",
    required: true,
  });
  addApprovedState(b, project, true);
  addExpertise(b, project, []);
  addAnswers(b, project, true);
  // ADR-0020 §3: deferred needs stay visible — the candidate must record
  // them as unresolved, never assume answers the user chose not to give.
  const deferredQs = readQuestions(project.id).filter((q) => q.status === "deferred");
  if (deferredQs.length > 0) {
    b.add({
      kind: "pilot-note",
      id: "context-sufficient",
      absPath: abs(projectDir(project.id), "questions.json"),
      content:
        "The user declared the context sufficient. These questions remain " +
        "deliberately unanswered — list them as unresolved; assume nothing:\n" +
        deferredQs.map((q) => `- ${q.text}`).join("\n"),
      reason: "ADR-0020 §3 — deferred questions stay visible, never silently dropped",
      required: true,
    });
  }
  // Decided Decision Surfaces are authoritative direction (steps 9-10 of the
  // interaction-model slice): the candidate folds every selection, with its
  // refinement lineage visible.
  for (const ds of readSurfaces(project.id).filter((d) => d.status === "decided")) {
    const sel = ds.options.find(
      (o) => o.id === ds.selected?.optionId && o.version === ds.selected?.version,
    );
    if (!sel) continue;
    b.add({
      kind: "pilot-note",
      id: ds.id,
      absPath: abs(projectDir(project.id), "decisions", `${ds.id}.json`),
      content:
        `Governed decision (${ds.id}): ${ds.decision}\n` +
        `The user selected: ${sel.title} — ${sel.direction}\n${sel.description}` +
        (sel.refinement ? `\nWith the user's refinement: ${sel.refinement}` : ""),
      reason: "a decided Decision Surface is authoritative direction",
      required: true,
    });
  }
  const prev = readCandidate(project.id);
  if (prev?.status === "rejected" && prev.rejectionNote) {
    b.add({
      kind: "pilot-note",
      id: "rejection-note",
      absPath: abs(stateDir(project.id), "candidate.json"),
      content: `The user rejected the previous candidate state with this direction:\n${prev.rejectionNote}`,
      reason: "the user's rejection is the strongest signal the rebuild has",
      required: true,
    });
  }
  // The agents' latest reads, newest first, under the optional budget.
  const wos = readWorkOrders(project.id, project.iteration)
    .filter((w) => (w.kind === "consult" || w.kind === "reconsult") && w.status === "done")
    .reverse();
  const seen = new Set<string>();
  for (const w of wos) {
    if (!w.agentId || seen.has(w.agentId)) continue;
    seen.add(w.agentId);
    const respPath = abs(workOrdersDir(project.id, project.iteration), w.id, "response.md");
    if (!existsSync(respPath)) continue;
    b.add({
      kind: "prior-response",
      id: `${w.id}-response`,
      absPath: respPath,
      content: readText(respPath),
      reason: `the latest read from agent ${w.agentId} this iteration`,
      required: false,
    });
  }
  addPilotNotes(b, project);

  const ctx = b.build();
  const { record, text } = await runWorkOrder({
    project,
    kind: "synthesize",
    agentId: null,
    system: SYNTHESIZE_SYSTEM,
    ctx,
    level: args.level,
    runtime: args.runtime,
    ...phaseCallbacks(args.onPhase, args.onMeter),
  });
  args.onPhase?.("validating-parsing", record.id, "");
  const state = stateFrom(text);
  if (!state) {
    throw new Error(`synthesize work order ${record.id} returned no parseable state block`);
  }
  const candidate: CandidateState = {
    iteration: project.iteration,
    builtAt: nowIso(),
    workOrderId: record.id,
    state,
    status: "candidate",
  };
  args.onPhase?.("persisting", record.id, "");
  writeJson(abs(stateDir(project.id), "candidate.json"), candidate);
  event(project, "kernel", "candidate_built", scripted, { workOrderId: record.id });
  return candidate;
}

// ---------------------------------------------------------------------------
// Step 10 — the Pilot approves (or rejects, with direction).

export function decideCandidate(
  projectId: string,
  decision: "approve" | "reject",
  note?: string,
  scripted = false,
): void {
  const project = getProject(projectId);
  const candidate = readCandidate(projectId);
  if (!candidate || candidate.status !== "candidate") {
    throw new Error("no candidate state awaiting a decision");
  }
  candidate.decidedAt = nowIso();
  if (decision === "approve") {
    candidate.status = "approved";
    const approved: ApprovedState = {
      iteration: candidate.iteration,
      approvedAt: candidate.decidedAt,
      state: candidate.state,
    };
    const approvedPath = abs(stateDir(projectId), "approved.json");
    const historyPath = abs(stateDir(projectId), "history", `approved-it${candidate.iteration}.json`);
    const candidatePath = abs(stateDir(projectId), "candidate.json");
    const evidencePath = abs(projectDir(projectId), "evidence.jsonl");
    withTransition(workspaceRoot(), `approve-state-${projectId}-${candidate.iteration}`, [approvedPath, historyPath, candidatePath, evidencePath], () => {
      writeJson(approvedPath, approved);
      writeJson(historyPath, approved);
      event(project, "pilot", "state_approved", scripted, {});
      writeJson(candidatePath, candidate);
    });
  } else {
    candidate.status = "rejected";
    if (note) candidate.rejectionNote = note;
    const candidatePath = abs(stateDir(projectId), "candidate.json");
    const evidencePath = abs(projectDir(projectId), "evidence.jsonl");
    withTransition(workspaceRoot(), `reject-state-${projectId}-${candidate.iteration}`, [candidatePath, evidencePath], () => {
      event(project, "pilot", "state_rejected", scripted, note ? { note } : {});
      writeJson(candidatePath, candidate);
    });
  }
}

// ---------------------------------------------------------------------------
// Governed back-and-forth across the WHOLE journey (ADR-0022, decision 14):
// every step back is a pure data move — zero tokens, zero Work Orders — with
// governed evidence. Nothing is deleted: candidates withdraw, approvals move
// aside into history, open decisions are set aside. stageOf re-derives the
// stage; the past stays on file, always.

/** Aprovar → back: the pending proposal leaves the table (kept on file). */
export function withdrawCandidate(projectId: string, scripted = false): void {
  const project = getProject(projectId);
  const candidate = readCandidate(projectId);
  if (!candidate || candidate.iteration !== project.iteration || candidate.status !== "candidate") {
    throw new Error("nenhuma proposta pendente para retirar");
  }
  candidate.status = "withdrawn";
  candidate.decidedAt = nowIso();
  const candidatePath = abs(stateDir(projectId), "candidate.json");
  const evidencePath = abs(projectDir(projectId), "evidence.jsonl");
  withTransition(workspaceRoot(), `withdraw-candidate-${projectId}-${candidate.iteration}`, [candidatePath, evidencePath], () => {
    event(project, "pilot", "candidate_withdrawn", scripted, {
      note: "proposta retirada pela minha mão — voltar atrás; nada se perde",
    });
    writeJson(candidatePath, candidate);
  });
}

/**
 * Criar → back: reopen this iteration's approval BEFORE anything was
 * executed. The approved snapshot moves aside into history (never deleted);
 * an earlier iteration's approval is restored when history holds one.
 */
export function revokeApproval(projectId: string, scripted = false): void {
  const project = getProject(projectId);
  const candidate = readCandidate(projectId);
  if (!candidate || candidate.iteration !== project.iteration || candidate.status !== "approved") {
    throw new Error("nenhuma aprovação desta passagem para reabrir");
  }
  if (listArtifacts(projectId).some((a) => a.iteration === project.iteration)) {
    throw new Error(
      "a execução já devolveu artefactos nesta passagem — avalia e melhora na próxima passagem em vez de reabrir a aprovação",
    );
  }
  const approvedPath = abs(stateDir(projectId), "approved.json");
  const historyDir = abs(stateDir(projectId), "history");
  // Preserve the revoked snapshot, then restore the most recent EARLIER
  // approval if history holds one (approvals older than the history
  // mechanism have no snapshot — then the honest state is "none approved").
  const revokedKeep = abs(historyDir, `approved-it${candidate.iteration}-revoked-${Date.now().toString(36)}.json`);
  let restored: ApprovedState | null = null;
  if (existsSync(historyDir)) {
    const prior = readdirSync(historyDir)
      .map((name) => /^approved-it(\d+)\.json$/.exec(name))
      .filter((m): m is RegExpExecArray => m !== null)
      .map((m) => Number(m[1]))
      .filter((it) => it < candidate.iteration)
      .sort((a, b) => b - a)[0];
    if (prior !== undefined) {
      restored = validateApprovedState(readJson<unknown>(abs(historyDir, `approved-it${prior}.json`)));
    }
  }
  candidate.status = "candidate";
  delete candidate.decidedAt;
  const candidatePath = abs(stateDir(projectId), "candidate.json");
  const evidencePath = abs(projectDir(projectId), "evidence.jsonl");
  withTransition(workspaceRoot(), `revoke-approval-${projectId}-${candidate.iteration}`, [approvedPath, revokedKeep, candidatePath, evidencePath], () => {
    if (existsSync(approvedPath)) {
      writeJson(revokedKeep, readJson<unknown>(approvedPath));
      unlinkSync(approvedPath);
    }
    if (restored) writeJson(approvedPath, restored);
    event(project, "pilot", "approval_revoked", scripted, {
      note: restored
        ? `aprovação da passagem ${candidate.iteration} reaberta pela minha mão — vale de novo a da passagem ${restored.iteration}`
        : `aprovação da passagem ${candidate.iteration} reaberta pela minha mão — nenhum estado aprovado fica em vigor`,
    });
    writeJson(candidatePath, candidate);
  });
}

/**
 * Decidir → back: set the open Decision Surface aside without choosing.
 * If a routed question created it, that question reopens — nothing strands.
 */
export function setAsideOpenSurface(projectId: string, scripted = false): void {
  const project = getProject(projectId);
  const ds = openSurface(projectId);
  if (!ds) throw new Error("nenhuma decisão aberta para pôr de lado");
  ds.status = "dismissed";
  let reopenedQuestion = false;
  if (ds.sourceQuestionId) {
    const questions = readQuestions(projectId);
    const q = questions.find((item) => item.id === ds.sourceQuestionId);
    if (q && q.status === "routed") {
      q.status = "open";
      writeQuestions(projectId, questions);
      reopenedQuestion = true;
    }
  }
  writeSurface(ds);
  event(project, "pilot", "decision_dismissed", scripted, {
    note:
      `decisão "${ds.decision.slice(0, 80)}" posta de lado pela minha mão — as opções ficam no registo` +
      (reopenedQuestion ? "; a pergunta que a originou voltou a abrir" : ""),
  });
}

// The journey bar's back-navigation composes the four acts above; it adds no
// mechanics and no evidence of its own (ADR-0022 §4: mechanism, never a
// second orchestrator — every act below still speaks with its own voice).

export type BackTarget = "interview" | "candidate" | "approve";

export type BackStep =
  | { act: "dismiss_surface"; lands: Stage }
  | { act: "withdraw_candidate"; lands: Stage }
  | { act: "revoke_approval"; lands: Stage }
  | { act: "reopen_questions"; count: number; lands: Stage };

export type BackPlan = { ok: true; steps: BackStep[] } | { ok: false; why: string };

/** How far back each stage sits on the journey; fractions keep decide a half
 *  step ahead of candidate (same bar step, dismiss walks between them). */
const BACK_RANK: Record<Stage, number> = {
  consult: 1, interview: 1, candidate: 2, decide: 2.5, approve: 3, execute: 4, advance: 5,
};
const TARGET_RANK: Record<BackTarget, number> = { interview: 1, candidate: 2, approve: 3 };

/**
 * Plan the chain of governed acts that walks the project BACK to `target`
 * (ADR-0022 decision 14). One truth, two consumers: the journey bar paints
 * its clickable steps from this plan, and stepBackTo refuses to start unless
 * the WHOLE path is clear — a blocked chain fails before the first act,
 * never midway. Reads only; changes nothing.
 */
export function planStepsBack(projectId: string, target: BackTarget): BackPlan {
  let stage = stageOf(projectId);
  if (stage === "advance") {
    return {
      ok: false,
      why: "a execução já devolveu artefactos nesta passagem — avalia e melhora na próxima passagem",
    };
  }
  if (stage === target) return { ok: false, why: "já estás nesse passo" };
  if (TARGET_RANK[target] >= BACK_RANK[stage]) {
    return { ok: false, why: "andar para a frente é pelos cartões, não pela barra" };
  }
  const steps: BackStep[] = [];
  for (let hops = 0; stage !== target; hops += 1) {
    if (hops > 4) return { ok: false, why: `sem caminho de volta a partir de ${stage}` };
    if (BACK_RANK[stage] < TARGET_RANK[target]) {
      return {
        ok: false,
        why: "pôr a decisão de lado reabre a pergunta que a originou — o caminho de volta passa por Compreender",
      };
    }
    if (stage === "execute") {
      steps.push({ act: "revoke_approval", lands: "approve" });
      stage = "approve";
    } else if (stage === "approve") {
      steps.push({ act: "withdraw_candidate", lands: "candidate" });
      stage = "candidate";
    } else if (stage === "decide") {
      const ds = openSurface(projectId);
      const reopensSource = ds?.sourceQuestionId
        ? readQuestions(projectId).some((q) => q.id === ds.sourceQuestionId && q.status === "routed")
        : false;
      stage = reopensSource ? "interview" : "candidate";
      steps.push({ act: "dismiss_surface", lands: stage });
    } else if (stage === "candidate") {
      const deferred = readQuestions(projectId).filter((q) => q.status === "deferred").length;
      if (deferred === 0) {
        return {
          ok: false,
          why: "não há perguntas adiadas para reabrir — Compreender não tem nada a devolver",
        };
      }
      steps.push({ act: "reopen_questions", count: deferred, lands: "interview" });
      stage = "interview";
    } else {
      return { ok: false, why: `sem caminho de volta a partir de ${stage}` };
    }
  }
  return { ok: true, steps };
}

/**
 * Execute a planned walk back to `target`: each step calls the governed act
 * it names and leaves that act's own evidence — zero tokens, zero Work
 * Orders. Throws before touching anything when the path is blocked.
 */
export function stepBackTo(projectId: string, target: BackTarget, scripted = false): BackStep[] {
  const plan = planStepsBack(projectId, target);
  if (!plan.ok) throw new Error(plan.why);
  for (const step of plan.steps) {
    if (step.act === "revoke_approval") revokeApproval(projectId, scripted);
    else if (step.act === "withdraw_candidate") withdrawCandidate(projectId, scripted);
    else if (step.act === "dismiss_surface") setAsideOpenSurface(projectId, scripted);
    else reopenDeferredQuestions(projectId, scripted);
    const landed = stageOf(projectId);
    if (landed !== step.lands) {
      throw new Error(
        `o passo ${step.act} aterrou em ${landed}, não em ${step.lands} — caminho interrompido a caminho de ${target}`,
      );
    }
  }
  return plan.steps;
}

// ---------------------------------------------------------------------------
// Steps 11–12 — governed execution at the Pilot's chosen effort; artifacts
// return automatically into the project workspace.

export async function runExecute(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<{ artifacts: string[]; meters: MeterRecord[]; retriesUsed: number }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const spec = effortSpec(args.level);
  const approved = readApproved(project.id);
  if (!approved) throw new Error("no approved Project State — approval precedes execution");
  const roster = readRoster(project.id);
  if (!roster) throw new Error("no roster — consult precedes execution");

  event(project, "pilot", "execution_started", scripted, { effortLevel: args.level });

  const table = roster.agents.slice(0, spec.maxAgents);
  const artifacts: string[] = [];
  const meters: MeterRecord[] = [];
  let retriesUsed = 0;
  for (const agent of table) {
    const b = baseContext(project, spec.contextBudgetChars);
    addRole(b, project, agent);
    addApprovedState(b, project, true);
    const applied = addExpertise(b, project, agent.tags);
    addAnswers(b, project, false);
    for (const a of listArtifacts(project.id).reverse()) {
      b.add({
        kind: "artifact",
        id: `it${a.iteration}-${a.agentId}`,
        absPath: a.path,
        content: readText(a.path),
        reason: "a prior returned artifact — execution builds on what exists",
        required: false,
      });
    }
    addPilotNotes(b, project);
    const ctx = b.build();
    const { record, text, meter, retriesUsed: r, reused } = await runWorkOrder({
      project,
      kind: "execute",
      agentId: agent.id,
      system: EXECUTE_SYSTEM,
      ctx,
      level: args.level,
      runtime: args.runtime,
      ...phaseCallbacks(args.onPhase, args.onMeter),
    });
    retriesUsed += r;
    if (!reused) meters.push(meter);
    const artifactPath = abs(artifactsDir(project.id, project.iteration), `${agent.id}.md`);
    const provenancePath = abs(artifactsDir(project.id, project.iteration), `${agent.id}.provenance.json`);
    if (reused && existsSync(artifactPath) && existsSync(provenancePath)) {
      artifacts.push(artifactPath);
      continue;
    }
    // No "validating-parsing" here — EXECUTE_SYSTEM returns the artifact
    // verbatim, nothing is parsed. What follows (the artifact + provenance
    // writes below) is real additional persistence beyond runWorkOrder's own
    // workorder.json, so "persisting" fires again, honestly, right before it.
    args.onPhase?.("persisting", record.id, agent.id);
    // Provenance by reference, on the artifact itself (gap audit): which
    // human judgement shaped this output, at which version, and why it was
    // selected — the artifact text stays byte-faithful, the sidecar declares.
    // Hashes of artifact, manifest and each seed's content (parecer
    // 2026-07-12) make the declaration verifiable, not just legible.
    const manifestPath = abs(
      workOrdersDir(project.id, project.iteration),
      record.id,
      "manifest.json",
    );
    const provenance: ArtifactProvenance = {
      workOrderId: record.id,
      agentId: agent.id,
      iteration: project.iteration,
      effortLevel: record.effortLevel,
      model: record.model,
      artifactSha256: sha256(text),
      manifestSha256: sha256(readText(manifestPath)),
      seeds: applied.map((r) => ({
        id: r.seed.id,
        version: r.seed.version,
        contentHash: r.seed.content_hash ?? seedContentHash(r.seed),
        title: r.seed.title,
        reason: r.reason,
        senseiId: r.senseiId,
        senseiTitle: r.senseiTitle,
      })),
    };
    const evidencePath = abs(projectDir(project.id), "evidence.jsonl");
    withTransition(workspaceRoot(), `return-artifact-${project.id}-${project.iteration}-${agent.id}`, [artifactPath, provenancePath, evidencePath], () => {
      writeArtifactOnce(artifactPath, text);
      writeJson(provenancePath, provenance);
      event(project, "kernel", "artifact_returned", scripted, {
        workOrderId: record.id,
        agentId: agent.id,
      });
    });
    artifacts.push(artifactPath);
  }
  return { artifacts, meters, retriesUsed };
}

// ---------------------------------------------------------------------------
// Step 13 — advance the iteration; the loop repeats with the approved state
// in every future context.

export function advanceIteration(projectId: string, scripted = false): Project {
  const project = getProject(projectId);
  const advanced: Project = { ...project, iteration: project.iteration + 1 };
  writeJson(abs(projectDir(projectId), "project.json"), advanced);
  event(advanced, "pilot", "iteration_advanced", scripted, {
    note: `it-${project.iteration} -> it-${advanced.iteration}`,
  });
  return advanced;
}

// ---------------------------------------------------------------------------
// Project lifecycle (parecer 2026-07-12): the production loop existed but the
// project's whole life did not. Concluding is a governed act — confirm the
// result, review pending candidate seeds, freeze and archive; NEVER delete.
// Reopening is equally governed and leaves evidence.

export function concludeProject(projectId: string, note?: string, scripted = false): Project {
  const project = getProject(projectId);
  if ((project.status ?? "active") === "concluded") return project;
  const concluded: Project = {
    ...project,
    status: "concluded",
    concludedAt: nowIso(),
    ...(note?.trim() ? { concludedNote: note.trim() } : {}),
  };
  writeJson(abs(projectDir(projectId), "project.json"), concluded);
  event(concluded, "pilot", "project_concluded", scripted, {
    ...(note?.trim() ? { note: note.trim() } : {}),
  });
  return concluded;
}

export function reopenProject(projectId: string, scripted = false): Project {
  const project = getProject(projectId);
  if ((project.status ?? "active") !== "concluded") return project;
  const reopened: Project = { ...project, status: "active" };
  delete reopened.concludedAt;
  writeJson(abs(projectDir(projectId), "project.json"), reopened);
  event(reopened, "pilot", "project_reopened", scripted, {});
  return reopened;
}

// ---------------------------------------------------------------------------
// Human Intelligence governance (ADR-0020): store transitions live in hi.ts;
// these wrappers add what governance requires — the evidence event, pilot
// actor, always. The Kernel schedules seeds; only the user admits them.

export function addCandidateSeedGoverned(
  projectId: string,
  args: {
    title: string;
    rule: string;
    why: string;
    domains: string[];
    projectLocal: boolean;
    provenanceNote: string;
    /** The Sensei this seed is proposed for (ponto A) — admission confirms. */
    sensei?: string;
  },
  scripted = false,
): GuruSeed {
  const project = getProject(projectId);
  const seed = addCandidateSeed({
    title: args.title,
    rule: args.rule,
    why: args.why,
    domains: args.domains,
    projects: args.projectLocal ? [projectId] : [],
    origin: "taught",
    provenanceNote: args.provenanceNote,
    sourceProject: projectId,
    ...(args.sensei ? { sensei: args.sensei } : {}),
  });
  event(project, "pilot", "seed_candidate_added", scripted, {
    seedId: seed.id,
    note: seed.title,
  });
  return seed;
}

export function decideSeedGoverned(
  projectId: string,
  seedId: string,
  decision: "admit" | "reject",
  editedRule?: string,
  scripted = false,
  senseiId?: string,
): void {
  const project = getProject(projectId);
  if (decision === "admit") {
    const seed = admitSeed(seedId, editedRule, senseiId);
    event(project, "pilot", "seed_admitted", scripted, {
      seedId,
      note: `${seed.title} → Sensei ${seed.sensei ?? "?"}`,
    });
  } else {
    rejectSeed(seedId);
    event(project, "pilot", "seed_rejected", scripted, { seedId });
  }
}

export function saveSenseiGoverned(
  projectId: string,
  args: {
    id?: string;
    title: string;
    persona: string;
    domains: string[];
    seedIds: string[];
    selectionNotes: string[];
  },
  scripted = false,
): Sensei {
  const project = getProject(projectId);
  const sensei = saveSensei(args);
  event(project, "pilot", "sensei_saved", scripted, {
    note: `${sensei.title} (v${sensei.version}, ${sensei.seeds.length} seeds, domínios [${sensei.domains.join(", ")}])`,
  });
  return sensei;
}

/**
 * The user's verdict on a seed in use, returning to the asset (ADR-0020,
 * Consequences: "the Pilot evaluates → evidence returns to the seed").
 * Explicit governance only — nothing is ever inferred from silence.
 */
export function recordSeedEvidenceGoverned(
  projectId: string,
  seedId: string,
  kind: "supporting" | "contradicting",
  note: string,
  scripted = false,
): GuruSeed {
  const project = getProject(projectId);
  const seed = recordSeedEvidence(seedId, { kind, note, project: projectId });
  event(project, "pilot", "seed_evidence", scripted, {
    seedId,
    note: `${kind === "supporting" ? "reforçou" : "contradisse"}: ${note}`,
  });
  return seed;
}

/**
 * The Pilot's hand: revise an admitted seed's content. Versioned, never in
 * place — the previous version stays recoverable forever (parecer 2026-07-12).
 */
export function reviseSeedGoverned(
  projectId: string,
  seedId: string,
  changes: { title?: string; rule?: string; why?: string },
  scripted = false,
): GuruSeed {
  const project = getProject(projectId);
  const seed = reviseSeed(seedId, changes);
  event(project, "pilot", "seed_revised", scripted, {
    seedId,
    note: `${seed.title} → v${seed.version}`,
  });
  return seed;
}

// ---------------------------------------------------------------------------
// The Decision Surface (GOVERNANCE-INTERACTION-MODEL, ADR-0020 §5): the
// Kernel chews the problem — resolves expertise, convenes distinct voices,
// compares consequences — and surfaces one consequential choice with
// genuinely distinct options, a recommendation, and refinement capability.
// Options are versioned; originals are never overwritten; the whole lineage
// is evidence.

const OPTION_LETTERS = ["a", "b", "c", "d"] as const;

const GENERIC_ANGLES: { id: string; hint: string }[] = [
  { id: "economico", hint: "the most economical honest path — smallest effort that truly serves the intent" },
  { id: "arrojado", hint: "the boldest, most distinctive path — what makes this unmistakably itself" },
  { id: "seguro", hint: "the safest, most reversible path — minimal risk, easy to change later" },
  { id: "sensorial", hint: "the most concrete, sensory path — what the audience directly feels" },
];

const OPTION_SYSTEM =
  "You are one temporary specialist voice inside AgentOS, producing ONE " +
  "concrete option for a governed decision. Your angle is given in context " +
  "(the line starting with 'angle:'). Commit to that angle — the user will " +
  "compare genuinely distinct alternatives, so do not hedge toward the " +
  "middle. If Sensei seeds are in context, apply them faithfully and let " +
  "them shape the option. Do not decide for the user; do not mention other " +
  "options. End with exactly one fenced ```json block: {\"title\", " +
  '"direction" (a 3-6 word slug of the underlying direction), ' +
  '"description" (the concrete option, 4-8 sentences), "benefits" (one ' +
  'sentence), "tradeoffs" (one sentence), "assumptions" (array of short ' +
  "strings)}. " +
  LANG_RULE;

const REFINE_SYSTEM =
  "You are refining ONE existing option inside AgentOS per the user's " +
  "short instruction. Change ONLY what the instruction asks; preserve " +
  "everything else — structure, direction, level of detail. The user must " +
  "recognize the option they liked. End with exactly one fenced ```json " +
  'block, same shape as the original: {"title", "direction", "description", ' +
  '"benefits", "tradeoffs", "assumptions"}. ' +
  LANG_RULE;

const RECOMMEND_SYSTEM =
  "You are the Kernel of AgentOS comparing the options on one Decision " +
  "Surface against the project's approved state and founding intent. " +
  "Recommend exactly one, with an honest one-sentence reason grounded in " +
  "the state — never in your own taste. End with exactly one fenced " +
  '```json block: {"optionId", "reason"}. ' +
  LANG_RULE;

function surfacesDir(projectId: string): string {
  return abs(projectDir(projectId), "decisions");
}

export function readSurfaces(projectId: string): DecisionSurface[] {
  const dir = surfacesDir(projectId);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => {
      const path = abs(dir, f);
      return validateDecisionSurface(readJson<unknown>(path), path);
    });
}

export function openSurface(projectId: string): DecisionSurface | null {
  return readSurfaces(projectId).find((d) => d.status === "open") ?? null;
}

function writeSurface(ds: DecisionSurface): void {
  writeJson(abs(surfacesDir(ds.projectId), `${ds.id}.json`), ds);
}

interface OptionParse {
  title: string;
  direction: string;
  description: string;
  benefits: string;
  tradeoffs: string;
  assumptions: string[];
}

function optionFrom(text: string): OptionParse | null {
  const str = (v: unknown): string => (typeof v === "string" ? v : "");
  for (const block of extractJsonBlocks(text).reverse()) {
    const b = block as Partial<Record<keyof OptionParse, unknown>>;
    if (typeof b !== "object" || b === null) continue;
    if (typeof b.title !== "string" || typeof b.description !== "string") continue;
    return {
      title: b.title,
      direction: str(b.direction) || "unnamed-direction",
      description: b.description,
      benefits: str(b.benefits),
      tradeoffs: str(b.tradeoffs),
      assumptions: Array.isArray(b.assumptions)
        ? b.assumptions.filter((a): a is string => typeof a === "string")
        : [],
    };
  }
  return null;
}

function seedRefs(resolved: ResolvedSeed[]): OptionSeedRef[] {
  return resolved.map((r) => ({
    id: r.seed.id,
    version: r.seed.version,
    reason: r.reason,
    senseiId: r.senseiId,
    senseiTitle: r.senseiTitle,
  }));
}

/** Steps 1-4 of the interaction-model slice: open one governed option set. */
export async function runDecisionSurface(args: {
  projectId: string;
  level: EffortLevel;
  runtime: Runtime;
  scripted?: boolean;
  /** Ponto J: the Pilot's explicit table size (2-4); absent = effort-derived. */
  optionsCount?: number;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<DecisionSurface> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  if (openSurface(project.id)) {
    throw new Error("a Decision Surface is already open — decide it first");
  }
  const spec = effortSpec(args.level);
  const approved = readApproved(project.id);
  const routedQuestion = readQuestions(project.id).find((question) => question.status === "routed");
  const activeSlice = nextProjectSlice(project.id);
  const decidedQuestions = new Set(readSurfaces(project.id).filter((surface) => surface.status === "decided").map((surface) => surface.decision));
  const sliceDecision = activeSlice?.materialDecisions.find((item) => !decidedQuestions.has(item));

  const decision = routedQuestion
    ? routedQuestion.text
    : sliceDecision
    ? sliceDecision
    : approved
    ? `Como concretizar a próxima ação: ${approved.state.nextAction}`
    : `A direção fundamental de "${project.name}"`;
  const why = routedQuestion
    ? "o Pilot decidiu transformar esta incerteza numa escolha concreta em vez de responder do zero"
    : sliceDecision
    ? `esta é a próxima decisão material preparada para a fatia ${activeSlice?.title ?? "ativa"}`
    : approved
    ? "a próxima ação aprovada admite mais do que um caminho honesto"
    : "a intenção fundadora admite mais do que uma direção honesta";

  // Voices: the user's Senseis first (attributed — theirs is the victory if
  // picked), generic angles fill the table. Table size: the Pilot's explicit
  // choice wins; otherwise it follows the effort level.
  const targetCount = args.optionsCount
    ? Math.max(2, Math.min(4, Math.round(args.optionsCount)))
    : Math.max(2, Math.min(spec.maxAgents, 4));
  const senseis = applicableSenseis(project.id).slice(0, targetCount);
  const angles: { id: string; hint: string; senseiId?: string }[] = senseis.map((m) => ({
    id: m.id,
    hint: `the path this Sensei's judgement points to: ${m.persona}`,
    senseiId: m.id,
  }));
  for (const g of GENERIC_ANGLES) {
    if (angles.length >= targetCount) break;
    angles.push(g);
  }

  const options: OptionRecord[] = [];
  // No per-option write happens inside this loop — writeSurface(ds) below,
  // once, is the real "persisting" moment for the whole Decision Surface.
  // Track the last Work Order touched so that single "persisting" call
  // still names a real, already-reported id rather than inventing one.
  let lastWoId = "";
  for (const [i, angle] of angles.entries()) {
    const b = baseContext(project, spec.contextBudgetChars);
    addApprovedState(b, project, true);
    b.add({
      kind: "pilot-note",
      id: `angle-${angle.id}`,
      absPath: abs(projectDir(project.id), "project.json"),
      content: `angle: ${angle.id}\nAngle hint: ${angle.hint}`,
      reason: "the distinct angle this option must commit to",
      required: true,
    });
    const sensei = angle.senseiId ? senseis.find((m) => m.id === angle.senseiId) : undefined;
    // A Sensei's voice carries ONLY its own seeds (ponto A); a generic angle
    // carries none — human intelligence never enters transversally.
    const resolved = sensei ? senseiSeeds(project.id, sensei) : [];
    for (const r of resolved) {
      b.add({
        kind: "expertise",
        id: r.seed.id,
        absPath: seedYamlPath(r.seed),
        content:
          `${r.seed.title} (GuruSeed v${r.seed.version}, Sensei: ${r.senseiTitle})\n\n` +
          `Rule: ${r.seed.rule}\nWhy: ${r.seed.why}`,
        reason: r.reason,
        required: true,
      });
    }
    addAnswers(b, project, false);
    const ctx = b.build();
    const { record, text } = await runWorkOrder({
      project,
      kind: "option",
      agentId: angle.id,
      system: OPTION_SYSTEM,
      ctx,
      level: args.level,
      runtime: args.runtime,
      ...phaseCallbacks(args.onPhase, args.onMeter),
    });
    args.onPhase?.("validating-parsing", record.id, angle.id);
    lastWoId = record.id;
    const parsed = optionFrom(text);
    if (!parsed) continue; // an unparseable voice is not an option — visible in the WO record
    const included = new Set(
      ctx.elements.filter((el) => el.kind === "expertise").map((el) => el.ref.id),
    );
    options.push({
      id: `option-${OPTION_LETTERS[i] ?? String(i + 1)}`,
      version: 1,
      ...(sensei ? { senseiId: sensei.id, senseiTitle: sensei.title } : {}),
      ...parsed,
      seeds: seedRefs(resolved.filter((r) => included.has(r.seed.id))),
      workOrderId: record.id,
      status: "candidate",
    });
  }
  if (options.length < 2) {
    throw new Error(
      `only ${options.length} option(s) parsed — a Decision Surface needs at least two honest alternatives`,
    );
  }

  // The Kernel's recommendation, grounded in the state (skippable at minimal).
  let recommendation: DecisionSurface["recommendation"] = null;
  if (levelIndex(args.level) >= levelIndex("low")) {
    const b = baseContext(project, spec.contextBudgetChars);
    addApprovedState(b, project, true);
    b.add({
      kind: "pilot-note",
      id: "options-on-the-table",
      absPath: abs(projectDir(project.id), "project.json"),
      content: options
        .map((o) => `${o.id}: ${o.title} — ${o.direction}\n${o.description}`)
        .join("\n\n"),
      reason: "the options being compared",
      required: true,
    });
    const ctx = b.build();
    try {
      const { record, text } = await runWorkOrder({
        project,
        kind: "recommend",
        agentId: null,
        system: RECOMMEND_SYSTEM,
        ctx,
        level: args.level,
        runtime: args.runtime,
        ...phaseCallbacks(args.onPhase, args.onMeter),
      });
      args.onPhase?.("validating-parsing", record.id, "");
      lastWoId = record.id;
      for (const block of extractJsonBlocks(text).reverse()) {
        const r = block as { optionId?: unknown; reason?: unknown };
        if (
          typeof r.optionId === "string" &&
          typeof r.reason === "string" &&
          options.some((o) => o.id === r.optionId)
        ) {
          recommendation = { optionId: r.optionId, reason: r.reason };
          break;
        }
      }
    } catch {
      // no recommendation is honest; a failed one is not
    }
  }

  const ds: DecisionSurface = {
    id: `ds-${readSurfaces(project.id).length + 1}`,
    projectId: project.id,
    iteration: project.iteration,
    decision,
    why,
    options,
    recommendation,
    status: "open",
    createdAt: nowIso(),
    ...(routedQuestion ? { sourceQuestionId: routedQuestion.id } : {}),
  };
  args.onPhase?.("persisting", lastWoId, "");
  writeSurface(ds);
  event(project, "kernel", "decision_opened", scripted, {
    dsId: ds.id,
    note: `${decision} (${options.length} opções)`,
  });
  return ds;
}

/** Steps 5-7: a versioned refinement — the original is never overwritten. */
export async function refineOption(args: {
  projectId: string;
  dsId: string;
  optionId: string;
  instruction: string;
  runtime: Runtime;
  scripted?: boolean;
  onPhase?: OnPhase;
  onMeter?: OnMeter;
}): Promise<{ option: OptionRecord; candidateSeed: GuruSeed }> {
  const scripted = args.scripted ?? false;
  const project = getProject(args.projectId);
  const ds = readSurfaces(project.id).find((d) => d.id === args.dsId);
  if (!ds || ds.status !== "open") throw new Error(`no open surface ${args.dsId}`);
  const base = ds.options
    .filter((o) => o.id === args.optionId)
    .sort((a, b) => b.version - a.version)[0];
  if (!base) throw new Error(`unknown option ${args.optionId} on ${args.dsId}`);

  // Refinement is interview-shaped movement — the "questions" phase effort.
  const level = phaseEffort(project, "questions");
  const spec = effortSpec(level);
  const b = baseContext(project, spec.contextBudgetChars);
  addApprovedState(b, project, false);
  b.add({
    kind: "prior-response",
    id: `${base.id}-v${base.version}`,
    absPath: abs(surfacesDir(project.id), `${ds.id}.json`),
    content:
      `The option being refined (${base.id} v${base.version}):\n` +
      `Title: ${base.title}\nDirection: ${base.direction}\n${base.description}\n` +
      `Benefits: ${base.benefits}\nTradeoffs: ${base.tradeoffs}`,
    reason: "the original the refinement must preserve",
    required: true,
  });
  b.add({
    kind: "pilot-note",
    id: "refinement",
    absPath: abs(projectDir(project.id), "evidence.jsonl"),
    content: `refinement instruction: ${args.instruction.trim()}`,
    reason: "the user's own direction — the only thing that may change",
    required: true,
  });
  const seedsById = new Map(listSeeds().map((s) => [s.id, s]));
  for (const ref of base.seeds) {
    const seed = seedsById.get(ref.id);
    if (!seed) continue;
    b.add({
      kind: "expertise",
      id: seed.id,
      absPath: seedYamlPath(seed),
      content: `${seed.title} (GuruSeed v${seed.version})\n\nRule: ${seed.rule}\nWhy: ${seed.why}`,
      reason: `carried over from ${base.id} v${base.version}: ${ref.reason}`,
      required: true,
    });
  }
  const ctx = b.build();
  const { record, text } = await runWorkOrder({
    project,
    kind: "refine",
    agentId: base.id,
    system: REFINE_SYSTEM,
    ctx,
    level,
    runtime: args.runtime,
    ...phaseCallbacks(args.onPhase, args.onMeter),
  });
  args.onPhase?.("validating-parsing", record.id, base.id);
  const parsed = optionFrom(text);
  if (!parsed) throw new Error(`refine work order ${record.id} returned no parseable option`);

  const refined: OptionRecord = {
    id: base.id,
    version: base.version + 1,
    // The voice stays the voice: refining a Sensei's option keeps the credit.
    ...(base.senseiId ? { senseiId: base.senseiId, senseiTitle: base.senseiTitle } : {}),
    ...parsed,
    seeds: base.seeds,
    workOrderId: record.id,
    parent: { id: base.id, version: base.version },
    refinement: args.instruction.trim(),
    status: "candidate",
  };
  ds.options.push(refined);
  args.onPhase?.("persisting", record.id, base.id);
  writeSurface(ds);
  event(project, "pilot", "option_refined", scripted, {
    dsId: ds.id,
    optionId: base.id,
    workOrderId: record.id,
    note: args.instruction.trim(),
  });

  // Step 11: a refinement may teach — candidate only, the Pilot governs it.
  // Proposed for the Sensei whose option was refined: the learning returns
  // to the voice that earned it, never to everyone (ponto C).
  const candidateSeed = addCandidateSeed({
    title: `Preferência: ${args.instruction.trim().slice(0, 60)}`,
    rule: args.instruction.trim(),
    why:
      `O utilizador refinou ${base.id} em ${ds.id} com esta direção — ` +
      `possivelmente um julgamento reutilizável, possivelmente pontual.`,
    domains: [],
    projects: [project.id],
    origin: "taught",
    provenanceNote: `extracted from refinement ${ds.id}:${base.id} v${base.version}→v${refined.version}`,
    sourceProject: project.id,
    ...(base.senseiId ? { sensei: base.senseiId } : {}),
  });
  event(project, "kernel", "seed_candidate_extracted", scripted, {
    seedId: candidateSeed.id,
    dsId: ds.id,
    optionId: base.id,
    note: candidateSeed.title,
  });
  return { option: refined, candidateSeed };
}

/** Steps 8-10: the Pilot's choice closes the surface; lineage is evidence. */
export function selectOption(
  projectId: string,
  dsId: string,
  optionId: string,
  version: number,
  scripted = false,
): DecisionSurface {
  const project = getProject(projectId);
  const ds = readSurfaces(projectId).find((d) => d.id === dsId);
  if (!ds || ds.status !== "open") throw new Error(`no open surface ${dsId}`);
  const chosen = ds.options.find((o) => o.id === optionId && o.version === version);
  if (!chosen) throw new Error(`unknown option ${optionId} v${version} on ${dsId}`);
  chosen.status = "selected";
  for (const o of ds.options) {
    if (o !== chosen && o.status === "candidate") o.status = "rejected";
  }
  ds.selected = { optionId, version };
  ds.status = "decided";
  ds.decidedAt = nowIso();
  writeSurface(ds);
  if (ds.sourceQuestionId) {
    const questions = readQuestions(projectId);
    const routed = questions.find((question) => question.id === ds.sourceQuestionId);
    if (routed?.status === "routed") {
      routed.status = "answered";
      routed.answer = `Decidido na ${ds.id}: ${chosen.title} (v${version})`;
      routed.answeredAt = nowIso();
      writeQuestions(projectId, questions);
    }
  }
  event(project, "pilot", "option_selected", scripted, {
    dsId,
    optionId,
    note: `${chosen.title} (v${version}${chosen.refinement ? ", refinada" : ""})`,
  });
  // Ponto C — the fight was won: the victory returns to the ONE Sensei whose
  // voice the Pilot picked. Append-only telemetry; graduation derives from it.
  if (chosen.senseiId) {
    recordSenseiVictory(chosen.senseiId, {
      ts: nowIso(),
      project: project.id,
      dsId,
      optionId,
      decision: ds.decision,
    });
    event(project, "kernel", "sensei_victory", scripted, {
      dsId,
      optionId,
      note: `vitória do Sensei ${chosen.senseiTitle ?? chosen.senseiId} — a escolha evolui quem a sugeriu`,
    });
  }
  return ds;
}

// ---------------------------------------------------------------------------
// The story of the project (FOUNDATION-CORRECTION, ADR-0019 §3): assembled
// entirely from disk — evidence, work orders, manifests, questions, states,
// artifacts. Operational provenance, never private model reasoning: the only
// things stored (and therefore the only things shown) are inputs, outputs,
// and what entered context with which reason.

const OUTPUT_EXCERPT_CHARS = 1600;

export interface StoryItem {
  ts: string;
  iteration: number;
  action: EvidenceEvent["action"];
  actor: "pilot" | "kernel";
  agentId?: string;
  agentTitle?: string;
  mandate?: string;
  workOrderId?: string;
  workKind?: WorkOrderKind;
  effortLevel?: string;
  model?: string;
  workStatus?: string;
  /** Expertise this work order received, with the Kernel's selection reason. */
  expertise?: { id: string; title: string; reason: string }[];
  /** Operational output excerpt (response or artifact), never reasoning. */
  output?: string;
  outputChars?: number;
  questionText?: string;
  answer?: string;
  askedBy?: string[];
  expertiseId?: string;
  note?: string;
}

export interface StoryIteration {
  iteration: number;
  items: StoryItem[];
}

export interface Story {
  intent: { name: string; description: string; createdAt: string };
  iterations: StoryIteration[];
}

function woDetail(
  projectId: string,
  iteration: number,
  workOrderId: string,
  expertiseTitles: Map<string, string>,
): Partial<StoryItem> {
  const dir = abs(workOrdersDir(projectId, iteration), workOrderId);
  if (!existsSync(abs(dir, "workorder.json"))) return {};
  const recordPath = abs(dir, "workorder.json");
  const record = validateWorkOrderRecord(readJson<unknown>(recordPath), recordPath);
  const out: Partial<StoryItem> = {
    workKind: record.kind,
    effortLevel: record.effortLevel,
    model: record.model,
    workStatus: record.status,
  };
  const manifestPath = abs(dir, "manifest.json");
  if (existsSync(manifestPath)) {
    const manifest = readJson<import("./types.js").ContextManifest>(manifestPath);
    const applied = manifest.elements
      .filter((el) => el.kind === "expertise")
      .map((el) => ({
        id: el.ref.id,
        title: expertiseTitles.get(el.ref.id) ?? el.ref.id,
        reason: el.selectionReason,
      }));
    if (applied.length > 0) out.expertise = applied;
  }
  const respPath = abs(dir, "response.md");
  if (existsSync(respPath)) {
    const text = readText(respPath);
    out.output = text.slice(0, OUTPUT_EXCERPT_CHARS);
    out.outputChars = text.length;
  }
  return out;
}

export function storyOf(projectId: string): Story {
  const project = getProject(projectId);
  const roster = readRoster(projectId);
  const questions = readQuestions(projectId);
  const titles = new Map<string, string>();
  for (const s of [...listSeeds(), ...listCandidates()]) titles.set(s.id, s.title);

  const iterations = new Map<number, StoryItem[]>();
  for (const e of readEvents(projectId)) {
    const item: StoryItem = {
      ts: e.ts,
      iteration: e.iteration,
      action: e.action,
      actor: e.actor,
    };
    if (e.agentId) {
      item.agentId = e.agentId;
      const role = roster?.agents.find((a) => a.id === e.agentId);
      if (role) {
        item.agentTitle = role.title;
        item.mandate = role.mandate;
      }
    }
    if (e.workOrderId) {
      item.workOrderId = e.workOrderId;
      Object.assign(item, woDetail(projectId, e.iteration, e.workOrderId, titles));
    }
    if (e.questionId) {
      const q = questions.find((x) => x.id === e.questionId);
      if (q) {
        item.questionText = q.text;
        if (q.answer !== undefined) item.answer = q.answer;
        item.askedBy = q.askedBy;
      }
    }
    if (e.expertiseId) item.expertiseId = e.expertiseId;
    if (e.note) item.note = e.note;

    const bucket = iterations.get(e.iteration) ?? [];
    bucket.push(item);
    iterations.set(e.iteration, bucket);
  }

  return {
    intent: {
      name: project.name,
      description: project.description,
      createdAt: project.createdAt,
    },
    iterations: [...iterations.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([iteration, items]) => ({ iteration, items })),
  };
}
