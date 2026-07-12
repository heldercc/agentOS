// The governance dashboard (ADR-0015 + ADR-0016) — Grand Objective B's
// surface: the owner iterates real work with clicks, across several projects.
// Everything is derived from the audit trail on disk; the dashboard only
// fans decisions into blind proposals, records clicks as evidence events,
// shows the distiller's tray, runs blind anchors, and carries the owner's
// notes into the next round's context. Judging is pointwise FIRST, enforced
// server-side.
//
// Usage: tsx src/cli/dashboard.ts [--port 4700]

import { spawn } from "node:child_process";
import { existsSync, readdirSync, renameSync, writeFileSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { resolve } from "node:path";

import {
  anchorBodies,
  anchorableRounds,
  consistency,
  createAnchor,
  loadAnchor,
  resolveAnchorClick,
} from "../anchor.js";
import { clampAutoEffort, nextAutoStep, type DecisionLoopState } from "../auto.js";
import {
  AUTO_MAX_LEVEL,
  EFFORT_LEVELS,
  effortSpec,
  probeEffort,
  type EffortLevel,
} from "../effort.js";
import { appendEvent, readAllEvents, readSessionEvents } from "../evidence.js";
import { admitCandidate, draftCandidates } from "../distill.js";
import { approvalRateByRound, decisionProgress } from "../metrics.js";
import { resolveModel } from "../model.js";
import { listProjects, loadProject } from "../project.js";
import { MAILBOX_DIR, PROJECTS_DIR, REPO_ROOT, RUNS_DIR } from "../paths.js";
import { roundDir, runRound } from "../propose.js";
import { abs, readJson, readText } from "../stores.js";
import type { RoundMapping } from "../types.js";

const DEFAULT_PORT = 4700;

/** The daily loop: one session per day. */
function todaySession(): string {
  return new Date().toISOString().slice(0, 10);
}

function runsDirFor(projectId: string): string {
  return abs(RUNS_DIR, projectId);
}

function getProject(projectId: string) {
  return loadProject(REPO_ROOT, PROJECTS_DIR, projectId);
}

// ---------------------------------------------------------------------------
// Round generation — one at a time, driven in-process.

interface RoundBusy {
  projectId: string;
  decisionId: string;
  round: number;
  model: string;
  level: EffortLevel;
  log: string[];
  error?: string;
}

let busy: RoundBusy | null = null;

// ---------------------------------------------------------------------------
// Auto-iteration (Operating Model §5/§8, ADR-0017): the system automates
// movement — opening the next round when the loop's state dictates it — and
// never authority. Judging, selecting and effort above the line stay the
// owner's. Per-project, in-memory: a restart simply stops moving until the
// owner re-arms it.

interface AutoState {
  enabled: boolean;
  level: EffortLevel;
  model: string;
  lastAction: string;
}

const autoState = new Map<string, AutoState>();

function autoFor(projectId: string): AutoState {
  let s = autoState.get(projectId);
  if (!s) {
    s = { enabled: false, level: "low", model: "fake", lastAction: "" };
    autoState.set(projectId, s);
  }
  return s;
}

function autoTick(): void {
  if (busy) return; // one round at a time, project-wide
  const session = todaySession();
  for (const [projectId, s] of autoState) {
    if (!s.enabled) continue;
    let loop: DecisionLoopState[];
    try {
      const project = getProject(projectId);
      loop = project.decisions.map((d) => {
        const rounds = latestRound(projectId, session, d.id);
        const jv = rounds > 0 ? judgeView(projectId, session, d.id) : null;
        return {
          decisionId: d.id,
          rounds,
          closed: jv?.closed ?? false,
          judgeable: jv !== null && !jv.closed,
          allJudged: jv?.allJudged ?? false,
          approvedCount: jv?.approvedLetters.length ?? 0,
        };
      });
    } catch {
      continue;
    }
    const step = nextAutoStep(loop);
    if (!step) {
      s.lastAction = "à espera do teu julgamento — nada a mover";
      continue;
    }
    const level = clampAutoEffort(s.level);
    s.lastAction =
      `ronda ${step.round} de ${step.decisionId} aberta automaticamente ` +
      `(${level}${level !== s.level ? ` — "${s.level}" fica acima da linha de autoridade` : ""})`;
    void startRound(projectId, step.decisionId, s.model, level);
    return; // one movement per tick, then let the state settle
  }
}

setInterval(autoTick, 3000);

function latestRound(projectId: string, session: string, decisionId: string): number {
  const dir = abs(runsDirFor(projectId), session, decisionId);
  if (!existsSync(dir)) return 0;
  return readdirSync(dir)
    .map((n) => /^round-(\d+)$/.exec(n))
    .filter((m): m is RegExpExecArray => m !== null)
    .reduce((max, m) => Math.max(max, Number(m[1])), 0);
}

async function startRound(
  projectId: string,
  decisionId: string,
  model: string,
  level: EffortLevel,
): Promise<void> {
  const session = todaySession();
  const project = getProject(projectId);
  const decision = project.decisions.find((d) => d.id === decisionId);
  if (!decision) throw new Error(`unknown decision ${decisionId}`);
  const priorRounds = latestRound(projectId, session, decisionId);
  const round = priorRounds + 1;
  const spec = effortSpec(level);
  const estimate = probeEffort({
    runsDir: runsDirFor(projectId),
    approaches: project.approaches,
    decision,
    level,
    priorRounds,
  });
  const state: RoundBusy = { projectId, decisionId, round, model, level, log: [] };
  busy = state;
  try {
    if (model === "manual") startWorker((m) => state.log.push(m), spec.workerModel);
    const { port, model: modelName } = resolveModel(model, { mailboxDir: MAILBOX_DIR });
    state.log.push(
      `round ${round} for ${decisionId} · model ${modelName} · effort ${level} ` +
        `(${estimate.alternatives} alt${spec.critic ? " + critic" : ""}, ` +
        `~${estimate.expectedTokens} tok, confiança ${estimate.confidence})`,
    );
    await runRound({
      repoRoot: REPO_ROOT,
      runsDir: runsDirFor(projectId),
      session,
      project,
      decision,
      round,
      port,
      model: modelName,
      effort: spec,
      estimate,
      log: (m) => state.log.push(m),
    });
    state.log.push("done — ready to judge");
  } catch (err) {
    state.error = err instanceof Error ? err.message : String(err);
    state.log.push(`ERROR: ${state.error}`);
  } finally {
    if (busy === state && !state.error) busy = null;
  }
}

// ---------------------------------------------------------------------------
// Mailbox worker (ADR-0013) — spawns one CLI worker per job on the owner's
// subscription. If the CLI is not logged in, jobs stay in the outbox where a
// human-in-the-middle (any Claude session) can answer them by writing the
// matching file into mailbox/inbox/.

interface WorkerState {
  active: boolean;
  cmd: string;
  /** Model the effort level asked the CLI to use (ADR-0017); per-spawn. */
  model: string;
  current: string | null;
  served: number;
  lastError: string | null;
}

const worker: WorkerState = {
  active: false,
  cmd: process.env["WORKER_CMD"] ?? "claude -p",
  model: "haiku",
  current: null,
  served: 0,
  lastError: null,
};
const workerFailures = new Map<string, number>();
const MAX_JOB_ATTEMPTS = 3;

/** The command one job spawns: WORKER_CMD wins; else the CLI at the effort model. */
function workerCmd(): string {
  return process.env["WORKER_CMD"] ?? `claude -p --model ${worker.model}`;
}

function startWorker(log: (m: string) => void, model?: string): void {
  if (model) worker.model = model; // effort may change the model between rounds
  if (worker.active) return;
  worker.active = true;
  log(`worker: "${workerCmd()}" watching mailbox/outbox`);
  const outbox = resolve(MAILBOX_DIR, "outbox");
  const inbox = resolve(MAILBOX_DIR, "inbox");

  const tick = (): void => {
    if (!worker.active || worker.current !== null) return;
    if (!existsSync(outbox)) return;
    const job = readdirSync(outbox)
      .filter((f) => f.endsWith(".md"))
      .filter((f) => !existsSync(resolve(inbox, f)))
      .find((f) => (workerFailures.get(f) ?? 0) < MAX_JOB_ATTEMPTS);
    if (!job) return;

    worker.current = job;
    worker.cmd = workerCmd();
    const prompt = readText(resolve(outbox, job));
    const child = spawn(worker.cmd, { shell: true, windowsHide: true });
    let out = "";
    let errOut = "";
    child.stdout.on("data", (d: Buffer) => (out += d.toString("utf8")));
    child.stderr.on("data", (d: Buffer) => (errOut += d.toString("utf8")));
    child.on("error", (e) => {
      worker.lastError = `worker spawn failed: ${e.message}`;
      workerFailures.set(job, (workerFailures.get(job) ?? 0) + 1);
      worker.current = null;
    });
    child.on("close", (code) => {
      if (code === 0 && out.trim().length > 0) {
        const part = resolve(inbox, `${job}.part`);
        writeFileSync(part, out, "utf8");
        renameSync(part, resolve(inbox, job));
        worker.served += 1;
        worker.lastError = null;
      } else {
        const n = (workerFailures.get(job) ?? 0) + 1;
        workerFailures.set(job, n);
        worker.lastError =
          `job ${job} failed (attempt ${n}/${MAX_JOB_ATTEMPTS}, exit ${code}): ` +
          `${errOut.trim().slice(0, 300) || "empty output"}. ` +
          `If the CLI is not logged in, run "claude" once in a terminal — ` +
          `or a human-in-the-middle can answer the outbox files directly.`;
      }
      worker.current = null;
    });
    child.stdin.write(prompt);
    child.stdin.end();
  };
  setInterval(tick, 1500);
}

// ---------------------------------------------------------------------------
// Derived views.

interface OptionView {
  letter: string;
  body: string;
  verdict: "approve" | "reject" | "";
  selected: boolean;
  asksInterview: boolean;
  /** Adversarial critique artifact (high/maximum effort), shown beside the option. */
  critique: string | null;
}

interface JudgeView {
  decisionId: string;
  title: string;
  instruction: string;
  round: number;
  options: OptionView[];
  allJudged: boolean;
  approvedLetters: string[];
  closed: boolean;
  reveal: Record<string, string> | null;
  notes: string[];
}

const INTERVIEW_MARK = "Perguntas ao Pilot";

function judgeView(projectId: string, session: string, decisionId: string): JudgeView | null {
  const project = getProject(projectId);
  const runsDir = runsDirFor(projectId);
  const decision = project.decisions.find((d) => d.id === decisionId);
  if (!decision) return null;
  const round = latestRound(projectId, session, decisionId);
  if (round === 0) return null;
  const dir = roundDir(runsDir, session, decisionId, round);
  if (!existsSync(abs(dir, "mapping.sealed.json"))) return null;
  const mapping = readJson<RoundMapping>(abs(dir, "mapping.sealed.json"));
  const events = readSessionEvents(runsDir, session).filter(
    (e) => e.decisionId === decisionId && !e.anchor,
  );
  const roundEvents = events.filter((e) => e.round === round);
  const verdictOf = (letter: string): "approve" | "reject" | "" => {
    let v: "approve" | "reject" | "" = "";
    for (const e of roundEvents) {
      if (e.proposalId === letter && (e.action === "approve" || e.action === "reject")) {
        v = e.action;
      }
    }
    return v;
  };
  const selectedLetter = roundEvents.find((e) => e.action === "select")?.proposalId ?? null;
  const options: OptionView[] = Object.keys(mapping.letters)
    .sort()
    .filter((l) => existsSync(abs(dir, l, "proposal.md")))
    .map((l) => {
      const body = readText(abs(dir, l, "proposal.md"));
      const critiquePath = abs(dir, l, "critique.md");
      return {
        letter: l,
        body,
        verdict: verdictOf(l),
        selected: selectedLetter === l,
        asksInterview: body.includes(INTERVIEW_MARK),
        critique: existsSync(critiquePath) ? readText(critiquePath) : null,
      };
    });
  const allJudged = options.length > 0 && options.every((o) => o.verdict !== "");
  const closed = events.some((e) => e.action === "select");
  return {
    decisionId,
    title: decision.title,
    instruction: decision.instruction,
    round,
    options,
    allJudged,
    approvedLetters: options.filter((o) => o.verdict === "approve").map((o) => o.letter),
    closed,
    reveal: closed ? mapping.letters : null,
    notes: events.filter((e) => e.action === "pilot_note" && e.note).map((e) => e.note ?? ""),
  };
}

/** Pull the question lines out of one proposal's interview section. */
function extractQuestions(body: string): string[] {
  const lines = body.split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes(INTERVIEW_MARK));
  if (start < 0) return [];
  const out: string[] = [];
  for (let i = start + 1; i < lines.length && out.length < 5; i++) {
    const line = lines[i] ?? "";
    const m = /^\s*(?:\d+[.)]|[-*•])\s*(.+)$/.exec(line);
    if (m?.[1]) {
      out.push(m[1].trim());
    } else if (out.length > 0 && line.trim() !== "") {
      break; // the section ended
    }
  }
  return out;
}

