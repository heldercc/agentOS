// The AgentOS shell — the product's face (docs/PRODUCT-LOOP.md, Operating
// Model §12): "I state what I want. The system digests it. A team works
// underneath. I see only the questions and choices that matter. I decide."
//
// One HTTP server, no dependencies, localhost:4900. The user sees one primary
// action per loop stage; everything below the authority line moves by itself.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { existsSync, readdirSync } from "node:fs";

import { readEvents } from "../evidence.js";
import {
  AUTO_MAX_LEVEL,
  EFFORT_LEVELS,
  effortSpec,
  probeEffort,
  buildActual,
  type EffortLevel,
} from "../effort.js";
import {
  addCandidateSeedGoverned,
  advanceIteration,
  answerQuestion,
  answerQuestions,
  appendOperationActual,
  concludeProject,
  decideCandidate,
  decideSeedGoverned,
  DEFAULT_EFFORT_PROFILE,
  getProject,
  initProject,
  listArtifacts,
  listProjects,
  openQuestions,
  openSurface,
  addPilotNote,
  readCandidate,
  readApproved,
  readCandidateProjectMap,
  readProjectMap,
  readQuestions,
  readRoster,
  readSurfaces,
  readWorkOrders,
  recordOperationCancelled,
  refineOption,
  reopenProject,
  declareContextSufficient,
  planStepsBack,
  reopenDeferredQuestions,
  recordSeedEvidenceGoverned,
  revokeApproval,
  setAsideOpenSurface,
  stepBackTo,
  withdrawCandidate,
  type BackTarget,
  runCandidate,
  runConsult,
  runDecisionSurface,
  runExecute,
  runProjectSlicer,
  approveCandidateProjectMap,
  moveProjectSlice,
  nextProjectSlice,
  saveSenseiGoverned,
  selectOption,
  setEffortProfile,
  stageOf,
  storyOf,
  topOpenQuestion,
  topOpenQuestions,
  routeQuestionToDecision,
  type OnMeter,
  type OnPhase,
  type WorkOrderPhase,
} from "../kernel.js";
import {
  ensureImmutableProvenance,
  ensureSenseiLibrary,
  listCandidates,
  listSenseis,
  listSeeds,
  migrateLegacyExpertise,
  senseiOwnershipSanity,
  senseiSanity,
  senseiVictories,
} from "../hi.js";
import {
  iterationDir,
  MAILBOX_DIR,
  PKG_ROOT,
  projectDir,
  REPO_ROOT,
  workOrdersDir,
  workspaceRoot,
} from "../paths.js";
import { OpCancelledError, resolveRuntime, type GenerateArgs, type Runtime } from "../runtime.js";
import { abs, containedPath, readJson, readText, writeJson } from "../stores.js";
import { computeStaleness, gitDirtyProductFiles, gitProductHead, gitShortHead } from "../build.js";
import { DATA_SCHEMA_VERSION, type EffortProfile, type MeterRecord, type OperationActual } from "../types.js";
import { bodyTooLarge, hostAllowed, originAllowed } from "../http-guards.js";
import { applyMigrations, MIGRATIONS } from "../migrations.js";
import { recoverTransitions } from "../transitions.js";
import { MODULE_REGISTRY_VERSION } from "../module-registry.js";

/** PRODUCT_PORT lets a verification instance run beside the live :4900 shell. */
const PORT = Number(process.env["PRODUCT_PORT"] ?? 4900);
const RUNTIME_NAME = process.env["PRODUCT_RUNTIME"] ?? "cli";
const runtime = resolveRuntime(RUNTIME_NAME, { mailboxDir: MAILBOX_DIR });
recoverTransitions(workspaceRoot());
const BOOT_MIGRATION = applyMigrations(workspaceRoot(), DATA_SCHEMA_VERSION, MIGRATIONS);

// ---------------------------------------------------------------------------
// Ponto A (parecer 2026-07-12) + PHASE 1.1 (ADR-0022): the running version
// must be visible AND staleness must be PRODUCT-AWARE — a docs-only commit
// must never make this App claim newer code exists. Captured once at boot.
const BOOT_SHA = gitShortHead(REPO_ROOT) ?? "unknown";
const BUILD = {
  sha: BOOT_SHA,
  productSha: gitProductHead(REPO_ROOT, BOOT_SHA === "unknown" ? "HEAD" : BOOT_SHA),
  version: (() => {
    try {
      return readJson<{ version?: string }>(abs(PKG_ROOT, "package.json")).version ?? "0.0.0";
    } catch { return "0.0.0"; }
  })(),
  schemaVersion: DATA_SCHEMA_VERSION,
  moduleRegistryVersion: MODULE_REGISTRY_VERSION,
  startedAt: new Date().toISOString(),
  port: PORT,
  runtime: RUNTIME_NAME,
  node: process.version,
};

// Repo movement re-checked at most every 30s — cheap enough to call on every
// state poll without shelling out constantly.
let repoCache: {
  at: number; repoHead: string | null; productHead: string | null; dirty: number;
} | null = null;
function repoNow(): { repoHead: string | null; productHead: string | null; dirty: number } {
  const now = Date.now();
  if (repoCache && now - repoCache.at < 30_000) return repoCache;
  repoCache = {
    at: now,
    repoHead: gitShortHead(REPO_ROOT),
    productHead: gitProductHead(REPO_ROOT, "HEAD"),
    dirty: gitDirtyProductFiles(REPO_ROOT).length,
  };
  return repoCache;
}

function buildInfo(): typeof BUILD & {
  repoHead: string | null; productHead: string | null; dirtyProductFiles: number;
  stale: boolean; repoMovedDocsOnly: boolean; dirtyProduct: boolean;
  safeMode: boolean; safeModeReason: string | null; migrationVersion: string;
} {
  const r = repoNow();
  const s = computeStaleness({
    buildSha: BUILD.sha,
    buildProductSha: BUILD.productSha,
    repoHead: r.repoHead,
    productHead: r.productHead,
    dirtyProductFiles: r.dirty,
  });
  return { ...BUILD, repoHead: r.repoHead, productHead: r.productHead,
    dirtyProductFiles: r.dirty, ...s, safeMode: BOOT_MIGRATION.safeMode,
    safeModeReason: BOOT_MIGRATION.reason, migrationVersion: BOOT_MIGRATION.migrationVersion };
}

// One-time, mechanical, provenance-preserving (ADR-0020 §9).
try {
  const n = migrateLegacyExpertise();
  if (n > 0) console.log(`migrated ${n} ADR-0019 expertise record(s) into the HI library`);
} catch (e) {
  console.error("legacy expertise migration failed:", e);
}

// One-time, mechanical, idempotent (parecer 2026-07-12): telemetry moves to
// sidecars, content hashes are stamped, current versions get their first
// immutable snapshot.
try {
  const c = ensureImmutableProvenance();
  if (c > 0) console.log(`immutable provenance: corrected ${c} HI record(s)`);
} catch (e) {
  console.error("immutable provenance correction failed:", e);
}

// The Sensei reform migration (parecer 2026-07-12 noite): mentors/ becomes
// senseis/, crafts derive from pinned seeds, admitted seeds gain their owner.
try {
  const c = ensureSenseiLibrary();
  if (c > 0) console.log(`sensei reform: migrated/corrected ${c} HI record(s)`);
} catch (e) {
  console.error("sensei reform migration failed:", e);
}

// ---------------------------------------------------------------------------
// One in-flight operation per project — honest for a Beta: the loop is
// sequential by design; parallel governance is nobody's ask yet. Busy is
// also the live operation card's data (parecer 2026-07-12, ponto B): the
// shell drives it by wrapping the runtime, never by inventing a percentage.

interface Busy {
  op: string;
  startedAt: string;
  /** "queued"|"launching"|"awaiting-model"|"response-received"|
   *  "validating-parsing"|"persisting" — honest stage labels; "processing"
   *  is retired (ADR-0022 PHASE 1 items 3/5 — it claimed work that was not
   *  really happening). The last three arrive from the Kernel's onPhase
   *  callback, fired only on real evidence (runtime.ts/kernel.ts). */
  phase: string;
  phaseSince: string;
  /** Last REAL evidence of life (stdout/stderr chunk, poll tick). */
  heartbeatAt: string;
  workOrderId: string | null;
  model: string | null;
  effortLevel: string;
  callsDone: number;
  callsPlanned: number;
  timeoutMs: number | null;
  /** Stable id for this one operation (full visibility, ADR-0022 PHASE 1
   *  item 3): "op-" + base36 timestamp + 4 random base36 chars. */
  operationId: string;
  /** The roster agent currently being worked, if any — kernel-level Work
   *  Orders (roster/synthesize/recommend) leave this null. */
  agentId: string | null;
  /** agentId's roster title, resolved once known — the human-readable name
   *  the Pilot actually recognizes. */
  humanRole: string | null;
  /** Cumulative input+output tokens across every Work Order this operation
   *  has completed so far. */
  tokensDone: number;
  /** True the instant ANY contributing meter was an estimate (fake/cli/
   *  mailbox ports) rather than API-metered — never silently rounds up to
   *  "exact". */
  tokensEstimated: boolean;
}
const busy = new Map<string, Busy>();
/** Never serialized — the Pilot's "Parar esta operação" reaches in here only. */
const aborters = new Map<string, AbortController>();
const lastError = new Map<string, string>();

/** "op-" + Date.now() base36 + 4 random base36 chars — unique enough for one
 *  in-flight-per-project operation, cheap, and legible in logs/UI. */
function genOperationId(): string {
  const rand = Math.random().toString(36).slice(2, 6);
  return `op-${Date.now().toString(36)}-${rand}`;
}

/**
 * Internal-only bookkeeping for ONE in-flight operation's persisted actuals
 * (ADR-0022 PHASE 1 item 5) — never serialized to the client; Busy carries
 * only what the live card needs. Accumulated across every Work Order the
 * operation runs, then folded into an OperationActual in startOp's finally.
 */
interface OpTrack {
  startedAtMs: number;
  phases: { phase: string; at: string }[];
  /** ms from startedAtMs to the first phase change away from "queued";
   *  null until that first change happens. */
  queueMs: number | null;
  /** ms from startedAtMs to the first "response-received"; null until then. */
  firstFeedbackMs: number | null;
  lastHeartbeatMs: number;
  heartbeatGapMaxMs: number;
  tokensInput: number;
  tokensOutput: number;
  models: Set<string>;
  workOrdersDone: number;
}
const opTrack = new Map<string, OpTrack>();

function noteHeartbeat(track: OpTrack | undefined): void {
  if (!track) return;
  const nowMs = Date.now();
  const gap = nowMs - track.lastHeartbeatMs;
  if (gap > track.heartbeatGapMaxMs) track.heartbeatGapMaxMs = gap;
  track.lastHeartbeatMs = nowMs;
}

function notePhase(projectId: string, phase: string, at: string): void {
  const track = opTrack.get(projectId);
  if (!track) return;
  track.phases.push({ phase, at });
  if (track.queueMs === null && phase !== "queued") {
    track.queueMs = Date.now() - track.startedAtMs;
  }
}

/**
 * The Kernel's onPhase callback for one operation: fired only with REAL
 * evidence (see runWorkOrder's honesty comment in kernel.ts) — the shell
 * never invents a phase, it only relays the Kernel's own.
 */
function onPhaseFor(projectId: string): OnPhase {
  return (phase: WorkOrderPhase, workOrderId: string, agentId: string): void => {
    const b = busy.get(projectId);
    const now = new Date().toISOString();
    if (b) {
      b.phase = phase;
      b.phaseSince = now;
      b.heartbeatAt = now;
      b.workOrderId = workOrderId;
      if (agentId) {
        b.agentId = agentId;
        const roster = readRoster(projectId);
        b.humanRole = roster?.agents.find((a) => a.id === agentId)?.title ?? agentId;
      }
    }
    notePhase(projectId, phase, now);
    noteHeartbeat(opTrack.get(projectId));
    const track = opTrack.get(projectId);
    if (track && phase === "response-received" && track.firstFeedbackMs === null) {
      track.firstFeedbackMs = Date.now() - track.startedAtMs;
    }
    if (track && phase === "persisting") {
      track.workOrdersDone += 1;
    }
  };
}

/** The Kernel's onMeter callback: accumulates the live token count on Busy
 *  and the input/output split + model set on the operation's track. */
function onMeterFor(projectId: string): OnMeter {
  return (meter: MeterRecord, _agentId: string): void => {
    const b = busy.get(projectId);
    if (b) {
      b.tokensDone += meter.inputTokens + meter.outputTokens;
      if (meter.estimated) b.tokensEstimated = true;
    }
    const track = opTrack.get(projectId);
    if (track) {
      track.tokensInput += meter.inputTokens;
      track.tokensOutput += meter.outputTokens;
      track.models.add(meter.model);
    }
  };
}

/**
 * Wraps the module-level runtime so every call drives the Busy record: phase
 * transitions and heartbeat come from REAL runtime activity (ponto D — no
 * invented percentage). If the project has no Busy record (called outside
 * startOp's bookkeeping), it simply delegates. "launching"/"awaiting-model"
 * stay shell-side (they describe the shell's OWN act of issuing the call);
 * everything from "response-received" onward is the Kernel's own honest
 * report, via onPhase/onMeter (kernel.ts).
 */
function instrument(projectId: string): Runtime {
  return {
    name: runtime.name,
    async generate(args: GenerateArgs) {
      const b = busy.get(projectId);
      if (!b) return runtime.generate(args);
      const now = (): string => new Date().toISOString();
      b.workOrderId = args.jobId;
      b.model = args.model;
      b.timeoutMs = args.timeoutMs;
      b.phase = "launching";
      b.phaseSince = now();
      b.heartbeatAt = now();
      notePhase(projectId, "launching", b.phaseSince);
      b.phase = "awaiting-model";
      b.phaseSince = now();
      notePhase(projectId, "awaiting-model", b.phaseSince);
      const ac = aborters.get(projectId);
      const res = await runtime.generate({
        ...args,
        ...(ac ? { signal: ac.signal } : {}),
        onActivity: () => {
          b.heartbeatAt = now();
          noteHeartbeat(opTrack.get(projectId));
        },
      });
      // The kernel now reports "response-received"/"validating-parsing"/
      // "persisting" itself, through onPhase — this wrapper's job ends at
      // issuing the call; it no longer guesses what happens after.
      b.callsDone += 1;
      b.heartbeatAt = now();
      noteHeartbeat(opTrack.get(projectId));
      return res;
    },
  };
}