interface AggregatedQuestion {
  text: string;
  decisionId: string;
  askedBy: number;
}

/**
 * Operating Model §4: the internal demand for context is plural; the visible
 * interview is singular. Collect every open option's questions, dedupe,
 * rank by demand — the owner answers one clear question at a time, through
 * the note channel that already feeds the next round's context.
 */
function aggregateQuestions(
  projectId: string,
  session: string,
  decisions: Array<{ id: string }>,
): AggregatedQuestion[] {
  const seen = new Map<string, AggregatedQuestion>();
  for (const d of decisions) {
    const rounds = latestRound(projectId, session, d.id);
    if (rounds === 0) continue;
    const jv = judgeView(projectId, session, d.id);
    if (!jv || jv.closed) continue;
    for (const o of jv.options) {
      for (const q of extractQuestions(o.body)) {
        const key = q.toLowerCase().replace(/\s+/g, " ").trim();
        const hit = seen.get(key);
        if (hit) hit.askedBy += 1;
        else seen.set(key, { text: q, decisionId: d.id, askedBy: 1 });
      }
    }
  }
  return [...seen.values()].sort((a, b) => b.askedBy - a.askedBy);
}

function stateView(projectId: string): unknown {
  const session = todaySession();
  const project = getProject(projectId);
  const runsDir = runsDirFor(projectId);
  const sessionEvents = readSessionEvents(runsDir, session).filter((e) => !e.scripted);
  const allEvents = readAllEvents(runsDir);
  const progress = decisionProgress(project.decisions, sessionEvents);
  const decisions = project.decisions.map((d) => {
    const p = progress.find((x) => x.decisionId === d.id);
    const rounds = latestRound(projectId, session, d.id);
    const jv = rounds > 0 ? judgeView(projectId, session, d.id) : null;
    const asksInterview = jv?.options.some((o) => o.asksInterview && !jv.closed) ?? false;
    return {
      id: d.id,
      title: d.title,
      tags: d.tags,
      rounds,
      closed: p?.closed ?? false,
      judgeable: jv !== null && !jv.closed,
      allJudged: jv?.allJudged ?? false,
      asksInterview,
    };
  });
  const cons = consistency(allEvents.concat(readSessionEvents(runsDir, session)));
  const auto = autoFor(projectId);
  return {
    session,
    project: { id: project.id, name: project.name },
    projects: listProjects(PROJECTS_DIR),
    learned: project.learned.map((s) => s.id),
    decisions,
    busy: busy && busy.projectId === projectId ? busy : null,
    auto: {
      enabled: auto.enabled,
      level: auto.level,
      model: auto.model,
      lastAction: auto.lastAction,
      authorityLine: AUTO_MAX_LEVEL,
    },
    effortLevels: EFFORT_LEVELS,
    questions: aggregateQuestions(projectId, session, project.decisions),
    worker: worker.active
      ? { cmd: worker.cmd, current: worker.current, served: worker.served, lastError: worker.lastError }
      : null,
    tray: draftCandidates(project.approaches, allEvents).map((c) => ({
      id: c.id,
      title: c.title,
      body: c.body,
      stats: c.stats,
    })),
    metrics: {
      byRound: approvalRateByRound(allEvents),
      progress,
      consistency: cons,
      anchorable: anchorableRounds(runsDir, session).length,
    },
  };
}

// ---------------------------------------------------------------------------
// HTTP plumbing.

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolvePromise, reject) => {
    let body = "";
    req.on("data", (c: Buffer) => (body += c.toString("utf8")));
    req.on("end", () => resolvePromise(body));
    req.on("error", reject);
  });
}

function sendJson(res: ServerResponse, status: number, value: unknown): void {
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(value));
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const session = todaySession();

  if (req.method === "GET" && path === "/") {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
    res.end(PAGE);
    return;
  }

  const projects = listProjects(PROJECTS_DIR);
  const fallback = projects[0]?.id ?? "";
  const qProject = url.searchParams.get("project") ?? "";

  if (req.method === "GET" && path === "/api/state") {
    const id = projects.some((p) => p.id === qProject) ? qProject : fallback;
    if (!id) {
      sendJson(res, 500, { error: "no projects under data/projects/" });
      return;
    }
    sendJson(res, 200, stateView(id));
    return;
  }

  // Everything below takes { project } in the body or query.
  const body =
    req.method === "POST"
      ? (JSON.parse((await readBody(req)) || "{}") as Record<string, unknown>)
      : {};
  const projectId = String(body["project"] ?? qProject ?? fallback);
  if (!projects.some((p) => p.id === projectId)) {
    sendJson(res, 400, { error: `unknown project "${projectId}"` });
    return;
  }
  const runsDir = runsDirFor(projectId);

  if (req.method === "GET" && path === "/api/probe") {
    const decisionId = url.searchParams.get("decision") ?? "";
    const rawLevel = url.searchParams.get("level") ?? "low";
    const level = (EFFORT_LEVELS as string[]).includes(rawLevel)
      ? (rawLevel as EffortLevel)
      : "low";
    const project = getProject(projectId);
    const decision = project.decisions.find((d) => d.id === decisionId);
    if (!decision) {
      sendJson(res, 404, { error: `unknown decision "${decisionId}"` });
      return;
    }
    const estimate = probeEffort({
      runsDir,
      approaches: project.approaches,
      decision,
      level,
      priorRounds: latestRound(projectId, session, decisionId),
    });
    sendJson(res, 200, { spec: effortSpec(level), estimate });
    return;
  }

  if (req.method === "POST" && path === "/api/auto") {
    const s = autoFor(projectId);
    s.enabled = body["enabled"] === true;
    const rawLevel = String(body["level"] ?? s.level);
    if ((EFFORT_LEVELS as string[]).includes(rawLevel)) s.level = rawLevel as EffortLevel;
    s.model = body["model"] === "manual" ? "manual" : "fake";
    if (s.enabled) s.lastAction = "armado — a observar o estado do loop";
    else s.lastAction = "";
    sendJson(res, 200, { ok: true, auto: s });
    return;
  }

  if (req.method === "POST" && path === "/api/round") {
    if (busy && !busy.error) {
      sendJson(res, 409, { error: "a round is already being generated" });
      return;
    }
    const decisionId = String(body["decisionId"] ?? "");
    const jv =
      latestRound(projectId, session, decisionId) > 0
        ? judgeView(projectId, session, decisionId)
        : null;
    if (jv && !jv.closed && !jv.allJudged) {
      sendJson(res, 409, { error: "judge the current round before opening a new one" });
      return;
    }
    const model = body["model"] === "manual" ? "manual" : "fake";
    // The slider is the owner's hand: any level is legitimate here. Only
    // automation is clamped (clampAutoEffort) — authority is not.
    const rawLevel = String(body["level"] ?? "low");
    const level = (EFFORT_LEVELS as string[]).includes(rawLevel)
      ? (rawLevel as EffortLevel)
      : "low";
    void startRound(projectId, decisionId, model, level);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "GET" && path === "/api/judge") {
    const decisionId = url.searchParams.get("decision") ?? "";
    const jv = judgeView(projectId, session, decisionId);
    if (!jv) {
      sendJson(res, 404, { error: "no round to judge for this decision" });
      return;
    }
    sendJson(res, 200, jv);
    return;
  }

  if (req.method === "POST" && path === "/api/click") {
    const decisionId = String(body["decisionId"] ?? "");
    const round = Number(body["round"] ?? 0);
    const letter = String(body["letter"] ?? "");
    const action = String(body["action"] ?? "");
    if (!decisionId || !round || !letter) {
      sendJson(res, 400, { error: "decisionId, round, letter, action are required" });
      return;
    }
    if (action !== "approve" && action !== "reject" && action !== "select") {
      sendJson(res, 400, { error: "action must be approve, reject or select" });
      return;
    }
    const jv = judgeView(projectId, session, decisionId);
    if (!jv || jv.closed) {
      sendJson(res, 409, { error: "this decision is closed" });
      return;
    }
    if (action === "select") {
      if (!jv.allJudged) {
        sendJson(res, 409, { error: "judge every option in isolation before selecting" });
        return;
      }
      if (!jv.approvedLetters.includes(letter)) {
        sendJson(res, 409, { error: "the winner must be an approved option" });
        return;
      }
    }
    const dir = roundDir(runsDir, session, decisionId, round);
    const mapping = readJson<RoundMapping>(abs(dir, "mapping.sealed.json"));
    const approachId = mapping.letters[letter];
    if (!approachId) {
      sendJson(res, 400, { error: `unknown option ${letter}` });
      return;
    }
    appendEvent(runsDir, {
      ts: new Date().toISOString(),
      session,
      decisionId,
      round,
      proposalId: letter,
      approachId,
      action,
      scripted: false,
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && path === "/api/note") {
    const decisionId = String(body["decisionId"] ?? "");
    const text = String(body["text"] ?? "").trim();
    if (!decisionId || !text) {
      sendJson(res, 400, { error: "decisionId and text are required" });
      return;
    }
    appendEvent(runsDir, {
      ts: new Date().toISOString(),
      session,
      decisionId,
      round: 0,
      action: "pilot_note",
      scripted: false,
      note: text.slice(0, 2000),
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && path === "/api/anchor") {
    const pool = anchorableRounds(runsDir, session);
    if (pool.length === 0) {
      sendJson(res, 409, { error: "no closed rounds to anchor yet" });
      return;
    }
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (!pick) {
      sendJson(res, 500, { error: "anchor pick failed" });
      return;
    }
    const mapping = createAnchor(runsDir, session, pick.decisionId, pick.round);
    sendJson(res, 200, { anchorId: mapping.anchorId });
    return;
  }

  if (req.method === "GET" && path === "/api/anchor") {
    const anchorId = url.searchParams.get("id") ?? "";
    const mapping = loadAnchor(runsDir, session, anchorId);
    if (!mapping) {
      sendJson(res, 404, { error: "unknown anchor" });
      return;
    }
    const events = readSessionEvents(runsDir, session).filter(
      (e) => e.anchor && e.anchorId === anchorId,
    );
    const verdictOf = (letter: string): string => {
      let v = "";
      for (const e of events) {
        if (e.proposalId === letter && (e.action === "approve" || e.action === "reject")) {
          v = e.action;
        }
      }
      return v;
    };
    const selected = events.find((e) => e.action === "select")?.proposalId ?? null;
    const bodies = anchorBodies(runsDir, mapping).map((b) => ({
      ...b,
      verdict: verdictOf(b.letter),
      selected: selected === b.letter,
    }));
    const allJudged = bodies.every((b) => b.verdict !== "");
    sendJson(res, 200, {
      anchorId,
      options: bodies,
      allJudged,
      approvedLetters: bodies.filter((b) => b.verdict === "approve").map((b) => b.letter),
      done: selected !== null,
    });
    return;
  }

  if (req.method === "POST" && path === "/api/anchor-click") {
    const anchorId = String(body["anchorId"] ?? "");
    const letter = String(body["letter"] ?? "");
    const action = String(body["action"] ?? "");
    const mapping = loadAnchor(runsDir, session, anchorId);
    if (!mapping || !letter) {
      sendJson(res, 400, { error: "anchorId and letter are required" });
      return;
    }
    if (action !== "approve" && action !== "reject" && action !== "select") {
      sendJson(res, 400, { error: "action must be approve, reject or select" });
      return;
    }
    const { approachId } = resolveAnchorClick(runsDir, mapping, letter);
    appendEvent(runsDir, {
      ts: new Date().toISOString(),
      session,
      decisionId: mapping.decisionId,
      round: mapping.round,
      proposalId: letter,
      approachId,
      action,
      scripted: false,
      anchor: true,
      anchorId,
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && path === "/api/tray") {
    const candidateId = String(body["candidateId"] ?? "");
    const action = String(body["action"] ?? "");
    if (!candidateId || (action !== "admit" && action !== "discard")) {
      sendJson(res, 400, { error: "candidateId and action (admit|discard) are required" });
      return;
    }
    const project = getProject(projectId);
    const candidates = draftCandidates(project.approaches, readAllEvents(runsDir));
    const cand = candidates.find((c) => c.id === candidateId);
    if (!cand) {
      sendJson(res, 404, { error: "candidate not in the tray (already ruled on?)" });
      return;
    }
    if (action === "admit") admitCandidate(project.learnedDir, cand);
    appendEvent(runsDir, {
      ts: new Date().toISOString(),
      session,
      decisionId: "-",
      round: 0,
      candidateId,
      action: action === "admit" ? "admit_seed" : "discard_seed",
      scripted: false,
    });
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

// ---------------------------------------------------------------------------
// The page — single HTML document, no external assets, Portuguese for the Pilot.
// Client JS deliberately avoids template literals so this file nests cleanly.

const PAGE = `<!doctype html>
<html lang="pt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AgentOS — Governança</title>
<style>
  :root { color-scheme: dark;
    --bg:#0b0e12; --panel:#13181f; --panel2:#0e1319; --line:#222b36;
    --ink:#e6ebf1; --dim:#8b9bab; --acc:#4f8ef7; --ok:#2f9e63; --no:#c0504d; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink);
    font: 15px/1.55 system-ui, "Segoe UI", sans-serif; }
  header { position:sticky; top:0; z-index:5; background:rgba(11,14,18,.92);
    backdrop-filter: blur(6px); border-bottom:1px solid var(--line);
    padding:12px 24px; display:flex; align-items:center; gap:16px; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; letter-spacing:.2px; }
  header h1 span { color:var(--acc); }
  select { background:var(--panel); color:var(--ink); border:1px solid var(--line);
    border-radius:8px; padding:6px 10px; font:inherit; }
  .tag { color:var(--dim); font-size:12.5px; }
  nav { margin-left:auto; display:flex; gap:6px; }
  nav button { background:transparent; color:var(--dim); border:0; border-radius:8px;
    padding:7px 14px; font:inherit; cursor:pointer; }
  nav button.on { background:var(--panel); color:var(--ink); border:1px solid var(--line); }
  main { max-width:1080px; margin:0 auto; padding:20px 24px 80px; }
  section.pane { display:none; }
  section.pane.on { display:block; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:12px;
    padding:16px 18px; margin-bottom:14px; }
  h2 { font-size:12.5px; margin:0 0 12px; color:var(--dim);
    text-transform:uppercase; letter-spacing:.8px; font-weight:600; }
  button { background:var(--acc); color:#fff; border:0; border-radius:9px;
    padding:8px 15px; font:inherit; cursor:pointer; }
  button:hover { filter:brightness(1.1); }
  button.ghost { background:var(--panel2); color:var(--ink); border:1px solid var(--line); }
  button.okb { background:var(--ok); } button.nob { background:var(--no); }
  button.soft { background:var(--panel2); color:var(--dim); border:1px solid var(--line); }
  button:disabled { opacity:.4; cursor:default; }
  .note { color:var(--dim); font-size:13px; margin-top:10px; }
  .err { color:#f08a8a; font-size:13px; white-space:pre-wrap; margin-top:8px; }
  pre.log { background:var(--panel2); border:1px solid var(--line); border-radius:8px;
    padding:10px 12px; max-height:180px; overflow:auto; font-size:12.5px; white-space:pre-wrap; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th, td { text-align:left; padding:9px 10px; border-bottom:1px solid var(--line); }
  th { color:var(--dim); font-weight:500; font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
  tr:last-child td { border-bottom:0; }
  .chip { display:inline-block; border-radius:20px; padding:2px 10px; font-size:12px;
    background:var(--panel2); border:1px solid var(--line); color:var(--dim); }
  .chip.ok { background:#12301f; color:#7fd8a5; border-color:#1d4a30; }
  .chip.run { background:#152441; color:#9dc1fb; border-color:#23406e; }
  .chip.ask { background:#3a2d12; color:#eec97a; border-color:#5d4a1e; }
  .opt { background:var(--panel2); border:1px solid var(--line); border-radius:10px;
    padding:12px 14px; margin-top:12px; }
  .opt.sel { border-color:var(--acc); box-shadow:0 0 0 1px var(--acc); }
  .opt .head { display:flex; align-items:center; gap:10px; }
  .badge { width:26px; height:26px; border-radius:50%; background:var(--panel);
    border:1px solid var(--line); display:inline-flex; align-items:center;
    justify-content:center; font-weight:600; font-size:13px; }
  .body { white-space:pre-wrap; font-size:13.5px; margin-top:10px;
    max-height:280px; overflow:auto; color:#cdd6e0; }
  .row { display:flex; gap:8px; margin-top:10px; flex-wrap:wrap; align-items:center; }
  textarea { width:100%; background:var(--panel2); color:var(--ink);
    border:1px solid var(--line); border-radius:9px; padding:9px 11px;
    font:inherit; font-size:13.5px; min-height:56px; resize:vertical; }
  .kpi { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:14px; }
  .kpi .box { background:var(--panel); border:1px solid var(--line); border-radius:12px;
    padding:12px 18px; min-width:150px; }
  .kpi .n { font-size:22px; font-weight:650; }
  .kpi .l { color:var(--dim); font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
  .inst { color:var(--dim); font-size:13.5px; margin:2px 0 4px; }
</style>
</head>
<body>
<header>
  <h1>agent<span>OS</span> · Governança</h1>
  <select id="projectSel" title="Projeto"></select>
  <span class="tag" id="sessionTag"></span>
  <nav>
    <button data-pane="decisions" class="on">Decisões</button>
    <button data-pane="tray">Tabuleiro</button>
    <button data-pane="metrics">Métricas</button>
  </nav>
</header>
<main>
  <section class="pane on" id="pane-decisions">
    <div class="card">
      <h2>Decisões de hoje</h2>
      <div class="row" style="margin:0 0 10px">
        <span class="tag">Modelo:</span>
        <label class="tag"><input type="radio" name="model" value="fake" checked> fake (custo zero)</label>
        <label class="tag"><input type="radio" name="model" value="manual"> manual (Claude, subscrição)</label>
      </div>
      <div class="row" style="margin:0 0 6px">
        <span class="tag">Esforço:</span>
        <input type="range" id="effortRange" min="0" max="4" step="1" value="1" style="width:170px">
        <span class="chip" id="effortName">low</span>
        <span class="tag" id="effortFor"></span>
      </div>
      <div class="note" id="probeBox" style="display:none;margin:0 0 10px"></div>
      <div class="row" style="margin:0 0 10px">
        <label class="tag"><input type="checkbox" id="autoChk"> Auto-iteração — abre rondas sozinho;
          nunca julga, nunca escolhe, nunca passa de «balanced»</label>
        <span class="tag" id="autoMsg"></span>
      </div>
      <table id="decisions"><thead><tr>
        <th>decisão</th><th>rondas</th><th>estado</th><th></th>
      </tr></thead><tbody></tbody></table>
      <div id="busyBox" style="display:none">
        <pre class="log" id="busyLog"></pre>
        <div class="err" id="busyErr"></div>
      </div>
      <div class="note">Julgas cada proposta isolada antes de escolher a vencedora — o protocolo
      não pode fabricar o vencedor. As propostas são cegas; o ângulo revela-se no fecho.
      🎤 marca propostas que pedem entrevista (Artigo 9).</div>
    </div>
    <div class="card" id="qCard" style="display:none">
      <h2>Perguntas ao Pilot — agregadas de todas as propostas abertas</h2>
      <div id="qList"></div>
      <div class="note">A entrevista visível é singular: começa pela primeira. Responde com uma
      nota na decisão respetiva — a resposta entra no contexto da próxima ronda.</div>
    </div>
    <div class="card" id="judge" style="display:none">
      <h2 id="judgeTitle"></h2>
      <div class="inst" id="judgeInst"></div>
      <div id="judgeNotes" class="note"></div>
      <div id="judgeItems"></div>
      <div id="selectStep" style="display:none">
        <h2 style="margin-top:16px">Escolhe a vencedora (entre aprovadas)</h2>
        <div class="row" id="selectPick"></div>
      </div>
      <div id="revealBox" class="note" style="display:none"></div>
      <div style="margin-top:14px">
        <h2>Nota para a próxima ronda (opcional — tu inicias a direção)</h2>
        <textarea id="noteText" placeholder="ex.: quero mais silêncio antes da explosão; o adversário nunca aparece"></textarea>
        <div class="row"><button class="ghost" id="noteSave">Guardar nota</button>
        <span class="tag" id="noteMsg"></span></div>
      </div>
    </div>
  </section>

  <section class="pane" id="pane-tray">
    <div class="card">
      <h2>Seeds candidatas — destiladas da tua seleção</h2>
      <div id="tray"></div>
      <div class="note">Nada é admitido automaticamente (O5): cada candidata mostra a sua evidência
      e espera o teu clique. Admitidas entram no contexto das próximas propostas — o manifest prova-o.</div>
    </div>
  </section>

  <section class="pane" id="pane-metrics">
    <div class="kpi" id="kpis"></div>
    <div class="card">
      <h2>Melhoria — taxa de aprovação por ronda (casos novos)</h2>
      <div id="metrics"></div>
    </div>
    <div class="card">
      <h2>Consistência — casos âncora (ADR-0016; não ensinam nada)</h2>
      <div id="consBox" class="note"></div>
      <div class="row"><button class="ghost" id="anchorBtn">Repetir um caso âncora (cego)</button></div>
      <div id="anchorItems"></div>
      <div id="anchorPick" class="row"></div>
    </div>
  </section>
</main>
<script>
"use strict";
var state = null;
var project = localStorage.getItem("agentos-project") || "";
var openDecision = null;
var anchorId = null;

function el(id) { return document.getElementById(id); }
function esc(s) { return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }
function api(method, path, body) {
  var sep = path.indexOf("?") >= 0 ? "&" : "?";
  var opts = { method: method, headers: { "content-type": "application/json" } };
  if (body) { body.project = project; opts.body = JSON.stringify(body); }
  return fetch(path + sep + "project=" + encodeURIComponent(project), opts)
    .then(function (r) { return r.json(); });
}
function model() { return document.querySelector("input[name=model]:checked").value; }

// --- effort (ADR-0017) ------------------------------------------------------
var LEVELS = ["minimal", "low", "balanced", "high", "maximum"];
var LEVEL_FOR = {
  minimal: "canalizações e testes de UI",
  low: "default de desenvolvimento",
  balanced: "modo de trabalho normal",
  high: "modelo mais forte + crítica adversarial",
  maximum: "só quando TU o escolhes"
};
function effortLevel() { return LEVELS[Number(el("effortRange").value)] || "low"; }
function setEffort(levelName) {
  var i = LEVELS.indexOf(levelName);
  el("effortRange").value = String(i >= 0 ? i : 1);
  el("effortName").textContent = effortLevel();
  el("effortFor").textContent = LEVEL_FOR[effortLevel()] || "";
}
el("effortRange").oninput = function () {
  setEffort(effortLevel());
  if (project) localStorage.setItem("agentos-effort-" + project, effortLevel());
  lastProbeKey = ""; loadProbe();
  if (el("autoChk").checked) postAuto(true);
};

var lastProbeKey = "";
function probeTarget() {
  if (!state) return null;
  for (var i = 0; i < state.decisions.length; i++) {
    var d = state.decisions[i];
    if (!d.closed && !d.judgeable) return d;
  }
  return null;
}
function loadProbe() {
  var t = probeTarget();
  var box = el("probeBox");
  if (!t) { box.style.display = "none"; lastProbeKey = "none"; return; }
  var key = [project, t.id, t.rounds, effortLevel()].join("|");
  if (key === lastProbeKey) return;
  lastProbeKey = key;
  api("GET", "/api/probe?decision=" + encodeURIComponent(t.id) + "&level=" + effortLevel())
    .then(function (p) {
      if (p.error) { box.style.display = "none"; return; }
      var e = p.estimate;
      var secs = Math.round(e.expectedDurationMs / 1000);
      var txt = "Sonda (próxima: " + t.id + ", ronda " + (t.rounds + 1) + "): "
        + e.alternatives + " proposta(s)" + (e.criticPasses ? " + " + e.criticPasses + " crítica(s)" : "")
        + " · ~" + e.expectedTokens + " tokens · ~" + secs + "s"
        + " · pressão " + e.pressure + " · confiança " + e.confidence
        + " (" + e.basedOnRuns + " medições)"
        + " — qualidade esperada: " + e.expectedQuality + ".";
      if (e.recommendation !== effortLevel()) {
        txt += " Recomendação: «" + e.recommendation + "» — " + e.recommendationReason + ".";
      }
      box.textContent = txt;
      box.style.display = "";
    });
}

// --- auto-iteração ----------------------------------------------------------
function postAuto(enabled) {
  api("POST", "/api/auto", { enabled: enabled, level: effortLevel(), model: model() })
    .then(function (r) {
      if (r.auto) el("autoMsg").textContent = r.auto.lastAction || "";
    });
}
el("autoChk").onchange = function () { postAuto(el("autoChk").checked); };

var lastQJson = "";
function renderQuestions() {
  var json = JSON.stringify(state.questions);
  if (json === lastQJson) return;
  lastQJson = json;
  var card = el("qCard");
  if (!state.questions.length) { card.style.display = "none"; return; }
  card.style.display = "";
  var host = el("qList");
  host.innerHTML = "";
  state.questions.forEach(function (q, i) {
    var div = document.createElement("div");
    div.className = "opt";
    div.innerHTML = "<div class='head'>"
      + (i === 0 ? "<span class='chip ask'>começa aqui</span>" : "")
      + "<span class='chip'>" + esc(q.decisionId) + "</span>"
      + (q.askedBy > 1 ? "<span class='chip'>pedida por " + q.askedBy + " propostas</span>" : "")
      + "</div><div class='body' style='max-height:none'>" + esc(q.text) + "</div>";
    host.appendChild(div);
  });
}

// --- tabs ------------------------------------------------------------------
Array.prototype.forEach.call(document.querySelectorAll("nav button"), function (b) {
  b.onclick = function () {
    Array.prototype.forEach.call(document.querySelectorAll("nav button"), function (x) { x.className = ""; });
    Array.prototype.forEach.call(document.querySelectorAll("section.pane"), function (x) { x.className = "pane"; });
    b.className = "on";
    el("pane-" + b.getAttribute("data-pane")).className = "pane on";
  };
});

// --- polling ---------------------------------------------------------------
function refresh() {
  api("GET", "/api/state").then(function (s) {
    if (s.error) return;
    state = s;
    if (!project) {
      project = s.project.id;
      setEffort(localStorage.getItem("agentos-effort-" + project) || "low");
    }
    renderHeader(); renderDecisions(); renderBusy(); renderTray(); renderMetrics();
    renderQuestions(); loadProbe(); syncAuto();
    if (openDecision) loadJudge(openDecision, true);
    if (anchorId) loadAnchor(true);
  });
}
setInterval(refresh, 1500);
refresh();

var lastProjectsJson = "";
function renderHeader() {
  el("sessionTag").textContent = "sessão " + state.session +
    (state.learned.length ? " · " + state.learned.length + " seed(s) ativa(s)" : "");
  var json = JSON.stringify([state.projects, state.project.id]);
  if (json === lastProjectsJson) return;
  lastProjectsJson = json;
  var sel = el("projectSel");
  sel.innerHTML = "";
  state.projects.forEach(function (p) {
    var o = document.createElement("option");
    o.value = p.id; o.textContent = p.name;
    if (p.id === state.project.id) o.selected = true;
    sel.appendChild(o);
  });
  sel.onchange = function () {
    project = sel.value;
    localStorage.setItem("agentos-project", project);
    openDecision = null; anchorId = null;
    el("judge").style.display = "none";
    lastDecisionsJson = ""; lastTrayJson = ""; lastMetricsJson = "";
    lastProbeKey = ""; lastQJson = "";
    setEffort(localStorage.getItem("agentos-effort-" + project) || "low");
    refresh();
  };
}

function syncAuto() {
  var a = state.auto;
  if (!a) return;
  var chk = el("autoChk");
  if (document.activeElement !== chk && chk.checked !== a.enabled) chk.checked = a.enabled;
  el("autoMsg").textContent = a.enabled ? (a.lastAction || "armado") : "";
}

function renderBusy() {
  var b = state.busy;
  var box = el("busyBox");
  if (!b) { box.style.display = "none"; return; }
  box.style.display = "";
  el("busyLog").textContent = b.log.join("\\n");
  var w = state.worker;
  el("busyErr").textContent = (w && w.lastError) ? w.lastError : (b.error || "");
}

var lastDecisionsJson = "";
function renderDecisions() {
  var json = JSON.stringify([state.decisions, !!state.busy]);
  if (json === lastDecisionsJson) return;
  lastDecisionsJson = json;
  var tb = el("decisions").querySelector("tbody");
  tb.innerHTML = "";
  state.decisions.forEach(function (d) {
    var tr = document.createElement("tr");
    var status = d.closed ? "<span class='chip ok'>fechada</span>"
      : d.judgeable ? "<span class='chip run'>a julgar · ronda " + d.rounds + "</span>"
      : d.rounds > 0 ? "<span class='chip'>ronda " + d.rounds + "</span>"
      : "<span class='chip'>por abrir</span>";
    if (d.asksInterview) status += " <span class='chip ask'>🎤 entrevista</span>";
    tr.innerHTML = "<td><strong>" + esc(d.title) + "</strong><br><span class='tag'>" + esc(d.id) + "</span></td>"
      + "<td>" + d.rounds + "</td><td>" + status + "</td><td style='text-align:right'></td>";
    var cell = tr.lastChild;
    if (!d.closed && !d.judgeable) {
      var b = document.createElement("button");
      b.textContent = d.rounds === 0 ? "Propor" : "Iterar (r" + (d.rounds + 1) + ")";
      b.disabled = !!state.busy;
      b.onclick = function () {
        api("POST", "/api/round", { decisionId: d.id, model: model(), level: effortLevel() })
          .then(refresh);
      };
      cell.appendChild(b);
    }
    if (d.judgeable || d.closed) {
      var b2 = document.createElement("button");
      b2.className = "ghost"; b2.style.marginLeft = "6px";
      b2.textContent = d.closed ? "Rever" : "Julgar";
      b2.onclick = function () { openDecision = d.id; lastJudgeJson = ""; loadJudge(d.id, false); };
      cell.appendChild(b2);
    }
    tb.appendChild(tr);
  });
}

var lastJudgeJson = "";
function loadJudge(decisionId, quiet) {
  api("GET", "/api/judge?decision=" + encodeURIComponent(decisionId)).then(function (j) {
    if (j.error) { if (!quiet) alert(j.error); return; }
    var json = JSON.stringify(j);
    if (json === lastJudgeJson) return;
    lastJudgeJson = json;
    el("judge").style.display = "";
    el("judgeTitle").textContent = j.title + " · ronda " + j.round + (j.closed ? " · FECHADA" : "");
    el("judgeInst").textContent = j.instruction;
    el("judgeNotes").textContent = j.notes.length ? "Notas tuas ativas: " + j.notes.join(" · ") : "";
    var host = el("judgeItems");
    host.innerHTML = "";
    j.options.forEach(function (o) {
      var card = document.createElement("div");
      card.className = "opt" + (o.selected ? " sel" : "");
      var head = "<div class='head'><span class='badge'>" + esc(o.letter) + "</span>"
        + (o.asksInterview ? "<span class='chip ask'>🎤 pede entrevista</span>" : "")
        + (o.verdict ? "<span class='chip " + (o.verdict === "approve" ? "ok" : "") + "'>"
            + (o.verdict === "approve" ? "✔ aprovada" : "✘ rejeitada") + "</span>" : "")
        + (o.selected ? "<span class='chip ok'>★ vencedora</span>" : "")
        + "</div>";
      card.innerHTML = head + "<div class='body'>" + esc(o.body) + "</div>"
        + (o.critique
          ? "<details style='margin-top:8px'><summary class='tag' style='cursor:pointer'>"
            + "crítica adversarial (high/maximum — mais evidência, não um veredicto)</summary>"
            + "<div class='body' style='max-height:160px'>" + esc(o.critique) + "</div></details>"
          : "");
      if (!j.closed) {
        var pick = document.createElement("div");
        pick.className = "row";
        [["approve", "Aprovar", "okb"], ["reject", "Rejeitar", "nob"]].forEach(function (a) {
          var b = document.createElement("button");
          b.className = o.verdict === a[0] ? a[2] : "soft";
          b.textContent = a[1];
          b.onclick = function () {
            api("POST", "/api/click", { decisionId: decisionId, round: j.round, letter: o.letter, action: a[0] })
              .then(function () { lastJudgeJson = ""; loadJudge(decisionId, true); refresh(); });
          };
          pick.appendChild(b);
        });
        card.appendChild(pick);
      }
      host.appendChild(card);
    });
    var stepBox = el("selectStep");
    if (!j.closed && j.allJudged && j.approvedLetters.length > 0) {
      stepBox.style.display = "";
      var pick2 = el("selectPick");
      pick2.innerHTML = "";
      j.approvedLetters.forEach(function (l) {
        var b = document.createElement("button");
        b.textContent = "Proposta " + l + " vence";
        b.onclick = function () {
          api("POST", "/api/click", { decisionId: decisionId, round: j.round, letter: l, action: "select" })
            .then(function () { lastJudgeJson = ""; loadJudge(decisionId, true); refresh(); });
        };
        pick2.appendChild(b);
      });
    } else { stepBox.style.display = "none"; }
    var reveal = el("revealBox");
    if (j.reveal) {
      reveal.style.display = "";
      var parts = [];
      Object.keys(j.reveal).sort().forEach(function (k) { parts.push(k + " = " + j.reveal[k]); });
      reveal.textContent = "Revelação (fechada): " + parts.join(" · ");
    } else { reveal.style.display = "none"; }
    if (!quiet) el("judge").scrollIntoView({ behavior: "smooth" });
  });
}

el("noteSave").onclick = function () {
  var t = el("noteText").value.trim();
  if (!t || !openDecision) return;
  api("POST", "/api/note", { decisionId: openDecision, text: t }).then(function (r) {
    el("noteMsg").textContent = r.ok ? "Nota guardada — entra na próxima ronda." : (r.error || "erro");
    el("noteText").value = "";
    lastJudgeJson = ""; loadJudge(openDecision, true);
  });
};

var lastTrayJson = "";
function renderTray() {
  var json = JSON.stringify(state.tray);
  if (json === lastTrayJson) return;
  lastTrayJson = json;
  var host = el("tray");
  host.innerHTML = "";
  if (state.tray.length === 0) {
    host.innerHTML = "<div class='note'>Sem candidatas — o destilador precisa de ≥2 vitórias do mesmo ângulo.</div>";
    return;
  }
  state.tray.forEach(function (c) {
    var card = document.createElement("div");
    card.className = "opt";
    card.innerHTML = "<div class='head'><strong>" + esc(c.title) + "</strong>"
      + "<span class='chip'>" + c.stats.selections + " vitórias / " + c.stats.appearances + " aparições</span></div>"
      + "<div class='body'>" + esc(c.body) + "</div>";
    var pick = document.createElement("div");
    pick.className = "row";
    [["admit", "Admitir seed", "okb"], ["discard", "Descartar", "nob"]].forEach(function (a) {
      var b = document.createElement("button");
      b.className = a[2]; b.textContent = a[1];
      b.onclick = function () { api("POST", "/api/tray", { candidateId: c.id, action: a[0] }).then(refresh); };
      pick.appendChild(b);
    });
    card.appendChild(pick);
    host.appendChild(card);
  });
}

var lastMetricsJson = "";
function renderMetrics() {
  var json = JSON.stringify(state.metrics);
  if (json === lastMetricsJson) return;
  lastMetricsJson = json;
  var m = state.metrics;
  var closed = m.progress.filter(function (p) { return p.closed; }).length;
  el("kpis").innerHTML =
    "<div class='box'><div class='n'>" + closed + "/" + m.progress.length + "</div><div class='l'>decisões fechadas</div></div>"
    + "<div class='box'><div class='n'>" + state.learned.length + "</div><div class='l'>seeds aprendidas</div></div>"
    + "<div class='box'><div class='n'>" + (m.consistency.anchorsCompleted
        ? m.consistency.agreements + "/" + m.consistency.anchorsCompleted : "—")
      + "</div><div class='l'>consistência (âncoras)</div></div>";
  var html = "<table><tr><th>ronda</th><th>julgadas</th><th>aprovadas</th><th>taxa</th></tr>";
  m.byRound.forEach(function (r) {
    html += "<tr><td>" + r.round + "</td><td>" + r.proposals + "</td><td>" + r.approvals
      + "</td><td>" + Math.round(r.rate * 100) + "%</td></tr>";
  });
  html += "</table><div class='note'>A pergunta do ADR-0015: a ronda N+1 aprova mais do que a ronda N?</div>";
  el("metrics").innerHTML = html;
  el("consBox").textContent = m.anchorable > 0
    ? m.anchorable + " caso(s) fechado(s) disponível(is) para âncora. A âncora repete um caso já julgado, às cegas e baralhado; serve só para medir a estabilidade do teu critério."
    : "Ainda não há casos fechados nesta sessão para ancorar.";
}

el("anchorBtn").onclick = function () {
  api("POST", "/api/anchor", {}).then(function (r) {
    if (r.error) { el("consBox").textContent = r.error; return; }
    anchorId = r.anchorId;
    loadAnchor(false);
  });
};

var lastAnchorJson = "";
function loadAnchor(quiet) {
  api("GET", "/api/anchor?id=" + encodeURIComponent(anchorId)).then(function (a) {
    if (a.error) return;
    var json = JSON.stringify(a);
    if (json === lastAnchorJson) return;
    lastAnchorJson = json;
    var host = el("anchorItems");
    host.innerHTML = "";
    a.options.forEach(function (o) {
      var card = document.createElement("div");
      card.className = "opt" + (o.selected ? " sel" : "");
      card.innerHTML = "<div class='head'><span class='badge'>" + esc(o.letter) + "</span>"
        + (o.verdict ? "<span class='chip " + (o.verdict === "approve" ? "ok" : "") + "'>"
          + (o.verdict === "approve" ? "✔" : "✘") + "</span>" : "")
        + (o.selected ? "<span class='chip ok'>★</span>" : "") + "</div>"
        + "<div class='body'>" + esc(o.body) + "</div>";
      if (!a.done) {
        var pick = document.createElement("div");
        pick.className = "row";
        [["approve", "Aprovar", "okb"], ["reject", "Rejeitar", "nob"]].forEach(function (x) {
          var b = document.createElement("button");
          b.className = o.verdict === x[0] ? x[2] : "soft"; b.textContent = x[1];
          b.onclick = function () {
            api("POST", "/api/anchor-click", { anchorId: anchorId, letter: o.letter, action: x[0] })
              .then(function () { lastAnchorJson = ""; loadAnchor(true); });
          };
          pick.appendChild(b);
        });
        card.appendChild(pick);
      }
      host.appendChild(card);
    });
    var pickHost = el("anchorPick");
    pickHost.innerHTML = "";
    if (!a.done && a.allJudged && a.approvedLetters.length > 0) {
      a.approvedLetters.forEach(function (l) {
        var b = document.createElement("button");
        b.textContent = "Proposta " + l + " vence";
        b.onclick = function () {
          api("POST", "/api/anchor-click", { anchorId: anchorId, letter: l, action: "select" })
            .then(function () { lastAnchorJson = ""; anchorId = null;
              el("anchorItems").innerHTML = ""; el("anchorPick").innerHTML = "";
              lastMetricsJson = ""; refresh(); });
        };
        pickHost.appendChild(b);
      });
    }
    if (a.done) { el("anchorItems").innerHTML = ""; anchorId = null; }
    if (!quiet) el("anchorItems").scrollIntoView({ behavior: "smooth" });
  });
}
</script>
</body>
</html>
`;

// ---------------------------------------------------------------------------

function main(): void {
  let port = DEFAULT_PORT;
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--port") port = Number(argv[++i] ?? DEFAULT_PORT);
  }
  const server = createServer((req, res) => {
    void handle(req, res).catch((err) => {
      sendJson(res, 500, { error: err instanceof Error ? err.message : String(err) });
    });
  });
  server.on("error", (err: NodeJS.ErrnoException) => {
    if (err.code === "EADDRINUSE") {
      console.log(`governance dashboard already running — open http://localhost:${port}`);
      process.exit(0);
    }
    throw err;
  });
  server.listen(port, "127.0.0.1", () => {
    console.log(`AgentOS governance dashboard: http://localhost:${port}`);
    console.log(`(local only — nothing is exposed beyond this machine)`);
  });
}

main();