function startOp(
  projectId: string,
  op: string,
  level: EffortLevel,
  planned: number,
  work: () => Promise<void>,
): boolean {
  if (busy.has(projectId)) return false;
  const now = new Date().toISOString();
  const operationId = genOperationId();
  busy.set(projectId, {
    op,
    startedAt: now,
    phase: "queued",
    phaseSince: now,
    heartbeatAt: now,
    workOrderId: null,
    model: null,
    effortLevel: level,
    callsDone: 0,
    callsPlanned: planned,
    timeoutMs: null,
    operationId,
    agentId: null,
    humanRole: null,
    tokensDone: 0,
    tokensEstimated: false,
  });
  opTrack.set(projectId, {
    startedAtMs: Date.now(),
    phases: [{ phase: "queued", at: now }],
    queueMs: null,
    firstFeedbackMs: null,
    lastHeartbeatMs: Date.now(),
    heartbeatGapMaxMs: 0,
    tokensInput: 0,
    tokensOutput: 0,
    models: new Set<string>(),
    workOrdersDone: 0,
  });
  aborters.set(projectId, new AbortController());
  lastError.delete(projectId);
  let outcome: "completed" | "interrupted" | "failed" = "completed";
  void work()
    .catch((e) => {
      // The Kernel now lets OpCancelledError through intact and writes the
      // Work Order as "interrupted" (ADR-0022 PHASE 1 §4) — no message
      // sniffing. The shell only REQUESTS the halt; the governed evidence
      // is the Kernel's act.
      const msg = e instanceof Error ? e.message : String(e);
      const cancelled =
        e instanceof OpCancelledError ||
        (e as { name?: string } | null)?.name === "OpCancelledError";
      if (cancelled) {
        outcome = "interrupted";
        recordOperationCancelled(projectId, op);
        lastError.set(
          projectId,
          "⏹ Operação parada por ti — o que já estava completo ficou preservado. " +
            "Podes relançar quando quiseres (igual ou com outro esforço).",
        );
      } else {
        outcome = "failed";
        lastError.set(projectId, msg);
      }
    })
    .finally(() => {
      // Persisted operation actuals (ADR-0022 PHASE 1 item 5) — must never
      // throw out of finally; a bookkeeping failure is not the Pilot's
      // problem, so it is only ever logged.
      try {
        const b = busy.get(projectId);
        const track = opTrack.get(projectId);
        if (b && track) {
          appendOperationActual({
            operationId: b.operationId,
            projectId,
            iteration: getProject(projectId).iteration,
            op: b.op,
            effortLevel: b.effortLevel,
            startedAt: b.startedAt,
            endedAt: new Date().toISOString(),
            outcome,
            wallMs: Date.now() - track.startedAtMs,
            queueMs: track.queueMs,
            firstFeedbackMs: track.firstFeedbackMs,
            phases: track.phases,
            workOrdersPlanned: b.callsPlanned,
            workOrdersDone: track.workOrdersDone,
            tokensInput: track.tokensInput,
            tokensOutput: track.tokensOutput,
            tokensEstimated: b.tokensEstimated,
            heartbeatGapMaxMs: track.heartbeatGapMaxMs,
            timeoutMs: b.timeoutMs,
            models: [...track.models],
          } satisfies OperationActual);
        }
      } catch (persistErr) {
        console.error("failed to persist operation actual:", persistErr);
      }
      busy.delete(projectId);
      opTrack.delete(projectId);
      aborters.delete(projectId);
    });
  return true;
}

// ---------------------------------------------------------------------------
// Planned calls per operation — feeds the probe so the estimate is honest.

function plannedCalls(
  projectId: string,
  op: string,
  level: EffortLevel,
  optionsCount?: number,
): number {
  const spec = effortSpec(level);
  const roster = readRoster(projectId);
  if (op === "consult") {
    const agents = roster ? Math.min(roster.agents.length, spec.maxAgents) : spec.maxAgents;
    return roster ? agents : agents + 1; // +1 for the roster bootstrap
  }
  if (op === "candidate") return 1;
  if (op === "execute") {
    return roster ? Math.min(roster.agents.length, spec.maxAgents) : spec.maxAgents;
  }
  if (op === "decision") {
    const options = optionsCount
      ? Math.max(2, Math.min(4, optionsCount))
      : Math.max(2, Math.min(spec.maxAgents, 4));
    return options + (level === "minimal" ? 0 : 1); // +1 for the recommendation
  }
  return 1;
}

// ---------------------------------------------------------------------------
// Ponto I — tokens and time must be EVIDENT: the real meters of the current
// iteration, summed from disk on every poll, so the Pilot watches the spend
// grow while the system thinks.

function iterationMeters(projectId: string, iteration: number): {
  workOrders: number;
  tokens: number;
  durationMs: number;
  estimated: boolean;
} {
  const dir = workOrdersDir(projectId, iteration);
  let workOrders = 0;
  let tokens = 0;
  let durationMs = 0;
  let estimated = false;
  if (existsSync(dir)) {
    for (const wo of readdirSync(dir)) {
      const p = abs(dir, wo, "meter.json");
      if (!existsSync(p)) continue;
      const m = readJson<MeterRecord>(p);
      workOrders += 1;
      tokens += m.inputTokens + m.outputTokens;
      durationMs += m.durationMs;
      if (m.estimated) estimated = true;
    }
  }
  return { workOrders, tokens, durationMs, estimated };
}

// ---------------------------------------------------------------------------
// The view model the page polls.

function stateView(projectId: string): unknown {
  const project = getProject(projectId);
  const stage = stageOf(projectId);
  const roster = readRoster(projectId);
  const questions = readQuestions(projectId);
  const top = topOpenQuestion(projectId);
  const topThree = topOpenQuestions(projectId, 3);
  const artifacts = listArtifacts(projectId).map((a) => ({
    iteration: a.iteration,
    agentId: a.agentId,
    chars: a.chars,
    seeds: a.seeds ?? null,
    content: a.iteration === project.iteration ? readText(a.path).slice(0, 6000) : null,
  }));
  const events = readEvents(projectId).slice(-25).reverse();
  return {
    project,
    stage,
    runtime: RUNTIME_NAME,
    /** Ponto A: the running version must be visible — never let the Pilot
     *  believe a committed feature is active when the process is stale. */
    build: buildInfo(),
    autoMaxLevel: AUTO_MAX_LEVEL,
    effortProfile: project.effortProfile ?? DEFAULT_EFFORT_PROFILE,
    /** Ponto I: the iteration's real spend, visible and growing. */
    meters: iterationMeters(projectId, project.iteration),
    levels: EFFORT_LEVELS.map((l) => {
      const s = effortSpec(l);
      return {
        level: l,
        workerModel: s.workerModel,
        maxAgents: s.maxAgents,
        expectedQuality: s.expectedQuality,
        intendedFor: s.intendedFor,
      };
    }),
    roster: roster?.agents ?? null,
    interview: {
      open: openQuestions(projectId).length,
      deferred: questions.filter((q) => q.status === "deferred").length,
      top,
      topThree,
      answered: questions
        .filter((q) => q.status === "answered")
        .map((q) => ({ id: q.id, text: q.text, answer: q.answer, askedBy: q.askedBy })),
    },
    candidate: readCandidate(projectId),
    approved: readApproved(projectId),
    projectMap: readProjectMap(projectId),
    candidateProjectMap: readCandidateProjectMap(projectId),
    nextProjectSlice: nextProjectSlice(projectId),
    surface: openSurface(projectId),
    /** Decision 14: what the journey bar may walk back to, and why not. */
    journey: {
      interview: planStepsBack(projectId, "interview"),
      candidate: planStepsBack(projectId, "candidate"),
      approve: planStepsBack(projectId, "approve"),
    },
    decidedSurfaces: readSurfaces(projectId).filter((d) => d.status === "decided").length,
    artifacts,
    workOrders: readWorkOrders(projectId, project.iteration),
    events,
    /** Seeds awaiting the Pilot's judgement — reviewed before concluding. */
    pendingCandidates: listCandidates().length,
    busy: busy.get(projectId) ?? null,
    lastError: lastError.get(projectId) ?? null,
  };
}

/** Concluded projects are frozen: governance ops require reopening first. */
function guardActive(projectId: string, res: ServerResponse): boolean {
  const p = getProject(projectId);
  if ((p.status ?? "active") === "concluded") {
    json(res, 409, { error: "projeto concluído — reabre-o para continuar a trabalhar" });
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Plumbing.

function json(res: ServerResponse, code: number, value: unknown): void {
  res.writeHead(code, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

class HttpRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
    this.name = "HttpRequestError";
  }
}

function safeSinglePathPart(root: string, value: string): boolean {
  if (!value || value === "." || value === ".." || /[\\/]/.test(value) || /^[a-z]:/i.test(value)) {
    return false;
  }
  return containedPath(root, value) !== null;
}

async function body(req: IncomingMessage): Promise<Record<string, string>> {
  const mediaType = (req.headers["content-type"] ?? "").split(";", 1)[0]?.trim().toLowerCase();
  if (mediaType !== "application/json" && mediaType !== "application/x-www-form-urlencoded") {
    throw new HttpRequestError(415, "tipo de conteúdo não suportado — usa JSON ou formulário");
  }
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const c of req) {
    const chunk = c as Buffer;
    bytes += chunk.length;
    if (bodyTooLarge(bytes)) throw new HttpRequestError(413, "pedido demasiado grande — limite de 1 MB");
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (!text) return {};
  let parsed: Record<string, string>;
  try {
    if (mediaType === "application/json") {
      const value = JSON.parse(text) as unknown;
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new Error("o corpo JSON deve ser um objeto");
      }
      parsed = Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, value]) => [key, String(value ?? "")]),
      );
    } else {
      parsed = Object.fromEntries(new URLSearchParams(text));
    }
  } catch (e) {
    throw new HttpRequestError(400, `pedido inválido: ${e instanceof Error ? e.message : String(e)}`);
  }
  const projectId = parsed["project"];
  if (projectId && !safeSinglePathPart(workspaceRoot(), projectId)) {
    throw new HttpRequestError(400, "identificador de projeto inválido");
  }
  return parsed;
}

function asLevel(v: string | undefined): EffortLevel {
  return EFFORT_LEVELS.includes(v as EffortLevel) ? (v as EffortLevel) : "low";
}

/** The per-phase effort profile from a request body (ponto D). */
function profileFrom(b: Record<string, string>): EffortProfile {
  return {
    questions: asLevel(b["effortQuestions"]),
    options: asLevel(b["effortOptions"]),
    execution: asLevel(b["effortExecution"]),
  };
}

// ---------------------------------------------------------------------------
// Routes.

const server = createServer((req, res) => {
  void route(req, res).catch((e) => {
    if (e instanceof HttpRequestError) {
      json(res, e.status, { error: e.message });
      return;
    }
    console.error("request failed:", e);
    json(res, 500, { error: "erro interno — consulta a Auditoria; nenhum detalhe privado foi exposto" });
  });
});

async function route(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
  const q = (name: string): string => url.searchParams.get(name) ?? "";

  if (req.method === "POST") {
    if (!hostAllowed(req.headers.host, PORT)) {
      json(res, 403, { error: "Host rejeitado — a App aceita mutações apenas em loopback" });
      return;
    }
    const origin = Array.isArray(req.headers.origin) ? req.headers.origin[0] : req.headers.origin;
    if (!originAllowed(origin, PORT)) {
      json(res, 403, { error: "Origem rejeitada — mutação cross-origin não autorizada" });
      return;
    }
    if (BOOT_MIGRATION.safeMode) {
      json(res, 503, {
        error: `modo seguro só de leitura — ${BOOT_MIGRATION.reason ?? "estado dos dados requer intervenção"}`,
      });
      return;
    }
  }
  if (url.searchParams.has("project") && !safeSinglePathPart(workspaceRoot(), q("project"))) {
    json(res, 400, { error: "identificador de projeto inválido" });
    return;
  }

  if (req.method === "GET" && url.pathname === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(PAGE);
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/projects") {
    // Enriched for the home page: human state, last activity, next action.
    const projects = listProjects().map((p) => {
      const events = readEvents(p.id);
      const last = events[events.length - 1];
      return {
        ...p,
        status: p.status ?? "active",
        stage: stageOf(p.id),
        lastActivityAt: last ? last.ts : p.createdAt,
      };
    });
    json(res, 200, { projects, runtime: RUNTIME_NAME, build: buildInfo() });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/conclude") {
    const b = await body(req);
    const project = concludeProject(b["project"] ?? "", b["note"]);
    json(res, 200, { status: project.status });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/reopen") {
    const b = await body(req);
    const project = reopenProject(b["project"] ?? "");
    json(res, 200, { status: project.status });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project") {
    const b = await body(req);
    if (!b["name"]?.trim() || !b["description"]?.trim()) {
      json(res, 400, { error: "nome e descrição são obrigatórios" });
      return;
    }
    const project = initProject(b["name"], b["description"], false, profileFrom(b));
    json(res, 200, { id: project.id });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/effort") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    const project = setEffortProfile(b["project"] ?? "", profileFrom(b));
    json(res, 200, { effortProfile: project.effortProfile });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/map/propose") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    const level = asLevel(b["level"]);
    const ok = startOp(projectId, "slice", level, 1, async () => {
      await runProjectSlicer({
        projectId,
        level,
        runtime: instrument(projectId),
        onPhase: onPhaseFor(projectId),
        onMeter: onMeterFor(projectId),
      });
    });
    if (!ok) {
      json(res, 409, { error: "já existe uma operação em curso neste projeto" });
      return;
    }
    json(res, 200, { started: "slice" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/map/approve") {
    const b = await body(req);
    const expected = b["expectedVersion"] ? Number(b["expectedVersion"]) : null;
    const map = approveCandidateProjectMap(b["project"] ?? "", expected);
    json(res, 200, { version: map.version, slices: map.slices.length });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/project/slice/move") {
    const b = await body(req);
    const target = b["to"];
    if (!target || !["ready", "active", "done", "abandoned"].includes(target)) {
      json(res, 400, { error: "estado de Slice inválido" });
      return;
    }
    const map = moveProjectSlice({
      projectId: b["project"] ?? "",
      sliceId: b["sliceId"] ?? "",
      to: target as "ready" | "active" | "done" | "abandoned",
      expectedMapVersion: Number(b["expectedVersion"]),
      ...(b["reason"]?.trim() ? { reason: b["reason"].trim() } : {}),
    });
    json(res, 200, { version: map.version, next: nextProjectSlice(map.projectId) });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/state") {
    if (!existsSync(projectDir(q("project")))) {
      json(res, 404, { error: "projeto desconhecido" });
      return;
    }
    json(res, 200, stateView(q("project")));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/probe") {
    const level = asLevel(q("level"));
    const project = getProject(q("project"));
    const optionsCount = q("options") ? Number(q("options")) : undefined;
    json(res, 200, {
      probe: probeEffort({
        workspaceDir: workspaceRoot(),
        level,
        plannedCalls: plannedCalls(project.id, q("op") || "execute", level, optionsCount),
        priorIterations: project.iteration - 1,
      }),
      spec: effortSpec(level),
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/story") {
    json(res, 200, storyOf(q("project")));
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/project/map") {
    const projectId = q("project");
    json(res, 200, {
      current: readProjectMap(projectId),
      candidate: readCandidateProjectMap(projectId),
      next: nextProjectSlice(projectId),
    });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/hi") {
    // Senseis carry their telemetry-derived rank (ponto C) and their
    // active-vs-photo sanity (ponto F2) — the library is inspectable, whole.
    const senseis = listSenseis()
      .map((m) => {
        const sanity = senseiSanity(m);
        return {
          ...m,
          victories: senseiVictories(m.id),
          graduation: sanity.graduation,
          sanity,
        };
      })
      .sort((a, b) => b.victories.length - a.victories.length);
    json(res, 200, {
      seeds: listSeeds(),
      candidates: listCandidates(),
      senseis,
      ownershipSanity: senseiOwnershipSanity(),
    });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/seed") {
    const b = await body(req);
    if (!b["title"]?.trim() || !b["rule"]?.trim()) {
      json(res, 400, { error: "título e regra são obrigatórios" });
      return;
    }
    const seed = addCandidateSeedGoverned(b["project"] ?? "", {
      title: b["title"],
      rule: b["rule"],
      why: b["why"]?.trim() || "registada à mão na Biblioteca",
      domains: (b["domains"] ?? "").split(",").map((t) => t.trim()).filter((t) => t !== ""),
      projectLocal: b["reach"] === "project",
      provenanceNote: "registada à mão na Biblioteca de Inteligência Humana",
      ...(b["sensei"]?.trim() ? { sensei: b["sensei"].trim() } : {}),
    });
    json(res, 200, { id: seed.id });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/seed/decide") {
    const b = await body(req);
    decideSeedGoverned(
      b["project"] ?? "",
      b["seedId"] ?? "",
      b["decision"] === "admit" ? "admit" : "reject",
      b["editedRule"]?.trim() || undefined,
      false,
      b["senseiId"]?.trim() || undefined,
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/interview/enough") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    const n = declareContextSufficient(b["project"] ?? "", b["note"]?.trim() || undefined);
    json(res, 200, { deferred: n });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/interview/reopen") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    const n = reopenDeferredQuestions(b["project"] ?? "");
    json(res, 200, { reopened: n });
    return;
  }
  // Governed back-and-forth (ADR-0022 §14) — pure data moves, zero tokens.
  if (req.method === "POST" && url.pathname === "/api/candidate/withdraw") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    withdrawCandidate(b["project"] ?? "");
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/approval/revoke") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    revokeApproval(b["project"] ?? "");
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/decision/dismiss") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    setAsideOpenSurface(b["project"] ?? "");
    json(res, 200, { ok: true });
    return;
  }
  // The journey bar walks back through the plan's whole chain in one click.
  if (req.method === "POST" && url.pathname === "/api/journey/back") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    const target = b["target"] ?? "";
    if (target !== "interview" && target !== "candidate" && target !== "approve") {
      json(res, 400, { error: "alvo de navegação inválido" });
      return;
    }
    const plan = planStepsBack(projectId, target as BackTarget);
    if (!plan.ok) {
      json(res, 409, { error: plan.why });
      return;
    }
    const steps = stepBackTo(projectId, target as BackTarget);
    json(res, 200, { ok: true, steps });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/seed/evidence") {
    const b = await body(req);
    if (!b["note"]?.trim()) {
      json(res, 400, { error: "a evidência precisa da tua nota — é ela que volta ao ativo" });
      return;
    }
    recordSeedEvidenceGoverned(
      b["project"] ?? "",
      b["seedId"] ?? "",
      b["kind"] === "contradicting" ? "contradicting" : "supporting",
      b["note"].trim(),
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/hi/sensei") {
    const b = await body(req);
    if (!b["title"]?.trim()) {
      json(res, 400, { error: "o Sensei precisa de um nome" });
      return;
    }
    const sensei = saveSenseiGoverned(b["project"] ?? "", {
      ...(b["id"]?.trim() ? { id: b["id"].trim() } : {}),
      title: b["title"],
      persona: b["persona"] ?? "",
      domains: (b["domains"] ?? "").split(",").map((d) => d.trim()).filter((d) => d !== ""),
      seedIds: (b["seedIds"] ?? "").split(",").map((s) => s.trim()).filter((s) => s !== ""),
      selectionNotes: (b["notes"] ?? "").split("\n").map((n) => n.trim()).filter((n) => n !== ""),
    });
    json(res, 200, { id: sensei.id, version: sensei.version });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/option/refine") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    if (!b["instruction"]?.trim()) {
      json(res, 400, { error: "o refinamento precisa da tua instrução" });
      return;
    }
    const refineLevel = getProject(projectId).effortProfile?.questions ?? "low";
    const ok = startOp(projectId, "refine", refineLevel, 1, async () => {
      await refineOption({
        projectId,
        dsId: b["dsId"] ?? "",
        optionId: b["optionId"] ?? "",
        instruction: b["instruction"] ?? "",
        runtime: instrument(projectId),
        onPhase: onPhaseFor(projectId),
        onMeter: onMeterFor(projectId),
      });
    });
    if (!ok) {
      json(res, 409, { error: "já existe uma operação em curso neste projeto" });
      return;
    }
    json(res, 200, { started: "refine" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/option/select") {
    const b = await body(req);
    selectOption(
      b["project"] ?? "",
      b["dsId"] ?? "",
      b["optionId"] ?? "",
      Number(b["version"] ?? 1),
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "GET" && url.pathname === "/api/artifact") {
    const project = getProject(q("project"));
    const a = listArtifacts(project.id).find(
      (x) => x.iteration === Number(q("iteration")) && x.agentId === q("agent"),
    );
    if (!a) {
      json(res, 404, { error: "artefacto desconhecido" });
      return;
    }
    json(res, 200, { content: readText(a.path) });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/op") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    const op = b["op"] ?? "";
    const level = asLevel(b["level"]);
    const project = getProject(projectId);
    const optionsCount = b["options"] ? Number(b["options"]) : undefined;
    const work = async (): Promise<void> => {
      const rt = instrument(projectId);
      const onPhase = onPhaseFor(projectId);
      const onMeter = onMeterFor(projectId);
      if (op === "consult") {
        await runConsult({ projectId, level, runtime: rt, onPhase, onMeter });
      } else if (op === "candidate") {
        await runCandidate({ projectId, level, runtime: rt, onPhase, onMeter });
      } else if (op === "decision") {
        await runDecisionSurface({
          projectId,
          level,
          runtime: rt,
          onPhase,
          onMeter,
          ...(optionsCount ? { optionsCount } : {}),
        });
      } else if (op === "execute") {
        const estimate = probeEffort({
          workspaceDir: workspaceRoot(),
          level,
          plannedCalls: plannedCalls(projectId, "execute", level),
          priorIterations: project.iteration - 1,
        });
        const r = await runExecute({ projectId, level, runtime: rt, onPhase, onMeter });
        writeJson(
          abs(iterationDir(projectId, project.iteration), "effort-actual.json"),
          buildActual({
            estimate,
            level,
            meters: r.meters,
            retriesUsed: r.retriesUsed,
            outcome: "ok",
          }),
        );
      } else {
        throw new Error(`operação desconhecida: ${op}`);
      }
    };
    if (!startOp(projectId, op, level, plannedCalls(projectId, op, level, optionsCount), work)) {
      json(res, 409, { error: "já existe uma operação em curso neste projeto" });
      return;
    }
    json(res, 200, { started: op });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/answers") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    let answers: { questionId: string; answer: string }[];
    try {
      const ids = JSON.parse(b["questionIds"] ?? "[]") as unknown;
      const values = JSON.parse(b["answers"] ?? "[]") as unknown;
      if (!Array.isArray(ids) || !Array.isArray(values) || ids.length === 0 || ids.length !== values.length) {
        throw new Error("lote desalinhado ou vazio");
      }
      answers = ids.map((id, index) => ({ questionId: String(id), answer: String(values[index] ?? "") }));
      if (answers.some((item) => !item.answer.trim())) throw new Error("todas as respostas visíveis são obrigatórias");
    } catch (e) {
      json(res, 400, { error: `lote de respostas inválido: ${e instanceof Error ? e.message : String(e)}` });
      return;
    }
    const answerLevel = getProject(projectId).effortProfile?.questions ?? "low";
    const ok = startOp(projectId, "answer", answerLevel, plannedCalls(projectId, "consult", answerLevel), async () => {
      await answerQuestions({
        projectId,
        answers,
        runtime: instrument(projectId),
        onPhase: onPhaseFor(projectId),
        onMeter: onMeterFor(projectId),
      });
    });
    if (!ok) { json(res, 409, { error: "já existe uma operação em curso neste projeto" }); return; }
    json(res, 200, { started: "answer-batch", count: answers.length });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/question/decide") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    const question = routeQuestionToDecision(b["project"] ?? "", b["questionId"] ?? "");
    json(res, 200, { routed: question.id });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/answer") {
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!guardActive(projectId, res)) return;
    if (!b["answer"]?.trim()) {
      json(res, 400, { error: "a resposta não pode ser vazia" });
      return;
    }
    const answerLevel = getProject(projectId).effortProfile?.questions ?? "low";
    const ok = startOp(
      projectId,
      "answer",
      answerLevel,
      plannedCalls(projectId, "consult", answerLevel),
      async () => {
        await answerQuestion({
          projectId,
          questionId: b["questionId"] ?? "",
          answer: b["answer"] ?? "",
          runtime: instrument(projectId),
          onPhase: onPhaseFor(projectId),
          onMeter: onMeterFor(projectId),
        });
      },
    );
    if (!ok) {
      json(res, 409, { error: "já existe uma operação em curso neste projeto" });
      return;
    }
    json(res, 200, { started: "answer" });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/op/stop") {
    // Ponto E: stopping must ALWAYS be allowed, even on a concluded/reopening
    // edge — a governed halt is never itself blocked by guardActive.
    const b = await body(req);
    const projectId = b["project"] ?? "";
    if (!busy.has(projectId)) {
      json(res, 409, { error: "não há operação em curso" });
      return;
    }
    aborters.get(projectId)?.abort();
    json(res, 200, { stopping: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/decide") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    decideCandidate(
      b["project"] ?? "",
      b["decision"] === "approve" ? "approve" : "reject",
      b["note"]?.trim() || undefined,
    );
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/advance") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    // "Melhorar" é uma nova passagem pelo ciclo com a tua direção à frente —
    // nunca uma etapa isolada: a nota entra no contexto de todo o trabalho
    // seguinte, as decisões anteriores ficam preservadas.
    if (b["direction"]?.trim()) addPilotNote(b["project"] ?? "", b["direction"].trim());
    advanceIteration(b["project"] ?? "");
    json(res, 200, { ok: true });
    return;
  }
  if (req.method === "POST" && url.pathname === "/api/note") {
    const b = await body(req);
    if (!guardActive(b["project"] ?? "", res)) return;
    if (b["note"]?.trim()) addPilotNote(b["project"] ?? "", b["note"].trim());
    json(res, 200, { ok: true });
    return;
  }
  json(res, 404, { error: "not found" });
}

// ---------------------------------------------------------------------------
// The page — one file, no build step, Portuguese like its user.

const PAGE = /* html */ `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<title>AgentOS</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
  :root { --bg:#0e1116; --card:#161b23; --line:#242c38; --tx:#d7dee8; --dim:#8b96a5;
          --acc:#4da3ff; --ok:#3fb96b; --warn:#e0a63f; --bad:#e05c5c; }
  * { box-sizing:border-box; }
  body { margin:0; background:var(--bg); color:var(--tx);
         font:15px/1.55 "Segoe UI", system-ui, sans-serif; }
  .wrap { max-width:980px; margin:0 auto; padding:24px 16px 80px; }
  h1 { font-size:20px; margin:0 0 4px; } h1 a { color:var(--tx); text-decoration:none; }
  h2 { font-size:15px; margin:0 0 10px; color:var(--tx); }
  .sub { color:var(--dim); font-size:13px; margin-bottom:20px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:10px;
          padding:16px; margin-bottom:14px; }
  .badge { display:inline-block; padding:1px 9px; border-radius:20px; font-size:12px;
           border:1px solid var(--line); color:var(--dim); margin-left:8px; }
  .badge.acc { color:var(--acc); border-color:var(--acc); }
  button { background:var(--acc); color:#08111e; border:0; border-radius:8px;
           padding:9px 18px; font-size:14px; font-weight:600; cursor:pointer; }
  button.ghost { background:transparent; color:var(--dim); border:1px solid var(--line); }
  button.danger { background:transparent; color:var(--bad); border:1px solid var(--bad); }
  button:disabled { opacity:.45; cursor:default; }
  input, textarea, select { width:100%; background:#0b0f14; border:1px solid var(--line);
           color:var(--tx); border-radius:8px; padding:9px 11px; font:inherit; }
  textarea { min-height:76px; resize:vertical; }
  label { display:block; font-size:12px; color:var(--dim); margin:10px 0 4px; }
  .row { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  .grow { flex:1; }
  .agent { display:inline-block; background:#0b0f14; border:1px solid var(--line);
           border-radius:8px; padding:8px 12px; margin:4px 6px 4px 0; max-width:100%; }
  .agent b { color:var(--acc); font-size:13px; }
  .agent div { font-size:12px; color:var(--dim); }
  .q { font-size:17px; margin:6px 0 12px; }
  .kv { font-size:13px; color:var(--dim); }
  .kv b { color:var(--tx); }
  pre { background:#0b0f14; border:1px solid var(--line); border-radius:8px;
        padding:12px; overflow-x:auto; font-size:12.5px; white-space:pre-wrap; }
  details { margin-top:8px; } summary { cursor:pointer; color:var(--dim); font-size:13px; }
  .ev { font-size:12px; color:var(--dim); padding:3px 0; border-bottom:1px dashed var(--line); }
  .ev b { color:var(--tx); font-weight:600; }
  .err { color:var(--bad); font-size:13px; white-space:pre-wrap; }
  .spin { color:var(--warn); font-size:13px; }
  .probe { font-size:12.5px; color:var(--dim); background:#0b0f14; border:1px dashed var(--line);
           border-radius:8px; padding:8px 12px; margin-top:8px; }
  .probe b { color:var(--warn); }
  input[type=range] { padding:0; accent-color:var(--acc); }
  .stateDoc dt { color:var(--dim); font-size:12px; margin-top:8px; }
  .stateDoc dd { margin:2px 0 0; }
  .proj { display:block; padding:12px 16px; background:var(--card); border:1px solid var(--line);
          border-radius:10px; margin-bottom:10px; color:var(--tx); text-decoration:none; }
  .proj:hover { border-color:var(--acc); }
  .proj small { color:var(--dim); }
  .tabs { display:flex; gap:6px; margin:0 0 16px; }
  .tab { padding:6px 16px; border-radius:20px; border:1px solid var(--line); color:var(--dim);
         background:transparent; font-size:13px; font-weight:600; cursor:pointer; }
  .tab.on { color:var(--acc); border-color:var(--acc); background:rgba(77,163,255,.08); }
  .tl { border-left:2px solid var(--line); margin-left:8px; padding-left:18px; }
  .tli { position:relative; margin-bottom:14px; }
  .tli::before { content:""; position:absolute; left:-24px; top:6px; width:9px; height:9px;
                 border-radius:50%; background:var(--line); }
  .tli.pilot::before { background:var(--acc); }
  .tli .when { font-size:11px; color:var(--dim); }
  .tli .lbl { font-weight:600; }
  .tli .who { font-size:11px; padding:0 7px; border-radius:10px; border:1px solid var(--line);
              color:var(--dim); margin-left:6px; }
  .tli.pilot .who { color:var(--acc); border-color:var(--acc); }
  .xchip { display:inline-block; font-size:11.5px; color:var(--warn); border:1px dashed var(--warn);
           border-radius:10px; padding:0 8px; margin:2px 4px 2px 0; }
  .itdiv { margin:20px 0 12px; color:var(--acc); font-weight:700; font-size:13px; }
  .xp { background:#0b0f14; border:1px solid var(--line); border-radius:8px; padding:10px 12px;
        margin-bottom:8px; }
  .xp .st { font-size:11px; padding:0 8px; border-radius:10px; border:1px solid var(--line);
            margin-left:6px; }
  .xp .st.admitted { color:var(--ok); border-color:var(--ok); }
  .xp .st.candidate { color:var(--warn); border-color:var(--warn); }
  .xp .st.discarded { color:var(--dim); }

  /* A jornada persistente — cor com função: azul = ação atual, âmbar =
     decisão humana pendente, verde = feito/aprovado, cinza = passado/técnico. */
  .journey { display:flex; flex-wrap:wrap; gap:4px; align-items:center; margin:14px 0 4px; }
  .jstep { font-size:12px; padding:3px 10px; border-radius:20px; border:1px solid var(--line);
           color:var(--dim); }
  .jstep.done { color:var(--ok); border-color:rgba(63,185,107,.55); }
  .jstep.now { color:#08111e; background:var(--acc); border-color:var(--acc); font-weight:700; }
  .jstep.now.need { background:var(--warn); border-color:var(--warn); }
  .jsep { color:var(--line); font-size:12px; }
  .jline { font-size:12.5px; color:var(--dim); margin:0 0 16px; }
  .jline b { color:var(--tx); }
  button.jstep.jback { font:inherit; font-size:12px; font-weight:700; padding:3px 10px;
           border-radius:20px; background:transparent; color:var(--ok);
           border:1px solid rgba(63,185,107,.55); cursor:pointer; }
  button.jstep.jback:hover { background:rgba(63,185,107,.18); }
  .jstep.jblocked { opacity:.55; cursor:help; }
  .jlock { background:transparent; color:var(--dim); border:1px solid var(--line);
           border-radius:20px; font-size:12px; font-weight:600; padding:3px 10px;
           margin-left:auto; cursor:pointer; }
  .jlock.on { color:var(--warn); border-color:var(--warn); }
  .card.primary { border-left:4px solid var(--acc); }
  .card.primary.need { border-left-color:var(--warn); }
  .card.primary.wait { border-left-color:var(--dim); }
  .card.primary.closed { border-left-color:var(--ok); }
  .kicker { font-size:11px; letter-spacing:.12em; font-weight:700; color:var(--acc);
            margin-bottom:6px; }
  .primary.need .kicker { color:var(--warn); }
  .primary.wait .kicker { color:var(--dim); }
  .primary.closed .kicker { color:var(--ok); }
  button.approve { background:var(--ok); }
  .badge.ok { color:var(--ok); border-color:var(--ok); }
  .badge.warn { color:var(--warn); border-color:var(--warn); }
  .proj .next { font-size:12.5px; color:var(--warn); margin-top:2px; }
  .proj .next.act { color:var(--acc); }
  .proj.closed { opacity:.75; }
  .wo { font-size:12px; color:var(--dim); padding:3px 0; border-bottom:1px dashed var(--line); }
  .wo b { color:var(--tx); }
</style>
</head>
<body>
<div class="wrap" id="app">A carregar…</div>
<script>
"use strict";
// The page's OWN identity, stamped by the process that served it. Everything
// else on screen comes from the API at each poll — so without this, a tab
// from an older process would happily display the NEW server's build while
// running old code. The poll compares and asks for a reload when they differ.
var PAGE_BOOT = ${JSON.stringify({ sha: BUILD.sha, startedAt: BUILD.startedAt })};
var $ = function (id) { return document.getElementById(id); };
var app = $("app");
var projectId = new URLSearchParams(location.search).get("p");
var state = null;
var levelChosen = null;
var journeyUnlocked = false; // per page-load; unlocking is a gesture, not a preference
var lastJson = "";
var view = "agora";

// Ponto F — polling failure must never be silent: a fixed banner outside
// #app so a render() rebuild can never eat it, ticking every second while
// the connection to the App is down.
var connbar = document.createElement("div");
connbar.id = "connbar";
connbar.style.cssText = "position:fixed;top:0;left:0;right:0;z-index:9;padding:6px 16px;" +
  "background:#3a2f14;color:#e0a63f;font-size:13px;display:none";
document.body.appendChild(connbar);
var lastPollOkAt = Date.now();
var lastPollContactAt = Date.now();
var lastPollOutcome = "ok";

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
  });
}
function post(path, data) {
  return fetch(path, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify(data) }).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || r.status); return j; });
    });
}

// ---------------- a jornada (linguagem humana, persistente) ----------------
// A jornada orienta; o Kernel continua a decidir que passos são necessários.
// Os estados internos (consult, candidate, execute…) vivem em Auditoria.
var STEPS = ["Intenção", "Compreender", "Decidir", "Aprovar", "Criar",
  "Avaliar e aprender", "Continuar ou concluir"];
// kind: "need" = decisão humana pendente (âmbar) · "act" = lançar o sistema (azul)
var STAGE_MAP = {
  consult:   { step: 1, kind: "act",  now: "o sistema vai compreender a tua intenção",
               next: "Pôr a equipa a compreender" },
  interview: { step: 1, kind: "need", now: "há perguntas para ti",
               next: "Responder — ou declarar que chega" },
  candidate: { step: 2, kind: "act",  now: "hora de decidir o rumo",
               next: "Pedir opções ou condensar o estado" },
  decide:    { step: 2, kind: "need", now: "há opções à tua espera",
               next: "Escolher ou refinar uma opção" },
  approve:   { step: 3, kind: "need", now: "um estado espera a tua aprovação",
               next: "Aprovar ou rejeitar com direção" },
  execute:   { step: 4, kind: "act",  now: "pronto para criar",
               next: "Mandar criar" },
  advance:   { step: 5, kind: "need", now: "resultado entregue — avalia e decide o futuro",
               next: "Avaliar, melhorar, continuar ou concluir" }
};
function isConcluded(p) { return (p.status || "active") === "concluded"; }
function stageInfo(stage, project) {
  if (project && isConcluded(project)) {
    return { step: 6, kind: "done", now: "projeto concluído e arquivado",
             next: "Reabrir, se quiseres continuar" };
  }
  return STAGE_MAP[stage] || STAGE_MAP.consult;
}
// Desbloqueada, a barra é a navegação de volta (ADR-0022 decisão 14): cada
// passo anterior alcançável executa a cadeia de atos governados que lá chega
// — zero tokens, nada se perde. Bloqueada (o defeito), é só informação.
var BACK_TARGET_BY_STEP = { 1: "interview", 2: "candidate", 3: "approve" };
var BACK_ACT_WORDS = {
  dismiss_surface: "pôr a decisão aberta de lado (as opções ficam no registo)",
  withdraw_candidate: "retirar a proposta da mesa (fica no registo)",
  revoke_approval: "reabrir a aprovação (o estado aprovado fica na história)"
};
function backStepWords(st) {
  if (st.act === "reopen_questions") return "reabrir " + st.count + " pergunta(s) adiada(s)";
  return BACK_ACT_WORDS[st.act] || st.act;
}
function journeyBar(s) {
  var info = stageInfo(s.stage, s.project);
  var concluded = isConcluded(s.project);
  var h = '<div class="journey">';
  STEPS.forEach(function (label, i) {
    var cls;
    if (info.kind === "done") cls = i <= info.step ? "done" : "todo";
    else cls = i < info.step ? "done" : i === info.step ? (info.kind === "need" ? "now need" : "now") : "todo";
    var target = BACK_TARGET_BY_STEP[i];
    var plan = !concluded && journeyUnlocked && i < info.step && target && s.journey ? s.journey[target] : null;
    if (plan && plan.ok) {
      h += '<button class="jstep jback" onclick="journeyBack(\\'' + target + '\\')" title="' +
        esc("Voltar a " + label + ": " + plan.steps.map(backStepWords).join("; ")) + '">⟲ ' + label + "</button>";
    } else if (plan && !plan.ok) {
      h += '<span class="jstep ' + cls + ' jblocked" title="' + esc(plan.why) + '">' + label + "</span>";
    } else {
      h += '<span class="jstep ' + cls + '">' + label + "</span>";
    }
    if (i < STEPS.length - 1) h += '<span class="jsep">›</span>';
  });
  if (!concluded) {
    h += '<button class="jlock' + (journeyUnlocked ? " on" : "") + '" onclick="toggleJourneyLock()">' +
      (journeyUnlocked ? "🔓 desbloqueada — bloquear" : "🔒 desbloquear a jornada") + "</button>";
  }
  h += "</div>";
  var nxt = info.step < STEPS.length - 1 ? STEPS[info.step + 1] : null;
  h += '<div class="jline">Estás em <b>' + STEPS[info.step] + "</b> — " + esc(info.now) +
    (nxt ? ' · depois vem <b>' + nxt + "</b>" : "") +
    (journeyUnlocked && !concluded
      ? ' · <b>jornada desbloqueada</b>: clica um passo anterior para voltar atrás — zero tokens, nada se perde'
      : "") + "</div>";
  return h;
}
function toggleJourneyLock() {
  journeyUnlocked = !journeyUnlocked;
  render();
}
function journeyBack(target) {
  // Desbloquear a jornada É o consentimento — o botão diz a cadeia inteira
  // no title e na jline; um confirm() nativo aqui seria fricção redundante.
  var plan = state && state.journey ? state.journey[target] : null;
  if (!plan || !plan.ok) return;
  post("/api/journey/back", { project: projectId, target: target })
    .then(function () { journeyUnlocked = false; return load(); })
    .catch(function (e) { alert(e.message); });
}
function relTime(ts) {
  var min = Math.round((Date.now() - new Date(ts).getTime()) / 60000);
  if (min < 1) return "agora mesmo";
  if (min < 60) return "há " + min + " min";
  var h = Math.round(min / 60);
  if (h < 24) return "há " + h + " h";
  return "há " + Math.round(h / 24) + " dia(s)";
}

// ---------------- home ----------------
function renderHome() {
  fetch("/api/projects").then(function (r) { return r.json(); }).then(function (data) {
    var h = '<h1>AgentOS</h1><div class="sub">Declara a intenção. O sistema digere. ' +
      'Tu governas. <span class="badge">runtime: ' + esc(data.runtime) + '</span>' +
      (data.build ? '<span class="badge">build ' + esc(data.build.sha) + '</span>' : "") +
      '</div>';
    h += fakeRuntimeCard(data.runtime);
    h += pageBootCard(data.build);
    h += staleCard(data.build);
    function homeLevelSelect(id) {
      var h2 = '<select id="' + id + '">';
      ["minimal", "low", "balanced", "high", "maximum"].forEach(function (l) {
        h2 += '<option value="' + l + '"' + (l === "low" ? " selected" : "") + ">" + l + "</option>";
      });
      return h2 + "</select>";
    }
    h += '<div class="card"><h2>Novo projeto</h2>' +
      '<label>Nome</label><input id="pname" placeholder="O nome do projeto">' +
      '<label>O que queres? (texto livre — a intenção fundadora)</label>' +
      '<textarea id="pdesc" placeholder="Descreve o que queres que exista no fim…"></textarea>' +
      '<details style="margin-top:8px"><summary class="kv">Perfil de esforço por fase (opcional — por defeito tudo "low"; podes mudar a qualquer momento)</summary>' +
      '<div class="row" style="margin-top:6px">' +
      '<div class="grow"><label>Perguntas</label>' + homeLevelSelect("nefq") + "</div>" +
      '<div class="grow"><label>Opções</label>' + homeLevelSelect("nefo") + "</div>" +
      '<div class="grow"><label>Execução</label>' + homeLevelSelect("nefe") + "</div></div></details>" +
      '<div style="margin-top:12px"><button onclick="createProject()">Criar projeto</button></div>' +
      '<div class="err" id="cerr"></div></div>';
    if (data.projects.length) {
      h += "<h2 style='margin:18px 0 10px'>Projetos</h2>";
      var projs = data.projects.slice().sort(function (a, b) {
        var ca = isConcluded(a) ? 1 : 0, cb = isConcluded(b) ? 1 : 0;
        if (ca !== cb) return ca - cb;
        return (b.lastActivityAt || "").localeCompare(a.lastActivityAt || "");
      });
      projs.forEach(function (p) {
        var info = stageInfo(p.stage, p);
        var closed = isConcluded(p);
        h += '<a class="proj' + (closed ? " closed" : "") + '" href="/?p=' + esc(p.id) + '">' +
          "<b>" + esc(p.name) + "</b> " +
          (closed ? '<span class="badge ok">concluído</span>'
                  : '<span class="badge">' + STEPS[info.step] + "</span>") +
          '<small> · passagem ' + p.iteration + " · última atividade " +
          relTime(p.lastActivityAt || p.createdAt) + "</small>" +
          '<div class="next' + (info.kind === "act" ? " act" : "") + '">' +
          (closed ? "arquivado — podes reabrir" : "próxima ação: " + esc(info.next)) +
          "</div></a>";
      });
    }
    app.innerHTML = h;
  });
}
function createProject() {
  post("/api/project", { name: $("pname").value, description: $("pdesc").value,
    effortQuestions: $("nefq") ? $("nefq").value : "low",
    effortOptions: $("nefo") ? $("nefo").value : "low",
    effortExecution: $("nefe") ? $("nefe").value : "low" })
    .then(function (r) { location.search = "?p=" + r.id; })
    .catch(function (e) { $("cerr").textContent = e.message; });
}

// ---------------- project ----------------
// Ponto F — verified live: a dead server does NOT reject the fetch; the
// connection just hangs, the catch never fires, and hung polls pile up until
// the browser's connection pool starves. So every poll carries its own 5s
// abort, and the banner derives from the AGE of the last successful poll —
// never from a rejection that may never come.
//
// Poll hardening (ADR-0022 PHASE 1 item 6) — this is the hand-mirrored twin
// of product/src/poll-logic.ts (browser inline JS cannot import a module);
// any change to shouldApplyPoll/classifyPollOutcome there must be mirrored
// here, and vice versa.
function shouldApplyPollClient(lastAppliedSeq, responseSeq) {
  return responseSeq > lastAppliedSeq;
}
function classifyPollOutcomeClient(o) {
  if (o.fetchRejected) return "connection-failure";
  if (o.httpStatus !== 200 || o.parseFailed) return "data-error";
  return "ok";
}
var pollSeq = 0;
var lastAppliedSeq = 0;
var pollInFlight = false;
function finishPoll(seq, outcome, s) {
  pollInFlight = false;
  if (outcome === "connection-failure") {
    lastPollOutcome = "connection-failure";
    // Silent here — the 1s interval's own staleness banner (age of
    // lastPollOkAt) is the honest signal for a hung/aborted connection.
    return;
  }
  if (outcome === "data-error") {
    lastPollContactAt = Date.now();
    lastPollOutcome = "data-error";
    // A DIFFERENT banner from the connection-age one: the App answered, but
    // with a bad status or unparseable body — never conflated with "the App
    // is unreachable".
    connbar.style.display = "block";
    connbar.textContent = "Erro de dados do servidor — a tentar de novo…";
    return;
  }
  // outcome === "ok" — but a newer poll may have already landed and applied
  // (out-of-order network delivery); an older one must never win.
  if (!shouldApplyPollClient(lastAppliedSeq, seq)) return;
  lastAppliedSeq = seq;
  lastPollOkAt = Date.now();
  lastPollContactAt = lastPollOkAt;
  lastPollOutcome = "ok";
  connbar.style.display = "none";
  // Re-render only on real change — a quiet poll must not eat a click.
  var j = JSON.stringify(s);
  if (j === lastJson) return;
  lastJson = j;
  state = s;
  // In the story/library views a state change refreshes content in place —
  // no "a carregar…" flash, no eaten interactions.
  if (view === "agora") render();
  else if (view === "historia") loadStory();
  else loadHi();
}
function load() {
  // At most one poll in flight — if the 2.5s timer fires while a poll is
  // still pending, skip this tick rather than piling another one on top.
  if (pollInFlight) return;
  pollInFlight = true;
  var seq = ++pollSeq;
  var ctl = new AbortController();
  var kill = setTimeout(function () { ctl.abort(); }, 5000);
  fetch("/api/state?project=" + encodeURIComponent(projectId), { signal: ctl.signal })
    .then(function (r) {
      clearTimeout(kill);
      var httpStatus = r.status;
      return r.json().then(
        function (s) {
          finishPoll(seq, classifyPollOutcomeClient({
            fetchRejected: false, httpStatus: httpStatus, parseFailed: false,
          }), s);
        },
        function () {
          finishPoll(seq, classifyPollOutcomeClient({
            fetchRejected: false, httpStatus: httpStatus, parseFailed: true,
          }), null);
        },
      );
    })
    .catch(function () {
      clearTimeout(kill);
      finishPoll(seq, classifyPollOutcomeClient({
        fetchRejected: true, httpStatus: null, parseFailed: false,
      }), null);
    });
}

// Ponto D — cada operação pertence a uma fase; o perfil do projeto dá o
// default, o slider continua a poder fazer override pontual.
function phaseOf(op) {
  if (op === "execute") return "execution";
  if (op === "decision" || op === "candidate") return "options";
  return "questions";
}
function levelFor(op) {
  return levelChosen || (state.effortProfile && state.effortProfile[phaseOf(op)]) || "low";
}
function levelSelector(op) {
  var lv = levelFor(op);
  var idx = state.levels.map(function (l) { return l.level; }).indexOf(lv);
  var spec = state.levels[idx];
  return '<label>Esforço — o teu perfil define a fase; o slider faz override pontual</label>' +
    '<div class="row"><input type="range" min="0" max="4" step="1" value="' + idx + '" class="grow" ' +
    'oninput="setLevel(this.value, \\'' + op + '\\')">' +
    '<span class="badge acc">' + esc(lv) + " · " + esc(spec.workerModel) + "</span>" +
    (levelChosen ? "" : '<span class="badge">perfil: ' + esc(phaseLabel(phaseOf(op))) + "</span>") +
    "</div>" +
    '<div class="probe" id="probe">a estimar…</div>';
}
function phaseLabel(ph) {
  return ph === "questions" ? "perguntas" : ph === "options" ? "opções" : "execução";
}
function setLevel(idx, op) {
  levelChosen = state.levels[Number(idx)].level;
  render();
  loadProbe(op);
}
function loadProbe(op) {
  if (!$("probe")) return;
  var extra = "";
  if (op === "decision" && $("optcount")) extra = "&options=" + $("optcount").value;
  fetch("/api/probe?project=" + encodeURIComponent(projectId) + "&level=" +
    levelFor(op) + "&op=" + op + extra)
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var p = d.probe;
      $("probe").innerHTML = "Probe: <b>" + p.calls + "</b> chamadas · ~<b>" +
        p.expectedTokens.toLocaleString() + "</b> tokens · ~<b>" +
        Math.round(p.expectedDurationMs / 1000) + "s</b> · pressão <b>" + esc(p.pressure) +
        "</b> · confiança " + esc(p.confidence) + " (" + p.basedOnRuns + " runs)" +
        "<br>Recomendação: <b>" + esc(p.recommendation) + "</b> — " + esc(p.recommendationReason) +
        "<br>" + esc(p.expectedQuality);
    });
}

// Ponto I — tempo e tokens visíveis enquanto o sistema pensa.
function elapsedSince(iso) {
  var s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  var m = Math.floor(s / 60);
  return m > 0 ? m + "m" + String(s % 60).padStart(2, "0") + "s" : s + "s";
}
function metersLine(s) {
  if (!s.meters || !s.meters.workOrders) return "";
  return '<div class="kv" style="margin-top:6px">Esta passagem: <b>' +
    s.meters.tokens.toLocaleString() + "</b> tokens" +
    (s.meters.estimated ? " (estimados)" : "") + " em <b>" + s.meters.workOrders +
    "</b> work orders · <b>" + Math.round(s.meters.durationMs / 1000) + "s</b> de modelo</div>";
}
// Ponto D/G — the honest heartbeat gap, shared between the initial render and
// the 1s ticking interval so the two never disagree.
function heartbeatText(b) {
  var gapS = Math.max(0, Math.round((Date.now() - new Date(b.heartbeatAt).getTime()) / 1000));
  var txt = "há " + gapS + "s";
  var amber = gapS > 30;
  if (b.timeoutMs && gapS * 1000 > b.timeoutMs) {
    txt += " — pode ter excedido o tempo — deve falhar em breve";
  } else if (amber) {
    txt += " — sem sinal recente";
  }
  return { text: txt, amber: amber };
}
// One tick drives THREE independent, honest displays — none of them re-render
// the page (lastJson dedupes polls; a full render would eat in-flight text):
// the elapsed timer, the heartbeat gap, and the polling-failure banner.
setInterval(function () {
  var el = $("elapsed");
  if (el && state && state.busy) el.textContent = elapsedSince(state.busy.startedAt);
  var hb = $("hb");
  if (hb && state && state.busy) {
    var ht = heartbeatText(state.busy);
    hb.textContent = ht.text;
    hb.style.color = ht.amber ? "var(--warn)" : "";
  }
  // Staleness of the last GOOD poll is the only honest signal — a hung fetch
  // never rejects, so a catch-driven flag would lie by omission.
  if (projectId) {
    var downS = Math.round((Date.now() - lastPollOkAt) / 1000);
    var contactS = Math.round((Date.now() - lastPollContactAt) / 1000);
    if (lastPollOutcome === "data-error" && contactS <= 8) {
      connbar.style.display = "block";
      connbar.textContent = "Erro de dados do servidor — a App respondeu, mas a resposta não é utilizável. A tentar de novo…";
    } else if (downS > 8) {
      connbar.style.display = "block";
      connbar.textContent = "Ligação à App interrompida — última atualização há " + downS +
        "s. A tentar novamente…";
    }
  }
}, 1000);

// O cartão dominante: UMA área que diz o que precisa do utilizador agora.
// Azul = ação para lançar; âmbar = decisão humana pendente; verde = concluído.
var BUSY_HUMAN = {
  consult: "a equipa está a compreender a tua intenção e a preparar perguntas",
  answer: "a tua resposta está a ser levada aos agentes que perguntaram",
  candidate: "o sistema está a condensar o estado do projeto",
  decision: "o sistema está a preparar opções genuinamente diferentes",
  refine: "a tua instrução está a refinar a opção",
  execute: "o sistema está a criar — o resultado regressa sozinho"
};
var concluding = false;

function primary(kind, title, inner) {
  var cls = kind === "need" ? " need" : kind === "wait" ? " wait" : kind === "closed" ? " closed" : "";
  var kick = kind === "wait" ? "O SISTEMA ESTÁ A TRABALHAR" :
    kind === "closed" ? "PROJETO CONCLUÍDO" : "O QUE PRECISA DE TI AGORA";
  return '<div class="card primary' + cls + '"><div class="kicker">' + kick + "</div>" +
    "<h2>" + title + "</h2>" + inner + "</div>";
}

// Ponto B/D — explicit states, honestly labeled; a stage label and elapsed
// time are more honest than an invented percentage.
var PHASE_PT = {
  "queued": "na fila",
  "launching": "a lançar o Claude Code",
  "awaiting-model": "a aguardar resposta do modelo",
  "response-received": "resposta recebida",
  "validating-parsing": "a validar",
  "persisting": "a gravar"
};
function liveOpBody(s) {
  var b = s.busy;
  var woLine;
  if (b.callsPlanned > 0 && b.callsDone >= b.callsPlanned) {
    woLine = b.callsDone + " de " + b.callsPlanned + " concluídas";
  } else {
    woLine = "Work order " + (b.callsDone + 1) + " de " + b.callsPlanned;
  }
  if (b.workOrderId) woLine += ' · <span style="color:var(--dim)">' + esc(b.workOrderId) + "</span>";
  if (b.model) woLine += " · modelo " + esc(b.model) + " · esforço " + esc(b.effortLevel);
  var ht = heartbeatText(b);
  var agentLine = (b.humanRole || b.agentId)
    ? '<div class="kv" style="margin-top:6px">Agente: <b>' + esc(b.humanRole || b.agentId) + "</b></div>"
    : "";
  var tokensLine = b.tokensDone > 0
    ? '<div class="kv" style="margin-top:6px">Tokens até agora: <b>' + b.tokensDone.toLocaleString() +
      "</b> (" + (b.tokensEstimated ? "estimados" : "exatos") + ")</div>"
    : "";
  var h = '<div class="spin">⏳ ' + esc(PHASE_PT[b.phase] || b.phase) + "</div>" +
    '<div class="kv" style="margin-top:6px">' + woLine + "</div>" +
    agentLine +
    '<div class="kv" style="margin-top:6px">Operação <span style="color:var(--dim)">' +
    esc(b.operationId) + "</span></div>" +
    '<div class="kv" style="margin-top:6px">Tempo decorrido: <b id="elapsed">' +
    elapsedSince(b.startedAt) + '</b> · Última atividade: <span id="hb" style="' +
    (ht.amber ? "color:var(--warn)" : "") + '">' + ht.text + "</span></div>" +
    tokensLine +
    metersLine(s) +
    '<div class="kv" style="margin-top:6px">Os tokens desta chamada aparecem quando ela terminar.</div>';
  if (b.timeoutMs) {
    h += '<div class="kv" style="margin-top:2px">timeout desta chamada: ' +
      Math.round(b.timeoutMs / 60000) + "m</div>";
  }
  h += '<div style="margin-top:12px"><button class="danger" onclick="stopOp()">Parar esta operação</button></div>';
  return h;
}

function concludeBlock(s) {
  var h = '<div class="kv" style="margin-top:10px">Concluir é um ato governado: o resultado fica ' +
    "confirmado, o projeto congela e é <b>arquivado — nada se apaga</b>, toda a proveniência fica. " +
    "Podes reabrir mais tarde, com evidência.</div>";
  if (s.pendingCandidates > 0) {
    h += '<div class="kv" style="margin-top:6px;color:var(--warn)">🌱 ' + s.pendingCandidates +
      " aprendizagem(ns) candidata(s) esperam o teu julgamento — resolve-as na Inteligência Humana " +
      "antes de arquivar, para o projeto fechar limpo.</div>";
  }
  h += '<label>O que este projeto terminou a ser (opcional — fica no registo)</label>' +
    '<textarea id="cnote"></textarea>' +
    '<div class="row" style="margin-top:10px">' +
    '<button class="approve" onclick="doConclude()">Concluir e arquivar</button>' +
    '<button class="ghost" onclick="cancelConclude()">Cancelar</button></div>';
  return h;
}

function primaryCard() {
  var s = state, h = "";
  if (isConcluded(s.project)) {
    return primary("closed", esc(s.project.name) + " está arquivado",
      '<div class="kv">Concluído ' + (s.project.concludedAt ? relTime(s.project.concludedAt) : "") +
      (s.project.concludedNote ? ' · "' + esc(s.project.concludedNote) + '"' : "") +
      " · Tudo fica: história, artefactos, proveniência.</div>" +
      '<div style="margin-top:12px"><button class="ghost" onclick="reopen()">Reabrir projeto</button></div>');
  }
  if (s.busy) {
    // Ponto B/D: the live operation card — every field derives from REAL
    // runtime activity (the shell's instrument() wrapper), never an invented
    // percentage. Ticking (#elapsed, #hb) comes from the 1s interval, never
    // from a re-render, so an in-flight click or keystroke is never eaten.
    return primary("wait", esc(BUSY_HUMAN[s.busy.op] || s.busy.op),
      liveOpBody(s));
  }
  if (s.stage === "consult") {
    h = primary("act", s.roster ? "Voltar a pôr a equipa a compreender" : "Pôr a equipa a compreender a tua intenção",
      '<div class="kv">' + (s.roster ? "A equipa reconsulta com tudo o que já decidiste." :
        "O sistema monta uma equipa delimitada a partir da tua intenção e traz-te só as perguntas que importam.") +
      "</div>" + levelSelector("consult") +
      '<div style="margin-top:12px"><button onclick="op(\\'consult\\')">Começar — recolher as perguntas da equipa</button></div>');
  } else if (s.stage === "interview" && s.interview.topThree && s.interview.topThree.length) {
    var batch = s.interview.topThree;
    var questionsHtml = '<div class="kv">' + s.interview.open + ' em aberto · até 3 perguntas coerentes por envio</div>';
    batch.forEach(function (t, i) {
      questionsHtml += '<div style="margin-top:12px"><div class="q">' + esc(t.text) + '</div>' +
        '<textarea id="answer-' + i + '" data-qid="' + esc(t.id) + '" placeholder="A tua resposta"></textarea>' +
        '<button class="ghost" style="margin-top:6px" onclick="routeToDecide(&quot;' + esc(t.id) + '&quot;)">Levar para Decidir — quero opções</button></div>';
    });
    h = primary("need", batch.length + (batch.length === 1 ? " pergunta" : " perguntas") + " nesta ronda",
      questionsHtml + effortQuestionsInline(s) +
      '<div class="row" style="margin-top:12px"><button onclick="answerBatch(' + batch.length + ')">Responder às ' + batch.length + '</button>' +
      '<button class="ghost" onclick="enough()">Chega — segue para Decidir com o que tens</button></div>' +
      '<div class="kv" style="margin-top:6px">Cada agente recebe o lote relevante uma única vez. O que não souberes pode virar opções em Decidir; o que adiares podes reabrir lá — navegar não gasta tokens.</div>');
  } else if (s.stage === "interview" && s.interview.top) {
    var t = s.interview.top;
    h = primary("need", "Uma pergunta de cada vez",
      '<div class="q">' + esc(t.text) + "</div>" +
      '<div class="kv">' + s.interview.open + " em aberto (as restantes esperam a vez)</div>" +
      '<label>A tua resposta</label><textarea id="answer"></textarea>' + effortQuestionsInline(s) +
      '<div class="row" style="margin-top:10px"><button onclick="answer(\\'' + esc(t.id) + '\\')">Responder</button>' +
      '<button class="ghost" onclick="enough()">Chega — segue para Decidir com o que tens</button></div>' +
      '<div class="kv" style="margin-top:6px">Ao responder, quem perguntou volta a pensar sozinho. ' +
      "Declarar suficiência é teu por direito: o que ficar em aberto fica adiado e visível, nunca inventado.</div>");
  } else if (s.stage === "decide" && s.surface) {
    h = decisionSurfaceCard(s.surface) +
      backRow("⟲ Pôr esta decisão de lado — voltar atrás sem escolher", "dismissSurface()") +
      reopenDeferredBlock(s);
  } else if (s.stage === "candidate") {
    var rej = s.candidate && s.candidate.status === "rejected" && s.candidate.iteration === s.project.iteration;
    h = primary("act", "Decidir o rumo",
      '<div class="kv">' +
      (rej ? "Rejeitaste a proposta anterior — o sistema reconstrói com a tua nota." :
        "Sem perguntas em aberto. Pede opções concretas para escolheres, ou condensa já o estado do projeto.") +
      "</div>" + levelSelector("candidate") +
      '<label>Quantas opções na mesa? (cada opção extra custa 1 chamada — o probe mostra)</label>' +
      '<select id="optcount" style="width:auto" onchange="loadProbe(\\'decision\\')">' +
      '<option value="2">2 opções</option><option value="3" selected>3 opções</option>' +
      '<option value="4">4 opções</option></select>' +
      '<div class="row" style="margin-top:12px">' +
      '<button onclick="op(\\'decision\\')">Quero opções para escolher</button>' +
      '<button class="ghost" onclick="op(\\'candidate\\')">Condensar já o estado</button></div>' +
      reopenDeferredBlock(s));
  } else if (s.stage === "approve" && s.candidate) {
    h = primary("need", "Aprovas este estado do projeto?",
      stateDoc(s.candidate.state) +
      '<label>Nota (obrigatória se rejeitares — é a tua direção)</label><textarea id="dnote"></textarea>' +
      '<div class="row" style="margin-top:10px"><button class="approve" onclick="decide(\\'approve\\')">Aprovar</button>' +
      '<button class="danger" onclick="decide(\\'reject\\')">Rejeitar com nota</button></div>' +
      backRow("⟲ Retirar esta proposta — voltar atrás", "withdrawCand()"));
  } else if (s.stage === "execute") {
    h = primary("act", "Mandar criar",
      '<div class="kv">Estado aprovado. O sistema vai criar: <b>' +
      esc(s.approved ? s.approved.state.nextAction : "") + "</b></div>" + levelSelector("execute") +
      '<div style="margin-top:12px"><button onclick="op(\\'execute\\')">Criar</button></div>' +
      '<div class="kv" style="margin-top:6px">O resultado regressa sozinho a este ecrã.</div>' +
      backRow("⟲ Reabrir a aprovação — voltar a Aprovar", "revokeAppr()"));
  } else if (s.stage === "advance") {
    var inner = '<div class="kv">O resultado está em baixo, em <b>Resultados</b>. Lê-o. ' +
      "Se uma GuruSeed ajudou ou atrapalhou, devolve o teu veredicto na <b>Inteligência Humana</b> — " +
      "é assim que o sistema aprende contigo.</div>";
    if (s.pendingCandidates > 0) {
      inner += '<div class="kv" style="margin-top:6px;color:var(--warn)">🌱 ' + s.pendingCandidates +
        " aprendizagem(ns) candidata(s) à espera do teu julgamento na Inteligência Humana.</div>";
    }
    if (concluding) {
      inner += concludeBlock(s);
    } else {
      inner += '<label>Melhorar — dá a tua direção; o ciclo repete preservando o que já decidiste</label>' +
        '<textarea id="improveDir" placeholder="ex.: gostei, mas quero mais humor e um final mais calmo"></textarea>' +
        '<div class="row" style="margin-top:10px">' +
        '<button onclick="improve()">Melhorar — nova passagem com a minha direção</button>' +
        '<button class="ghost" onclick="advance()">Nova passagem, sem direção</button>' +
        '<button class="ghost" onclick="concludeUI()">Concluir projeto…</button></div>';
    }
    h = primary("need", "Resultado entregue — avalia e decide o futuro", inner);
  }
  return h;
}

// ---------------- a superfície de decisão ----------------
function latestOptions(surface) {
  var byId = {};
  surface.options.forEach(function (o) {
    if (!byId[o.id] || o.version > byId[o.id].version) byId[o.id] = o;
  });
  return Object.keys(byId).sort().map(function (k) { return byId[k]; });
}

function decisionSurfaceCard(ds) {
  var h = primary("need", "Escolhe o rumo",
    '<div class="q">' + esc(ds.decision) + "</div>" +
    '<div class="kv">' + esc(ds.why) + " · O sistema mastigou; a escolha é tua. " +
    "Podes selecionar, ou refinar uma opção com uma frase antes de selecionar.</div>");
  if (ds.recommendation) {
    h += '<div class="card" style="border-color:var(--warn)"><div class="kv">' +
      '<b style="color:var(--warn)">Recomendação do Kernel:</b> ' +
      esc(ds.recommendation.optionId) + " — " + esc(ds.recommendation.reason) + "</div></div>";
  }
  latestOptions(ds).forEach(function (o) {
    // Ponto C: proveniência EVIDENTE — quem sugeriu esta opção; se a
    // escolheres, é esse Sensei que ganha a vitória e evolui.
    var voices = {};
    if (o.senseiTitle) voices[o.senseiTitle] = true;
    (o.seeds || []).forEach(function (s) {
      var t = s.senseiTitle || s.mentorTitle;
      if (t) voices[t] = true;
    });
    var rec = ds.recommendation && ds.recommendation.optionId === o.id;
    h += '<div class="card"' + (rec ? ' style="border-color:var(--acc)"' : "") + ">" +
      "<h2>" + esc(o.title) + (rec ? " ★" : "") +
      ' <span class="badge">' + esc(o.direction) + "</span>" +
      (o.refinement ? ' <span class="badge acc">v' + o.version + " · refinada</span>" : "") + "</h2>" +
      "<div>" + esc(o.description) + "</div>" +
      (o.benefits ? '<div class="kv" style="margin-top:6px">A favor: ' + esc(o.benefits) + "</div>" : "") +
      (o.tradeoffs ? '<div class="kv">Atenção: ' + esc(o.tradeoffs) + "</div>" : "") +
      (o.refinement ? '<div class="kv">Refinamento aplicado: "' + esc(o.refinement) + '"</div>' : "");
    if (Object.keys(voices).length) {
      h += "<div style='margin-top:6px'>";
      Object.keys(voices).forEach(function (m) {
        h += '<span class="xchip" title="se escolheres esta opção, a vitória evolui este Sensei">🥋 Sensei: ' + esc(m) + "</span>";
      });
      h += "</div>";
    } else {
      h += '<div class="kv" style="margin-top:6px">voz genérica do sistema — sem Sensei, sem vitória a atribuir</div>';
    }
    (o.seeds || []).forEach(function (s) {
      h += '<span class="xchip" title="' + esc(s.reason) + '">🧠 ' + esc(s.id) + " v" + s.version + "</span>";
    });
    h += '<label>Refinar (uma frase chega — o resto mantém-se)</label>' +
      '<div class="row"><input id="rf-' + esc(o.id) + '" class="grow" ' +
      'placeholder="ex.: menos dramático, mantém o final">' +
      '<button class="ghost" onclick="refine(\\'' + esc(ds.id) + '\\',\\'' + esc(o.id) + '\\')">Refinar</button>' +
      '<button onclick="pick(\\'' + esc(ds.id) + '\\',\\'' + esc(o.id) + '\\',' + o.version + ')">Selecionar</button>' +
      "</div></div>";
  });
  return h;
}
function refine(dsId, optionId) {
  var v = $("rf-" + optionId).value;
  post("/api/option/refine", { project: projectId, dsId: dsId, optionId: optionId, instruction: v })
    .then(load).catch(function (e) { alert(e.message); });
}
function pick(dsId, optionId, version) {
  post("/api/option/select", { project: projectId, dsId: dsId, optionId: optionId, version: String(version) })
    .then(load).catch(function (e) { alert(e.message); });
}

function stateDoc(doc) {
  function li(a) { return a.length ? "<ul>" + a.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" : "<i class='kv'>—</i>"; }
  return '<dl class="stateDoc">' +
    "<dt>Objetivo</dt><dd>" + esc(doc.objective) + "</dd>" +
    "<dt>Fase</dt><dd>" + esc(doc.phase) + "</dd>" +
    "<dt>Decisões aprovadas</dt><dd>" + li(doc.approvedDecisions) + "</dd>" +
    "<dt>Artefactos ativos</dt><dd>" + li(doc.activeArtifacts) + "</dd>" +
    "<dt>Questões por resolver</dt><dd>" + li(doc.unresolvedQuestions) + "</dd>" +
    "<dt>Restrições</dt><dd>" + li(doc.constraints) + "</dd>" +
    "<dt>Próxima ação</dt><dd><b>" + esc(doc.nextAction) + "</b></dd></dl>";
}

function tabsBar() {
  function t(id, label) {
    return '<button class="tab' + (view === id ? " on" : "") +
      '" onclick="setView(\\'' + id + '\\')">' + label + "</button>";
  }
  return '<div class="tabs">' + t("agora", "Agora") + t("historia", "História") +
    t("hi", "Inteligência Humana") + t("audit", "Detalhes / Auditoria") + "</div>";
}
function setView(v) { view = v; render(); }

// Ponto A — the running version must be visible in Details/Audit AND right
// under the header: never let the Pilot believe a committed feature is
// active when this process has not been restarted onto it.
function buildLine(build) {
  if (!build) return "";
  var started = new Date(build.startedAt).toTimeString().slice(0, 5);
  return '<div class="kv" style="margin:-12px 0 16px">v' + esc(build.version || "?") +
    " · build <b>" + esc(build.sha) + "</b> · processo desde " + started + "</div>";
}
// PHASE 1.1 (ADR-0022): the warn card fires ONLY on committed product-source
// movement. Docs-only repo movement and uncommitted product edits are
// disclosed in words that do not claim "newer code exists".
function staleCard(build) {
  if (!build) return "";
  if (build.safeMode) {
    return '<div class="card" style="border-left:4px solid var(--bad)"><div class="kv" ' +
      'style="color:var(--bad)"><b>MODO SEGURO — só leitura.</b> ' +
      esc(build.safeModeReason || "O estado dos dados requer intervenção.") +
      ' Nenhuma alteração será aceite até a integridade ser recuperada.</div></div>';
  }
  var started = new Date(build.startedAt).toTimeString().slice(0, 5);
  if (build.stale) {
    return '<div class="card" style="border-left:4px solid var(--warn)"><div class="kv" ' +
      'style="color:var(--warn)">⚠ Código de PRODUTO mais recente no repositório (produto ' +
      esc(build.productHead) + ', HEAD ' + esc(build.repoHead) +
      '). Esta App continua a executar a versão ' + esc(build.sha) +
      " iniciada às " + started + ". Reiniciar é um ato operacional explícito — " +
      "pede ao operador.</div></div>";
  }
  var notes = [];
  if (build.repoMovedDocsOnly) {
    notes.push("o repositório avançou (HEAD " + esc(build.repoHead) +
      "), mas sem alterações ao produto — esta App está atual");
  }
  if (build.dirtyProduct) {
    notes.push(build.dirtyProductFiles + " ficheiro(s) de produto por commitar no disco " +
      "(trabalho em curso, não é código publicado)");
  }
  if (!notes.length) return "";
  return '<div class="kv" style="margin:-8px 0 12px;opacity:.75">' + notes.join(" · ") + "</div>";
}

// O sandbox tem de ser INCONFUNDÍVEL: o Piloto entrou no :4901 a pensar que
// testava o produto real e correu um projeto inteiro contra respostas
// deterministas (2026-07-13). Um badge discreto não chega — cartão sempre
// visível, em cima, em todas as páginas.
function fakeRuntimeCard(runtime) {
  if (runtime !== "fake") return "";
  return '<div class="card" style="border-left:4px solid var(--warn)">' +
    "<b>🧪 Ambiente de ensaio — runtime fake.</b> " +
    '<span class="kv">Tudo aqui é deterministicamente simulado: nenhum modelo real é chamado e os artefactos são texto de teste. ' +
    "Serve para verificar o mecanismo, nunca para trabalho real. O teu trabalho vive no shell com runtime <b>cli</b>.</span></div>";
}

// A tab de um processo anterior corre código velho mas mostraria o build NOVO
// (vem da API) — sem isto, mentiria por omissão. Nunca auto-recarrega: o
// Piloto pode estar a meio de uma nota.
function pageBootCard(build) {
  if (!build || !build.startedAt || build.startedAt === PAGE_BOOT.startedAt) return "";
  return '<div class="card" style="border-left:4px solid var(--warn)">' +
    "<b>Esta página foi carregada de um processo anterior (build " + esc(PAGE_BOOT.sha) + ").</b> " +
    '<span class="kv">O servidor corre agora o build ' + esc(build.sha) +
    " — recarrega para teres a interface atual.</span>" +
    '<div class="row" style="margin-top:10px"><button onclick="location.reload()">Recarregar</button></div></div>';
}

function render() {
  var s = state;
  if (!s || !s.project) return;
  var h = '<h1><a href="/">AgentOS</a> · ' + esc(s.project.name) + "</h1>" +
    '<div class="sub">passagem ' + s.project.iteration + " pelo ciclo" +
    (isConcluded(s.project) ? ' <span class="badge ok">concluído</span>' : "") + "</div>" +
    buildLine(s.build);
  h += fakeRuntimeCard(s.runtime);
  h += pageBootCard(s.build);
  h += staleCard(s.build);
  h += journeyBar(s);
  h += tabsBar();
  if (view === "historia" || view === "hi") {
    h += '<div id="viewbox" class="kv">a carregar…</div>';
    app.innerHTML = h;
    if (view === "historia") loadStory();
    if (view === "hi") loadHi();
    return;
  }
  h += view === "audit" ? auditBody(s) : agoraBody(s);
  // Ponto F — never lose user text: EVERY input/textarea/select with an id
  // is snapshotted before the rebuild, not just a hardcoded few — a poll
  // landing mid-keystroke must never eat what the Pilot was typing.
  var focus = document.activeElement && document.activeElement.id;
  var vals = {};
  app.querySelectorAll("input, textarea, select").forEach(function (el) {
    if (!el.id) return;
    vals[el.id] = el.type === "checkbox" ? el.checked : el.value;
  });
  app.innerHTML = h;
  Object.keys(vals).forEach(function (id) {
    var el = $(id);
    if (!el) return;
    if (el.type === "checkbox") el.checked = vals[id]; else el.value = vals[id];
  });
  if (focus && $(focus)) $(focus).focus();
  if (view === "agora" && !isConcluded(s.project)) {
    if (s.stage === "consult") loadProbe("consult");
    if (s.stage === "candidate") loadProbe("decision");
    if (s.stage === "execute") loadProbe("execute");
  }
}

// Agora: o cartão dominante + o que já existe (resultados, respostas, estado).
// O diagnóstico técnico (agentes, work orders, eventos, runtime) vive na
// Auditoria — disponível, nunca a dominar o ecrã.
function agoraBody(s) {
  var h = "";
  if (s.lastError) {
    h += '<div class="card" style="border-left:4px solid var(--bad)"><div class="err">⚠ ' +
      esc(s.lastError) + "</div></div>";
  }
  h += primaryCard();
  h += projectMapCard(s);

  if (s.artifacts.length) {
    h += '<div class="card"><h2>Resultados</h2>';
    s.artifacts.forEach(function (a) {
      h += "<details" + (a.content ? " open" : "") + "><summary>passagem " + a.iteration + " · " +
        esc(a.agentId) + "</summary>";
      if (a.seeds && a.seeds.length) {
        h += "<div>";
        a.seeds.forEach(function (x) {
          var voice = x.senseiTitle || x.mentorTitle;
          h += '<span class="xchip" title="' + esc(x.reason) + '">🧠 ' + esc(x.title) + " v" + x.version +
            (voice ? " · 🥋 " + esc(voice) : "") + "</span>";
        });
        h += '<span class="kv" style="font-size:11px"> inteligência humana que moldou este resultado</span></div>';
      }
      if (a.content) h += "<pre>" + esc(a.content) + "</pre>";
      else h += '<div class="kv">de uma passagem anterior — <a style="color:var(--acc);cursor:pointer" ' +
        'onclick="viewArtifact(' + a.iteration + ',\\'' + esc(a.agentId) + '\\', this)">ver</a></div>';
      h += "</details>";
    });
    h += "</div>";
  }
  if (s.approved && s.stage !== "approve") {
    h += '<div class="card"><details><summary>O que já está decidido (estado aprovado, passagem ' +
      s.approved.iteration + ")</summary>" + stateDoc(s.approved.state) + "</details></div>";
  }
  if (s.interview.answered.length) {
    h += '<div class="card"><details><summary>Respostas que já dei (' + s.interview.answered.length +
      ")</summary>";
    s.interview.answered.forEach(function (q) {
      h += '<div style="margin-top:10px"><div class="kv"><b>' + esc(q.text) + "</b></div><div>" +
        esc(q.answer) + "</div></div>";
    });
    h += "</details></div>";
  }
  if (!isConcluded(s.project)) {
    h += '<div class="card"><h2>Dar direção</h2>' +
      '<div class="kv">A tua nota entra no contexto de todo o trabalho seguinte.</div>' +
      '<div class="row" style="margin-top:8px"><input id="pnote" class="grow" placeholder="ex.: mantém tudo em PT-PT">' +
      '<button class="ghost" onclick="note()">Registar</button></div></div>';
    // Ponto D: a estratégia de esforço é do utilizador — um perfil por fase,
    // editável a qualquer momento; o slider por lançamento faz o override.
    var ep = s.effortProfile || { questions: "low", options: "low", execution: "low" };
    h += '<div class="card"><details><summary>Perfil de esforço por fase — perguntas <b>' +
      esc(ep.questions) + "</b> · opções <b>" + esc(ep.options) + "</b> · execução <b>" +
      esc(ep.execution) + "</b></summary>" +
      '<div class="kv" style="margin-top:6px">"Um modelo melhor a planear e um pior a executar, ou vice-versa" — a estratégia é tua. ' +
      "As re-consultas automáticas usam o nível de Perguntas.</div>" +
      '<div class="row" style="margin-top:8px">' +
      '<div class="grow"><label>Perguntas (consultas, re-consultas, refinamentos)</label>' + levelSelect("efq", ep.questions) + "</div>" +
      '<div class="grow"><label>Opções (superfícies de decisão, síntese)</label>' + levelSelect("efo", ep.options) + "</div>" +
      '<div class="grow"><label>Execução (criar)</label>' + levelSelect("efe", ep.execution) + "</div></div>" +
      '<div style="margin-top:10px"><button class="ghost" onclick="saveProfile()">Guardar perfil</button></div>' +
      "</details></div>";
  }
  return h;
}

function projectMapCard(s) {
  var candidate = s.candidateProjectMap;
  var map = s.projectMap;
  if (!candidate && !map) {
    return '<div class="card"><h2>Mapa do projeto</h2><div class="kv">O AgentOS pode propor as fatias, dependências e entregáveis — tu aprovas a estrutura antes de ela orientar o trabalho.</div>' +
      '<button class="ghost" style="margin-top:10px" onclick="proposeMap()">Propor mapa do projeto</button></div>';
  }
  var shown = candidate || map;
  var h = '<div class="card"><h2>Mapa do projeto <span class="badge">v' + shown.version +
    (candidate ? ' · candidato' : ' · aprovado') + '</span></h2>';
  h += '<div class="kv">Cada fatia é governável por si. Dependências e próximo trabalho são mecânicos — não gastam chamadas ao modelo.</div>';
  shown.slices.forEach(function (slice) {
    h += '<div style="border-left:3px solid ' + (slice.status === "done" ? 'var(--ok)' : slice.status === "blocked" ? 'var(--warn)' : 'var(--acc)') + ';padding:8px 10px;margin-top:10px">' +
      '<b>' + esc(slice.title) + '</b> <span class="badge">' + esc(slice.status) + '</span>' +
      '<div class="kv">' + esc(slice.purpose) + '</div>' +
      (slice.dependsOn.length ? '<div class="kv">depende de: ' + slice.dependsOn.map(esc).join(', ') + '</div>' : '') +
      (slice.expectedArtifacts.length ? '<div class="kv">entrega: ' + slice.expectedArtifacts.map(esc).join(', ') + '</div>' : '') +
      (slice.materialDecisions.length ? '<div class="kv">decisões preparadas: ' + slice.materialDecisions.map(esc).join(' · ') + '</div>' : '') +
      '</div>';
  });
  if (candidate) {
    h += '<div class="row" style="margin-top:12px"><button onclick="approveMap(' + (map ? map.version : 'null') + ')">Aprovar este mapa</button>' +
      '<button class="ghost" onclick="proposeMap()">Pedir nova proposta</button></div>';
  } else if (s.nextProjectSlice) {
    var next = s.nextProjectSlice;
    h += '<div class="row" style="margin-top:12px"><span class="grow"><b>Próxima fatia:</b> ' + esc(next.title) + '</span>';
    if (next.status === "ready") h += '<button onclick="moveSlice(\\'' + esc(next.id) + '\\',\\'active\\',' + map.version + ')">Começar fatia</button>';
    if (next.status === "active") h += '<button onclick="moveSlice(\\'' + esc(next.id) + '\\',\\'done\\',' + map.version + ')">Marcar concluída</button>';
    h += '</div>';
  }
  if (map) {
    var affected = map.slices.filter(function (slice) { return slice.status === "affected"; });
    affected.forEach(function (slice) {
      h += '<div class="row" style="margin-top:10px"><span class="grow"><b>Precisa de revalidação:</b> ' + esc(slice.title) +
        '<div class="kv">' + esc(slice.statusReason || "uma alteração a montante pode ter impacto") + '</div></span>' +
        '<button class="ghost" onclick="moveSlice(&quot;' + esc(slice.id) + '&quot;,\\'ready\\',' + map.version + ')">Reavaliar esta fatia</button></div>';
    });
  }
  return h + '</div>';
}

// Esforço junto à ação (pedido do Piloto, teste real 2026-07-13): a fase
// Perguntas do perfil é editável AO LADO do botão de responder, não só no
// editor lá em baixo. Muda o perfil persistente — as re-consultas desta
// resposta já correm ao nível escolhido.
function effortQuestionsInline(s) {
  var ep = s.effortProfile || {};
  var epq = ep.questions || "low";
  var h = '<div class="kv" style="margin-top:10px">Esforço das re-consultas (perfil · Perguntas): ' +
    '<select id="efq-inline" style="width:auto" onchange="setQuestionsEffort(this.value)">';
  state.levels.forEach(function (l) {
    h += '<option value="' + esc(l.level) + '"' + (l.level === epq ? " selected" : "") + '>' +
      esc(l.level) + " · " + esc(l.workerModel) + "</option>";
  });
  return h + "</select></div>";
}

// Back-and-forth governado (ADR-0022, decisão 14): um passo atrás em
// QUALQUER estado é um ato governado — zero tokens, nada se perde.
function backRow(label, call) {
  return '<div class="row" style="margin-top:10px"><button class="ghost" onclick="' + call + '">' +
    label + "</button></div>" +
    '<div class="kv" style="margin-top:4px">Voltar atrás é governado — zero tokens, nada se perde.</div>';
}

// Voltar a Compreender é reabrir as perguntas que TU adiaste — movimento de
// dados puro, zero tokens.
function reopenDeferredBlock(s) {
  if (!s.interview || !s.interview.deferred) return "";
  return '<div class="row" style="margin-top:10px"><button class="ghost" onclick="reopenQuestions()">⟲ Reabrir ' +
    s.interview.deferred + ' pergunta(s) adiada(s) — voltar a Compreender</button></div>' +
    '<div class="kv" style="margin-top:4px">Navegar não gasta tokens; só novas consultas gastam.</div>';
}

function levelSelect(id, current) {
  var h = '<select id="' + id + '">';
  state.levels.forEach(function (l) {
    h += '<option value="' + esc(l.level) + '"' + (l.level === current ? " selected" : "") + ">" +
      esc(l.level) + " · " + esc(l.workerModel) + "</option>";
  });
  return h + "</select>";
}

// Detalhes / Auditoria: runtime, etapa interna, agentes, work orders, eventos —
// tudo inspecionável, nada disto é linguagem principal.
function auditBody(s) {
  var ep = s.effortProfile || {};
  var bl = s.build || {};
  var h = '<div class="card"><h2>Sistema</h2><div class="kv">' +
    "runtime <b>" + esc(s.runtime) + "</b> · etapa interna <b>" + esc(s.stage) + "</b>" +
    " · autoridade automática ≤ <b>" + esc(s.autoMaxLevel) + "</b>" +
    " · perfil de esforço <b>" + esc(ep.questions || "?") + "/" + esc(ep.options || "?") + "/" + esc(ep.execution || "?") + "</b>" +
    " · iteração <b>" + s.project.iteration + "</b>" +
    " · estado <b>" + esc(s.project.status || "active") + "</b>" +
    (s.busy ? ' · em curso: <b>' + esc(s.busy.op) + "</b> desde " + esc(s.busy.startedAt.slice(11, 19)) : "") +
    "</div>" +
    '<div class="kv" style="margin-top:6px">' +
    "produto v<b>" + esc(bl.version || "?") + "</b> · build <b>" + esc(bl.sha) + "</b>" +
    " · produto no build <b>" + esc(bl.productSha || "?") + "</b>" +
    " · HEAD do repo <b>" + esc(bl.repoHead || "?") + "</b>" +
    " · produto no HEAD <b>" + esc(bl.productHead || "?") + "</b> (" +
    (bl.stale ? "STALE — produto avançou" : bl.repoMovedDocsOnly ? "atual; repo avançou sem produto" : "atual") + ")" +
    (bl.dirtyProduct ? " · <b>" + bl.dirtyProductFiles + "</b> ficheiro(s) de produto por commitar" : "") +
    " · schema de dados v<b>" + esc(bl.schemaVersion) + "</b>" +
    " · registry de módulos v<b>" + esc(bl.moduleRegistryVersion) + "</b>" +
    " · migração <b>" + esc(bl.migrationVersion || "none") + "</b>" +
    " · processo desde " + esc(bl.startedAt ? new Date(bl.startedAt).toTimeString().slice(0, 5) : "?") +
    " · porta <b>" + esc(bl.port) + "</b> · node <b>" + esc(bl.node) + "</b>" +
    (s.busy ? " · operação <b>" + esc(s.busy.operationId) + "</b> · fase <b>" + esc(s.busy.phase) +
      "</b> · WO <b>" + esc(s.busy.workOrderId || "?") + "</b>" +
      " · agente <b>" + esc(s.busy.humanRole || s.busy.agentId || "?") + "</b>" +
      " · heartbeat " + esc(s.busy.heartbeatAt ? s.busy.heartbeatAt.slice(11, 19) : "?") +
      " · tokens <b>" + s.busy.tokensDone.toLocaleString() + "</b>" +
      (s.busy.tokensEstimated ? " (estimados)" : " (exatos)") +
      (s.busy.timeoutMs ? " · timeout <b>" + Math.round(s.busy.timeoutMs / 60000) + "m</b>" : "") : "") +
    "</div>" + metersLine(s) + "</div>";
  if (s.roster) {
    h += '<div class="card"><h2>Agentes temporários</h2>' +
      '<div class="kv">Vasos operacionais, não personalidades: mandato + contexto + expertise admitida ' +
      "+ orçamento de esforço, compostos no momento.</div><div style='margin-top:8px'>";
    s.roster.forEach(function (a) {
      h += '<span class="agent"><b>' + esc(a.title) + "</b><div>" + esc(a.mandate) + "</div></span>";
    });
    h += "</div></div>";
  }
  if (s.workOrders.length) {
    h += '<div class="card"><h2>Work orders desta iteração</h2>';
    s.workOrders.forEach(function (w) {
      h += '<div class="wo"><b>' + esc(w.id) + "</b> · " + esc(w.kind) + " · " + esc(w.model) +
        " · esforço " + esc(w.effortLevel) + " · " + esc(w.status) +
        (w.error ? ' · <span class="err">' + esc(w.error) + "</span>" : "") + "</div>";
    });
    h += "</div>";
  }
  if (s.events.length) {
    h += '<div class="card"><h2>Evidência (últimos ' + s.events.length + " eventos)</h2>";
    s.events.forEach(function (e) {
      h += '<div class="ev">' + esc(e.ts.slice(11, 19)) + " it" + e.iteration + " <b>" +
        esc(e.action) + "</b> · " + esc(e.actor) +
        (e.agentId ? " · " + esc(e.agentId) : "") + (e.note ? " · " + esc(e.note) : "") + "</div>";
    });
    h += "</div>";
  }
  return h;
}

// ---------------- história (a linha do tempo do projeto) ----------------
var LBL = {
  project_init: "Projeto criado",
  project_concluded: "Concluí o projeto — congelado e arquivado, nada apagado",
  project_reopened: "Reabri o projeto",
  roster_ready: "Agentes temporários convocados",
  consulted: "Consulta",
  reconsulted: "Reconsulta (após a minha resposta)",
  question_answered: "Respondi a uma pergunta",
  candidate_built: "Estado candidato construído",
  state_approved: "Aprovei o estado do projeto",
  state_rejected: "Rejeitei o candidato, com direção",
  execution_started: "Mandei executar",
  artifact_returned: "Artefacto entregue",
  iteration_advanced: "Avancei a iteração",
  pilot_note: "Nota minha ao Kernel",
  expertise_added: "Expertise registada (candidata)",
  expertise_admitted: "Expertise admitida por mim",
  expertise_discarded: "Expertise descartada por mim",
  seed_candidate_added: "GuruSeed candidata registada",
  seed_admitted: "GuruSeed admitida por mim",
  seed_rejected: "GuruSeed rejeitada por mim",
  seed_candidate_extracted: "O refinamento gerou uma GuruSeed candidata",
  seed_evidence: "A minha evidência voltou à GuruSeed",
  seed_revised: "Revi uma GuruSeed — nova versão, a anterior fica na história",
  context_sufficient: "Declarei o contexto suficiente — perguntas adiadas",
  mentor_saved: "Mentor guardado/evoluído (pré-reforma)",
  sensei_saved: "Sensei guardado/evoluído",
  sensei_victory: "Vitória de um Sensei — a escolha evoluiu quem a sugeriu",
  effort_profile_set: "Defini o perfil de esforço por fase",
  decision_opened: "Superfície de decisão aberta",
  option_refined: "Refinei uma opção",
  option_selected: "Selecionei uma opção",
  operation_cancelled: "Parei a operação em curso — nada do que estava completo se perdeu"
};

function tlItem(i) {
  var h = '<div class="tli' + (i.actor === "pilot" ? " pilot" : "") + '">' +
    '<div class="when">' + esc(i.ts.slice(11, 19)) + "</div><div>" +
    '<span class="lbl">' + (LBL[i.action] || esc(i.action)) + "</span>" +
    '<span class="who">' + (i.actor === "pilot" ? "Tu" : "Kernel") + "</span>";
  if (i.agentTitle) h += " · " + esc(i.agentTitle);
  if (i.effortLevel) h += ' <span class="badge">' + esc(i.effortLevel) + " · " + esc(i.model || "") + "</span>";
  h += "</div>";
  if (i.mandate) h += '<div class="kv">mandato: ' + esc(i.mandate) + "</div>";
  if (i.expertise && i.expertise.length) {
    h += "<div>";
    i.expertise.forEach(function (x) {
      h += '<span class="xchip" title="' + esc(x.reason) + '">🧠 ' + esc(x.title) + "</span>";
    });
    h += '<span class="kv" style="font-size:11px"> (passa o rato para veres porquê)</span></div>';
  }
  if (i.questionText) {
    h += '<div class="kv">Pergunta' + (i.askedBy ? " (de " + esc(i.askedBy.join(", ")) + ")" : "") +
      ": <b>" + esc(i.questionText) + "</b></div>";
    if (i.answer) h += "<div>" + esc(i.answer) + "</div>";
  }
  if (i.note) h += '<div class="kv">' + esc(i.note) + "</div>";
  if (i.output) {
    h += "<details><summary>output do trabalho (" + (i.outputChars || i.output.length) +
      " chars — proveniência operacional, nunca raciocínio)</summary><pre>" +
      esc(i.output) + "</pre></details>";
  }
  return h + "</div>";
}

function loadStory() {
  fetch("/api/story?project=" + encodeURIComponent(projectId))
    .then(function (r) { return r.json(); })
    .then(function (st) {
      var box = $("viewbox");
      if (!box || view !== "historia") return;
      var h = '<div class="card"><h2>O que pedi (a intenção fundadora, verbatim)</h2><div>' +
        esc(st.intent.description) + '</div><div class="kv" style="margin-top:6px">' +
        esc(st.intent.createdAt.slice(0, 16).replace("T", " ")) + "</div></div>";
      st.iterations.forEach(function (it) {
        h += '<div class="itdiv">Iteração ' + it.iteration + '</div><div class="tl">';
        it.items.forEach(function (i) { h += tlItem(i); });
        h += "</div>";
      });
      if (!st.iterations.length) h += '<div class="kv">ainda sem eventos — convoca a equipa no separador Agora.</div>';
      box.innerHTML = h;
    });
}

// ---------------- inteligência humana (o ativo durável) ----------------
function senseiTitleOf(id) {
  var m = hiData && hiData.senseis.filter(function (x) { return x.id === id; })[0];
  return m ? m.title : id;
}
function seedCard(s, isCandidate) {
  var scope = (s.scope.projects.length ? "local: " + s.scope.projects.join(", ") : "reutilizável") +
    (s.scope.domains.length ? " · domínios: " + s.scope.domains.join(", ") : "") +
    (s.sensei ? " · 🥋 " + esc(senseiTitleOf(s.sensei)) : " · sem Sensei (atribui ao admitir)");
  var h = '<div class="xp"><b>🧠 ' + esc(s.title) + '</b><span class="st ' + esc(s.status) + '">' +
    esc(s.status) + " v" + s.version + '</span> <span class="kv">' + esc(scope) + "</span>" +
    "<div style='margin-top:4px'>" + esc(s.rule) + "</div>" +
    (s.why ? '<div class="kv">porquê: ' + esc(s.why) + "</div>" : "") +
    '<div class="kv">proveniência: ' + esc(s.provenance.origin) +
    (s.provenance.note ? " — " + esc(s.provenance.note) : "") +
    (s.provenance.admitted_at ? " · admitida " + esc(s.provenance.admitted_at.slice(0, 10)) : "") + "</div>";
  if (s.applied_in && s.applied_in.length) {
    h += "<details><summary class='kv'>aplicada em " + s.applied_in.length +
      " work orders</summary><div class='kv'>";
    s.applied_in.forEach(function (a) {
      h += esc(a.project) + " · " + esc(a.workOrder) + " · " + esc(a.ts.slice(0, 16).replace("T", " ")) + "<br>";
    });
    h += "</div></details>";
  } else {
    h += '<div class="kv">ainda não aplicada</div>';
  }
  if (!isCandidate && s.status === "admitted") {
    var sup = (s.evidence && s.evidence.supporting) || [];
    var con = (s.evidence && s.evidence.contradicting) || [];
    if (sup.length || con.length) {
      h += "<details><summary class='kv'>evidência: " + sup.length + " a favor · " +
        con.length + " contra</summary><div class='kv'>";
      sup.forEach(function (e) { h += "✓ " + esc(e) + "<br>"; });
      con.forEach(function (e) { h += "✗ " + esc(e) + "<br>"; });
      h += "</div></details>";
    }
    h += '<label>O teu veredicto sobre esta seed em uso — a evidência volta ao ativo</label>' +
      '<div class="row"><input id="evn-' + esc(s.id) + '" class="grow" placeholder="ex.: o artefacto ganhou com esta regra">' +
      '<button class="ghost" onclick="seedEvidence(\\'' + esc(s.id) + '\\',\\'supporting\\')">Reforçou ✓</button>' +
      '<button class="danger" onclick="seedEvidence(\\'' + esc(s.id) + '\\',\\'contradicting\\')">Contradisse ✗</button></div>';
  }
  if (isCandidate) {
    var senseiSel = '<select id="sn-' + esc(s.id) + '" style="width:auto">';
    (hiData ? hiData.senseis : []).forEach(function (m) {
      senseiSel += '<option value="' + esc(m.id) + '"' + (s.sensei === m.id ? " selected" : "") + ">" +
        esc(m.title) + "</option>";
    });
    senseiSel += "</select>";
    h += '<label>Editar a regra antes de admitir (opcional — a última palavra é tua)</label>' +
      '<textarea id="ed-' + esc(s.id) + '">' + esc(s.rule) + "</textarea>" +
      '<label>Sensei dono — uma seed pertence a exatamente UM Sensei</label>' + senseiSel +
      '<div class="row" style="margin-top:8px">' +
      '<button onclick="decideSeed(\\'' + esc(s.id) + '\\',\\'admit\\')">Admitir</button>' +
      '<button class="danger" onclick="decideSeed(\\'' + esc(s.id) + '\\',\\'reject\\')">Rejeitar</button></div>';
  }
  return h + "</div>";
}

// O cartão do Sensei — a entidade que evolui: vitórias, graduação (faixa),
// e a sanidade face à fotografia de referência (base/), quando existe.
function senseiCard(m, seeds) {
  var byId = {};
  seeds.forEach(function (s) { byId[s.id] = s; });
  var owned = seeds.filter(function (s) { return s.sensei === m.id; });
  var h = '<div class="xp"><b>🥋 ' + esc(m.title) + '</b><span class="st admitted">v' + m.version + "</span>" +
    ' <span class="badge acc">' + esc(m.graduation) + " · " + m.victories.length + " vitória(s)</span>" +
    '<div class="kv">' + esc(m.persona) +
    (m.domains && m.domains.length ? " · ofício: " + esc(m.domains.join(", ")) : "") +
    "</div><div style='margin-top:4px'>";
  owned.forEach(function (s) {
    h += '<span class="xchip" title="' + esc(s.rule) + '">🧠 ' + esc(s.title) + "</span>";
  });
  if (!owned.length) h += '<span class="kv">ainda sem seeds próprias</span>';
  h += "</div>";
  if (m.victories.length) {
    h += "<details><summary class='kv'>as vitórias que o fizeram evoluir</summary><div class='kv'>";
    m.victories.forEach(function (v) {
      h += "🏆 " + esc(v.ts.slice(0, 16).replace("T", " ")) + " · " + esc(v.project) +
        " · " + esc(v.decision.slice(0, 80)) + "<br>";
    });
    h += "</div></details>";
  }
  if (m.sanity && m.sanity.hasBase) {
    var sa = m.sanity;
    h += '<div class="kv" style="margin-top:4px">Sanidade vs fotografia: base v' + sa.baseVersion +
      " → atual v" + sa.currentVersion +
      (sa.seedsAdded.length ? " · aprendeu: " + esc(sa.seedsAdded.join(", ")) : "") +
      (sa.seedsRemoved.length ? " · <span style='color:var(--warn)'>perdeu: " + esc(sa.seedsRemoved.join(", ")) + "</span>" : "") +
      (sa.seedsAdded.length || sa.seedsRemoved.length ? "" : " · fiel à base") + "</div>";
  }
  h += (m.selection_notes.length ?
    '<div class="kv">notas: ' + esc(m.selection_notes.join(" · ")) + "</div>" : "") +
    '<div class="row" style="margin-top:8px"><button class="ghost" onclick="editSensei(\\'' +
    esc(m.id) + '\\')">Editar / evoluir</button></div></div>';
  return h;
}

var hiData = null;
function loadHi() {
  fetch("/api/hi")
    .then(function (r) { return r.json(); })
    .then(function (d) {
      hiData = d;
      var box = $("viewbox");
      if (!box || view !== "hi") return;
      var h = '<div class="card"><h2>Senseis — o dojo do teu julgamento</h2>' +
        '<div class="kv">Um Sensei não é um agente de IA: é o perito com nome de UM ofício, ' +
        "dono das suas GuruSeeds. Quando escolhes uma opção que ele sugeriu, a vitória volta " +
        "para ele — evolui de faixa com o uso, como um lutador que ganha. Ranking por vitórias.</div>" +
        "<div style='margin-top:8px'>" +
        (d.senseis.length ? d.senseis.map(function (m) { return senseiCard(m, d.seeds); }).join("") :
          '<div class="kv">ainda sem Senseis — cria o primeiro em baixo.</div>') + "</div>" +
        '<details id="mform"><summary style="color:var(--acc);cursor:pointer;margin-top:8px">Criar / editar Sensei</summary>' +
        '<input type="hidden" id="mid">' +
        '<label>Nome (ex.: Sensei da Cozinha)</label><input id="mt">' +
        '<label>Persona — a voz, numa linha</label><input id="mp" placeholder="ex.: contenção antes do impacto; consequência física antes do espetáculo">' +
        '<label>Ofício — domínios que serve (vírgulas; são o que o convoca aos papéis)</label>' +
        '<input id="md" placeholder="ex.: culinaria, cozinha">' +
        '<label>GuruSeeds que este Sensei carrega</label><div id="mseeds">' +
        d.seeds.filter(function (s) { return s.status === "admitted"; }).map(function (s) {
          return '<label style="display:flex;gap:6px;align-items:center;margin:2px 0"><input type="checkbox" ' +
            'value="' + esc(s.id) + '" style="width:auto"> ' + esc(s.title) + "</label>";
        }).join("") + "</div>" +
        '<label>Notas de seleção (uma por linha)</label><textarea id="mn"></textarea>' +
        '<div style="margin-top:10px"><button onclick="saveSensei()">Guardar Sensei</button></div></details></div>';

      var candidates = d.candidates;
      h += '<div class="card"><h2>Candidatas — à espera do teu julgamento</h2>' +
        (candidates.length ? candidates.map(function (s) { return seedCard(s, true); }).join("") :
          '<div class="kv">nenhuma — candidatas nascem dos teus refinamentos, ou da tua mão em baixo.</div>') + "</div>";

      h += '<div class="card"><h2>GuruSeeds admitidas</h2>' +
        (d.seeds.length ? d.seeds.map(function (s) { return seedCard(s, false); }).join("") :
          '<div class="kv">vazia — a biblioteca cresce com o teu julgamento, não com transcrições.</div>') + "</div>";

      var seedSenseiSel = '<select id="ss">' + d.senseis.map(function (m) {
        return '<option value="' + esc(m.id) + '">' + esc(m.title) + "</option>";
      }).join("") + "</select>";
      h += '<div class="card"><h2>Registar GuruSeed à mão</h2>' +
        '<label>Título</label><input id="st">' +
        '<label>A regra (o julgamento, nas tuas palavras)</label><textarea id="sr"></textarea>' +
        '<label>Porquê</label><input id="sw">' +
        '<div class="row"><div class="grow"><label>Sensei dono</label>' +
        (d.senseis.length ? seedSenseiSel : '<span class="kv">cria primeiro um Sensei</span>') + "</div>" +
        '<div class="grow"><label>Domínios (vírgulas)</label><input id="sd"></div>' +
        '<div><label>Alcance</label><select id="sc"><option value="reusable">reutilizável</option>' +
        '<option value="project">só este projeto</option></select></div></div>' +
        '<div style="margin-top:10px"><button onclick="addSeed()">Registar candidata</button></div></div>';
      box.innerHTML = h;
    });
}
function addSeed() {
  post("/api/hi/seed", { project: projectId, title: $("st").value, rule: $("sr").value,
    why: $("sw").value, domains: $("sd").value, reach: $("sc").value,
    sensei: $("ss") ? $("ss").value : "" })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function decideSeed(id, d) {
  var edited = $("ed-" + id) ? $("ed-" + id).value : "";
  var sensei = $("sn-" + id) ? $("sn-" + id).value : "";
  post("/api/hi/seed/decide", { project: projectId, seedId: id, decision: d,
    editedRule: edited, senseiId: sensei })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function seedEvidence(id, kind) {
  var n = $("evn-" + id);
  post("/api/hi/seed/evidence", { project: projectId, seedId: id, kind: kind, note: n ? n.value : "" })
    .then(loadHi).catch(function (e) { alert(e.message); });
}
function editSensei(id) {
  var m = hiData && hiData.senseis.filter(function (x) { return x.id === id; })[0];
  if (!m) return;
  $("mform").open = true;
  $("mid").value = m.id;
  $("mt").value = m.title;
  $("mp").value = m.persona;
  $("md").value = (m.domains || []).join(", ");
  $("mn").value = m.selection_notes.join("\\n");
  var pinned = {};
  m.seeds.forEach(function (p) { pinned[p.id] = true; });
  document.querySelectorAll("#mseeds input").forEach(function (cb) { cb.checked = !!pinned[cb.value]; });
  $("mt").focus();
}
function saveSensei() {
  var ids = [];
  document.querySelectorAll("#mseeds input").forEach(function (cb) { if (cb.checked) ids.push(cb.value); });
  post("/api/hi/sensei", { project: projectId, id: $("mid").value, title: $("mt").value,
    persona: $("mp").value, domains: $("md").value, seedIds: ids.join(","), notes: $("mn").value })
    .then(loadHi).catch(function (e) { alert(e.message); });
}

function op(name) {
  var payload = { project: projectId, op: name, level: levelFor(name) };
  if (name === "decision" && $("optcount")) payload.options = $("optcount").value;
  post("/api/op", payload)
    .then(function () { levelChosen = null; load(); })
    .catch(function (e) { alert(e.message); });
}
// Ponto E — Pilot control: a governed halt. The terminated child leaves every
// completed work order in place; the shell marks the interruption honestly.
function stopOp() {
  post("/api/op/stop", { project: projectId }).then(load).catch(function (e) { alert(e.message); });
}
function saveProfile() {
  post("/api/project/effort", { project: projectId,
    effortQuestions: $("efq").value, effortOptions: $("efo").value,
    effortExecution: $("efe").value })
    .then(function () { levelChosen = null; lastJson = ""; load(); })
    .catch(function (e) { alert(e.message); });
}
function answerBatch(count) {
  var ids = [];
  var values = [];
  for (var i = 0; i < count; i++) {
    var el = $("answer-" + i);
    ids.push(el.getAttribute("data-qid"));
    values.push(el.value);
  }
  post("/api/answers", {
    project: projectId,
    questionIds: JSON.stringify(ids),
    answers: JSON.stringify(values),
  }).then(load).catch(function (e) { alert(e.message); });
}
function routeToDecide(qid) {
  post("/api/question/decide", { project: projectId, questionId: qid })
    .then(load).catch(function (e) { alert(e.message); });
}
function answer(qid) {
  post("/api/answer", { project: projectId, questionId: qid, answer: $("answer").value })
    .then(load).catch(function (e) { alert(e.message); });
}
function enough() {
  post("/api/interview/enough", { project: projectId, note: "" })
    .then(load).catch(function (e) { alert(e.message); });
}
function reopenQuestions() {
  post("/api/interview/reopen", { project: projectId })
    .then(load).catch(function (e) { alert(e.message); });
}
function withdrawCand() {
  post("/api/candidate/withdraw", { project: projectId })
    .then(load).catch(function (e) { alert(e.message); });
}
function revokeAppr() {
  post("/api/approval/revoke", { project: projectId })
    .then(load).catch(function (e) { alert(e.message); });
}
function dismissSurface() {
  post("/api/decision/dismiss", { project: projectId })
    .then(load).catch(function (e) { alert(e.message); });
}
function setQuestionsEffort(v) {
  // Only the Questions phase changes; the other two phases are re-sent as
  // they are so the profile endpoint never resets them.
  var ep = (state && state.effortProfile) || {};
  post("/api/project/effort", { project: projectId,
    effortQuestions: v, effortOptions: ep.options || "low",
    effortExecution: ep.execution || "low" })
    .then(load).catch(function (e) { alert(e.message); });
}
function decide(d) {
  var note = $("dnote").value;
  if (d === "reject" && !note.trim()) { alert("A rejeição pede a tua nota — é a direção da reconstrução."); return; }
  post("/api/decide", { project: projectId, decision: d, note: note })
    .then(load).catch(function (e) { alert(e.message); });
}
function advance() {
  post("/api/advance", { project: projectId }).then(load).catch(function (e) { alert(e.message); });
}
function improve() {
  // "Melhorar" não é uma etapa isolada: é uma nova passagem pelo ciclo com a
  // tua direção à frente, preservando as decisões anteriores.
  post("/api/advance", { project: projectId, direction: $("improveDir").value })
    .then(load).catch(function (e) { alert(e.message); });
}
function concludeUI() { concluding = true; lastJson = ""; render(); }
function cancelConclude() { concluding = false; lastJson = ""; render(); }
function doConclude() {
  post("/api/project/conclude", { project: projectId, note: $("cnote").value })
    .then(function () { concluding = false; lastJson = ""; load(); })
    .catch(function (e) { alert(e.message); });
}
function reopen() {
  post("/api/project/reopen", { project: projectId })
    .then(function () { lastJson = ""; load(); })
    .catch(function (e) { alert(e.message); });
}
function note() {
  post("/api/note", { project: projectId, note: $("pnote").value })
    .then(function () { $("pnote").value = ""; load(); }).catch(function (e) { alert(e.message); });
}
function proposeMap() {
  var level = (state.effortProfile && state.effortProfile.options) || "low";
  post("/api/project/map/propose", { project: projectId, level: level })
    .then(function () { lastJson = ""; load(); })
    .catch(function (e) { alert(e.message); });
}
function approveMap(expectedVersion) {
  post("/api/project/map/approve", {
    project: projectId,
    expectedVersion: expectedVersion == null ? "" : String(expectedVersion),
  }).then(function () { lastJson = ""; load(); }).catch(function (e) { alert(e.message); });
}
function moveSlice(sliceId, to, expectedVersion) {
  post("/api/project/slice/move", {
    project: projectId,
    sliceId: sliceId,
    to: to,
    expectedVersion: String(expectedVersion),
  }).then(function () { lastJson = ""; load(); }).catch(function (e) { alert(e.message); });
}
function viewArtifact(it, agent, el) {
  fetch("/api/artifact?project=" + encodeURIComponent(projectId) + "&iteration=" + it +
    "&agent=" + encodeURIComponent(agent))
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var pre = document.createElement("pre");
      pre.textContent = d.content;
      el.parentElement.parentElement.appendChild(pre);
      el.parentElement.remove();
    });
}

if (projectId) { load(); setInterval(load, 2500); } else { renderHome(); }
</script>
</body>
</html>`;

server.listen(PORT, "127.0.0.1", () => {
  console.log(`AgentOS shell — http://localhost:${PORT} (runtime: ${RUNTIME_NAME})`);
  if (RUNTIME_NAME === "cli") {
    console.log(
      `  the cli runtime needs a logged-in "claude" — if it fails, run "claude" once\n` +
        `  in a terminal, or restart with PRODUCT_RUNTIME=mailbox (human-in-the-middle).`,
    );
  }
});
